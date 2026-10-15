import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, requireOrigin } from '../src/server/auth.ts';
const origin='http://localhost:3000';
const issuer='https://unit.clerk.accounts.dev';
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const der=Buffer.from(await crypto.subtle.exportKey('spki',keys.publicKey)).toString('base64');
const pem=`-----BEGIN PUBLIC KEY-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
const DB={prepare(){return {bind(){return this;},async all(){return {results:[{tenant_id:'fixture',employee_id:'E0001',role:'employee'}]};}};}};
const env={CLERK_PUBLISHABLE_KEY:`pk_test_${Buffer.from('unit.clerk.accounts.dev$').toString('base64')}`,CLERK_JWT_KEY:pem,CLERK_ISSUER_URL:issuer,APP_ORIGINS:origin,DB};
async function token(extra={}){
 const now=Math.floor(Date.now()/1000);
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const content=`${encode({alg:'RS256',typ:'JWT',kid:'fixture'})}.${encode({v:2,sub:'user_fixture',sid:'sess_fixture',iss:issuer,azp:origin,iat:now,nbf:now-1,exp:now+60,sts:'active',...extra})}`;
 return `${content}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(content))).toString('base64url')}`;
}
const request=t=>new Request('http://localhost:8787/api/state',{headers:{Authorization:`Bearer ${t}`}});
test('Clerk SDK verifies a signed fixture session and D1 supplies its role',async()=>{
 const p=await authenticate(request(await token()),env);assert.equal(p.userId,'user_fixture');assert.equal(p.role,'employee');
});
for(const [name,claims] of [['pending session',{sts:'pending'}],['machine identity',{sub:'mch_fixture',sid:undefined}],['expired',{exp:1}],['wrong issuer',{iss:'https://other.clerk.accounts.dev'}],['wrong authorized party',{azp:'https://untrusted.example'}],['missing authorized party',{azp:undefined}],['future token',{nbf:Math.floor(Date.now()/1000)+3600}]]){
 test(`Clerk rejects ${name}`,async()=>{await assert.rejects(authenticate(request(await token(claims)),env),e=>e.status===401);});
}
test('missing bearer and missing auth configuration fail closed',async()=>{
 await assert.rejects(authenticate(new Request('http://localhost/api/state'),env),e=>e.status===401);
 await assert.rejects(authenticate(request(await token()),{}),e=>e.status===503);
});
test('mutations require the configured origin and JSON content type',()=>{
 assert.throws(()=>requireOrigin(new Request('http://localhost/api/commands',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'}}),env),e=>e.status===403);
 assert.throws(()=>requireOrigin(new Request('http://localhost/api/commands',{method:'POST',headers:{origin}}),env),e=>e.status===415);
});
