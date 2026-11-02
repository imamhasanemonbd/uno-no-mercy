import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
// Keep local tooling state out of account configuration; no Cloudflare login is needed.
process.env.WRANGLER_LOG_PATH??=join(tmpdir(),'nomercy-worker-tests.log');
process.env.WRANGLER_SEND_METRICS='false';
process.env.XDG_CONFIG_HOME??=join(tmpdir(),'nomercy-cloudflare-tests');
const {unstable_dev}=await import('wrangler');
test('Cloudflare rooms isolate private hands and survive runtime restarts', {timeout:60000},async()=>{
 const storage=await mkdtemp(join(tmpdir(),'nomercy-durable-test-'));let worker;const sockets=[];
 async function launch(){return unstable_dev('worker.js',{config:'wrangler.jsonc',port:0,inspectorPort:0,local:true,persist:true,persistTo:storage,logLevel:'error',experimental:{disableExperimentalWarning:true,watch:false,disableDevRegistry:true}});}
 async function client(path){
  const socket=new WebSocket(`ws://${worker.address}:${worker.port}${path}`);sockets.push(socket);const queue=[],waiters=[];
  socket.on('error',()=>{});socket.on('message',raw=>{const data=JSON.parse(raw);const index=waiters.findIndex(w=>w.type===data.type);if(index>=0)waiters.splice(index,1)[0].resolve(data);else queue.push(data);});await once(socket,'open');
  return {socket,send:data=>socket.send(JSON.stringify(data)),next:type=>{const index=queue.findIndex(d=>d.type===type);if(index>=0)return Promise.resolve(queue.splice(index,1)[0]);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`Waiting for ${type}`)),5000);waiters.push({type,resolve:data=>{clearTimeout(timer);resolve(data);}});});}};
 }
 try{
  worker=await launch();
  assert.equal((await worker.fetch('/')).status,200);assert.equal((await worker.fetch('/rules.js')).status,200);assert.equal((await worker.fetch('/room/new')).status,426);
  const a=await client('/room/new');a.send({type:'create',name:'Alice'});const session=await a.next('session');const lobby=(await a.next('state')).state;assert.notEqual(session.token,lobby.you);
  const b=await client(`/room/${session.code}`);b.send({type:'join',code:session.code,name:'Bob'});const bob=await b.next('session');await b.next('state');await a.next('state');
  b.send({type:'start'});assert.match((await b.next('error')).message,/host/);
  a.send({type:'start'});const sa=(await a.next('state')).state,sb=(await b.next('state')).state;assert.equal(sa.phase,'playing');assert.equal(sa.players[0].hand.length,7);assert.equal(sa.players[1].hand,undefined);assert.equal(sb.players[0].hand,undefined);assert.equal(sb.players[1].hand.length,7);assert.equal(JSON.stringify(sa).includes(bob.token),false);
  const impostor=await client(`/room/${session.code}`);impostor.send({type:'join',code:session.code,name:'Fake',token:sb.you});assert.match((await impostor.next('error')).message,/already started/);
  const isolated=await client('/room/new');isolated.send({type:'create',name:'Other room'});await isolated.next('session');const other=(await isolated.next('state')).state;assert.equal(other.players.length,1);assert.notEqual(other.code,session.code);
  // Stop the runtime, then reload the same SQLite storage to prove persistence.
  for(const ws of sockets)ws.terminate();await worker.stop();worker=await launch();
  const restored=await client(`/room/${session.code}`);restored.send({type:'join',name:'Alice',code:session.code,token:session.token});await restored.next('session');const sr=(await restored.next('state')).state;assert.equal(sr.phase,'playing');assert.equal(sr.you,sa.you);assert.deepEqual(sr.players[0].hand,sa.players[0].hand);assert.equal(sr.players[1].hand,undefined);
  const resumedBob=await client(`/room/${session.code}`);resumedBob.send({type:'join',name:'Bob',code:session.code,token:bob.token});await resumedBob.next('session');await resumedBob.next('state');await restored.next('state');
  const denied=await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://${worker.address}:${worker.port}/room/new`,{origin:'https://evil.example'});sockets.push(ws);ws.on('error',()=>{});ws.on('unexpected-response',(_request,response)=>{response.resume();resolve(response.statusCode);});ws.on('open',()=>reject(Error('Cross-origin connection was accepted')));});assert.equal(denied,403);
  const missing=await client('/room/000000');missing.send({type:'join',code:'000000',name:'Missing'});assert.match((await missing.next('error')).message,/Room not found/);
 }finally{for(const ws of sockets)ws.terminate();await worker?.stop();await rm(storage,{recursive:true,force:true});}
});
