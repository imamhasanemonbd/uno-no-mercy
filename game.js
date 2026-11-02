import { randomInt, randomUUID } from 'node:crypto';
import {drawValue,playableCard,cardNames} from './public/rules.js';
export const colors = ['red','yellow','green','blue'];
export function shuffle(cards) {
  for (let i=cards.length-1;i>0;i--) { const j=randomInt(i+1); [cards[i],cards[j]]=[cards[j],cards[i]]; }
  return cards;
}
export function deck() {
 let id=0;const cards=[];
 const add=(color,value,count)=>{for(let i=0;i<count;i++)cards.push({id:String(id++),color,value});};
 for(const color of colors){
  for(let n=0;n<=9;n++)add(color,String(n),2);
  for(const value of ['skip','reverse','+2','discard'])add(color,value,3);
  for(const value of ['+4','skip-all'])add(color,value,2);
 }
 for(const [value,count] of [['reverse+4',8],['roulette',8],['+6',4],['+10',4]])add('wild',value,count);
 return shuffle(cards);
}
export function player(name) { return {id:randomUUID(),name,hand:[],out:false}; }
function event(room,type,actor,details={}){room.event={id:(room.event?.id||0)+1,type,actor,draws:[],...details};}
export function start(room) {
 if(room.phase==='playing')throw Error('This game has already started.');
 if(room.players.length<2)throw Error('You need at least two players.');
 Object.assign(room,{deck:deck(),discard:[],retired:[],direction:1,turn:0,penalty:0,winner:null,pending:null,drawn:null,unoPending:[]});
 for(const p of room.players){p.out=false;p.hand=room.deck.splice(0,7);}
 // Initial action cards are ignored, as instructed by the base-game rules.
 do{room.discard.push(room.deck.pop());}while(!/^\d$/.test(top(room).value));
 room.color=top(room).color;room.phase='playing';room.message='Your turn.';event(room,'deal',room.host);
}
export function top(room){return room.discard?.at(-1);}
export function canPlay(room,card){return playableCard({...room,top:top(room)},card);}
function advance(room,steps=1){
 for(let i=0;i<steps;i++)do{room.turn=(room.turn+room.direction+room.players.length)%room.players.length;}while(room.players[room.turn].out);
}
function finish(room){
 const active=room.players.filter(p=>!p.out);
 const winner=active.find(p=>p.hand.length===0)||(active.length===1?active[0]:null);
 if(!winner)return false;
 room.phase='finished';room.winner=winner.name;room.message=`${winner.name} wins!`;room.pending=null;room.drawn=null;room.unoPending=[];return true;
}
function nextCard(room){
 if(!room.deck.length){const last=room.discard.pop();room.deck=shuffle([...room.discard,...(room.retired||[])]);room.retired=[];room.discard=[last];}
 return room.deck.pop();
}
function take(room,p,count,stop=()=>false){
 let taken=0,last;
 while(taken<count){
  last=nextCard(room);if(!last)break;p.hand.push(last);taken++;
  if(room.event.type==='roulette')(room.event.revealed??=[]).push({...last});
  if(p.hand.length>=25){p.out=true;(room.retired??=[]).push(...p.hand);p.hand=[];room.unoPending=(room.unoPending||[]).filter(id=>id!==p.id);break;}
  if(stop(last))break;
 }
 if(taken)room.event.draws.push({id:p.id,count:taken});
 return last;
}
function markUno(room,p,called){room.unoPending=p.hand.length===1&&!p.out&&!called?[p.id]:[];}
function endTurn(room){room.drawn=null;if(!finish(room))advance(room);}
export function act(room,id,data){
 if(room.phase!=='playing')throw Error('The game is not in progress.');
 const actor=room.players.find(p=>p.id===id);
 if(!actor||actor.out)throw Error('You are not in this round.');
 if(data.type==='uno'){
  if(!room.unoPending?.includes(id))throw Error('No UNO call needed.');room.unoPending=room.unoPending.filter(other=>other!==id);event(room,'uno',id);room.message=`${actor.name}: UNO!`;return;
 }
 if(data.type==='catch'){
  const target=room.players.find(p=>p.id!==id&&room.unoPending?.includes(p.id)&&(data.target===undefined||data.target===p.id));
  if(!target||target.id===id)throw Error('Nobody to catch.');
  event(room,'catch',id,{target:target.id});take(room,target,2);room.unoPending=room.unoPending.filter(other=>other!==target.id);room.message=`${target.name} missed UNO. +2`;finish(room);return;
 }
 const p=room.players[room.turn];if(p.id!==id)throw Error('Wait for your turn.');
 if(room.pending){
  if(room.pending.type!=='roulette'||data.type!=='color'||!colors.includes(data.color))throw Error('Choose a roulette color.');
  event(room,'roulette',id,{color:data.color});room.unoPending=[];room.pending=null;room.color=data.color;
  take(room,p,25-p.hand.length,c=>c.color===data.color);room.message=`${p.name}: roulette ${data.color}.`;endTurn(room);return;
 }
 if(data.type==='draw'){
  if(room.drawn)throw Error('Play the card you just drew.');
  if(!room.penalty&&p.hand.some(c=>canPlay(room,c)))throw Error('You have a playable card.');
  event(room,'draw',id);room.unoPending=[];
  if(room.penalty){const count=room.penalty;take(room,p,count);room.penalty=0;room.message=`${p.name} drew ${room.event.draws[0]?.count||0}.`;endTurn(room);return;}
  const drawn=take(room,p,25-p.hand.length,c=>canPlay(room,c));
  if(!p.out&&drawn&&canPlay(room,drawn)){room.drawn=drawn.id;room.message=`${p.name}: play the drawn card.`;}
  else endTurn(room);
  return;
 }
 if(data.type!=='play')throw Error('Unknown move.');
 const index=p.hand.findIndex(c=>c.id===data.cardId),card=p.hand[index];
 if(!card||!canPlay(room,card))throw Error('That card cannot be played here.');
 if(card.color==='wild'&&card.value!=='roulette'&&!colors.includes(data.color))throw Error('Choose a color first.');
 const target=room.players.find(other=>other.id===data.target&&!other.out&&other.id!==id);
 if(card.value==='7'&&p.hand.length>1&&!target)throw Error('Choose a player to swap with.');
 room.unoPending=[];room.drawn=null;event(room,'play',id,{card:{...card}});p.hand.splice(index,1);
 if(card.value==='discard'){
  const extra=p.hand.filter(c=>c.color===card.color);room.discard.push(...extra);p.hand=p.hand.filter(c=>c.color!==card.color);room.event.discarded=extra.length+1;
 }
 room.discard.push(card);room.color=card.color==='wild'?(data.color||room.color):card.color;
 room.message=`${p.name}: ${cardNames[card.value]||card.value}`;
 // Going out wins immediately, including on a final 0 or 7.
 if(finish(room))return;
 if(card.value==='7'){
  [p.hand,target.hand]=[target.hand,p.hand];room.event.target=target.id;room.event.transfer='swap';
 }else if(card.value==='0'){
  const active=room.players.filter(p=>!p.out),hands=active.map(p=>p.hand);
  active.forEach((p,i)=>{p.hand=hands[(i-room.direction+active.length)%active.length];});room.event.transfer='pass';
 }
 if(drawValue(card))room.penalty+=drawValue(card);
 if(card.value==='reverse'||card.value==='reverse+4')room.direction*=-1;
 markUno(room,p,data.uno===true);
 if(card.value==='7'&&target.hand.length===1)room.unoPending.push(target.id);
 if(card.value==='0')room.unoPending=room.players.filter(other=>!other.out&&other.hand.length===1&&!(other.id===id&&data.uno===true)).map(other=>other.id);
 if(card.value==='skip-all')return;
 const two=room.players.filter(p=>!p.out).length===2;
 if(card.value==='skip'){
  advance(room);room.event.target=room.players[room.turn].id;advance(room);
 }else if(two&&(card.value==='reverse'||card.value==='reverse+4'))advance(room,2);
 else advance(room);
 if(card.value==='roulette')room.pending={type:'roulette',player:room.players[room.turn].id};
}
export function view(room,id){
 return {code:room.code,phase:room.phase,host:room.host,you:id,players:room.players.map(p=>({id:p.id,name:p.name,count:p.hand.length,out:p.out,online:p.online,hand:p.id===id?p.hand:undefined})),turn:room.players[room.turn]?.id,top:top(room),color:room.color,penalty:room.penalty||0,direction:room.direction||1,message:room.message,winner:room.winner,pending:room.pending||null,drawn:room.players[room.turn]?.id===id?room.drawn:null,unoPending:room.unoPending||[],event:room.event};
}
