import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('Die fertige HTML-Datei lädt keine Skripte oder Styles nach',()=>{
  assert.equal(/<(?:script|link)\b[^>]*(?:src|href)="(?!data:)[^"]+"/.test(html),false);
  assert.equal(/<script[^>]+type="(?:module|importmap)"/.test(html),false);
  assert.ok(html.includes('<style>'));
});
test('Das komplette originale GLB steckt in der einzelnen HTML-Datei',()=>{
  const model=readFileSync(new URL('../assets/monstertruck.glb',import.meta.url));
  assert.equal(model.readUInt32LE(0),0x46546c67);assert.ok(html.includes(model.toString('base64')));
});
test('Das eingebettete Offline-Skript ist syntaktisch ausführbar',()=>{
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);assert.doesNotThrow(()=>new Script(scripts[0][1]));
});

