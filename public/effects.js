// Animation events contain only public actions, never opponents' card faces.
export function tableEffects(previous,next){
 const empty={draws:[],played:null,transfers:[]};
 const event=next.event;
 if(!previous||previous.code!==next.code||!event||previous.event?.id===event.id)return empty;
 if(event.type==='deal')return {...empty,deal:true,draws:next.players.map(p=>({id:p.id,count:7}))};
 if(previous.phase!=='playing')return empty;
 const transfers=[];
 if(event.transfer==='swap')transfers.push({from:event.actor,to:event.target},{from:event.target,to:event.actor});
 if(event.transfer==='pass'){
  const active=previous.players.filter(p=>!p.out);
  active.forEach((p,i)=>transfers.push({from:p.id,to:active[(i+previous.direction+active.length)%active.length].id}));
 }
 return {revealed:event.revealed||[],draws:event.draws||[],played:event.card||null,actor:event.actor,blocked:event.card?.value==='skip'?event.target:null,transfers};
}
