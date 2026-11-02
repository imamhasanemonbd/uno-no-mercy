import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { WebSocketServer,WebSocket } from 'ws';
import {view} from './game.js';
import {newRoom,joinRoom,move,leaveRoom} from './room.js';
const rooms=new Map();
const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/effects.js':['effects.js','text/javascript'],'/rules.js':['rules.js','text/javascript'],'/style.css':['style.css','text/css'],'/favicon.svg':['favicon.svg','image/svg+xml']};
const server=createServer(async(req,res)=>{
  const file=files[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try{res.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(await readFile(new URL(`./public/${file[0]}`,import.meta.url)));}catch{res.writeHead(500);res.end('Unable to load page');}
});
const wss=new WebSocketServer({server,maxPayload:2048});
function broadcast(room){for(const p of room.players)if(p.socket?.readyState===WebSocket.OPEN)p.socket.send(JSON.stringify({type:'state',state:view(room,p.id)}));}
wss.on('connection',(socket,req)=>{
  const origin=req.headers.origin;
  try{if(origin&&new URL(origin).host!==req.headers.host){socket.close(1008,'Invalid origin');return;}}catch{socket.close(1008,'Invalid origin');return;}
  let room,me,windowStart=Date.now(),messages=0;
  socket.alive=true;socket.on('pong',()=>{socket.alive=true;});
  socket.on('message',raw=>{
    try{
      if(Date.now()-windowStart>1000){windowStart=Date.now();messages=0;}if(++messages>15)throw Error('Slow down a moment.');
      const data=JSON.parse(raw.toString());
      if(!data||typeof data!=='object')throw Error('Invalid message.');
      if(!me){
        if(data.type==='create'){
          let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
          room=newRoom(code);rooms.set(code,room);
        }else room=rooms.get(String(data.code).toUpperCase());
        me=joinRoom(room,data);
        if(me.socket&&me.socket!==socket)me.socket.close(1000,'Reconnected elsewhere');
        me.socket=socket;me.online=true;socket.send(JSON.stringify({type:'session',token:me.token,code:room.code}));
      }else move(room,me.id,data);
      room.updated=Date.now();broadcast(room);
    }catch(error){socket.send(JSON.stringify({type:'error',message:error.message||'Invalid request.'}));}
  });
  socket.on('close',()=>{if(me?.socket===socket){me.socket=null;leaveRoom(room,me.id);room.updated=Date.now();broadcast(room);}});
});
setInterval(()=>{for(const socket of wss.clients){if(!socket.alive){socket.terminate();continue;}socket.alive=false;socket.ping();}for(const [code,room]of rooms)if(room.players.every(p=>!p.online)&&Date.now()-room.updated>3600000)rooms.delete(code);},30000).unref();
const port=Number(process.env.PORT)||3000;server.listen(port,'0.0.0.0',()=>console.log(`No Mercy is ready at http://localhost:${port}`));
