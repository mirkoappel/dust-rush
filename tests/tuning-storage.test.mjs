import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMERA_PRESETS} from '../src/driving-camera.mjs';
import {
  VEHICLE_PRESETS,
  createVehiclePhysicsProfile,
  snapshotVehiclePhysicsProfile
} from '../src/vehicle-physics-profile.mjs';
import {TUNING_STORAGE_KEY,loadTuning,saveTuning} from '../src/tuning-storage.mjs';

const memoryStorage=()=>{
  const values=new Map();
  return {
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,String(value))
  };
};
const target=()=>({
  profile:createVehiclePhysicsProfile(VEHICLE_PRESETS.monster.values),
  camera:{...CAMERA_PRESETS.monster}
});

test('Ohne gespeichertes Tuning ist der Einsteiger-Monstertruck der Startwert',()=>{
  const storage=memoryStorage(),state=target();
  assert.equal(loadTuning(storage,state),'monsterBeginner');
  assert.equal(state.profile.massKg,5443);
  assert.equal(state.profile.powerPs,400);
  assert.deepEqual(state.camera,CAMERA_PRESETS.monsterBeginner);
});

test('Ein benanntes Preset wird mit Fahrzeug, Lenkung und Drohne wiederhergestellt',()=>{
  const storage=memoryStorage(),state=target();
  storage.setItem(TUNING_STORAGE_KEY,JSON.stringify({preset:'formula'}));
  assert.equal(loadTuning(storage,state),'formula');
  assert.equal(state.profile.massKg,800);
  assert.equal(state.profile.steering,.35);
  assert.deepEqual(state.camera,CAMERA_PRESETS.formula);
});

test('Benutzerdefiniertes Tuning überlebt vollständig ein Neuladen',()=>{
  const storage=memoryStorage(),source=target();
  source.profile.powerPs=777;
  source.profile.nitro.rampTime=4.2;
  source.profile.steering=.63;
  source.camera.reactionTime=1.4;
  source.camera.speedReserve=52;
  assert.equal(saveTuning(storage,{preset:'custom',profile:snapshotVehiclePhysicsProfile(source.profile),camera:{...source.camera}}),true);
  const restored=target();
  assert.equal(loadTuning(storage,restored),'custom');
  assert.deepEqual(restored.profile,source.profile);
  assert.deepEqual(restored.camera,source.camera);
});

test('Defekte gespeicherte Daten werden ignoriert',()=>{
  const storage=memoryStorage(),state=target();
  storage.setItem(TUNING_STORAGE_KEY,'kein json');
  assert.equal(loadTuning(storage,state),'monsterBeginner');
  assert.equal(state.profile.massKg,5443);
  assert.equal(state.profile.powerPs,400);
});
