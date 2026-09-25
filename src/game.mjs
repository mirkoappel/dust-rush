import { Race } from './simulation.mjs';
import { World } from './world.mjs';
import { Sound } from './audio.mjs';
import { TiltControl } from './tilt.mjs';
import { setupPWA } from './pwa.mjs';
import {normalizeBuild,normalizePaint,isPartAvailable} from './customization.mjs';
import {createInspection} from './ui/inspection.mjs';
const $=id=>document.getElementById(id),sound=new Sound();
let race=new Race();
const mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
document.body.classList.toggle('mobile',mobile);
let world,loaded=false,lastMode='',toastUntil=0,finishShown=false,last=performance.now(),accumulator=0,hudClock=0,inWorkshop=false,selectedCourse='race',best=null,goUntil=0,errors=0,settingsOpen=false;
const keys=new Set(),touch=new Map();
let tiltAttempted=false,previewing=false,truckBuild=normalizeBuild(),truckPaint=normalizePaint(),colorTarget='body',lastAddon='wing';
try{const saved=JSON.parse(localStorage.getItem('dust-rush-paint-v1'));truckPaint=normalizePaint(saved?.paint||{body:saved?.body,accent:saved?.accent});truckBuild=normalizeBuild(saved?.build);}catch{}
function applyPalette(){
  world?.setPlayerPaint(truckPaint);world?.setPlayerBuild(truckBuild);
  document.querySelectorAll('[data-color]').forEach(b=>{
    const selected=b.dataset.color===truckPaint[colorTarget];b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
  });
  const labels={body:'Karosserie',wheels:'Felgen',lift:'Federn',engine:'Motor',wing:'Spoiler',lights:'Lichter',pipes:'Auspuff'};
  $('paintBand').setAttribute('aria-label','Farbe: '+labels[colorTarget]);
  document.querySelectorAll('[data-build]').forEach(b=>{
    b.disabled=!isPartAvailable(b.dataset.build,truckBuild);
    const selected=b.dataset.value?truckBuild[b.dataset.build]===b.dataset.value:truckBuild[b.dataset.build];
    b.setAttribute('aria-pressed',String(!b.disabled&&selected));
  });
  try{localStorage.setItem('dust-rush-paint-v1',JSON.stringify({paint:truckPaint,body:truckPaint.body,accent:truckPaint.wheels,build:truckBuild}));}catch{}
}
const inspection=createInspection({canvas:$('game'),getWorld:()=>world,isWorkshop:()=>inWorkshop&&!settingsOpen,onChange:active=>{
  document.body.dataset.inspect=String(active);$('inspectControls').hidden=!active;$('inspectTruck').hidden=!inWorkshop||active;$('workshopPanel').hidden=!inWorkshop;$('paintBand').hidden=!inWorkshop;
}});
function showWorkshop(show){
  inWorkshop=show;world?.setWorkshop(show);document.body.dataset.room=show?'workshop':'driving';$('workshopPanel').hidden=!show;
  inspection.set(show);
  $('paintBand').hidden=!show;$('home').hidden=!show&&race.mode==='menu';
}
function selectCourse(course){
  if(!['race','arena','workshop'].includes(course)||(!loaded&&!previewing)||inWorkshop||race.mode!=='menu')return;
  selectedCourse=course;
  document.querySelectorAll('[data-course]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.course===course));});
  void previewCourse();
}
async function previewCourse(){
  // Selection changes the scenery, never the game mode. Rapid taps are coalesced
  // so an older asynchronous scene load cannot win over the latest selection.
  if(previewing||!loaded)return;
  previewing=true;$('start').disabled=true;
  try{
    let previewed;
    do{
      previewed=selectedCourse;
      await switchCourse(previewed==='arena');
      if(!loaded)return;
      world.setWorkshop(previewed==='workshop');
    }while(previewed!==selectedCourse);
  }finally{previewing=false;$('start').disabled=!loaded;}
}
document.querySelectorAll('button[data-course]').forEach(b=>b.addEventListener('click',()=>selectCourse(b.dataset.course)));

document.querySelectorAll('[data-workshop-tab]').forEach(b=>b.addEventListener('click',()=>{
  if(!isPartAvailable(lastAddon,truckBuild))lastAddon='wing';
  const selected=b.dataset.workshopTab;colorTarget=selected==='parts'?lastAddon:selected;
  document.querySelectorAll('[data-workshop-tab]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));
  document.querySelectorAll('[data-workshop-panel]').forEach(panel=>panel.hidden=panel.dataset.workshopPanel!==selected);applyPalette();inspection.focus(colorTarget);
}));
document.querySelectorAll('[data-build]').forEach(b=>b.addEventListener('click',()=>{
  if(!isPartAvailable(b.dataset.build,truckBuild))return;
  const key=b.dataset.build;colorTarget=key;if(['wing','lights','pipes'].includes(key))lastAddon=key;truckBuild=normalizeBuild({...truckBuild,[key]:b.dataset.value||!truckBuild[key]});applyPalette();inspection.focus(key);
}));
const tilt=new TiltControl(updateTilt);
try{best=JSON.parse(localStorage.getItem('dust-rush-best-v3'))||null;}catch{}
function clearInput(){keys.clear();touch.clear();document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed'));}
function control(name){return [...touch.values()].includes(name);}
function input(){
  const left=keys.has('ArrowLeft')||keys.has('KeyA')||control('left'),right=keys.has('ArrowRight')||keys.has('KeyD')||control('right');
  return {forward:keys.has('ArrowUp')||keys.has('KeyW')||control('forward'),brake:keys.has('ArrowDown')||keys.has('KeyS')||control('brake'),steer:left||right?Number(right)-Number(left):tilt.read()};
}
function updateTilt(){
  document.body.dataset.tilt=tilt.active?'active':'buttons';
  $('tiltToggle').setAttribute('aria-pressed',String(tilt.enabled));
}
async function enableTilt(){tiltAttempted=true;await tilt.enable();updateTilt();}
function preparePhone(){
  // Called directly from a tap: iOS sensor permission requires a user gesture.
  if(mobile&&!tiltAttempted)void enableTilt();else tilt.calibrate();
}
async function start(){
  if(!loaded||previewing||inWorkshop)return;
  if(selectedCourse==='workshop'){showWorkshop(true);applyPalette();syncMode();return;}
  preparePhone();await switchCourse(selectedCourse==='arena');if(!loaded)return;
  clearInput();finishShown=false;toastUntil=0;goUntil=0;settingsOpen=false;
  race.start();accumulator=0;last=performance.now();world.reset();applyPalette();world.cameraInitialized=false;
  void sound.init().then(()=>sound.setEnabled(sound.enabled)).catch(()=>{});syncMode();
}
function garage(){showWorkshop(false);clearInput();settingsOpen=false;race.reset();world.reset();applyPalette();world.cameraInitialized=false;finishShown=false;syncMode();selectCourse(selectedCourse);}
async function switchCourse(freestyle){
  if(!loaded)return;showWorkshop(false);if(race.freestyle===freestyle)return;
  loaded=false;clearInput();$('start').disabled=true;$('startText').textContent='Lädt …';world.dispose();
  race=new Race(undefined,freestyle);lastMode='';accumulator=0;frames=0;frameTotal=0;qualityAdjusted=false;
  document.body.dataset.course=freestyle?'arena':'race';
  await boot();if(loaded)applyPalette();
}

function pause(){if(race.pause()){clearInput();settingsOpen=true;syncMode();}}
function resume(){clearInput();tilt.calibrate();settingsOpen=false;race.resume();syncMode();}
function closeSettings(){if(race.mode==='paused')resume();else{settingsOpen=false;syncMode();}}
function syncMode(){
  const changed=lastMode!==race.mode;lastMode=race.mode;document.body.dataset.mode=race.mode;
  $('garage').hidden=race.mode!=='menu';$('hud').hidden=race.mode==='menu';
  $('home').hidden=race.mode==='menu'&&!inWorkshop;
  $('settings').hidden=['racing','countdown','paused','finished'].includes(race.mode);
  $('pauseOverlay').hidden=!settingsOpen;$('finishOverlay').hidden=race.mode!=='finished';
  if(changed&&race.mode==='paused')$('resume').focus({preventScroll:true});
  $('resume').setAttribute('aria-label',race.mode==='paused'?'Weiterspielen':'Einstellungen schließen');
  if(race.mode==='finished')showFinish();
  applyPendingUpdate();
}
function toast(symbol,time=950){$('toast').textContent=symbol;toastUntil=performance.now()+time;$('toast').classList.add('show');}
function showFinish(){
  if(finishShown)return;finishShown=true;clearInput();
  const p=race.player;$('finishTitle').textContent=p.rank===1?'Gewonnen!':'Geschafft!';
  $('finishSubtitle').textContent='Platz '+p.rank+' von 6';
  const stars=p.rank<=2?'★ ★ ★':p.rank<=4?'★ ★ ☆':'★ ☆ ☆';
  $('finishStars').textContent=stars;$('finishStars').setAttribute('aria-label',(p.rank<=2?3:p.rank<=4?2:1)+' Sterne');
  const newBest=!best||race.finishTime<best.time;$('newRecord').hidden=!newBest;
  if(newBest){best={time:race.finishTime,assist:race.assist,date:new Date().toISOString()};try{localStorage.setItem('dust-rush-best-v3',JSON.stringify(best));}catch{}}
  $('again').focus({preventScroll:true});
}
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});}
$('start').addEventListener('click',start);$('again').addEventListener('click',start);
$('pause').addEventListener('click',pause);$('resume').addEventListener('click',closeSettings);$('home').addEventListener('click',garage);
$('settings').addEventListener('click',()=>{if(race.mode==='racing'||race.mode==='countdown')pause();else{settingsOpen=true;syncMode();}});
$('pauseOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeSettings();});$('fullscreen').addEventListener('click',fullscreen);
$('tiltToggle').addEventListener('click',()=>{if(tilt.enabled){tilt.disable();updateTilt();}else void enableTilt();});
$('recover').addEventListener('click',()=>race.respawn());
$('retryLoad').addEventListener('click',()=>location.reload());
async function toggleSound(){sound.enabled=!sound.enabled;await sound.init().catch(()=>{});sound.setEnabled(sound.enabled);$('sound').setAttribute('aria-pressed',String(sound.enabled));}
$('sound').addEventListener('click',toggleSound);
document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>{truckPaint={...truckPaint,[colorTarget]:b.dataset.color};applyPalette();}));
const drivingKeys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
window.addEventListener('keydown',e=>{
  if((inspection.active&&!settingsOpen)||e.defaultPrevented)return;
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
  document.body.dataset.diagnostics=JSON.stringify({version:'polish-v5',loaded,errors,room:inWorkshop?'workshop':race.mode,selectedCourse,inspecting:inspection.active,course:race.freestyle?'arena':'race',autoGas:race.assist,y:p.y,vy:p.vy,x:p.x,z:p.z,contact:p.groundedFraction,cars:world.trucks.length,fps:frames?Math.round(frames/frameTotal):0,drawCalls:world.renderer.info.render.calls,lap:p.lap,rank:p.rank,checkpoint:p.nextCheckpoint,speed:Math.round(p.speed*3.6),air:p.air,steering:p.steering,respawns:p.respawns,propsHit:race.props.filter(p=>p.hit||p.crush>0).length,mobile,tilt:tilt.active,color:truckPaint.body,accent:truckPaint.wheels,paint:truckPaint,colorTarget,build:truckBuild,suspension:{heave:p.suspension.heave,pitch:p.suspension.pitch,roll:p.suspension.roll,wheels:p.suspension.wheels.map(w=>w.compression)}});
  $('position').textContent=race.freestyle?'★ '+p.score:p.rank+'/6';$('lapLabel').textContent=race.freestyle?'∞':Math.min(3,p.lap+1)+'/3';
  $('wrongWay').hidden=(!race.freestyle&&p.wrongWay<1.1)||race.mode!=='racing';
  [...$('lapDots').children].forEach((d,i)=>d.classList.toggle('done',i<=p.lap));
  $('countdown').textContent=race.mode==='countdown'?Math.min(3,Math.ceil(race.countdown)):now<goUntil?'🏁':'';
  if(now>toastUntil)$('toast').classList.remove('show');
}
function events(){
  for(const e of race.events.splice(0)){
    world.event(e);sound.event(e);
    if(e.type==='go')goUntil=performance.now()+950;
    if(e.type==='gate')toast('★ ★ ★',1200);
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
    loaded=true;applyPalette();$('start').disabled=previewing;$('startText').textContent='LOS!';$('loadStatus').textContent='';syncMode();
  }catch(e){console.error(e);errors++;document.body.dataset.mode='loading';$('startText').textContent='Noch nicht bereit';$('loadStatus').textContent='Bitte in einem aktuellen Browser mit WebGL öffnen.';$('retryLoad').hidden=false;}
  if(!loopStarted){loopStarted=true;requestAnimationFrame(loop);}
}
let loopStarted=false;
const applyPendingUpdate=setupPWA({isSafe:()=>loaded&&race.mode==='menu'&&!inWorkshop&&!settingsOpen});
updateTilt();boot();
