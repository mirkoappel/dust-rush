import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../src/game.mjs',import.meta.url),'utf8');
const world=readFileSync(new URL('../src/world.mjs',import.meta.url),'utf8');
test('Spielarten und Werkstatt haben eigene Bildkarten und zugängliche Namen',()=>{
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  const standard=page.match(/<div class="course-picker"[\s\S]*?<\/div>/)?.[0]||'';
  assert.equal((page.match(/class="mode-art"/g)||[]).length,4);
  assert.equal((standard.match(/class="mode-art"/g)||[]).length,3);
  assert.ok(!standard.includes('id="speedwayMode"'));
  assert.match(page,/aria-label="Rennen – Strecke mit Zielflagge"/);
  assert.match(page,/aria-label="Rambazamba – frei in der Sprungarena fahren"/);
  assert.match(page,/id="speedwayMode" class="debug-course-card"[^>]*hidden/);
  assert.match(game,/\$\('speedwayMode'\)\.hidden=!visible/);
  assert.match(css,/\.course-picker\{[^}]*grid-template-columns:repeat\(3/);
  assert.match(css,/\.course-row\{[^}]*justify-content:space-between/);
  assert.match(css,/\.debug-course-card\{[^}]*flex:0 0 calc/);
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
test('Heller Lenkgriff und grüne Berührungsrückmeldung; rechts bleiben drei einzelne Knöpfe',()=>{
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(css,/\.stick-thumb\{[^}]*background:#f8eedba6/);
  assert.match(css,/\.drive-stick\.held \.stick-thumb\{[^}]*background:#c2e478/);
  assert.match(css,/\.drive-stick\.held \.stick-base\{[^}]*background:#c2e478/);
  assert.ok(!page.includes('drive-action-base'));
  assert.match(page,/class="symbol reverse-symbol"/);
});
test('Zurücksetzen sitzt neben den Einstellungen; hochkant hat die Punktzahl eine eigene Zeile',()=>{
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(css,/\.wrong-way\{position:absolute;right:calc\(var\(--safe-right\) \+ 72px\);top:var\(--safe-top\)\}/);
  assert.ok(!css.includes('body.mobile .wrong-way'));
  assert.match(css,/@media\(max-width:650px\) and \(orientation:portrait\)\{[\s\S]*?\.score-hud\{top:calc\(var\(--safe-top\) \+ 74px\)/);
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

test('Tuning zeigt die Presetauswahl über sechs kompakten Icon-Tabs',()=>{
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  const tabs=page.match(/<div class="tuning-tabs"[\s\S]*?<\/div>/)?.[0]||'';
  assert.equal((tabs.match(/role="tab"/g)||[]).length,6);
  for(const icon of ['engine','settings','spring','wheel','nitro','drone'])assert.match(tabs,new RegExp('href="#i-'+icon+'"'));
  assert.ok(page.indexOf('id="tuningPreset"')<page.indexOf('class="tuning-tabs"'));
  assert.ok(!page.includes('data-tuning-panel="preset"'));
  const tyres=page.split('id="tuningTyresPanel"')[1].split('</div>')[0];
  const chassis=page.split('id="tuningChassisPanel"')[1].split('</div>')[0];
  assert.match(tyres,/data-tuning="steering"/);
  assert.ok(!chassis.includes('data-tuning="steering"'));
  assert.match(page,/data-tuning-main-tab="feel">Fahrgefühl<\/button>/);
  assert.match(page,/data-tuning-main-tab="performance">Performance<\/button>/);
  assert.match(page,/id="tuningOpponents" type="checkbox" checked/);
  assert.match(page,/id="tuningOpponentSimulation" type="checkbox" checked/);
  assert.match(page,/id="tuningPanel"[^>]*data-tuning-drag-handle/);
  assert.ok(!page.includes('class="tuning-drag-handle"'));
  assert.match(page,/data-tuning="rollingResistance"/);
  assert.match(page,/data-tuning="dragArea"/);
  assert.match(game,/tuningOpponents[^\n]*setOpponentsVisible/);
  assert.match(game,/tuningOpponentSimulation[^\n]*setOpponentsSimulated/);
  assert.match(world,/setOpponentsVisible\(visible\)/);
  assert.match(world,/setOpponentsSimulated\(enabled\)/);
  assert.match(world,/if\(i>0&&this\.opponentsVisible===false\)return/);
  assert.ok(!page.includes('<h2>Fahrgefühl testen</h2>'));
  assert.match(css,/\.tuning-tabs\{[^}]*grid-template-columns:repeat\(6/);
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
