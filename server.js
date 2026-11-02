import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { WebSocketServer,WebSocket } from 'ws';
import { player,start,act,view } from './game.js';
const rooms=new Map();
const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/effects.js':['effects.js','text/javascript'],'/style.css':['style.css','text/css'],'/favicon.svg':['favicon.svg','image/svg+xml']};
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
        if(!['create','join'].includes(data.type))throw Error('Join a room first.');
        if(typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>20)throw Error('Enter a name with 1–20 characters.');
        if(data.type==='create'){
          let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
          room={code,players:[],phase:'lobby',message:'Waiting for the crew.',turn:0,updated:Date.now()};rooms.set(code,room);
        }else{room=rooms.get(String(data.code).toUpperCase());if(!room)throw Error('Room not found. Check your code.');}
        me=room.players.find(p=>typeof data.token==='string'&&p.id===data.token);
        if(me){if(me.socket&&me.socket!==socket)me.socket.close(1000,'Reconnected elsewhere');}
        else{
          if(room.phase!=='lobby')throw Error('This game has already started.');
          if(room.players.length>=6)throw Error('This table is full.');
          me=player(data.name.trim());room.players.push(me);if(!room.host)room.host=me.id;
        }
        me.socket=socket;me.online=true;socket.send(JSON.stringify({type:'session',token:me.id,code:room.code}));
      }else if(data.type==='start'){
        if(me.id!==room.host)throw Error('Only the host can start the game.');
        if(room.players.some(p=>!p.online))throw Error('Wait for everyone to reconnect.');start(room);
      }else{act(room,me.id,data);}
      room.updated=Date.now();broadcast(room);
    }catch(error){socket.send(JSON.stringify({type:'error',message:error.message||'Invalid request.'}));}
  });
  socket.on('close',()=>{if(me?.socket===socket){me.online=false;me.socket=null;if(room.phase==='lobby'){room.players=room.players.filter(p=>p!==me);if(room.host===me.id)room.host=room.players[0]?.id;}room.updated=Date.now();broadcast(room);}});
});
setInterval(()=>{for(const socket of wss.clients){if(!socket.alive){socket.terminate();continue;}socket.alive=false;socket.ping();}for(const [code,room]of rooms)if(room.players.every(p=>!p.online)&&Date.now()-room.updated>3600000)rooms.delete(code);},30000).unref();
const port=Number(process.env.PORT)||3000;server.listen(port,'0.0.0.0',()=>console.log(`No Mercy is ready at http://localhost:${port}`));
