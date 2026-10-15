import { HttpError } from "../lib/suite-domain";
export async function readJson(req:Request,limit=32768):Promise<unknown> {
 const chunks:Uint8Array[]=[];let total=0;const reader=req.body?.getReader();
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw new HttpError(413,"Request is too large");}chunks.push(value);}
 const bytes=new Uint8Array(total);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,"Invalid JSON");}
}
