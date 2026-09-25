import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../src/game.mjs',import.meta.url),'utf8');
test('Spielarten und Werkstatt haben eigene Bildkarten und zugängliche Namen',()=>{
  assert.equal((page.match(/class="mode-art"/g)||[]).length,3);
  assert.match(page,/aria-label="Rennen – Strecke mit Zielflagge"/);
  assert.match(page,/aria-label="Rambazamba – frei in der Sprungarena fahren"/);
});
test('Ein horizontaler Lenkregler und drei runde Knöpfe trennen Lenken und Gas',()=>{
  for(const action of ['forward','handbrake','nitro']){
    assert.match(page,new RegExp('data-control="'+action+'"'));
  }
  assert.match(page,/id="driveStick"/);assert.equal((page.match(/data-control=/g)||[]).length,3);
  assert.match(page,/aria-label="Lenkregler: horizontal nach links und rechts ziehen"/);
  assert.match(page,/class="charge-ring"/);
});
test('Der Joystick bleibt auch bei eingeschalteter Neigelenkung als Alternative sichtbar',()=>{
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.ok(!css.includes('body[data-tilt="active"] .driving-controls{display:none}'));
  assert.match(game,/combineDrivingInput\(keys,driving.read\(\),tilt.read\(\),driving.actions\(\)\)/);
  assert.match(css,/body:not\(\.mobile\) .driving-controls/);
});
test('Neigelenkung ist optional und standardmäßig aus; ihr Querformat-Schalter wird bei Aus durchgestrichen',()=>{
  const icons=readFileSync(new URL('../src/ui/icons.svg',import.meta.url),'utf8');
  assert.match(game,/let tiltWanted=false/);
  assert.match(game,/if\(tiltWanted&&!tilt.enabled\)void enableTilt\(\)/);
  assert.match(page,/id="tiltToggle"[^>]*aria-label="Handy kippen zum Lenken"/);
  assert.match(page,/<use href="#i-phone-steer"/);
  assert.match(page,/id="tiltToggle"[\s\S]*?<b class="off-slash"/);
  assert.match(icons,/id="i-phone-steer"/);
});
test('Einstellungen sind eine kleine Icon-Leiste ohne Play und ohne Hover-Auslöser',()=>{
  const pause=page.match(/<div id="settingsToolbar"([\s\S]*?)<\/div>/)?.[1];
  assert.ok(pause);
  for(const id of ['resume','closeSettings','restart','showStats','suspensionDemo','savePicture','calibrate','installHint','raceStats']){
    assert.ok(!page.includes('id="'+id+'"'),id);
    assert.ok(!game.includes("$('"+id+"')"),id);
  }
  assert.match(pause,/class="settings-toolbar"/);
  assert.ok(pause.indexOf('id="sound"')<pause.indexOf('id="fullscreen"'));
  assert.ok(pause.indexOf('id="fullscreen"')<pause.indexOf('id="tiltToggle"'));
  assert.ok(!game.includes("$('settings').addEventListener('pointerenter'"));
  assert.ok(!game.includes("$('fullscreen').hidden="));
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(css,/\.settings-toolbar\{[^}]*flex-direction:column/);
  assert.match(css,/\.toolbar-frame button\{[^}]*width:48px;height:48px/);
});

test('Gas liegt auf Space, Nitro auf Pfeil hoch, Driftbremse auf Pfeil runter; X und C bleiben Alternativen',()=>{
  const input=readFileSync(new URL('../src/driving-input.mjs',import.meta.url),'utf8');
  for(const key of ['Space','ArrowUp','ArrowDown','ShiftLeft','KeyX','KeyC'])assert.ok(input.includes("keys.has('"+key+"')"));
  assert.ok(page.includes('data-control="forward"'));assert.ok(!page.includes('data-control="brake"'));
});

test('Farben liegen im kontextabhängigen Werkstattband, ohne Fahrhilfen',()=>{
  const workshop=page.match(/<section id="workshopPanel"([\s\S]*?)<\/section>/)?.[1];
  assert.ok(workshop);assert.equal((page.match(/data-color=/g)||[]).length,8);assert.ok(page.includes('id="paintBand"'));assert.ok(game.includes('truckPaint[colorTarget]'));
  assert.match(page,/aria-label="Werkstatt – deinen Monstertruck umbauen"/);
  assert.ok(!page.includes('id="assist"'));assert.ok(!game.includes("$('assist')"));
});
