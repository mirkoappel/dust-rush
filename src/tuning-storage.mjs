import {CAMERA_DEFAULTS,applyCameraPreset} from './driving-camera.mjs';
import {
  VEHICLE_PRESETS,
  applyVehiclePhysicsProfile,
  applyVehiclePreset,
  createVehiclePhysicsProfile
} from './vehicle-physics-profile.mjs';

export const TUNING_STORAGE_KEY='dust-rush-tuning-v1';

const applySavedCamera=(target,source)=>{
  for(const key of Object.keys(CAMERA_DEFAULTS)){
    const value=Number(source?.[key]);
    if(Number.isFinite(value))target[key]=value;
  }
};

export function loadTuning(storage,{profile,camera}){
  try{
    const saved=JSON.parse(storage?.getItem(TUNING_STORAGE_KEY));
    if(saved?.preset==='custom'){
      if(saved.profile)applyVehiclePhysicsProfile(profile,createVehiclePhysicsProfile(saved.profile));
      applySavedCamera(camera,saved.camera);
      return 'custom';
    }
    if(VEHICLE_PRESETS[saved?.preset]){
      applyVehiclePreset(profile,saved.preset);
      applyCameraPreset(camera,saved.preset);
      return saved.preset;
    }
  }catch{}
  applyVehiclePreset(profile,'monsterBeginner');
  applyCameraPreset(camera,'monsterBeginner');
  return 'monsterBeginner';
}

export function saveTuning(storage,state){
  try{
    storage?.setItem(TUNING_STORAGE_KEY,JSON.stringify(state));
    return true;
  }catch{return false;}
}
