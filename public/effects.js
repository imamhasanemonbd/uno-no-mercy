// Compare public snapshots only; opponents' card identities never leave the server.
export function tableEffects(previous, next) {
  if (!previous || previous.code !== next.code || previous.phase !== 'playing') return {draws:[],played:null};
  const draws=next.players.flatMap(p=>{
    const before=previous.players.find(old=>old.id===p.id);
    return before&&p.count>before.count?[{id:p.id,count:p.count-before.count}]:[];
  });
  const played=next.top?.id!==previous.top?.id?next.top:null;
  let blocked=null;
  if(played?.value==='skip') {
    let index=previous.players.findIndex(p=>p.id===previous.turn);
    for(let i=0;i<previous.players.length;i++) {
      index=(index+previous.direction+previous.players.length)%previous.players.length;
      if(!previous.players[index].out){blocked=previous.players[index].id;break;}
    }
  }
  return {draws,played,blocked};
}
