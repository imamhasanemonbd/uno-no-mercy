import { tableEffects } from './effects.js';
import {playableCard,cardNames} from './rules.js';
const app=document.querySelector('#app');
let state=null,socket=null,session=null,reconnectTimer,attempts=0,leaving=false;
try{session=JSON.parse(sessionStorage.getItem('nomercy-session'));}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols={skip:'⊘',reverse:'⇄',discard:'▤','skip-all':'⊘⊘','reverse+4':'⇄ +4',roulette:'◉'};
function card(c,{back=false,extra='',disabled=false}={}){
  const value=symbols[c?.value]||c?.value||'10';
  if(back)return `<div class="card card-back ${extra}"><div class="card-back-frame"><span>NO<br>MERCY</span><small>PLAY DIRTY.</small></div></div>`;
  return `<${extra==='hand-card'?'button':'div'} class="card ${esc(c.color)} ${extra}" data-value="${esc(c.value)}" ${extra==='hand-card'?`data-card="${esc(c.id)}" aria-label="Play ${esc(c.color)} ${esc(cardNames[c.value]||c.value)}" ${disabled?'disabled':''}`:''}><span class="corner">${esc(value)}<small>${c.color==='wild'?'✦':'●'}</small></span><span class="card-oval"></span><span class="card-value ${c.value.startsWith('+')||c.value==='reverse+4'||c.value==='skip-all'?'plus':''}">${esc(value)}</span><span class="corner bottom">${esc(value)}<small>${c.color==='wild'?'✦':'●'}</small></span></${extra==='hand-card'?'button':'div'}>`;
}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3800);}
function home(){
 document.body.classList.remove('in-room');
 app.innerHTML=`<section class="home-entry"><form id="room-form" aria-label="Create or join a game"><label for="name">Your name</label><input id="name" name="name" maxlength="20" autocomplete="nickname" placeholder="Player name" required value="${esc(session?.name||'')}"><button class="primary" type="submit" name="action" value="create">Create game <span>↗</span></button><div class="home-divider"><span>or</span></div><label for="code">Room code</label><input id="code" name="code" aria-label="Room code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC123" value="${esc(new URL(location.href).searchParams.get('room')||'')}"><button class="primary join-button" type="submit" name="action" value="join">Join game <span>→</span></button></form></section>`;
 document.querySelector('#room-form').onsubmit=e=>{e.preventDefault();const name=document.querySelector('#name').value.trim();const code=document.querySelector('#code').value.trim().toUpperCase();const type=e.submitter?.value||'create';if(type==='join'&&!/^[A-F0-9]{6}$/.test(code)){toast('Enter the six-character room code.');return;}connect({type,name,code});};
}
function send(data){if(socket?.readyState!==WebSocket.OPEN){toast('Reconnecting to the table…');return;}socket.send(JSON.stringify(data));}
function connect(info){
 clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.close();}leaving=false;
 app.querySelectorAll('form button').forEach(b=>b.disabled=true);
 socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
 socket.onopen=()=>{attempts=0;send({...info,token:session?.code===info.code?session.token:undefined});};
 socket.onmessage=e=>{const data=JSON.parse(e.data);if(data.type==='session'){session={name:info.name,code:data.code,token:data.token};sessionStorage.setItem('nomercy-session',JSON.stringify(session));history.replaceState(null,'',`?room=${session.code}`);}if(data.type==='state'){const previous=state;state=data.state;renderRoom(previous);}if(data.type==='error'){toast(data.message);if(info.token&&/Room not found|already started/.test(data.message)){state=null;session=null;sessionStorage.removeItem('nomercy-session');socket.onclose=null;socket.close();home();}else if(!state){app.querySelectorAll('form button').forEach(b=>b.disabled=false);}}};
 socket.onerror=()=>toast('Cannot reach the game server. Please try again.');
 socket.onclose=e=>{if(leaving)return;if(e.code===1000){toast('This player reconnected in another tab.');return;}if(session&&state){toast('Connection lost. Reconnecting…');reconnectTimer=setTimeout(()=>connect({type:'join',...session}),Math.min(1000*2**attempts++,10000));}else app.querySelectorAll('form button').forEach(b=>b.disabled=false);};
}
function renderRoom(previous){
 document.body.classList.add('in-room');
 const scroll=app.querySelector('.hand')?.scrollLeft||0;
 const origins=new Map([...app.querySelectorAll('[data-card], [data-player] .avatar, #deck .card')].map(el=>[el.dataset.card?`card:${el.dataset.card}`:el.closest('[data-player]')?.dataset.player||'deck',el.getBoundingClientRect()]));
 document.querySelectorAll('.choice-dialog').forEach(el=>el.remove());
 const me=state.players.find(p=>p.id===state.you),mine=state.turn===state.you,host=state.host===state.you;
 const players=state.players.map((p,i)=>`<div data-player="${esc(p.id)}" class="player ${state.turn===p.id&&state.phase==='playing'?'active':''} ${p.out?'eliminated':''}"><span class="avatar avatar-${i}">${esc(p.name.slice(0,1).toUpperCase())}</span><div><b>${esc(p.name)} ${p.id===state.you?'<small>YOU</small>':''}</b><span>${p.out?'Eliminated':state.phase==='lobby'?(p.online?'Ready to play':'Reconnecting…'):`${p.count} cards${p.online?'':' · offline'}`}</span></div>${p.id===state.host?'<span class="host-badge">HOST</span>':''}${state.turn===p.id&&state.phase==='playing'?'<span class="turn-dot"></span>':''}</div>`).join('');
 app.innerHTML=`<section class="room"><div class="room-top"><div><span class="eyebrow">THE PRIVATE TABLE</span><h2>${state.phase==='lobby'?'Your table':'No Mercy'}</h2></div><button class="quiet" id="leave">Leave table ↗</button></div><div class="game-layout"><aside class="sidebar"><div class="room-code"><span class="eyebrow">ROOM CODE</span><button id="copy" title="Copy invite link">${state.code} <span>⧉</span></button></div><div class="players-title">THE CREW <span>${state.players.length}/6</span></div>${players}<div class="sidebar-note"><b>25 cards = out</b><button class="text-button" id="room-rules">Rules ↗</button></div></aside><div class="table-area"><div class="table-felt"><div class="table-watermark">NO MERCY</div>${state.phase==='lobby'?`<div class="lobby-content"><div class="lobby-cards">${card(null,{back:true})}${card({color:'wild',value:'+10'})}</div><h2>${state.players.length<2?'Invite a friend':'Ready to play?'}</h2>${host?`<button class="primary" id="start" ${state.players.length<2?'disabled':''}>Start game <span>↗</span></button>`:'<span class="waiting"><span class="status-dot"></span> Waiting for the host</span>'}</div>`:state.phase==='finished'?`<div class="winner-content"><div class="winner-star">✳</div><span class="eyebrow">THE LAST ONE LAUGHING</span><h2>${esc(state.winner)}</h2>${host?'<button class="primary" id="start">Run it back ↗</button>':'<p>Waiting for the host to deal again.</p>'}</div>`:`<div class="table-turn"><span class="status-dot"></span> ${mine?'YOUR TURN':`${esc(state.players.find(p=>p.id===state.turn)?.name.toUpperCase())}’S TURN`} <span class="direction">${state.direction===1?'↻':'↺'}</span></div><div class="center-piles"><button id="deck" class="deck-button" aria-label="Draw cards" ${!mine||state.pending||state.drawn||(!state.penalty&&me.hand.some(c=>playable(c)))?'disabled':''}>${card(null,{back:true})}<span>${state.pending?'ROULETTE':state.penalty?`DRAW ${state.penalty}`:'DRAW'}</span></button><div class="discard-pile">${card(state.top)}<span><i class="color-indicator ${state.color}"></i> ${state.color.toUpperCase()} IN PLAY</span></div></div>${state.penalty?`<div class="penalty-pill">+${state.penalty} · STACK OR DRAW</div>`:''}<div class="table-message" role="status">${esc(state.message)}</div>`}</div>${state.phase==='playing'?`<div class="hand-area"><div class="hand-heading"><div class="hand-controls">${state.unoPending?.includes(state.you)?'<button class="uno-button" id="call-uno">UNO!</button>':state.unoPending?.length&&!me.out?'<button class="uno-button catch-button" id="catch-uno">Catch UNO</button>':''}<span>${me.out?'ELIMINATED':state.pending?'CHOOSE COLOR':state.drawn?'PLAY DRAWN CARD':mine?'YOUR TURN':'WAITING'}</span></div><span>YOUR HAND <b>${me.hand.length}</b></span></div><div class="hand" tabindex="0" role="region" aria-label="Your cards. Scroll left or right to see more.">${me.hand.map(c=>card(c,{extra:'hand-card',disabled:!mine||me.out||!playable(c)})).join('')}</div><span class="hand-tip">Swipe for more cards ↔</span></div>`:''}</div></div></section>`;
 document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${state.code}`);toast('Invite link copied. Bring your crew.');}catch{toast(`Share this room code: ${state.code}`);}};
 document.querySelector('#leave').onclick=()=>{leaving=true;clearTimeout(reconnectTimer);socket?.close();state=null;session=null;sessionStorage.removeItem('nomercy-session');history.replaceState(null,'','/');home();};
 document.querySelector('#room-rules').onclick=()=>document.querySelector('#rules').showModal();
 document.querySelector('#start')?.addEventListener('click',()=>send({type:'start'}));
 document.querySelector('#deck')?.addEventListener('click',()=>send({type:'draw'}));
 const hand=app.querySelector('.hand');if(hand)hand.scrollLeft=scroll;
 animateTable(previous,origins);
 document.querySelector('#call-uno')?.addEventListener('click',()=>send({type:'uno'}));
 document.querySelector('#catch-uno')?.addEventListener('click',()=>send({type:'catch'}));
 if(state.pending?.type==='roulette'&&mine)chooseColor(color=>send({type:'color',color}),'Pick a color to draw until');
 app.querySelectorAll('[data-card]').forEach(el=>el.onclick=()=>{const c=me.hand.find(c=>c.id===el.dataset.card);if(c.color==='wild'&&c.value!=='roulette')chooseColor(color=>send({type:'play',cardId:c.id,color}));else if(c.value==='7'&&me.hand.length>1)chooseSwap(c);else send({type:'play',cardId:c.id});});
}
function playable(c){return playableCard(state,c);}
function choiceDialog(title,content){
 const dialog=document.createElement('dialog');dialog.className='choice-dialog';dialog.setAttribute('aria-label',title);dialog.innerHTML=`<div class="color-picker"><h2>${esc(title)}</h2>${content}<button class="text-button" data-cancel>Cancel</button></div>`;document.body.append(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();return dialog;
}
function chooseColor(select,title='Choose color'){
 const dialog=choiceDialog(title,`<div class="color-options">${['red','yellow','green','blue'].map(c=>`<button class="${c}" data-color="${c}" aria-label="Choose ${c}"></button>`).join('')}</div>`);
 dialog.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{select(b.dataset.color);dialog.close();});
 // Roulette is a required choice; cancel leaves an explicit way to reopen it.
 if(state.pending?.type==='roulette')dialog.onclose=()=>{dialog.remove();const deck=app.querySelector('#deck');if(deck){deck.disabled=false;deck.onclick=()=>chooseColor(select,title);}};
}
function chooseSwap(card){
 const dialog=choiceDialog('Swap with…',`<div class="swap-options">${state.players.filter(p=>!p.out&&p.id!==state.you).map(p=>`<button class="quiet" data-target="${p.id}">${esc(p.name)} <b>${p.count}</b></button>`).join('')}</div>`);
 dialog.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>{send({type:'play',cardId:card.id,target:b.dataset.target});dialog.close();});
}
document.querySelector('#rules-button').onclick=()=>document.querySelector('#rules').showModal();
document.querySelector('.close-dialog').onclick=()=>document.querySelector('#rules').close();
home();if(session?.token&&session.code===new URL(location.href).searchParams.get('room'))connect({type:'join',...session});

function animateTable(previous,origins){
 const effects=tableEffects(previous,state);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const felt=app.querySelector('.table-felt');if(!felt)return;
 const deck=app.querySelector('#deck .card');
 const deckRect=deck?.getBoundingClientRect()||origins.get('deck');
 function fly(from,to,html,{delay=0,duration=420,flip=false}={}){
  if(!from||!to)return;
  const flying=document.createElement('div');flying.className='flying-card';flying.innerHTML=html;flying.setAttribute('aria-hidden','true');document.body.append(flying);
  const scale=from.width/100,endScale=to.width/100;
  const motion=flying.animate([
   {transform:`translate(${from.left}px,${from.top}px) rotate(-12deg) scale(${scale})`,opacity:0},
   {transform:`translate(${from.left}px,${from.top}px) rotate(-12deg) scale(${scale})`,opacity:1,offset:.03},
   {transform:`translate(${(from.left+to.left)/2}px,${Math.min(from.top,to.top)-45}px) rotate(${flip?160:-4}deg) scale(${Math.max(scale,endScale)*1.15})`,opacity:1,offset:.5},
   {transform:`translate(${to.left}px,${to.top}px) rotate(${flip?360:8}deg) scale(${endScale})`,opacity:1}
  ],{duration,delay,fill:'both',easing:'cubic-bezier(.2,.7,.3,1)'});
  motion.onfinish=()=>flying.remove();motion.oncancel=()=>flying.remove();
 }
 if(effects.played){
  const destination=app.querySelector('.discard-pile>.card');
  const from=origins.get(`card:${effects.played.id}`)||origins.get(effects.actor);
  if(destination&&from){fly(from,destination.getBoundingClientRect(),card(effects.played),{flip:effects.actor!==state.you});destination.animate([{opacity:0},{opacity:1}],{duration:80,delay:380,fill:'backwards'});}
  const value=effects.played.value;
  if(value==='reverse'||value==='reverse+4')felt.querySelector('.direction')?.animate([{transform:'rotate(0)'},{transform:'rotate(-360deg)'}],{duration:550,delay:250});
  if(value==='skip-all')app.querySelectorAll('[data-player]').forEach(el=>{if(el.dataset.player!==effects.actor)el.animate([{background:'#ed4c3f99'},{background:'transparent'}],{duration:700,delay:300});});
  const label={skip:'⊘ BLOCKED','skip-all':'⊘ EVERYONE',reverse:'⇄ REVERSE','reverse+4':'⇄ +4',discard:'▤ DISCARD ALL',roulette:'◉ ROULETTE','7':'⇄ SWAP','0':'↻ PASS'}[value]||(value.startsWith('+')?value:null);
  if(label){
   const badge=document.createElement('div');badge.className=`action-effect ${value==='+6'||value==='+10'?'heavy-hit':''}`;badge.textContent=label;badge.setAttribute('aria-hidden','true');felt.append(badge);badge.addEventListener('animationend',()=>badge.remove(),{once:true});
   if(value==='+6'||value==='+10'){
    felt.animate([{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:240,delay:350});
    for(let i=0;i<12;i++){const spark=document.createElement('i');spark.className='impact-spark';spark.style.setProperty('--angle',`${i*30}deg`);felt.append(spark);spark.addEventListener('animationend',()=>spark.remove(),{once:true});}
   }
  }
  if(effects.blocked)app.querySelector(`[data-player="${effects.blocked}"]`)?.animate([{background:'#ed4c3fbb',transform:'scale(1.04)'},{background:'transparent',transform:'scale(1)'}],{duration:850,delay:300});
 }
 const hand=app.querySelector('.hand');
 for(const draw of effects.draws){
  if(draw.id===state.you&&hand){
   hand.scrollLeft=hand.scrollWidth;
   const oldIds=new Set(previous?.players.find(p=>p.id===state.you)?.hand?.map(c=>c.id));
   const added=state.players.find(p=>p.id===state.you).hand.filter(c=>!oldIds.has(c.id));
   for(const [i,c]of added.entries())app.querySelector(`[data-card="${c.id}"]`)?.animate([{transform:'translateY(-12px) rotate(-6deg)',opacity:0},{transform:'translateY(0) rotate(0)',opacity:1}],{duration:200,delay:350+i*55,fill:'backwards'});
  }
  const target=draw.id===state.you?hand:app.querySelector(`[data-player="${draw.id}"] .avatar`);if(!target||!deckRect)continue;
  const to=target.getBoundingClientRect(),size=draw.id===state.you?Math.min(to.height-15,98):35;
  for(let i=0;i<Math.min(draw.count,25);i++)fly(deckRect,{left:draw.id===state.you?to.right-70:to.left,top:to.top+5,width:size*.69},effects.revealed?.[i]?card(effects.revealed[i]):card(null,{back:true}),{delay:i*55,duration:350,flip:!!effects.revealed?.[i]});
 }
 for(const transfer of effects.transfers){
  const source=transfer.from===state.you?origins.get(`card:${previous.players.find(p=>p.id===state.you)?.hand?.[0]?.id}`):origins.get(transfer.from);
  const target=transfer.to===state.you?hand:app.querySelector(`[data-player="${transfer.to}"] .avatar`);if(!target)continue;
  const to=target.getBoundingClientRect();for(let i=0;i<3;i++)fly(source,{left:to.left+15+i*8,top:to.top,width:48},card(null,{back:true}),{delay:100+i*65,flip:true});
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
