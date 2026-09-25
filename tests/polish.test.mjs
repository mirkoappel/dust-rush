import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Race} from '../src/simulation.mjs';
import {arenaSurfaceLocal,arenaSurfacePoint,collectArenaGates} from '../src/arena.mjs';
import {orbitChange,orbitZoom} from '../src/ui/inspection.mjs';
import {normalizeBuild} from '../src/customization.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Alle Karosserien werden gespeichert und ungültige Formen fallen auf Pickup zurück',()=>{
  for(const body of ['pickup','buggy','van','hotrod'])assert.equal(normalizeBuild({body}).body,body);
  assert.equal(normalizeBuild({body:'invalid'}).body,'pickup');
});
test('Diagonale Arena-Sprünge verwenden dieselben Koordinaten für Grafik und Physik',()=>{
  const r=new Race(undefined,true);
  for(const m of r.mounds)for(const phase of [.1,.5,.9]){
    const p=arenaSurfacePoint(m,phase,.2),local=arenaSurfaceLocal(m,p.z+95,p.x);
    assert.ok(Math.abs(local.along-m.length*phase)<1e-9);
    assert.ok(Math.abs(local.across-m.width*.1)<1e-9);
    const h=r.groundAt({projection:r.track.project(p.x,p.z)}).height;
    assert.ok(h>=Math.sin(phase*Math.PI)**2*m.height-1e-8);
  }
});
test('Ein Stunt-Ring zählt nur beim Durchfahren, genau einmal und nach Neustart erneut',()=>{
  const r=new Race(undefined,true),c=r.player,g=r.gates[0];
  Object.assign(c,{x:g.x,z:g.z+.2,y:g.y-1.2});
  collectArenaGates(r,c,g.x,g.z-.2);assert.equal(c.score,500);assert.equal(g.collected,true);
  collectArenaGates(r,c,g.x,g.z-.2);assert.equal(c.score,500);
  r.start();assert.ok(r.gates.every(g=>!g.collected));assert.equal(r.player.score,0);
  Object.assign(r.player,{x:g.x+10,z:g.z+.2,y:g.y-1.2});collectArenaGates(r,r.player,g.x+10,g.z-.2);assert.equal(r.player.score,0);
});
test('Gestapelte Kisten bleiben im Stand stabil und stürzen beim Anfahren ein',()=>{
  const r=new Race(undefined,true),c=r.player,base=r.props.find(p=>p.stack&&p.y<1);
  r.mode='racing';r.cars=[c];const upper=r.props.find(p=>p.stack===base.stack&&p.y>3),initial=upper.y;
  Object.assign(c,{x:base.x,z:base.z-1.3,y:0,heading:0,speed:8,vx:0,vz:8,projection:r.track.project(base.x,base.z-1.3)});
  for(let i=0;i<180;i++)r.step(1/120,{forward:true});
  assert.equal(upper.hit,true);assert.ok(upper.y<initial-.3);
});
test('Nahansicht dreht in beide Richtungen und begrenzt Zoom und Höhe',()=>{
  const view={yaw:0,pitch:.2,distance:7.4};
  assert.ok(orbitChange(view,50,0).yaw<0);assert.ok(orbitChange(view,-50,0).yaw>0);
  assert.equal(orbitChange(view,0,10000).pitch,1.35);assert.equal(orbitChange(view,0,-10000).pitch,-.22);
  assert.equal(orbitZoom(view,.0001).distance,3.8);assert.equal(orbitZoom(view,100).distance,12);
});
test('Jeder Modus startet über Play und hat denselben Zurück-Knopf in einer Toolbar',()=>{
  const page=read('src/page.html'),game=read('src/game.mjs'),css=read('style.css');
  assert.equal((page.match(/id="home"/g)||[]).length,1);
  assert.match(page,/id="home"[^>]*aria-label="Zurück zum Hauptmenü"[^>]*><svg[^>]*><use href="#i-left"/);
  assert.ok(!page.includes('id="pause"'));
  assert.match(page,/id="homeToolbar" class="toolbar-frame home-toolbar"/);
  assert.match(css,/\.toolbar-frame \.home-button\{[^}]*background:var\(--green\)/);
  assert.match(css,/\.inspect-controls\{[^}]*left:50%;top:var\(--safe-top\);transform:translateX\(-50%\);[^}]*flex-direction:row/);
  assert.match(css,/body:not\(\.mobile\) \.driving-controls[^}]*display:none/);
  assert.ok(!page.includes('id="brand"'));assert.ok(!page.includes('class="drive-hint'));
  assert.ok(!page.includes('id="workshopDone"'));assert.ok(!page.includes('id="toGarage"'));
  assert.ok(game.includes("selectedCourse==='workshop'"));
  assert.match(css,/\.workshop-tabs[^}]*flex-direction:column/);
  assert.match(css,/--action-size:clamp\(64px,9vw,78px\)/);
  assert.match(css,/\.drive-action\{[^}]*border-radius:50%/);
});
test('Lokale Vorschau registriert keinen Service Worker, das veröffentlichte Spiel behält Offline-Nutzung',()=>{
  const pwa=read('src/pwa.mjs');assert.ok(pwa.includes("['localhost','127.0.0.1','[::1]']"));
  assert.ok(pwa.includes("if(local&&'serviceWorker' in navigator)"));
  assert.ok(pwa.includes("navigator.serviceWorker.register('./service-worker.js'"));
});

test('Nitro und Bremse sitzen nah am Gas-Knopf, ohne die runden Trefferflächen zu verkleinern',()=>{
  const css=read('style.css');
  const factor=(selector,property)=>Number(css.match(new RegExp(selector+'\\{[^}]*?'+property+':calc\\(var\\(--action-size\\)\\*([.0-9]+)\\)'))?.[1]);
  const width=factor('\\.drive-actions','width'),gasSize=factor('\\.gas','width');
  const brakeBottom=factor('\\.handbrake','bottom'),nitroBottom=factor('\\.drive-actions \\.nitro','bottom');
  assert.match(css,/\.drive-actions \.nitro\{left:var\(--action-size\)/);
  for(const size of [64,78]){
    const gas={x:(width-gasSize/2)*size,y:gasSize/2*size,r:gasSize/2*size};
    const brake={x:.5*size,y:(brakeBottom+.5)*size,r:.5*size};
    const nitro={x:1.5*size,y:(nitroBottom+.5)*size,r:.5*size};
    for(const b of [brake,nitro]){
      assert.ok(b.x<gas.x&&b.y>gas.y);
      const gap=Math.hypot(b.x-gas.x,b.y-gas.y)-b.r-gas.r;
      assert.ok(gap>=6&&gap<=10,'Nur 6–10 px Abstand zwischen den sichtbaren Kreisen');
    }
    assert.ok(Math.hypot(nitro.x-brake.x,nitro.y-brake.y)>nitro.r+brake.r+8);
  }
});
