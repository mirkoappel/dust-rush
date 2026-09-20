import test from 'node:test';
import assert from 'node:assert/strict';
import { Race,createTrack,angleDelta } from '../src/simulation.mjs';
const step=(r,input,n=60)=>{for(let i=0;i<n;i++)r.step(1/60,input);};
test('Die Strecke ist geschlossen und Projektion/Abstand sind konsistent',()=>{
  const t=createTrack();assert.ok(t.length>900);assert.ok(t.length<1600);
  for(let i=0;i<30;i++){const p=t.at(i*t.length/30,3),q=t.project(p.x,p.z);assert.ok(Math.abs(q.lateral-3)<.08);}
  const a=t.at(0),b=t.at(t.length);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-8);
});
test('Start-Countdown, Pause und Fortsetzen verändern keine Runden',()=>{
  const r=new Race();r.start();step(r,{},180);assert.equal(r.mode,'countdown');r.pause();const c=r.countdown;step(r,{},120);assert.equal(r.countdown,c);r.resume();step(r,{},30);assert.equal(r.mode,'racing');assert.equal(r.player.lap,0);
});
test('Gas, Pfeil-Steuersignal und Bremsen wirken unabhängig von Fahrhilfe',()=>{
  const r=new Race();r.start(false);r.mode='racing';const start=r.player.heading;
  step(r,{forward:true},60);const speed=r.player.speed;assert.ok(speed>3);assert.ok(speed<5,'Weiches Anfahren statt Vollgas-Sprung');
  step(r,{forward:true,steer:1},18);assert.ok(angleDelta(start,r.player.heading)<-.05,'Rechts lenkt aus Sicht der Fahrkamera nach rechts');
  step(r,{brake:true},30);assert.ok(r.player.speed<speed);
});
test('Auch ein altes Boost-Signal erhöht die normale Geschwindigkeit nicht',()=>{
  const r=new Race();r.start(true);r.mode='racing';r.cars=[r.player];step(r,{forward:true,boost:true},600);
  assert.ok(r.player.speed>12&&r.player.speed<13);assert.equal(r.pads.length,0);
});
test('Ziellinie allein erlaubt kein Abkürzen der Checkpoints',()=>{
  const r=new Race();const c=r.player,L=r.track.length;c.started=true;c.nextCheckpoint=5;c.projection.lateral=0;
  r.checkpoint(c,L-1,1);assert.equal(c.lap,0);assert.equal(c.finished,false);
});
test('Eine vollständige Checkpoint-Folge beendet erst die dritte Runde',()=>{
  const r=new Race();r.mode='racing';const c=r.player,L=r.track.length;c.projection.lateral=0;
  for(let pass=0;pass<=36;pass++){const s=pass%12*L/12;r.time=pass*2;r.checkpoint(c,(s-.5+L)%L,(s+.5)%L);}
  assert.equal(c.lap,3);assert.equal(c.finished,true);assert.equal(r.mode,'finished');assert.equal(r.events.filter(e=>e.type==='finish').length,1);
});
test('Die echte Fahrhilfe schafft drei Runden ohne Teleportieren',()=>{
  const r=new Race();r.start(true);let limit=60*380;while(r.mode!=='finished'&&limit--)r.step(1/60,{});
  assert.equal(r.mode,'finished','Fahrhilfe bleibt auf der Strecke und beendet das Rennen');assert.equal(r.player.lap,3);assert.ok(r.time>240&&r.time<350);assert.equal(r.player.respawns,0);
  assert.ok(r.player.lapTimes.every(t=>t>65));
});
test('Rampe hebt den Truck ab und Landung gibt Sprungpunkte',()=>{
  const r=new Race();r.start();r.mode='racing';r.cars=[r.player];r.props=[];const c=r.player,ra=r.ramps[0],p=r.track.at(ra.s-16,ra.lane);
  Object.assign(c,{x:p.x,z:p.z,s:p.s,heading:p.heading,speed:12.5});c.projection=r.track.project(c.x,c.z);
  let jumped=false,landed=false;
  for(let i=0;i<500;i++){r.step(1/60,{forward:true});jumped ||=c.air;landed ||=r.events.some(e=>e.type==='land');}
  assert.ok(jumped);assert.ok(landed);assert.ok(c.score>0);
});
test('Neustart setzt Gegner, Hindernisse und Ergebnis zurück',()=>{
  const r=new Race();r.start();r.mode='racing';r.player.score=123;r.props[0].active=false;r.mode='finished';r.start();
  assert.equal(r.player.score,0);assert.ok(r.props.every(p=>p.active));assert.equal(r.cars.length,6);assert.equal(r.mode,'countdown');
});
