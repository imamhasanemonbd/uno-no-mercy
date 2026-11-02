import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
test('real clients create, join, start, enforce host and reconnect with private hands',async()=>{
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3099'},stdio:['ignore','pipe','pipe']});
 const sockets=[];
 try{
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited with code ${code}`);}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server did not start')),5000).unref())]);
  async function client(){const ws=new WebSocket('ws://localhost:3099');sockets.push(ws);const queue=[],waiters=[];ws.on('message',raw=>{const data=JSON.parse(raw);const i=waiters.findIndex(w=>w.type===data.type);if(i>=0)waiters.splice(i,1)[0].resolve(data);else queue.push(data);});await once(ws,'open');return{ws,send:data=>ws.send(JSON.stringify(data)),next:type=>{const i=queue.findIndex(d=>d.type===type);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`Waiting for ${type}`)),3000);waiters.push({type,resolve:d=>{clearTimeout(timer);resolve(d);}});});}};}
  const a=await client();a.send({type:'create',name:'Alice'});const session=await a.next('session');await a.next('state');
  const b=await client();b.send({type:'join',name:'Bob',code:session.code});await b.next('session');await b.next('state');await a.next('state');
  b.send({type:'start'});assert.match((await b.next('error')).message,/host/);
  a.send({type:'start'});const sa=(await a.next('state')).state,sb=(await b.next('state')).state;assert.equal(sa.phase,'playing');assert.equal(sa.players[0].hand.length,7);assert.equal(sa.players[1].hand,undefined);assert.equal(sb.players[0].hand,undefined);assert.equal(sb.players[1].hand.length,7);
  const late=await client();late.send({type:'join',name:'Late',code:session.code});assert.match((await late.next('error')).message,/started/);
  const re=await client();re.send({type:'join',name:'Alice',code:session.code,token:session.token});await re.next('session');const restored=(await re.next('state')).state;assert.equal(restored.you,sa.you);assert.deepEqual(restored.players[0].hand,sa.players[0].hand);
  const response=await fetch('http://localhost:3099/');assert.equal(response.status,200);assert.match(await response.text(),/No Mercy/);assert.equal((await fetch('http://localhost:3099/..%2Fserver.js')).status,404);
 }finally{for(const ws of sockets)ws.terminate();if(server.exitCode===null){server.kill();await once(server,'exit');}}
});
