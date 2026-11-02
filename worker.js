import {DurableObject} from 'cloudflare:workers';
import {randomBytes} from 'node:crypto';
import {view} from './game.js';
import {newRoom,joinRoom,move,leaveRoom} from './room.js';
const ROOM_TTL=60*60*1000;

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/room/'))return env.ASSETS.fetch(request);
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const origin=request.headers.get('Origin');
  try{if(origin&&new URL(origin).origin!==url.origin)return new Response('Invalid origin',{status:403});}catch{return new Response('Invalid origin',{status:403});}
  const requested=url.pathname.slice(6).toUpperCase(),creating=requested==='NEW';
  if(!creating&&!/^[A-F0-9]{6}$/.test(requested))return new Response('Invalid room code',{status:400});
  for(let attempt=0;attempt<5;attempt++){
   const code=creating?randomBytes(3).toString('hex').toUpperCase():requested;
   const target=new URL(request.url);target.pathname=`/room/${code}`;
   const forwarded=new Request(target,request);forwarded.headers.set('X-Create-Room',creating?'1':'0');
   const response=await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(forwarded);
   if(response.status!==409||!creating)return response;
  }
  return new Response('Try creating a room again',{status:503});
 }
};

export class GameRoom extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);
  ctx.blockConcurrencyWhile(async()=>{
   this.room=await ctx.storage.get('room')||null;
   if(this.room){const online=new Set(ctx.getWebSockets().filter(ws=>ws.readyState===1).map(ws=>ws.deserializeAttachment()?.id));for(const p of this.room.players)p.online=online.has(p.id);}
  });
 }
 async fetch(request){
  const code=new URL(request.url).pathname.slice(6),creating=request.headers.get('X-Create-Room')==='1';
  if(creating){
   if(this.room)return new Response('Room code in use',{status:409});
   this.room=newRoom(code);await this.save();
  }
  // Bound abandoned handshakes without keeping this object awake with timers.
  for(const ws of this.ctx.getWebSockets()){const meta=ws.deserializeAttachment();if(!meta.id&&Date.now()-meta.connected>30000)ws.close(1008,'Join timeout');}
  if(this.ctx.getWebSockets().filter(ws=>ws.readyState===1).length>=12)return new Response('Too many connections',{status:429});
  const [client,server]=Object.values(new WebSocketPair());
  this.ctx.acceptWebSocket(server);
  server.serializeAttachment({id:null,creating,connected:Date.now(),windowStart:Date.now(),messages:0});
  return new Response(null,{status:101,webSocket:client});
 }
 async save(){
  this.room.updated=Date.now();
  await this.ctx.storage.put('room',this.room);
  await this.ctx.storage.setAlarm(this.room.updated+ROOM_TTL);
 }
 broadcast(){
  if(!this.room)return;
  for(const ws of this.ctx.getWebSockets()){
   const id=ws.deserializeAttachment()?.id;
   if(id&&ws.readyState===1)ws.send(JSON.stringify({type:'state',state:view(this.room,id)}));
  }
 }
 async webSocketMessage(ws,message){
  if(typeof message!=='string'){ws.close(1003,'Text messages required');return;}
  if(new TextEncoder().encode(message).byteLength>2048){ws.close(1009,'Message too large');return;}
  const meta=ws.deserializeAttachment();
  if(Date.now()-meta.windowStart>1000){meta.windowStart=Date.now();meta.messages=0;}
  meta.messages++;ws.serializeAttachment(meta);
  if(meta.messages>15){ws.send(JSON.stringify({type:'error',message:'Slow down a moment.'}));return;}
  try{
   const data=JSON.parse(message);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid message.');
   let session;
   if(!meta.id){
    if(data.type==='create'&&!meta.creating)throw Error('Create a new room first.');
    const me=joinRoom(this.room,data);
    for(const old of this.ctx.getWebSockets())if(old!==ws&&old.deserializeAttachment()?.id===me.id){const oldMeta=old.deserializeAttachment();old.serializeAttachment({...oldMeta,id:null});old.close(1000,'Reconnected elsewhere');}
    meta.id=me.id;meta.creating=false;ws.serializeAttachment(meta);session={type:'session',token:me.token,code:this.room.code};
   }else move(this.room,meta.id,data);
   await this.save();
   if(session)ws.send(JSON.stringify(session));
   this.broadcast();
  }catch(error){ws.send(JSON.stringify({type:'error',message:error.message||'Invalid request.'}));}
 }
 async disconnected(ws){
  const id=ws.deserializeAttachment()?.id;
  if(!id||!this.room)return;
  ws.serializeAttachment({...ws.deserializeAttachment(),id:null});
  if(this.ctx.getWebSockets().some(other=>other!==ws&&other.readyState===1&&other.deserializeAttachment()?.id===id))return;
  leaveRoom(this.room,id);await this.save();this.broadcast();
 }
 async webSocketClose(ws){await this.disconnected(ws);}
 async webSocketError(ws){ws.close(1011,'Connection error');await this.disconnected(ws);}
 async alarm(){
  if(!this.room)return;
  if(this.ctx.getWebSockets().some(ws=>ws.readyState===1&&ws.deserializeAttachment()?.id)){await this.ctx.storage.setAlarm(Date.now()+ROOM_TTL);return;}
  if(Date.now()-this.room.updated<ROOM_TTL){await this.ctx.storage.setAlarm(this.room.updated+ROOM_TTL);return;}
  for(const ws of this.ctx.getWebSockets())ws.close(1001,'Room expired');
  await this.ctx.storage.deleteAll();this.room=null;
 }
}
