import{createServer}from'node:http';import{randomBytes,timingSafeEqual}from'node:crypto';import{validateEvent}from'./contracts.mjs';
export async function startBridge({onEvent,port=0,token=randomBytes(32).toString('hex')}){
 const server=createServer((req,res)=>{
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  if(req.headers.origin){reply(403,{error:'Browser origins are not accepted'});return}
  if(req.method==='GET'&&req.url==='/health'){reply(200,{ok:true,service:'agent-meter'});return}
  if(req.method!=='POST'||req.url!=='/v1/events'){reply(404,{error:'Not found'});return}
  const provided=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,'')),expected=Buffer.from(token);
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected)){reply(401,{error:'Unauthorized'});return}
  if(!String(req.headers['content-type']).startsWith('application/json')){reply(415,{error:'JSON required'});return}
  let size=0,chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>32768){reply(413,{error:'Event too large'});req.destroy();return}chunks.push(chunk)});
  req.on('end',()=>{if(res.writableEnded)return;try{let event=validateEvent(JSON.parse(Buffer.concat(chunks).toString('utf8')));onEvent(event);reply(202,{accepted:true})}catch{reply(400,{error:'Invalid event'})}});
 });server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 return {port:server.address().port,token,close:()=>new Promise(resolve=>server.close(resolve))};
}
