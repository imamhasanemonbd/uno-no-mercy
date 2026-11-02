import { tableEffects } from './effects.js';
const app=document.querySelector('#app');
let state=null,socket=null,session=null,pendingCard=null,reconnectTimer,attempts=0,leaving=false;
try{session=JSON.parse(sessionStorage.getItem('nomercy-session'));}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols={skip:'⊘',reverse:'⇄',wild:'✦'};
function card(c,{back=false,extra='',disabled=false}={}){
  const value=symbols[c?.value]||c?.value||'10';
  if(back)return `<div class="card card-back ${extra}"><div class="card-back-frame"><span>NO<br>MERCY</span><small>PLAY DIRTY.</small></div></div>`;
  return `<${extra==='hand-card'?'button':'div'} class="card ${esc(c.color)} ${extra}" ${extra==='hand-card'?`data-card="${esc(c.id)}" aria-label="Play ${esc(c.color)} ${esc(c.value)}" ${disabled?'disabled':''}`:''}><span class="corner">${esc(value)}<small>${c.color==='wild'?'✦':'●'}</small></span><span class="card-oval"></span><span class="card-value ${c.value.startsWith('+')?'plus':''}">${esc(value)}</span><span class="corner bottom">${esc(value)}<small>${c.color==='wild'?'✦':'●'}</small></span></${extra==='hand-card'?'button':'div'}>`;
}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3800);}
function home(){
 document.body.classList.remove('in-room');
 app.innerHTML=`<section class="landing"><div class="hero-copy"><div class="eyebrow"><span class="small-line"></span> 2–6 PLAYERS · PRIVATE ROOMS</div><h1>Good friends.<br>Bad cards.<br><span>No mercy.</span><span class="title-star">✳</span></h1><p class="hero-description">Invite friends. Stack cards. Show no mercy.</p><div class="features"><span><b>↗</b> 2–6 players</span><span><b>◎</b> No downloads</span><span><b>✧</b> No sign-ups</span></div></div><div class="hero-art" aria-label="Red 7, black draw 10 and green reverse playing cards"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="art-cross">✳</span><span class="art-caption">THINGS ARE ABOUT TO<br>GET OUT OF HAND.</span>${card({color:'red',value:'7'},{extra:'hero-red'})}${card({color:'green',value:'reverse'},{extra:'hero-green'})}${card({color:'wild',value:'+10'},{extra:'hero-black'})}<div class="damage-sticker"><b>+10</b><span>YES, REALLY.</span></div><span class="art-bottom">SHUFFLE. STACK. SURVIVE.</span></div></section><section class="entry-panel"><div class="entry-heading"><span class="eyebrow">YOUR TABLE. YOUR RULES.</span><h2>Let’s ruin game night.</h2><p>Create a room or join your friends.</p></div><form id="room-form"><label for="name">YOUR NAME</label><input id="name" name="name" maxlength="20" autocomplete="nickname" placeholder="Your player name" required value="${esc(session?.name||'')}"><div class="entry-actions"><button class="primary" type="submit" name="action" value="create">Create a game <span>↗</span></button><span class="or">OR</span><div class="join-group"><input id="code" aria-label="Room code" maxlength="6" placeholder="ROOM CODE" value="${esc(new URL(location.href).searchParams.get('room')||'')}"><button type="submit" name="action" value="join">Join game <span>→</span></button></div></div><span class="form-note"><span class="status-dot"></span> Free to play. Hard to forgive.</span></form></section><div class="bottom-strip"><span>01 <b>CREATE A ROOM</b></span><span class="strip-arrow">⟶</span><span>02 <b>INVITE YOUR PEOPLE</b></span><span class="strip-arrow">⟶</span><span>03 <b>SHOW NO MERCY</b></span></div>`;
 document.querySelector('#room-form').onsubmit=e=>{e.preventDefault();const name=document.querySelector('#name').value.trim();const code=document.querySelector('#code').value.trim().toUpperCase();const type=e.submitter?.value||'create';if(type==='join'&&!/^[A-F0-9]{6}$/.test(code)){toast('Enter the six-character room code.');return;}connect({type,name,code});};
}
function send(data){if(socket?.readyState!==WebSocket.OPEN){toast('Reconnecting to the table…');return;}socket.send(JSON.stringify(data));}
function connect(info){
 clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.close();}leaving=false;
 app.querySelectorAll('form button').forEach(b=>b.disabled=true);
 socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
 socket.onopen=()=>{attempts=0;send({...info,token:session?.code===info.code?session.token:undefined});};
 socket.onmessage=e=>{const data=JSON.parse(e.data);if(data.type==='session'){session={name:info.name,code:data.code,token:data.token};sessionStorage.setItem('nomercy-session',JSON.stringify(session));history.replaceState(null,'',`?room=${session.code}`);}if(data.type==='state'){const previous=state;state=data.state;pendingCard=null;renderRoom(previous);}if(data.type==='error'){toast(data.message);if(info.token&&/Room not found|already started/.test(data.message)){state=null;session=null;sessionStorage.removeItem('nomercy-session');socket.onclose=null;socket.close();home();}else if(!state){app.querySelectorAll('form button').forEach(b=>b.disabled=false);}}};
 socket.onerror=()=>toast('Cannot reach the game server. Please try again.');
 socket.onclose=e=>{if(leaving)return;if(e.code===1000){toast('This player reconnected in another tab.');return;}if(session&&state){toast('Connection lost. Reconnecting…');reconnectTimer=setTimeout(()=>connect({type:'join',...session}),Math.min(1000*2**attempts++,10000));}else app.querySelectorAll('form button').forEach(b=>b.disabled=false);};
}
function renderRoom(previous){
 document.body.classList.add('in-room');
 const scroll=app.querySelector('.hand')?.scrollLeft||0;
 const me=state.players.find(p=>p.id===state.you),mine=state.turn===state.you,host=state.host===state.you;
 const players=state.players.map((p,i)=>`<div data-player="${esc(p.id)}" class="player ${state.turn===p.id&&state.phase==='playing'?'active':''} ${p.out?'eliminated':''}"><span class="avatar avatar-${i}">${esc(p.name.slice(0,1).toUpperCase())}</span><div><b>${esc(p.name)} ${p.id===state.you?'<small>YOU</small>':''}</b><span>${p.out?'Eliminated':state.phase==='lobby'?(p.online?'Ready to play':'Reconnecting…'):`${p.count} cards${p.online?'':' · offline'}`}</span></div>${p.id===state.host?'<span class="host-badge">HOST</span>':''}${state.turn===p.id&&state.phase==='playing'?'<span class="turn-dot"></span>':''}</div>`).join('');
 app.innerHTML=`<section class="room"><div class="room-top"><div><span class="eyebrow">THE PRIVATE TABLE</span><h2>${state.phase==='lobby'?'Your table':'No Mercy'}</h2></div><button class="quiet" id="leave">Leave table ↗</button></div><div class="game-layout"><aside class="sidebar"><div class="room-code"><span class="eyebrow">ROOM CODE</span><button id="copy" title="Copy invite link">${state.code} <span>⧉</span></button></div><div class="players-title">THE CREW <span>${state.players.length}/6</span></div>${players}<div class="sidebar-note"><b>25 cards = out</b><button class="text-button" id="room-rules">Rules ↗</button></div></aside><div class="table-area"><div class="table-felt"><div class="table-watermark">NO MERCY</div>${state.phase==='lobby'?`<div class="lobby-content"><div class="lobby-cards">${card(null,{back:true})}${card({color:'wild',value:'+10'})}</div><h2>${state.players.length<2?'Invite a friend':'Ready to play?'}</h2>${host?`<button class="primary" id="start" ${state.players.length<2?'disabled':''}>Start game <span>↗</span></button>`:'<span class="waiting"><span class="status-dot"></span> Waiting for the host</span>'}</div>`:state.phase==='finished'?`<div class="winner-content"><div class="winner-star">✳</div><span class="eyebrow">THE LAST ONE LAUGHING</span><h2>${esc(state.winner)}</h2>${host?'<button class="primary" id="start">Run it back ↗</button>':'<p>Waiting for the host to deal again.</p>'}</div>`:`<div class="table-turn"><span class="status-dot"></span> ${mine?'YOUR TURN':`${esc(state.players.find(p=>p.id===state.turn)?.name.toUpperCase())}’S TURN`} <span class="direction">${state.direction===1?'↻':'↺'}</span></div><div class="center-piles"><button id="deck" class="deck-button" aria-label="Draw cards" ${!mine?'disabled':''}>${card(null,{back:true})}<span>DRAW ${state.penalty||1}</span></button><div class="discard-pile">${card(state.top)}<span><i class="color-indicator ${state.color}"></i> ${state.color.toUpperCase()} IN PLAY</span></div></div>${state.penalty?`<div class="penalty-pill">+${state.penalty} · STACK OR DRAW</div>`:''}<div class="table-message" role="status">${esc(state.message)}</div>`}</div>${state.phase==='playing'?`<div class="hand-area"><div class="hand-heading"><span>${me.out?'ELIMINATED':mine?'YOUR TURN':'WAITING'}</span><span>YOUR HAND <b>${me.hand.length}</b></span></div><div class="hand" tabindex="0" role="region" aria-label="Your cards. Scroll left or right to see more.">${me.hand.map(c=>card(c,{extra:'hand-card',disabled:!mine||me.out||!playable(c)})).join('')}</div><span class="hand-tip">Swipe for more cards ↔</span></div>`:''}</div></div></section>`;
 document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${state.code}`);toast('Invite link copied. Bring your crew.');}catch{toast(`Share this room code: ${state.code}`);}};
 document.querySelector('#leave').onclick=()=>{leaving=true;clearTimeout(reconnectTimer);socket?.close();state=null;session=null;sessionStorage.removeItem('nomercy-session');history.replaceState(null,'','/');home();};
 document.querySelector('#room-rules').onclick=()=>document.querySelector('#rules').showModal();
 document.querySelector('#start')?.addEventListener('click',()=>send({type:'start'}));
 document.querySelector('#deck')?.addEventListener('click',()=>send({type:'draw'}));
 const hand=app.querySelector('.hand');if(hand)hand.scrollLeft=scroll;
 animateTable(previous);
 app.querySelectorAll('[data-card]').forEach(el=>el.onclick=()=>{const c=me.hand.find(c=>c.id===el.dataset.card);if(c.color==='wild'){pendingCard=c.id;chooseColor();}else send({type:'play',cardId:c.id});});
}
function playable(c){if(state.penalty)return c.value.startsWith('+')&&Number(c.value.slice(1))>=Number(state.top.value.slice(1));return c.color==='wild'||c.color===state.color||c.value===state.top.value;}
function chooseColor(){const overlay=document.createElement('div');overlay.className='color-overlay';overlay.innerHTML=`<div class="color-picker" role="dialog" aria-modal="true" aria-label="Choose a color"><span class="eyebrow">WILD MOVE</span><h2>Pick your poison.</h2><div class="color-options">${['red','yellow','green','blue'].map(c=>`<button class="${c}" data-color="${c}" aria-label="Choose ${c}"></button>`).join('')}</div><button class="text-button" id="cancel-color">Cancel</button></div>`;app.append(overlay);const close=()=>{overlay.remove();document.removeEventListener('keydown',escape);};const escape=e=>{if(e.key==='Escape')close();};document.addEventListener('keydown',escape);overlay.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{send({type:'play',cardId:pendingCard,color:b.dataset.color});close();});overlay.querySelector('#cancel-color').onclick=close;overlay.querySelector('button').focus();}
document.querySelector('#rules-button').onclick=()=>document.querySelector('#rules').showModal();
document.querySelector('.close-dialog').onclick=()=>document.querySelector('#rules').close();
home();if(session?.token&&session.code===new URL(location.href).searchParams.get('room'))connect({type:'join',...session});

function animateTable(previous){
 const effects=tableEffects(previous,state);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const felt=app.querySelector('.table-felt');
 if(effects.played){
  const value=effects.played.value;
  const label=value==='skip'?'⊘ BLOCKED':value==='reverse'?'⇄ REVERSE':value.startsWith('+')?value:null;
  if(label){
   const badge=document.createElement('div');badge.className=`action-effect ${value==='+6'||value==='+10'?'heavy-hit':''}`;badge.textContent=label;badge.setAttribute('aria-hidden','true');felt.append(badge);badge.addEventListener('animationend',()=>badge.remove(),{once:true});
   if(value==='+6'||value==='+10')felt.animate([{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:240});
  }
  if(effects.blocked)app.querySelector(`[data-player="${effects.blocked}"]`)?.animate([{background:'#ed4c3f88'},{background:'transparent'}],{duration:850});
 }
 const deck=app.querySelector('#deck .card');if(!deck)return;
 for(const draw of effects.draws){
  const hand=app.querySelector('.hand');
  if(draw.id===state.you&&hand){
   hand.scrollLeft=hand.scrollWidth;
   const oldIds=new Set(previous.players.find(p=>p.id===state.you)?.hand?.map(c=>c.id));
   const added=state.players.find(p=>p.id===state.you).hand.filter(c=>!oldIds.has(c.id));
   for(const [i,c]of added.entries())app.querySelector(`[data-card="${c.id}"]`)?.animate([{transform:'translateY(-20px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:220,delay:i*45,fill:'backwards'});
  }
  const target=draw.id===state.you?hand:app.querySelector(`[data-player="${draw.id}"] .avatar`);if(!target)continue;
  const from=deck.getBoundingClientRect(),to=target.getBoundingClientRect();
  for(let i=0;i<Math.min(draw.count,10);i++){
   const flying=document.createElement('div');flying.className='flying-card';flying.innerHTML=card(null,{back:true});flying.setAttribute('aria-hidden','true');document.body.append(flying);
   const endX=draw.id===state.you?to.right-45:to.left+to.width/2;
   const motion=flying.animate([{transform:`translate(${from.left}px,${from.top}px) rotate(-7deg) scale(.7)`,opacity:1},{transform:`translate(${endX-35}px,${to.top}px) rotate(14deg) scale(.4)`,opacity:0}],{duration:350,delay:i*45,fill:'both',easing:'ease-in'});
   motion.onfinish=()=>flying.remove();
  }
 }
}
const fullscreen=document.querySelector('#fullscreen');
function syncFullscreen(){const active=!!(document.fullscreenElement||document.webkitFullscreenElement);fullscreen.textContent=active?'⊡':'⛶';fullscreen.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');fullscreen.setAttribute('aria-pressed',String(active));}
fullscreen.onclick=async()=>{
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else if(document.webkitFullscreenElement)document.webkitExitFullscreen();
  else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
  else if(document.documentElement.webkitRequestFullscreen)document.documentElement.webkitRequestFullscreen();
  else toast('Fullscreen isn’t supported in this browser.');
 }catch{toast('Fullscreen isn’t available here.');}
};
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('webkitfullscreenchange',syncFullscreen);
