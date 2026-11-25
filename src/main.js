import Phaser from 'phaser';
import Peer from 'peerjs';
import './style.css';

const $=id=>document.getElementById(id),W=800,H=500,PRE='biyecrash-';
const MAPS=[
{TB:[[150,150],[150,350],[400,110],[400,390],[650,150],[650,350]],BR:[400,250],SH:[745,455],MI:[730,250],BO:[70,250],DF:[240,250],
 A:[[[100,80],[700,80],[700,200],[100,200]],[[100,300],[700,300],[700,430],[100,430]],[[400,60],[400,440],[250,250],[550,250]]]},
{TB:[[120,120],[300,120],[500,120],[680,120],[200,380],[600,380]],BR:[450,300],SH:[60,440],MI:[740,250],BO:[60,250],DF:[250,260],
 A:[[[60,60],[740,60],[740,200],[60,200]],[[60,320],[740,320],[740,440],[60,440]],[[400,100],[400,420],[200,260],[600,260]]]},
{TB:[[200,100],[400,100],[600,100],[200,400],[400,400],[600,400]],BR:[400,250],SH:[740,250],MI:[60,250],BO:[740,60],DF:[250,250],
 A:[[[80,80],[720,80],[720,420],[80,420]],[[400,60],[400,440]],[[100,250],[700,250],[400,200],[400,300]]]}];
