import test from 'node:test';
import assert from 'node:assert/strict';
import {screenRoll,steeringFromRoll} from '../src/tilt.mjs';
import {Race} from '../src/simulation.mjs';
import {kickProp,stepProps} from '../src/obstacles.mjs';
test('Lenkradwinkel: Totzone, Links/Rechts und Anschlag',()=>{
  assert.equal(steeringFromRoll(1),0);assert.ok(steeringFromRoll(-14)<-.5);assert.ok(steeringFromRoll(14)>.5);
  assert.equal(steeringFromRoll(80),1);assert.equal(steeringFromRoll(-80),-1);
  assert.ok(steeringFromRoll(-178,178)>0);assert.equal(screenRoll(null,0),null);
});
test('Handywinkel wird für beide Querformate auf Bildschirmachsen umgerechnet',()=>{
  assert.ok(Math.abs(screenRoll(0,60,90))<1e-6);
  assert.ok(screenRoll(-15,60,90)>10);assert.ok(screenRoll(15,60,90)<-10);
  assert.ok(Math.abs(screenRoll(0,-60,-90))<1e-6);
  assert.ok(screenRoll(15,-60,-90)>10);assert.ok(screenRoll(-15,-60,-90)<-10);
  assert.ok(screenRoll(60,20,0)>0);assert.ok(screenRoll(60,-20,0)<0);
});
test('Hindernisse enthalten Pylonen, Reifen, Kisten, Fässer und neun Schrottautos',()=>{
  const r=new Race();assert.deepEqual(new Set(r.props.map(p=>p.type)),new Set(['cone','barrel','crate','tyre','car']));
  assert.equal(r.props.filter(p=>p.type==='car').length,9);assert.ok(r.mounds.length>=8);
});
test('Fass bekommt Impuls, bleibt sichtbar, prallt auf und kommt zur Ruhe',()=>{
  const r=new Race(),p=r.props.find(p=>p.type==='barrel'),x=p.x,z=p.z;
  assert.equal(kickProp(p,{x:p.x,z:p.z-1,heading:0,speed:36,id:0}),true);
  assert.equal(kickProp(p,{x:p.x,z:p.z-1,heading:0,speed:36,id:0}),false);
  for(let i=0;i<1200;i++)stepProps([p],1/60);
  assert.ok(Math.hypot(p.x-x,p.z-z)>5);assert.equal(p.active,true);assert.equal(p.vx,0);assert.equal(p.vz,0);assert.equal(p.vy,0);
  assert.ok(p.rx!==0);assert.ok(p.y>=.7);
});
test('Schrottauto ist überfahrbar und wird durch das Überfahren flacher',()=>{
  const r=new Race(),p=r.props.find(p=>p.type==='car'),c=r.player;
  const before=r.groundAt({projection:{s:p.s,lateral:p.lane}}).height;assert.ok(before>1);
  const at=r.track.at(p.s-.3,p.lane);
  Object.assign(c,{x:at.x,z:at.z,heading:at.heading,s:at.s,speed:8,projection:r.track.project(at.x,at.z)});
  r.drive(c,1/60,{forward:true});
  assert.ok(p.crush>0);assert.ok(r.groundAt({projection:{s:p.s,lateral:p.lane}}).height<before);
  assert.ok(c.score>=250);assert.ok(r.events.some(e=>e.type==='crush'));
});
test('Rücksetzen setzt angefahrene Gegenstände und zerdrückte Autos zurück',()=>{
  const r=new Race();r.props[0].hit=true;r.props.find(p=>p.type==='car').crush=1;r.reset();
  assert.ok(r.props.every(p=>!p.hit&&p.crush===0));
});

