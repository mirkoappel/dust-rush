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
test('Gas und Bremse sind eigenständige große Touch-Steuerungen',()=>{
  for(const action of ['forward','brake']){
    assert.match(page,new RegExp('data-control="'+action+'"'));
    assert.ok(game.includes("control('"+action+"')"));
  }
  assert.match(page,/aria-label="Gas geben"/);assert.match(page,/aria-label="Bremsen und rückwärts"/);
});
test('Lenktasten bleiben auch bei eingeschalteter Neigelenkung als Alternative sichtbar',()=>{
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(page,/data-control="left"/);assert.match(page,/data-control="right"/);
  assert.ok(!css.includes('body[data-tilt="active"] .touch-steering{display:none}'));
  assert.ok(!css.includes('body[data-tilt="active"] .pedals{'));
  assert.match(game,/steer:left\|\|right\?Number\(right\)-Number\(left\):tilt\.read\(\)/);
});
test('Handy-Lenkung ist voreingeschaltet und ihr Querformat-Schalter wird bei Aus durchgestrichen',()=>{
  const icons=readFileSync(new URL('../src/ui/icons.svg',import.meta.url),'utf8');
  assert.match(game,/let tiltWanted=tiltSupported/);
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

test('Leertaste fährt, linke Umschalttaste bremst und es gibt keinen Turbo',()=>{
  assert.ok(!page.includes('data-control="boost"'));assert.ok(!page.includes('id="turbo"'));
  assert.ok(game.includes("keys.has('Space')||control('forward')"));
  assert.ok(game.includes("keys.has('ShiftLeft')||control('brake')"));
  assert.ok(!game.includes("control('boost')"));
});

test('Farben liegen im kontextabhängigen Werkstattband, ohne Fahrhilfen',()=>{
  const workshop=page.match(/<section id="workshopPanel"([\s\S]*?)<\/section>/)?.[1];
  assert.ok(workshop);assert.equal((page.match(/data-color=/g)||[]).length,8);assert.ok(page.includes('id="paintBand"'));assert.ok(game.includes('truckPaint[colorTarget]'));
  assert.match(page,/aria-label="Werkstatt – deinen Monstertruck umbauen"/);
  assert.ok(!page.includes('id="assist"'));assert.ok(!game.includes("$('assist')"));
});
