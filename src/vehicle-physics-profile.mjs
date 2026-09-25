// Canonical, session-mutable vehicle physics profile.
// Values use game metres, seconds, kilograms and explicitly named UI units.
export function automaticGearRatios(count){
  const length=Math.max(2,Math.min(6,Math.round(count))),first=2.65;
  return Array.from({length},(_,index)=>Number(Math.pow(first,1-index/(length-1)).toFixed(4)));
}
const DEFAULTS={
  massKg:5000,
  powerPs:1500,
  throttleResponse:1/3.4,
  accelerationFalloff:2,
  grip:0.9,
  brakingG:8.2/9.81,
  brakingResponse:1/12,
  brakingGrip:0.9,
  steering:1,
  drivetrain:{idleRpm:1000,redlineRpm:7000,finalRatio:32.4,gears:automaticGearRatios(3)},
  suspension:{stiffness:1,damping:1},
  speed:{race:15.5,arena:11.5,reverse:3.1},
  nitro:{duration:5,recharge:12,delay:2,speedGain:8.5,power:1,forwardGrip:1}
};

const copy=profile=>({
  massKg:profile.massKg,
  powerPs:profile.powerPs,
  throttleResponse:profile.throttleResponse,
  accelerationFalloff:profile.accelerationFalloff,
  grip:profile.grip,
  brakingG:profile.brakingG,
  brakingResponse:profile.brakingResponse,
  brakingGrip:profile.brakingGrip,
  steering:profile.steering,
  drivetrain:{...profile.drivetrain,gears:[...profile.drivetrain.gears]},
  suspension:{...profile.suspension},
  speed:{...profile.speed},
  nitro:{...profile.nitro}
});

export const VEHICLE_PHYSICS_DEFAULTS=Object.freeze({
  ...DEFAULTS,
  drivetrain:Object.freeze({...DEFAULTS.drivetrain,gears:Object.freeze([...DEFAULTS.drivetrain.gears])}),
  suspension:Object.freeze({...DEFAULTS.suspension}),
  speed:Object.freeze({...DEFAULTS.speed}),
  nitro:Object.freeze({...DEFAULTS.nitro})
});

export function createVehiclePhysicsProfile(overrides={}){
  return {
    ...copy(VEHICLE_PHYSICS_DEFAULTS),
    ...overrides,
    drivetrain:{...VEHICLE_PHYSICS_DEFAULTS.drivetrain,...overrides.drivetrain,gears:[...(overrides.drivetrain?.gears||VEHICLE_PHYSICS_DEFAULTS.drivetrain.gears)]},
    suspension:{...VEHICLE_PHYSICS_DEFAULTS.suspension,...overrides.suspension},
    speed:{...VEHICLE_PHYSICS_DEFAULTS.speed,...overrides.speed},
    nitro:{...VEHICLE_PHYSICS_DEFAULTS.nitro,...overrides.nitro}
  };
}

export function snapshotVehiclePhysicsProfile(profile){
  return copy(profile);
}

export function applyVehiclePhysicsProfile(target,source){
  for(const key of ['massKg','powerPs','throttleResponse','accelerationFalloff','grip','brakingG','brakingResponse','brakingGrip','steering'])target[key]=source[key];
  Object.assign(target.drivetrain,source.drivetrain,{gears:[...source.drivetrain.gears]});
  Object.assign(target.suspension,source.suspension);
  Object.assign(target.speed,source.speed);
  Object.assign(target.nitro,source.nitro);
  return target;
}

export const VEHICLE_PHYSICS=createVehiclePhysicsProfile();
