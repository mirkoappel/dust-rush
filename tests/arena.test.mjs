import test from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/simulation.mjs';
test('Arena hat Tribünenfläche, zwölf Sprunghügel, fünf Stunt-Ringe und sechzehn Schrottautos',()=>{
  const r=new Race(undefined,true);assert.equal(r.freestyle,true);assert.equal(r.props.filter(p=>p.type==='car').length,16);assert.equal(r.mounds.length,12);assert.equal(r.gates.length,5);
  assert.equal(r.player.x,0);assert.equal(r.player.z,-67);assert.ok(r.props.length>50);
});
test('Freestyle läuft ohne Rundenziel oder falsche Richtung unbegrenzt weiter',()=>{
  const r=new Race(undefined,true);r.start(true);for(let i=0;i<60*210;i++)r.step(1/60,{forward:true,steer:Math.sin(i/150)*.65});
  assert.equal(r.mode,'racing');assert.equal(r.player.lap,0);assert.equal(r.player.wrongWay,0);
  for(const c of r.cars){assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.z));assert.ok(Math.abs(c.x)<91&&Math.abs(c.z)<91);}
});
test('Arena erzwingt keine Rundstrecke und Rücksetzen bringt den Truck zum Eingang',()=>{
  const r=new Race(undefined,true);r.mode='racing';r.player.x=60;r.player.z=0;r.player.s=95;r.player.heading=Math.PI/2;r.player.speed=15;r.player.projection=r.track.project(60,0);
  for(let i=0;i<20;i++)r.step(1/60,{});
  assert.equal(r.player.respawns,0);assert.ok(r.player.x>63);
  r.respawn();assert.equal(r.player.x,0);assert.equal(r.player.z,-67);
});
test('Großer Arena-Hügel erlaubt Sprünge in beiden Richtungen',()=>{
  for(const heading of [0,Math.PI]){
    const r=new Race(undefined,true),c=r.player,m=r.mounds[0],z=heading===0?m.s-95-20:m.s-95+m.length+20;
    Object.assign(c,{x:0,z,s:z+95,heading,speed:8.8,projection:r.track.project(0,z)});
    r.mode='racing';r.assist=false;
    let jumped=false;for(let i=0;i<600;i++){r.drive(c,1/60,{forward:true});jumped ||=c.air;}
    assert.ok(jumped,'Hügel springt auch gegen die Z-Richtung');
  }
});
