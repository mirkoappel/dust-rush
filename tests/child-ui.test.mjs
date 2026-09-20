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
test('Zusatztexte und Diagnoseoptionen bleiben hinter dem Erwachsenen-Menü',()=>{
  const advanced=page.match(/<details class="grown-ups">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(advanced);for(const id of ['showStats','suspensionDemo','savePicture'])assert.ok(advanced.includes('id="'+id+'"'));
  assert.match(page,/<button id="resume"[^>]*aria-label="Weiterspielen"[^>]*><svg/);
});

test('Es gibt keinen Turbo-Knopf und keine Turbo-Tastaturbelegung mehr',()=>{
  assert.ok(!page.includes('data-control="boost"'));assert.ok(!page.includes('id="turbo"'));
  assert.ok(!game.includes("keys.has('Space')"));assert.ok(!game.includes("control('boost')"));
});

test('Farben liegen nur in der Werkstatt, mit separaten Felgenfarben',()=>{
  const workshop=page.match(/<section id="workshopPanel"([\s\S]*?)<\/section>/)?.[1];
  assert.ok(workshop);assert.equal((workshop.match(/data-color=/g)||[]).length,4);assert.equal((workshop.match(/data-accent=/g)||[]).length,3);
  assert.match(page,/aria-label="Werkstatt – deinen Monstertruck umbauen"/);
  assert.ok(!page.includes('id="assist"'));assert.ok(!game.includes("$('assist')"));
});
