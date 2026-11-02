import {player,start,act} from './game.js';
export function newRoom(code){return {code,players:[],phase:'lobby',message:'Waiting for the crew.',turn:0,updated:Date.now()};}
export function joinRoom(room,data){
 if(!['create','join'].includes(data.type))throw Error('Join a room first.');
 if(typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>20)throw Error('Enter a name with 1–20 characters.');
 if(!room)throw Error('Room not found. Check your code.');
 let me=room.players.find(p=>typeof data.token==='string'&&p.token===data.token);
 if(!me){
  if(room.phase!=='lobby')throw Error('This game has already started.');
  if(room.players.length>=6)throw Error('This table is full.');
  me=player(data.name.trim());room.players.push(me);if(!room.host)room.host=me.id;
 }
 me.online=true;return me;
}
export function move(room,id,data){
 if(data.type==='start'){
  if(id!==room.host)throw Error('Only the host can start the game.');
  if(room.players.some(p=>!p.online))throw Error('Wait for everyone to reconnect.');
  start(room);
 }else act(room,id,data);
}
export function leaveRoom(room,id){
 const me=room.players.find(p=>p.id===id);if(!me)return;
 me.online=false;
 if(room.phase==='lobby'){room.players=room.players.filter(p=>p!==me);if(room.host===id)room.host=room.players[0]?.id;}
}
