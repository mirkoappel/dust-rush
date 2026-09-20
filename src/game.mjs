import { Race } from './simulation.mjs';
import { World } from './world.mjs';
import { Sound } from './audio.mjs';
import { TiltControl } from './tilt.mjs';
import { setupPWA } from './pwa.mjs';
const $=id=>document.getElementById(id),sound=new Sound();
let race=new Race();
const mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
document.body.classList.toggle('mobile',mobile);
let world,loaded=false,lastMode='',toastUntil=0,finishShown=false,last=performance.now(),accumulator=0,hudClock=0,menuColor='#14bdd1',best=null,goUntil=0,errors=0,settingsOpen=false;
const keys=new Set(),touch=new Map();
let tiltAttempted=false;
const tilt=new TiltControl(updateTilt);
const fmt=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')+'.'+Math.floor(t*10)%10;
try{best=JSON.parse(localStorage.getItem('dust-rush-best-v2'))||null;}catch{}
function clearInput(){keys.clear();touch.clear();document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed'));}
function control(name){return [...touch.values()].includes(name);}
function input(){
  const left=keys.has('ArrowLeft')||keys.has('KeyA')||control('left'),right=keys.has('ArrowRight')||keys.has('KeyD')||control('right');
  return {forward:keys.has('ArrowUp')||keys.has('KeyW')||control('forward'),brake:keys.has('ArrowDown')||keys.has('KeyS')||control('brake'),steer:left||right?Number(right)-Number(left):tilt.read()};
}
function updateTilt(){
  document.body.dataset.tilt=tilt.active?'active':'buttons';
  $('tiltToggle').setAttribute('aria-pressed',String(tilt.enabled));
  $('calibrate').hidden=!tilt.enabled;
  $('tiltStatus').textContent=tilt.active?'Handy gerade halten → „Gerade halten“ antippen.':tilt.enabled?'Handy ruhig halten. Ohne Sensorsignal erscheinen Pfeiltasten.':'Am Handy: drehen und lenken. Oder die Pfeilknöpfe benutzen.';
}
async function enableTilt(){tiltAttempted=true;const ok=await tilt.enable();updateTilt();if(!ok)$('tiltStatus').textContent='Sensor nicht verfügbar oder nicht erlaubt. Die Pfeilknöpfe funktionieren trotzdem.';}
function preparePhone(){
  // Called directly from a tap: iOS sensor permission requires a user gesture.
  if(mobile&&!tiltAttempted)void enableTilt();else tilt.calibrate();
}
function start(){
  if(!loaded)return;preparePhone();clearInput();finishShown=false;toastUntil=0;goUntil=0;settingsOpen=false;
  race.start(!race.freestyle&&(mobile||$('assist').checked));accumulator=0;last=performance.now();world.reset();world.setPlayerColor(menuColor);world.cameraInitialized=false;
  void sound.init().then(()=>sound.setEnabled(sound.enabled)).catch(()=>{});syncMode();
}
function garage(){clearInput();settingsOpen=false;race.reset();world.reset();world.setPlayerColor(menuColor);world.cameraInitialized=false;finishShown=false;syncMode();}
async function switchCourse(freestyle){
  if(!loaded||race.freestyle===freestyle)return;
  loaded=false;clearInput();$('start').disabled=true;$('startText').textContent='Lädt …';world.dispose();
  race=new Race(undefined,freestyle);lastMode='';accumulator=0;frames=0;frameTotal=0;qualityAdjusted=false;
  document.body.dataset.course=freestyle?'arena':'race';
  for(const b of document.querySelectorAll('button[data-course]'))b.setAttribute('aria-pressed',String(b.dataset.course===(freestyle?'arena':'race')));
  await boot();if(loaded)world.setPlayerColor(menuColor);
}
$('raceMode').addEventListener('click',()=>void switchCourse(false));
$('arenaMode').addEventListener('click',()=>void switchCourse(true));
function pause(){if(race.pause()){clearInput();settingsOpen=true;syncMode();}}
function resume(){clearInput();tilt.calibrate();settingsOpen=false;race.resume();syncMode();}
function closeSettings(){if(race.mode==='paused')resume();else{settingsOpen=false;syncMode();}}
function syncMode(){
  const changed=lastMode!==race.mode;lastMode=race.mode;document.body.dataset.mode=race.mode;
  $('garage').hidden=race.mode!=='menu';$('hud').hidden=race.mode==='menu';
  $('assist').closest('label').hidden=mobile||race.freestyle;
  $('pauseOverlay').hidden=!settingsOpen;$('finishOverlay').hidden=race.mode!=='finished';
  if(changed&&race.mode==='paused')$('resume').focus({preventScroll:true});
  if(race.mode==='finished')showFinish();
}
function toast(symbol,time=950){$('toast').textContent=symbol;toastUntil=performance.now()+time;$('toast').classList.add('show');}
function showFinish(){
  if(finishShown)return;finishShown=true;clearInput();
  const p=race.player;$('finishTitle').textContent=p.rank===1?'Gewonnen!':'Geschafft!';
  $('finishSubtitle').textContent='Platz '+p.rank+' von 6';
  const stars=p.rank<=2?'★ ★ ★':p.rank<=4?'★ ★ ☆':'★ ☆ ☆';
  $('finishStars').textContent=stars;$('finishStars').setAttribute('aria-label',(p.rank<=2?3:p.rank<=4?2:1)+' Sterne');
  const newBest=!best||race.finishTime<best.time;$('newRecord').hidden=!newBest;
  if(newBest){best={time:race.finishTime,assist:race.assist,date:new Date().toISOString()};try{localStorage.setItem('dust-rush-best-v2',JSON.stringify(best));}catch{}}
  $('again').focus({preventScroll:true});
}
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});}
$('start').addEventListener('click',start);$('again').addEventListener('click',start);$('restart').addEventListener('click',start);
$('suspensionDemo').addEventListener('click',()=>{closeSettings();world?.testSuspension();});
$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('toGarage').addEventListener('click',garage);$('finishGarage').addEventListener('click',garage);
$('settings').addEventListener('click',()=>{if(race.mode==='racing'||race.mode==='countdown')pause();else{settingsOpen=true;syncMode();}});
$('closeSettings').addEventListener('click',closeSettings);$('fullscreen').addEventListener('click',fullscreen);
$('tiltToggle').addEventListener('click',()=>{if(tilt.enabled){tilt.disable();updateTilt();}else void enableTilt();});
$('calibrate').addEventListener('click',()=>{tilt.calibrate();$('tiltStatus').textContent='Geradeaus gespeichert. Gute Fahrt!';});
$('showStats').addEventListener('change',()=>{$('raceStats').hidden=!$('showStats').checked;});
$('recover').addEventListener('click',()=>race.respawn());
$('savePicture').addEventListener('click',()=>{world.render();$('game').toBlob(blob=>{if(!blob)return;const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='dust-rush-gameplay.png';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),10000);},'image/png');});
$('retryLoad').addEventListener('click',()=>location.reload());
$('brand').addEventListener('click',e=>e.preventDefault());
async function toggleSound(){sound.enabled=!sound.enabled;await sound.init().catch(()=>{});sound.setEnabled(sound.enabled);$('sound').setAttribute('aria-pressed',String(sound.enabled));}
$('sound').addEventListener('click',toggleSound);
if(mobile){$('assist').disabled=true;$('assist').closest('label').hidden=true;}
document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{menuColor=b.dataset.color;world?.setPlayerColor(menuColor);document.querySelectorAll('.swatch').forEach(o=>{o.classList.toggle('selected',o===b);o.setAttribute('aria-pressed',String(o===b));});}));
const drivingKeys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
window.addEventListener('keydown',e=>{
  if(drivingKeys.includes(e.code)&&['racing','countdown'].includes(race.mode)){e.preventDefault();keys.add(e.code);document.body.dataset.lastDrivingKey=e.code;}
  if(e.repeat)return;
  if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(settingsOpen)closeSettings();else pause();}
  if(e.code==='KeyR'&&race.mode==='racing'){race.respawn();e.preventDefault();}
  if(e.code==='KeyM')void toggleSound();
  if(e.code==='KeyF')fullscreen();
  if(e.code==='Enter'&&['menu','finished'].includes(race.mode)&&!settingsOpen){e.preventDefault();start();}
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(drivingKeys.includes(e.code)&&race.mode==='racing')e.preventDefault();});
document.querySelectorAll('[data-control]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.set(e.pointerId,b.dataset.control);b.classList.add('pressed');});
  const up=e=>{touch.delete(e.pointerId);b.classList.remove('pressed');};
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
});
window.addEventListener('blur',()=>{clearInput();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
function updateHUD(now){
  const p=race.player;updateTilt();
  document.body.dataset.diagnostics=JSON.stringify({version:'gentle-pedals-v3',loaded,errors,course:race.freestyle?'arena':'race',autoGas:race.assist,y:p.y,vy:p.vy,x:p.x,z:p.z,contact:p.groundedFraction,cars:world.trucks.length,fps:frames?Math.round(frames/frameTotal):0,drawCalls:world.renderer.info.render.calls,lap:p.lap,rank:p.rank,checkpoint:p.nextCheckpoint,speed:Math.round(p.speed*3.6),air:p.air,steering:p.steering,respawns:p.respawns,propsHit:race.props.filter(p=>p.hit||p.crush>0).length,mobile,tilt:tilt.active,suspension:{heave:p.suspension.heave,pitch:p.suspension.pitch,roll:p.suspension.roll,wheels:p.suspension.wheels.map(w=>w.compression)}});
  $('position').textContent=race.freestyle?'★ '+p.score:p.rank+'/6';$('lapLabel').textContent=race.freestyle?'∞':Math.min(3,p.lap+1)+'/3';$('raceTime').textContent=fmt(race.time);$('speed').textContent=Math.round(Math.abs(p.speed)*3.6);$('score').textContent=p.score;
  $('wrongWay').hidden=(!race.freestyle&&p.wrongWay<1.1)||race.mode!=='racing';
  [...$('lapDots').children].forEach((d,i)=>d.classList.toggle('done',i<=p.lap));
  $('countdown').textContent=race.mode==='countdown'?Math.min(3,Math.ceil(race.countdown)):now<goUntil?'🏁':'';
  if(now>toastUntil)$('toast').classList.remove('show');
}
function events(){
  for(const e of race.events.splice(0)){
    world.event(e);sound.event(e);
    if(e.type==='go')goUntil=performance.now()+950;
    if(e.type==='crush'&&e.player)toast('★');
    if(e.type==='land'&&e.distance>6)toast('★ ★');
    if(e.type==='lap'&&e.lap<3)toast(e.lap===2?'🏁':'★',1200);
  }
}
let frames=0,frameTotal=0,qualityAdjusted=false;
function loop(now){
  const raw=(now-last)/1000;last=now;const dt=Math.min(.05,Math.max(0,raw));
  if(loaded){
    accumulator=Math.min(accumulator+dt,.12);
    while(accumulator>=1/120){race.step(1/120,input());accumulator-=1/120;}
    events();syncMode();world.sync(dt,accumulator*120);world.render();sound.update(race.player,race.mode,race.time);
    hudClock+=dt;if(hudClock>.10){updateHUD(now);hudClock=0;}
    if(race.mode==='racing'&&raw<.2){frames++;frameTotal+=raw;if(frames>180&&!qualityAdjusted&&frameTotal/frames>.027){world.renderer.setPixelRatio(1);world.resize();qualityAdjusted=true;}}
  }
  requestAnimationFrame(loop);
}
window.addEventListener('error',()=>errors++);
window.addEventListener('unhandledrejection',()=>errors++);
async function boot(){
  try{
    world=new World($('game'),race);world.sync(0);world.render();await world.load();await world.renderer.compileAsync(world.scene,world.camera);world.render();last=performance.now();accumulator=0;
    loaded=true;$('start').disabled=false;$('startText').textContent='LOS!';$('loadStatus').textContent='';syncMode();
  }catch(e){console.error(e);errors++;document.body.dataset.mode='loading';$('startText').textContent='Noch nicht bereit';$('loadStatus').textContent='Bitte in einem aktuellen Browser mit WebGL öffnen.';$('retryLoad').hidden=false;}
  if(!loopStarted){loopStarted=true;requestAnimationFrame(loop);}
}
let loopStarted=false;
setupPWA({install:$('install'),update:$('update'),hint:$('installHint'),isSafe:()=>['menu','paused','finished'].includes(race.mode)});
updateTilt();boot();
