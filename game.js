import { randomInt, randomUUID } from 'node:crypto';
export const colors = ['red','yellow','green','blue'];
export function shuffle(cards) {
  for (let i=cards.length-1;i>0;i--) { const j=randomInt(i+1); [cards[i],cards[j]]=[cards[j],cards[i]]; }
  return cards;
}
export function deck() {
  let id=0;
  return shuffle([...colors.flatMap(color=>[...Array.from({length:10},(_,i)=>String(i)),'skip','reverse','+2','+4'].flatMap(value=>[0,1].map(()=>({id:String(id++),color,value})))),...['+6','+10','wild'].flatMap(value=>Array.from({length:8},()=>({id:String(id++),color:'wild',value}))) ]);
}
export function player(name) { return {id:randomUUID(),name,hand:[],out:false}; }
export function start(room) {
  if(room.phase==='playing') throw Error('This game has already started.');
  if(room.players.length<2) throw Error('You need at least two players.');
  room.deck=deck(); room.discard=[]; room.direction=1; room.turn=0; room.penalty=0; room.winner=null;
  for(const p of room.players) { p.out=false; p.hand=room.deck.splice(0,7); }
  const first=room.deck.findIndex(c=>/^\d$/.test(c.value));
  room.discard.push(...room.deck.splice(first,1)); room.color=room.discard[0].color; room.phase='playing'; room.message='The table is open. No holding back.';
}
export function top(room) { return room.discard.at(-1); }
export function canPlay(room,card) {
  if(room.penalty) return card.value.startsWith('+') && Number(card.value.slice(1))>=Number(top(room).value.slice(1));
  return card.color==='wild'||card.color===room.color||card.value===top(room).value;
}
function advance(room,steps=1) {
  for(let i=0;i<steps;i++) do { room.turn=(room.turn+room.direction+room.players.length)%room.players.length; } while(room.players[room.turn].out);
}
function finish(room) {
  const active=room.players.filter(p=>!p.out);
  const winner=active.find(p=>p.hand.length===0)||(active.length===1?active[0]:null);
  if(winner) {room.phase='finished';room.winner=winner.name;room.message=`${winner.name} takes the table.`;return true;} return false;
}
function take(room,p,count) {
  for(let i=0;i<count;i++) {
    if(!room.deck.length) { const last=room.discard.pop();room.deck=shuffle(room.discard);room.discard=[last]; }
    if(!room.deck.length) break;
    p.hand.push(room.deck.pop());
    if(p.hand.length>=25) {p.out=true;room.message=`${p.name} hit 25 cards. Mercy rule: eliminated.`;break;}
  }
}
export function act(room,id,data) {
  const p=room.players[room.turn];
  if(room.phase!=='playing'||p.id!==id) throw Error('Wait for your turn.');
  if(data.type==='draw') {
    const count=room.penalty||1; room.message=`${p.name} drew ${count} card${count===1?'':'s'}.`;take(room,p,count);room.penalty=0;
    // shortcut: a normal draw ends the turn, add draw-until-playable when implementing the full official rules.
    if(!finish(room)) advance(room);return;
  }
  if(data.type!=='play') throw Error('Unknown move.');
  const index=p.hand.findIndex(c=>c.id===data.cardId),card=p.hand[index];
  if(!card||!canPlay(room,card)) throw Error('That card cannot be played here.');
  if(card.color==='wild'&&!colors.includes(data.color)) throw Error('Choose a color first.');
  p.hand.splice(index,1);room.discard.push(card);room.color=card.color==='wild'?data.color:card.color;
  room.message=`${p.name} played ${card.value==='wild'?'a Wild':card.value}.`;
  if(card.value.startsWith('+')) room.penalty+=Number(card.value.slice(1));
  if(card.value==='reverse') room.direction*=-1;
  if(finish(room))return;
  advance(room,card.value==='skip'||(card.value==='reverse'&&room.players.filter(p=>!p.out).length===2)?2:1);
}
export function view(room,id) {
  return {code:room.code,phase:room.phase,host:room.host,you:id,players:room.players.map(p=>({id:p.id,name:p.name,count:p.hand.length,out:p.out,online:p.online,hand:p.id===id?p.hand:undefined})),turn:room.players[room.turn]?.id,top:room.discard?.at(-1),color:room.color,penalty:room.penalty||0,direction:room.direction||1,message:room.message,winner:room.winner};
}
