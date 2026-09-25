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
test('Pause-Menü zeigt nur Bildschalter und darunter Play, ohne Neustart oder Zusatzoptionen',()=>{
  const pause=page.match(/<section id="pauseOverlay"([\s\S]*?)<\/section>/)?.[1];
  assert.ok(pause);
  for(const id of ['closeSettings','restart','showStats','suspensionDemo','savePicture','calibrate','installHint','raceStats']){
    assert.ok(!page.includes('id="'+id+'"'),id);
    assert.ok(!game.includes("$('"+id+"')"),id);
  }
  assert.ok(!pause.includes('grown-ups'));assert.ok(!pause.includes('settings-note'));
  assert.ok(pause.indexOf('id="resume"')>pause.indexOf('id="tiltToggle"'));
  assert.match(page,/<button id="resume"[^>]*aria-label="Weiterspielen"[^>]*><svg/);
});

test('Es gibt keinen Turbo-Knopf und keine Turbo-Tastaturbelegung mehr',()=>{
  assert.ok(!page.includes('data-control="boost"'));assert.ok(!page.includes('id="turbo"'));
  assert.ok(!game.includes("keys.has('Space')"));assert.ok(!game.includes("control('boost')"));
});

test('Farben liegen im kontextabhängigen Werkstattband, ohne Fahrhilfen',()=>{
  const workshop=page.match(/<section id="workshopPanel"([\s\S]*?)<\/section>/)?.[1];
  assert.ok(workshop);assert.equal((page.match(/data-color=/g)||[]).length,7);assert.ok(page.includes('id="paintBand"'));assert.ok(game.includes('truckPaint[colorTarget]'));
  assert.match(page,/aria-label="Werkstatt – deinen Monstertruck umbauen"/);
  assert.ok(!page.includes('id="assist"'));assert.ok(!game.includes("$('assist')"));
});