let TB,BR,SH,MI,BO,DF,T={},myRole='Crasher';
const RD={Crasher:'no special power',Pickpocket:'act near a friend to steal points',Distractor:'act away from stations to blind nearby aunties',Insider:'SECRET traitor: act near a friend to expose them',Medic:'act near a friend to calm them down',Saboteur:'act anywhere to cause a blackout (40s cooldown)',Waiter:'eating never raises your suspicion',Sprinter:'you run faster'};
function setMap(v){({TB,BR,SH,MI,BO,DF}=MAPS[v])}
setMap(0);
const STORY=["Groom's cousin from Chittagong","Bride's phupu's neighbour","Photographer's assistant","Caterer's nephew","Groom's bhaiya's friend","Bride's university senior"];
const rnd=a=>a[Math.random()*a.length|0],cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(p,t)=>Math.hypot(p.x-t[0],p.y-t[1]);
const esc=s=>String(s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
let peer,conns={},hostConn,isHost=false,me='H',L={},G=null,S=null,keys={},ptr=null;

function show(id){['home','lobby','game','end'].forEach(x=>$(x).hidden=x!==id);if(id==='game')startRender()}
function msg(t){$('msg').textContent=t}
function nm(){return $('nm').value.trim().slice(0,12)||'Guest'+(Math.random()*90+10|0)}

/* ---------- networking ---------- */
function mkHost(){
  const code=Array.from({length:4},()=>rnd('ABCDEFGHJKMNPQRSTUVWXYZ')).join('');
  peer=new Peer(PRE+code);
  peer.on('open',()=>{isHost=true;me='H';L={H:nm()};$('rc').textContent=code;lobbyBroadcast();show('lobby')});
  peer.on('error',e=>e.type==='unavailable-id'?mkHost():msg('Network error: '+e.type));
  peer.on('connection',c=>{
    conns[c.peer]=c;
    c.on('data',m=>onHost(c.peer,m,c));
    c.on('close',()=>{delete conns[c.peer];if(G){if(G.p[c.peer])G.p[c.peer].o=1}else{delete L[c.peer];lobbyBroadcast()}});
  });
}
function joinRoom(code){
  peer=new Peer();
  peer.on('open',id=>{
    me=id;hostConn=peer.connect(PRE+code,{reliable:true});
    hostConn.on('open',()=>hostConn.send({t:'join',n:nm()}));
    hostConn.on('data',onClient);
    hostConn.on('close',()=>{msg('The host left the room.');show('home')});
  });
  peer.on('error',e=>msg(e.type==='peer-unavailable'?'Room not found. Check the code.':'Network error: '+e.type));
}
const send=m=>{for(const c of Object.values(conns))if(c.open)c.send(m)};

function onHost(id,m,c){
  if(m.t==='join'){
    if(G||Object.keys(L).length>=10){c.send({t:'no'});return}
    L[id]=String(m.n).slice(0,12)||'Guest';lobbyBroadcast();
  }else if(G&&G.p[id]){
    if(m.t==='i'){G.p[id].dx=cl(+m.x||0,-1,1);G.p[id].dy=cl(+m.y||0,-1,1)}
    else if(m.t==='a')act(G.p[id]);
  }
}
function onClient(m){
  if(m.t==='l'){renderLobby(m.list);show('lobby')}
  else if(m.t==='go'){setMap(m.v);show('game')}
  else if(m.t==='r')myRole=m.r;
  else if(m.t==='s'){S=m;if(m.over)showEnd()}
  else if(m.t==='back')show('lobby');
  else if(m.t==='no'){msg('Room is full or already started.');show('home')}
}

/* ---------- lobby ---------- */
function lobbyBroadcast(){const list=Object.values(L);send({t:'l',list});renderLobby(list)}
function renderLobby(list){
  $('pl').innerHTML=list.map(n=>'<li>'+esc(n)+'</li>').join('');
  const ok=[4,6,8,10].includes(list.length);
  $('ls').textContent=ok?'Ready to crash!':'Need 4, 6, 8 or 10 players ('+list.length+' in the room).';
  $('st').hidden=!isHost;$('vn').hidden=!isHost;$('st').disabled=!ok;
}

/* ---------- host game simulation ---------- */
function start(){
  const ids=Object.keys(L);if(![4,6,8,10].includes(ids.length))return;
  const v=+$('vn').value;setMap(v);
  G={time:150,dark:0,el:0,over:false,feed:[],p:{},res:null,
    aunts:MAPS[v].A
      .map(wp=>({x:wp[0][0],y:wp[0][1],wp,i:1}))};
  ids.forEach((id,i)=>G.p[id]={id,i,n:L[id],x:280+i*24,y:470,dx:0,dy:0,sus:0,sc:0,o:0,cd:0,bo:0,rc:0,ot:-9,e:0,tab:[],q:{},story:rnd(STORY)});
  ids.forEach((id,i)=>G.p[id].b=ids[i^1]);
  const sf=a=>[...a].sort(()=>Math.random()-.5),rs=(ids.length>=6?['Insider']:[]).concat(sf(['Distractor','Pickpocket','Medic','Saboteur','Waiter','Sprinter'])).slice(0,ids.length/2),sh=sf(ids);
  rs.forEach((r,k)=>G.p[sh[k]].r=r);Object.values(G.p).forEach(p=>p.r=p.r||'Crasher');
  send({t:'go',v});show('game');
  Object.entries(conns).forEach(([id,c])=>G.p[id]&&c.open&&c.send({t:'r',r:G.p[id].r}));myRole=G.p.H.r;
  G.timer=setInterval(tick,50);
}
function feed(s){G.feed.push(s);if(G.feed.length>4)G.feed.shift()}
function caught(p){
  p.o=1;p.ot=G.el;const b=G.p[p.b];if(b&&!b.o){b.sus=Math.min(99,b.sus+20);feed(`${b.n} saw ${p.n} get thrashed and is sweating 😰`)}
  feed(rnd([`${p.n} got the Mama-with-slippers treatment 🩴💥`,`${p.n} was launched out the gate by 12 uncles 🚀`,`"Ke tumi?!" ${p.n} was thrashed and thrown out 😵`]));
}
function chug(p){
  const k=G.el-p.cs,u=(k*1.1)%2,d=Math.abs((u<1?u:2-u)-.5);p.cs=0;p.cd=G.el+.5;
  if(d<.07){p.sus=Math.max(0,p.sus-50);p.sc+=15;feed(`${p.n} chugged borhani PERFECTLY and is totally calm 🥛✨`)}
  else if(d<.2){p.sus=Math.max(0,p.sus-25);p.sc+=5;feed(`${p.n} finished the borhani and cooled down 🥛`)}
  else{p.sus=Math.min(100,p.sus+10);feed(`${p.n} choked on borhani and coughed everywhere 🤧`)}
}
function roleAct(p){
  const t=G.el;if(t<p.rc)return;
  const o=Object.values(G.p).find(q=>q!==p&&!q.o&&Math.hypot(q.x-p.x,q.y-p.y)<50);
  if(p.r==='Pickpocket'&&o&&o.sc>0){const k=Math.min(15,o.sc);o.sc-=k;p.sc+=k;p.rc=t+12;p.sus=Math.min(100,p.sus+10);feed(`${o.n} got their pocket picked: -${k} pts 🕵️`)}
  else if(p.r==='Insider'&&o){o.sus=Math.min(100,o.sus+40);p.sc+=30;p.rc=t+15;feed(`Somebody loudly asked "Who invited ${o.n}?!" 📢`)}
  else if(p.r==='Distractor'){G.aunts.forEach(a=>{if(Math.hypot(a.x-p.x,a.y-p.y)<260)a.fz=4});p.rc=t+20;feed('A fake fight broke out over the seating 🗣️')}
  else if(p.r==='Medic'&&o){o.sus=Math.max(0,o.sus-35);p.sc+=5;p.rc=t+15;feed(`${p.n} fanned ${o.n} with a hand-fan and cooled them down 🪭`)}
  else if(p.r==='Saboteur'){G.dark=5;p.rc=t+40;feed('⚡ The generator mysteriously died!')}
}
function act(p){
  if(p.o||G.over||G.el<p.cd)return;
  if(p.cs>0){chug(p);return}
  const t=TB.findIndex(t=>dist(p,t)<52);
  if(t>=0){
    p.cd=G.el+1.1;p.sc+=10;p.e++;if(G.pot&&G.pot.i===t){G.pot=null;p.sc+=40;feed(`${p.n} won the biryani rush: +40 🏁`)}if(p.r!=='Waiter')p.sus=Math.min(100,p.sus+9);if(!p.tab.includes(t))p.tab.push(t);
    feed(rnd([`${p.n} is on plate number ${p.e} 🍛`,`${p.n} found a free kacchi seat 😋`,`${p.n} "forgot" this isn't their cousin's wedding 🍽️`]));
    if(p.tab.length>=3&&!p.q.t){p.q.t=1;p.sc+=50;feed(`${p.n} ate at 3 tables: +50 🍽️`)}
  }else if(dist(p,BR)<62&&!p.q.b){
    p.cd=G.el+1;p.q.b=1;p.sc+=40;p.sus=Math.min(100,p.sus+25);feed(`${p.n} got a photo with the bride: +40 📸`);
  }else if(dist(p,SH)<50&&!p.q.s){
    p.cd=G.el+1;p.q.s=1;p.sc+=60;p.sus=Math.min(100,p.sus+35);feed(`${p.n} stole the groom's shoes: +60 👞 (juta churi!)`);
  }else if(dist(p,MI)<50&&!p.q.m){
    p.cd=G.el+1;p.q.m=1;p.sc+=30;p.sus=Math.min(100,p.sus+15);feed(`${p.n} raided the rasmalai counter: +30 🍮`);
  }else if(dist(p,BO)<50&&G.el>=p.bo){
    p.cd=G.el+.6;p.bo=G.el+20;p.cs=G.el;feed(`${p.n} lifted a giant glass of borhani 🥛`);
  }else if(dist(p,DF)<55){
    p.cd=G.el+.45;p.sc+=4;p.sus=Math.min(100,p.sus+5);p.dn=(p.dn||0)+1;if(p.dn%6===0)feed(`${p.n} is destroying the dance floor 💃`);
  }else roleAct(p);
}
function snap(){
  return{t:'s',el:G.el,pot:G.pot?G.pot.i:-1,time:Math.ceil(G.time),dark:G.dark>0,over:G.over,feed:G.feed,res:G.res,
    aunts:G.aunts.map(a=>[a.x|0,a.y|0,a.fz>0?1:0]),
    p:Object.values(G.p).map(p=>({id:p.id,i:p.i,n:p.n,x:p.x|0,y:p.y|0,s:p.sus|0,sc:p.sc,o:p.o,st:p.story,b:p.b,ot:p.ot,cs:p.cs>0?p.cs:0}))};
}
function tick(){
  const dt=.05;G.el+=dt;G.time-=dt;
  if(G.pot){G.pot.t-=dt;if(G.pot.t<=0)G.pot=null}
  else if(Math.random()<dt/25){G.pot={i:Math.random()*6|0,t:8};feed('🍛 A fresh biryani pot just opened! First there gets +40')}
  if(G.dark>0)G.dark-=dt;
  else if(Math.random()<dt/35){G.dark=6;feed('⚡ Load shedding! Lights out, nobody can see you.')}
  G.aunts.forEach(a=>{
    if(a.fz>0){a.fz-=dt;return}
    const t=a.wp[a.i],dx=t[0]-a.x,dy=t[1]-a.y,d=Math.hypot(dx,dy);
    if(d<5)a.i=(a.i+1)%a.wp.length;else{a.x+=dx/d*60*dt;a.y+=dy/d*60*dt}
  });
  const ps=Object.values(G.p);
  ps.forEach(p=>{
    if(p.cs>0&&G.el-p.cs>3){p.cs=0;p.sus=Math.min(100,p.sus+10);feed(`${p.n} froze mid-chug and spilled borhani 🥛`)}
    if(p.o)return;
    const m=Math.max(1,Math.hypot(p.dx,p.dy));
    const sp=p.r==='Sprinter'?175:140;p.x=cl(p.x+p.dx/m*sp*dt,12,W-12);p.y=cl(p.y+p.dy/m*sp*dt,12,H-12);
    const seen=G.dark<=0&&G.aunts.some(a=>!(a.fz>0)&&Math.hypot(a.x-p.x,a.y-p.y)<95);
    const bd=G.p[p.b],cov=bd&&!bd.o&&Math.hypot(bd.x-p.x,bd.y-p.y)<70;p.sus=cl(p.sus+(seen?(cov?12:24)*dt:-5*dt),0,100);
    if(p.sus>=100)caught(p);
  });
  if(G.time<=0||ps.filter(p=>!p.o).length<=1)end();
  S=snap();send(S);
}
function end(){
  if(G.over)return;G.over=true;clearInterval(G.timer);
  Object.values(G.p).forEach(p=>T[p.id]=(T[p.id]||0)+p.sc+(p.o?0:20));
  G.res=Object.values(G.p).sort((a,b)=>(a.o-b.o)||(b.sc-a.sc)).map(p=>({n:p.n,sc:p.sc,o:p.o,t:T[p.id],r:p.r}));
  S=snap();send(S);showEnd();
}
function showEnd(){
  if(!S||!S.res)return;
  $('win').textContent=S.res[0].n+(S.res[0].o?' (thrown out, but best score!)':' crashed the best 🏆');
  $('rs').innerHTML=S.res.map(r=>`<li>${esc(r.n)}${r.r==='Insider'?' 🕶️ (the Insider)':''}: ${r.sc} pts ${r.o?'(thrown out 🩴)':'(stayed)'} | series total ${r.t}</li>`).join('');
  $('again').hidden=!isHost;$('wait').hidden=isHost;show('end');
}

/* ---------- input ---------- */
const doAct=()=>isHost?(G&&G.p.H&&act(G.p.H)):hostConn&&hostConn.send({t:'a'});
addEventListener('keydown',e=>{
  const k=e.key.length>1?e.key:e.key.toLowerCase();keys[k]=1;
  if(k==='e'||k===' ')doAct();
  if(k.startsWith('Arrow')||k===' ')e.preventDefault();
});
addEventListener('keyup',e=>{keys[e.key.length>1?e.key:e.key.toLowerCase()]=0});
setInterval(()=>{
  if(!S||$('game').hidden)return;
  let x=(keys.d||keys.ArrowRight?1:0)-(keys.a||keys.ArrowLeft?1:0),y=(keys.s||keys.ArrowDown?1:0)-(keys.w||keys.ArrowUp?1:0);
  const m=S.p.find(p=>p.id===me);
  if(ptr&&m){const dx=ptr.x-m.x,dy=ptr.y-m.y,d=Math.hypot(dx,dy);if(d>14){x=dx/d;y=dy/d}}
  if(isHost){if(G&&G.p.H){G.p.H.dx=x;G.p.H.dy=y}}else if(hostConn&&hostConn.open)hostConn.send({t:'i',x,y});
},50);

/* ---------- buttons ---------- */
$('mk').onclick=()=>{msg('Creating room…');mkHost()};
$('jn').onclick=()=>{const c=$('cd').value.trim().toUpperCase();if(c.length!==4)return msg('Enter the 4-letter room code.');msg('Joining…');joinRoom(c)};
$('st').onclick=start;
$('act').onclick=doAct;
$('again').onclick=()=>{G=null;S=null;send({t:'back'});lobbyBroadcast();show('lobby')};

/* ================= Phaser renderer ================= */
const FF='"Baloo Da 2","Apple Color Emoji","Segoe UI Emoji",sans-serif';
let game,scn,booting=false,au,lf='';
function beep(f){try{au=au||new AudioContext();const o=au.createOscillator(),g=au.createGain();o.type='square';o.frequency.value=f;g.gain.value=.05;o.connect(g);g.connect(au.destination);o.start();o.stop(au.currentTime+.12)}catch(e){}}
function startRender(){
  if(game){game.scale.refresh();scn&&build(scn);return}
  if(booting)return;booting=true;
  Promise.all([document.fonts.load('800 20px "Baloo Da 2"','ধোলাই গেট জুতা'),document.fonts.load('500 14px "Baloo Da 2"')]).catch(()=>0).then(()=>{
    game=new Phaser.Game({type:Phaser.AUTO,width:800,height:500,parent:'stage',backgroundColor:'#3b0a1a',
      scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
      scene:{create(){scn=this;texs(this);build(this);
          this.input.on('pointerdown',p=>ptr={x:p.x,y:p.y});
          this.input.on('pointermove',p=>{if(ptr)ptr={x:p.x,y:p.y}});
          this.input.on('pointerup',()=>ptr=null);this.input.on('pointerupoutside',()=>ptr=null)},
        update(t){upd(this,t)}}});
  });
}
function texs(s){
  const g=s.make.graphics({add:false}),mk=(k,w,h,f)=>{g.clear();f();g.generateTexture(k,w,h)};
  mk('shadow',34,14,()=>g.fillStyle(0,.35).fillEllipse(17,7,32,12));
  mk('body',30,36,()=>{g.fillStyle(0xffffff).fillRoundedRect(2,0,26,30,9).fillEllipse(9,33,11,6).fillEllipse(21,33,11,6);g.fillStyle(0,.2).fillRect(14,3,2,25)});
  mk('head',24,24,()=>{g.fillStyle(0xe0a574).fillCircle(12,12,11).fillStyle(0x2b1a12).fillCircle(8,12,1.6).fillCircle(16,12,1.6);g.lineStyle(1.5,0x7a3b2a).beginPath().arc(12,15,4,.2,2.9).strokePath()});
  mk('hair',26,13,()=>g.fillStyle(0x1d120d).fillEllipse(13,8,26,14));
  mk('aunt',46,64,()=>{g.fillStyle(0xc2185b).fillRoundedRect(6,24,34,36,12).fillStyle(0xf2b134).fillRect(6,44,34,4).fillStyle(0x8e0e45).fillTriangle(6,26,40,26,6,52).fillStyle(0xd99a6c).fillCircle(23,15,12).fillStyle(0x1d120d).fillEllipse(23,6,26,12).fillCircle(23,0,6).fillStyle(0xe63946).fillCircle(23,9,1.8).fillStyle(0x6d4c41).fillRect(38,40,8,10);g.lineStyle(2,0x222222).strokeCircle(18,15,4).strokeCircle(28,15,4).beginPath().moveTo(15,10).lineTo(21,12).moveTo(31,10).lineTo(25,12).strokePath()});
  mk('table',100,100,()=>{g.fillStyle(0,.25).fillCircle(52,54,40).fillStyle(0xfdf7e7).fillCircle(50,50,38);g.lineStyle(4,0xf2b134).strokeCircle(50,50,38);g.lineStyle(2,0xa3162f).strokeCircle(50,50,28)});
  mk('spark',8,8,()=>g.fillStyle(0xffffff).fillCircle(4,4,4));
  const rg=(k,w,h,st)=>{const c=s.textures.createCanvas(k,w,h),x=c.getContext(),r=x.createRadialGradient(w/2,h/2,w*.1,w/2,h/2,w/2);st.forEach(a=>r.addColorStop(a[0],a[1]));x.fillStyle=r;x.fillRect(0,0,w,h);c.refresh()};
  rg('vis',190,190,[[0,'rgba(230,57,70,.06)'],[.8,'rgba(230,57,70,.3)'],[1,'rgba(230,57,70,0)']]);
  rg('vig',500,500,[[0,'rgba(255,255,255,0)'],[.6,'rgba(255,255,255,0)'],[1,'rgba(255,255,255,1)']]);
}
function build(s){
  s.tweens.killAll();(s.objs||[]).forEach(o=>o.destroy());s.objs=[];s.pl={};s.au=[];
  const A=o=>(s.objs.push(o),o);
  const tx=(x,y,t,z,o={})=>A(s.add.text(x,y,t,{fontFamily:FF,fontSize:z+'px',...o}).setOrigin(.5).setDepth(3));
  const lb=(x,y,t)=>tx(x,y,t,13,{fontStyle:'800',color:'#5a0f26',stroke:'#fff1d6',strokeThickness:3});
  const f=A(s.add.graphics().setDepth(0));
  for(let x=0;x<800;x+=50)for(let y=0;y<500;y+=50)f.fillStyle((x+y)%100?0xefcf92:0xf8e3b8).fillRect(x,y,50,50);
  f.fillStyle(0xa3162f).fillRect(368,BR[1],64,500-BR[1]).fillStyle(0xf2b134).fillRect(366,BR[1],3,500-BR[1]).fillRect(431,BR[1],3,500-BR[1]);
  f.fillStyle(0,.25).fillRoundedRect(BR[0]-92,BR[1]-52,190,126,16).fillStyle(0x5a0f26).fillRoundedRect(BR[0]-90,BR[1]-60,180,120,16).fillStyle(0xe63946).fillRoundedRect(BR[0]-80,BR[1]-50,160,100,12).lineStyle(4,0xf2b134).strokeRoundedRect(BR[0]-80,BR[1]-50,160,100,12);
  f.fillStyle(0x7a1530).fillRect(0,0,800,36).fillStyle(0xf2b134).fillRect(352,455,10,45).fillRect(438,455,10,45);
  const dot=(x,y,i)=>f.fillStyle(i%2?0xf28c28:0xf2b134).fillCircle(x,y,5);
  for(let i=8,k=0;i<800;i+=16,k++){dot(i,8,k);dot(i,492,k)}
  for(let j=8,k=0;j<500;j+=16,k++){dot(8,j,k);dot(792,j,k)}
  for(let i=20,k=0;i<790;i+=30,k++){const c=A(s.add.circle(i,46+Math.sin(i)*4,4,[0xffd54a,0xff7aa2,0x7af0d4][k%3]).setDepth(5));s.tweens.add({targets:c,alpha:.25,yoyo:true,repeat:-1,duration:500+Math.random()*700,delay:Math.random()*600})}
  tx(400,478,'গেট · GATE',16,{fontStyle:'800',color:'#7a1530'});
  TB.forEach((t,i)=>{A(s.add.image(t[0],t[1],'table').setDepth(2));tx(t[0],t[1],'🍛',30);
    for(let k=0;k<5;k++){const a=k*1.256+i,gx=t[0]+Math.cos(a)*50,gy=t[1]+Math.sin(a)*50;
      const h=A(s.add.circle(gx,gy,9,Phaser.Display.Color.HSLToColor(Math.random(),.6,.5).color).setDepth(2));
      s.tweens.add({targets:h,y:gy-3,yoyo:true,repeat:-1,duration:500+Math.random()*400})}});
  tx(BR[0]-24,BR[1]-4,'👰',44);tx(BR[0]+34,BR[1]-4,'🤵',44);lb(BR[0],BR[1]+40,'ফটো · Photo');
  f.fillStyle(0x6d4c41).fillRoundedRect(SH[0]-28,SH[1]-14,56,28,8).fillStyle(0xf2b134).fillRoundedRect(MI[0]-30,MI[1]-30,60,60,10).fillStyle(0x0f7b6c).fillRoundedRect(BO[0]-30,BO[1]-30,60,60,10);
  tx(SH[0],SH[1],'👞',28);lb(SH[0],SH[1]+26,'জুতা');tx(MI[0],MI[1],'🍮',32);lb(MI[0],MI[1]+40,'মিষ্টি');tx(BO[0],BO[1],'🥛',32);lb(BO[0],BO[1]+40,'বোরহানি');
  const d=A(s.add.circle(DF[0],DF[1],50,0xf28c28).setDepth(1).setStrokeStyle(4,0xffffff));
  s.tweens.addCounter({from:0,to:360,duration:3000,repeat:-1,onUpdate:t=>d.setFillStyle(Phaser.Display.Color.HSVToRGB(t.getValue()/360,.7,1).color)});
  const dn=tx(DF[0],DF[1],'💃',34);s.tweens.add({targets:dn,y:DF[1]-8,yoyo:true,repeat:-1,duration:300});lb(DF[0],DF[1]+62,'নাচ · Dance');
  s.pot=tx(0,0,'🔥',30).setVisible(false).setDepth(400);
  s.vg=A(s.add.image(400,250,'vig').setDisplaySize(800,500).setDepth(790));
  s.dk=A(s.add.rectangle(400,250,800,500,0).setAlpha(0).setDepth(800));
  s.ls=tx(400,80,'⚡ লোডশেডিং! LOAD SHEDDING',24,{fontStyle:'800',color:'#ffd54a',stroke:'#000',strokeThickness:5}).setVisible(false).setDepth(900);
  s.ct=tx(400,398,'Stop in the gold! (E / ACT)',16,{fontStyle:'800',color:'#fff',stroke:'#000',strokeThickness:4}).setVisible(false).setDepth(960);
  s.gm=A(s.add.graphics().setDepth(950));
}
function mkP(s,p){
  const c=s.add.container(p.x,p.y),col=Phaser.Display.Color.HSLToColor(((p.i>>1)*70%360)/360,.75,.55).color;
  const T=(x,y,t,z,o={})=>s.add.text(x,y,t,{fontFamily:FF,fontSize:z+'px',...o}).setOrigin(.5);
  c.sh=s.add.image(0,16,'shadow');c.rg=s.add.ellipse(0,16,38,15).setStrokeStyle(3,col);
  c.bd=s.add.image(0,0,'body').setTint(col);c.hd=s.add.image(0,-22,'head');c.hr=s.add.image(0,-28,'hair');
  c.nm=T(0,-46,p.n,13,{fontStyle:'800',color:'#fff',stroke:'#3b0a1a',strokeThickness:4});
  c.al=T(18,-40,'❗',18).setVisible(false);c.ko=T(0,-6,'😵',28).setVisible(false).setAlpha(.65);
  c.add([c.sh,c.rg,c.bd,c.hd,c.hr,c.nm,c.al,c.ko]);
  if(p.id===me){const m=T(0,-64,'▼',16,{color:'#ffd54a'});c.add(m);s.tweens.add({targets:m,y:-58,yoyo:true,repeat:-1,duration:350})}
  s.objs.push(c);c.sc=p.sc;return c;
}
function pop(s,x,y,t,col){const o=s.add.text(x,y,t,{fontFamily:FF,fontSize:'22px',fontStyle:'800',color:col,stroke:'#3b0a1a',strokeThickness:4}).setOrigin(.5).setDepth(900);s.tweens.add({targets:o,y:y-40,alpha:0,duration:900,onComplete:()=>o.destroy()})}
function burst(s,x,y){const e=s.add.particles(x,y,'spark',{speed:{min:60,max:170},lifespan:550,scale:{start:1,end:0},tint:[0xffd54a,0xf28c28,0xe63946,0x0f7b6c],emitting:false}).setDepth(850);e.explode(14);s.time.delayedCall(700,()=>e.destroy())}
function thrash(s,x,y,n){
  s.cameras.main.shake(280,.012);
  const b=s.add.text(x,y,'💥',{fontSize:'30px'}).setOrigin(.5).setDepth(900);s.tweens.add({targets:b,scale:3,alpha:0,duration:500,onComplete:()=>b.destroy()});
  for(let k=0;k<7;k++){const e=s.add.text(x,y,'🩴',{fontSize:'22px'}).setOrigin(.5).setDepth(900),a=k*.9;s.tweens.add({targets:e,x:x+Math.cos(a)*90,y:y+Math.sin(a)*70-30,angle:360,alpha:0,duration:900,onComplete:()=>e.destroy()})}
  const t=s.add.text(400,120,'ধোলাই! '+n+' got thrashed',{fontFamily:FF,fontSize:'30px',fontStyle:'800',color:'#fff',stroke:'#e63946',strokeThickness:7}).setOrigin(.5).setDepth(950).setScale(.2);
  s.tweens.add({targets:t,scale:1,duration:250,ease:'Back.Out'});
  s.tweens.add({targets:t,alpha:0,delay:1200,duration:300,onComplete:()=>t.destroy()});
}
function upd(s,t){
  if(!S||!s.objs)return;
  const m=S.p.find(p=>p.id===me)||{};
  S.p.forEach(p=>{
    const o=s.pl[p.id]||(s.pl[p.id]=mkP(s,p)),dx=p.x-o.x,dy=p.y-o.y,mv=Math.min(1,Math.hypot(dx,dy)/4),by=-Math.abs(Math.sin(t/80))*4*mv;
    o.x+=dx*.35;o.y+=dy*.35;o.setDepth(100+o.y);
    o.bd.y=by;o.bd.rotation=Math.sin(t/70)*.14*mv;o.hd.y=-22+by;o.hr.y=-28+by;
    o.al.setVisible(!p.o&&p.s>60);
    if(p.sc>o.sc){pop(s,o.x,o.y-34,'+'+(p.sc-o.sc),'#ffd54a');burst(s,o.x,o.y)}else if(p.sc<o.sc)pop(s,o.x,o.y-34,String(p.sc-o.sc),'#ff6b6b');
    o.sc=p.sc;
    if(p.o&&!o.dead){o.dead=1;[o.bd,o.hd,o.hr,o.rg,o.al].forEach(z=>z.setVisible(false));o.ko.setVisible(true);thrash(s,o.x,o.y,p.n)}
  });
  S.aunts.forEach((a,i)=>{
    const u=s.au[i]||(s.au[i]={sp:s.add.image(a[0],a[1],'aunt'),vi:s.add.image(a[0],a[1],'vis').setDepth(50),bb:s.add.text(a[0],a[1],'💬',{fontSize:'24px'}).setOrigin(.5).setDepth(900)});
    if(!u.in){u.in=1;s.objs.push(u.sp,u.vi,u.bb)}
    u.bx=(u.bx??a[0]);u.by=(u.by??a[1]);u.bx+=(a[0]-u.bx)*.4;u.by+=(a[1]-u.by)*.4;
    u.sp.setPosition(u.bx,u.by-8+Math.sin(t/160+i)*2).setDepth(100+u.by);
    u.vi.setPosition(u.bx,u.by).setVisible(!S.dark&&!a[2]).setAlpha(.7+.3*Math.sin(t/200));
    u.bb.setPosition(u.bx,u.by-48).setVisible(!!a[2]);
  });
  if(S.pot>=0)s.pot.setVisible(true).setPosition(TB[S.pot][0],TB[S.pot][1]-40+Math.sin(t/90)*3);else s.pot.setVisible(false);
  s.dk.alpha+=((S.dark?.74:0)-s.dk.alpha)*.12;s.ls.setVisible(S.dark);
  s.vg.setTint(m.s>60?0xff1030:0x1a0008).setAlpha(m.s>60?.25+m.s/250:.5);
  s.gm.clear();s.ct.setVisible(m.cs>0);
  if(m.cs>0){const u=((S.el-m.cs)*1.1)%2,q=u<1?u:2-u;s.gm.fillStyle(0x2a0712).fillRoundedRect(250,418,300,24,8).fillStyle(0x0f7b6c).fillRect(340,418,120,24).fillStyle(0xf2b134).fillRect(379,418,42,24).fillStyle(0xffffff).fillRect(250+300*q-3,412,6,36)}
  const B=S.p.find(p=>p.id===m.b)||{n:'?'};
  $('tm').textContent='⏱ '+S.time+'s';$('sc').textContent='⭐ '+(m.sc||0);$('sb').style.width=(m.s||0)+'%';
  $('story').innerHTML=m.o?'You got thrown out. Watch and heckle!':'<b>Cover:</b> '+esc(m.st)+'<br><b>Buddy:</b> '+esc(B.n)+'<br><b>Role:</b> '+myRole+' <small>('+RD[myRole]+')</small>';
  $('feed').innerHTML=S.feed.map(x=>'<div>'+esc(x)+'</div>').join('');
  const l=S.feed[S.feed.length-1]||'';if(l!==lf){lf=l;beep(/💥|🚀|😵|😰/.test(l)?150:/⚡/.test(l)?90:660)}
}
