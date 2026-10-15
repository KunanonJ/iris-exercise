import { DatabaseSync } from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../../db/migrations/0001_suite_v2.sql',import.meta.url),'utf8'));
 const wrap=(query,params=[])=>({bind(...values){return wrap(query,values);},async first(){return sql.prepare(query).get(...params)??null;},async all(){return {results:sql.prepare(query).all(...params)};},async run(){const r=sql.prepare(query).run(...params);return {success:true,meta:{changes:Number(r.changes)}};},_run(){return sql.prepare(query).run(...params);}});
 return {prepare:q=>wrap(q),async batch(stmts){sql.exec('BEGIN IMMEDIATE');try{const r=stmts.map(s=>s._run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}},sql};
}