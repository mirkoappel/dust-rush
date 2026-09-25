import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BUILD,normalizeBuild,buildGeometry} from '../src/customization.mjs';
test('Ungültige gespeicherte Teile fallen sicher auf den Standard zurück',()=>{
  for(const value of [null,42,'oops',{}, {wheels:'huge',lift:999,wing:'yes'}])assert.deepEqual(normalizeBuild(value),DEFAULT_BUILD);
});
test('Reifen, Fahrwerk und Anbauteile sind unabhängig kombinierbar',()=>{
  const c=normalizeBuild({wheels:'giant',lift:'high',wing:true,lights:true,pipes:true});
  assert.deepEqual(c,{body:'pickup',wheels:'giant',lift:'high',engine:'classic',wing:true,lights:true,pipes:true});
  assert.deepEqual(normalizeBuild(JSON.parse(JSON.stringify(c))),c);
});
test('Riesenreifen behalten Bodenkontakt und erhalten die passende Abrollgröße',()=>{
  const standard=buildGeometry(),giant=buildGeometry({wheels:'giant',lift:'high'});
  assert.equal(standard.wheelScale,1);assert.ok(giant.wheelRadius>standard.wheelRadius);
  assert.ok(Math.abs(.685+giant.groundLift-giant.wheelRadius)<1e-10);assert.equal(giant.bodyLift,.28);
});
