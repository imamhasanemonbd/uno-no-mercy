import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,player,start,act,view,canPlay} from '../game.js';
const c=(id,color,value)=>({id,color,value});
function table(){const a=player('A'),b=player('B'),d=player('C');const room={players:[a,b,d],host:a.id,code:'ABCDEF',phase:'lobby'};start(room);room.color='red';room.discard=[c('top','red','5')];return room;}
test('deck has unique IDs and start deals private hands',()=>{const cards=deck();assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);const r=table();assert.equal(r.players[0].hand.length,7);const visible=view(r,r.players[0].id);assert.equal(visible.players[1].hand,undefined);assert.equal(visible.players[0].hand.length,7);assert.equal(JSON.stringify(visible).includes('deck'),false);});
test('invalid moves cannot change state',()=>{const r=table();const a=r.players[0];a.hand=[c('x','blue','3'),c('y','red','8')];assert.throws(()=>act(r,a.id,{type:'play',cardId:'x'}));assert.throws(()=>act(r,r.players[1].id,{type:'draw'}));assert.equal(a.hand.length,2);assert.equal(r.turn,0);});
test('draw penalties stack only equal or higher, then draw and end turn',()=>{const r=table();r.players[0].hand=[c('x','red','+4'),c('keep','red','0')];r.players[1].hand=[c('y','wild','+10'),c('keep2','blue','0')];act(r,r.players[0].id,{type:'play',cardId:'x'});assert.equal(r.penalty,4);assert.equal(canPlay(r,c('bad','red','+2')),false);act(r,r.players[1].id,{type:'play',cardId:'y',color:'green'});assert.equal(r.penalty,14);assert.equal(r.color,'green');const count=r.players[2].hand.length;act(r,r.players[2].id,{type:'draw'});assert.equal(r.players[2].hand.length,count+14);assert.equal(r.penalty,0);assert.equal(r.turn,0);});
test('wild requires valid color and preserves the hand on failure',()=>{const r=table();r.players[0].hand=[c('x','wild','+10'),c('keep','red','0')];assert.throws(()=>act(r,r.players[0].id,{type:'play',cardId:'x',color:'purple'}));assert.equal(r.players[0].hand.length,2);});
test('reverse and skip move to the correct player',()=>{const r=table();r.players[0].hand=[c('x','red','reverse'),c('y','red','0')];act(r,r.players[0].id,{type:'play',cardId:'x'});assert.equal(r.turn,2);r.players[2].hand=[c('s','red','skip'),c('stay','green','3')];act(r,r.players[2].id,{type:'play',cardId:'s'});assert.equal(r.turn,0);});
test('25 cards eliminates a player and turn skips their seat',()=>{const r=table();r.players[0].hand=Array.from({length:24},(_,i)=>c(`h${i}`,'blue','1'));act(r,r.players[0].id,{type:'draw'});assert.equal(r.players[0].out,true);assert.equal(r.turn,1);});
test('playing the last card wins and rematch resets eliminations',()=>{const r=table();r.players[0].hand=[c('win','red','5')];act(r,r.players[0].id,{type:'play',cardId:'win'});assert.equal(r.phase,'finished');assert.equal(r.winner,'A');start(r);assert.equal(r.phase,'playing');assert.equal(r.winner,null);assert.ok(r.players.every(p=>p.hand.length===7&&!p.out));});
test('last remaining player wins on elimination',()=>{const r=table();r.players[2].out=true;r.players[0].hand=Array.from({length:24},(_,i)=>c(`h${i}`,'blue','1'));act(r,r.players[0].id,{type:'draw'});assert.equal(r.winner,'B');});
test('two-player reverse gives the same player another turn',()=>{const r=table();r.players.pop();r.players[0].hand=[c('rev','red','reverse'),c('keep','red','8')];act(r,r.players[0].id,{type:'play',cardId:'rev'});assert.equal(r.turn,0);});
test('deck refills without reusing the visible discard',()=>{const r=table();r.players[0].hand=[c('keep','blue','3')];r.penalty=1;r.deck=[];r.discard=[c('old','green','1'),c('top','red','5')];act(r,r.players[0].id,{type:'draw'});assert.equal(r.discard.length,1);assert.equal(r.discard[0].id,'top');assert.equal(r.players[0].hand.at(-1).id,'old');});
test('official base deck composition is exactly 168 cards',()=>{
 const cards=deck();assert.equal(cards.length,168);
 const count=(color,value)=>cards.filter(c=>c.color===color&&c.value===value).length;
 for(const color of ['red','yellow','green','blue']){
  for(let n=0;n<10;n++)assert.equal(count(color,String(n)),2);
  for(const value of ['skip','reverse','+2','discard'])assert.equal(count(color,value),3);
  for(const value of ['+4','skip-all'])assert.equal(count(color,value),2);
 }
 for(const [value,total]of [['reverse+4',8],['roulette',8],['+6',4],['+10',4]])assert.equal(count('wild',value),total);
 assert.equal(cards.filter(c=>c.value==='wild').length,0);
});
test('draw until playable keeps the turn and requires the newly drawn card',()=>{
 const r=table(),p=r.players[0];p.hand=[c('keep','blue','3')];
 r.deck=[c('play','red','8'),c('miss','green','2')];act(r,p.id,{type:'draw'});
 assert.equal(r.turn,0);assert.equal(r.drawn,'play');assert.equal(p.hand.length,3);assert.deepEqual(r.event.draws,[{id:p.id,count:2}]);
 assert.throws(()=>act(r,p.id,{type:'draw'}));assert.throws(()=>act(r,p.id,{type:'play',cardId:'keep'}));
 act(r,p.id,{type:'play',cardId:'play'});assert.equal(r.turn,1);assert.equal(r.drawn,null);
});
test('cannot draw voluntarily with a playable card',()=>{const r=table();r.players[0].hand=[c('yes','red','8')];assert.throws(()=>act(r,r.players[0].id,{type:'draw'}));});
test('discard all removes only that color and keeps the action on top',()=>{
 const r=table(),p=r.players[0];p.hand=[c('all','red','discard'),c('r','red','3'),c('b','blue','3')];
 act(r,p.id,{type:'play',cardId:'all'});assert.deepEqual(p.hand.map(c=>c.id),['b']);assert.equal(r.discard.at(-1).id,'all');assert.equal(r.discard.at(-2).id,'r');assert.equal(r.event.discarded,2);
});
test('discard all can win and skip everyone retains the turn',()=>{
 const r=table(),p=r.players[0];p.hand=[c('skipall','red','skip-all'),c('all','red','discard'),c('r','red','3')];
 act(r,p.id,{type:'play',cardId:'skipall'});assert.equal(r.turn,0);
 act(r,p.id,{type:'play',cardId:'all'});assert.equal(r.winner,'A');
});
test('7 validates a target, then swaps hands privately',()=>{
 const r=table(),[a,b]=r.players;a.hand=[c('7','red','7'),c('keep','red','8')];b.hand=[c('b','blue','2'),c('b2','blue','4')];
 assert.throws(()=>act(r,a.id,{type:'play',cardId:'7',target:a.id}));assert.equal(a.hand.length,2);
 act(r,a.id,{type:'play',cardId:'7',target:b.id});assert.deepEqual(a.hand.map(c=>c.id),['b','b2']);assert.deepEqual(b.hand.map(c=>c.id),['keep']);assert.equal(r.event.transfer,'swap');assert.equal(view(r,a.id).players[1].hand,undefined);
});
test('0 passes all active hands in current direction and ignores eliminated seats',()=>{
 const r=table(),[a,b,d]=r.players;a.hand=[c('zero','red','0'),c('a','blue','1')];b.hand=[c('b','green','2')];d.hand=[c('d','yellow','3')];
 act(r,a.id,{type:'play',cardId:'zero'});assert.equal(a.hand[0].id,'d');assert.equal(b.hand[0].id,'a');assert.equal(d.hand[0].id,'b');
 const s=table();s.direction=-1;s.players[1].out=true;s.players[0].hand=[c('z','red','0'),c('stay','green','2')];s.players[2].hand=[c('d2','blue','3')];act(s,s.players[0].id,{type:'play',cardId:'z'});assert.equal(s.players[0].hand[0].id,'d2');assert.equal(s.players[2].hand[0].id,'stay');
});
test('wild reverse +4 reverses a stack and hits its own player with two seats',()=>{
 const r=table(),a=r.players[0];r.players.pop();a.hand=[c('rev4','wild','reverse+4'),c('stack','blue','+4'),c('keep','blue','8')];
 act(r,a.id,{type:'play',cardId:'rev4',color:'blue'});assert.equal(r.direction,-1);assert.equal(r.penalty,4);assert.equal(r.turn,0);assert.equal(canPlay(r,a.hand[0]),true);
 act(r,a.id,{type:'play',cardId:'stack'});assert.equal(r.penalty,8);assert.equal(r.turn,1);
});
test('roulette color belongs to the next player; wilds do not stop the draw',()=>{
 const r=table(),[a,b]=r.players;a.hand=[c('roulette','wild','roulette'),c('keep','red','8')];
 act(r,a.id,{type:'play',cardId:'roulette'});assert.equal(r.pending.player,b.id);assert.throws(()=>act(r,a.id,{type:'color',color:'blue'}));assert.throws(()=>act(r,b.id,{type:'color',color:'purple'}));
 r.deck=[c('hit','blue','2'),c('wild','wild','+10'),c('miss','red','3')];const count=b.hand.length;
 act(r,b.id,{type:'color',color:'blue'});assert.equal(b.hand.length,count+3);assert.equal(r.pending,null);assert.equal(r.turn,2);assert.equal(r.color,'blue');assert.equal(r.event.draws[0].count,3);assert.deepEqual(r.event.revealed.map(c=>c.id),['miss','wild','hit']);
});
test('UNO can be declared or caught until the next player starts',()=>{
 const r=table(),[a,b]=r.players;a.hand=[c('play','red','8'),c('keep','green','3')];act(r,a.id,{type:'play',cardId:'play'});assert.deepEqual(r.unoPending,[a.id]);
 act(r,b.id,{type:'catch'});assert.equal(a.hand.length,3);assert.deepEqual(r.unoPending,[]);
 const s=table(),p=s.players[0];p.hand=[c('play','red','8'),c('keep','green','3')];act(s,p.id,{type:'play',cardId:'play'});act(s,p.id,{type:'uno'});assert.deepEqual(s.unoPending,[]);assert.throws(()=>act(s,s.players[1].id,{type:'catch'}));
});
test('eliminated cards remain aside until deck refill; animations reveal no private cards',()=>{
 const r=table(),p=r.players[0];p.hand=Array.from({length:24},(_,i)=>c(`private-${i}`,'blue','1'));r.penalty=2;act(r,p.id,{type:'draw'});
 assert.equal(p.out,true);assert.equal(r.retired.length,25);assert.equal(p.hand.length,0);assert.equal(r.event.draws[0].count,1);assert.equal(JSON.stringify(r.event).includes('private-'),false);
});
test('last 0 or 7 wins immediately without forcing a hand swap',()=>{for(const value of ['0','7']){const r=table();r.players[0].hand=[c('win','red',value)];act(r,r.players[0].id,{type:'play',cardId:'win'});assert.equal(r.winner,'A');}});
test('complete games conserve all 168 cards across draws, swaps and eliminations',()=>{
 for(let game=0;game<12;game++){
  const players=Array.from({length:2+game%5},(_,i)=>player(`P${i}`));const room={code:'SIM',host:players[0].id,players,phase:'lobby'};start(room);
  for(let step=0;step<1500&&room.phase==='playing';step++){
   const p=room.players[room.turn];assert.equal(p.out,false);
   if(room.pending)act(room,p.id,{type:'color',color:['red','yellow','green','blue'][step%4]});
   else{const card=p.hand.find(c=>canPlay(room,c));act(room,p.id,card?{type:'play',cardId:card.id,color:'red',target:room.players.find(other=>other.id!==p.id&&!other.out).id,uno:true}:{type:'draw'});}
   const cards=[...room.deck,...room.discard,...room.retired,...room.players.flatMap(p=>p.hand)];assert.equal(cards.length,168);assert.equal(new Set(cards.map(c=>c.id)).size,168);
   assert.ok(room.players.every(p=>p.out||p.hand.length<25));
  }
  assert.equal(room.phase,'finished','game should reach a winner');
 }
});

test('drawn-card identity is private while public animation exposes only its count',()=>{
 const r=table(),p=r.players[0];p.hand=[c('keep','blue','3')];r.deck=[c('secret','red','8')];act(r,p.id,{type:'draw'});
 assert.equal(view(r,p.id).drawn,'secret');assert.equal(view(r,r.players[1].id).drawn,null);assert.equal(JSON.stringify(view(r,r.players[1].id)).includes('secret'),false);
});
