// Deterministic arcade spring/damper simulation, in world metres.
import {VEHICLE_DIMENSIONS} from './vehicle-dimensions.mjs';
import {VEHICLE_PHYSICS} from './vehicle-physics-profile.mjs';
export const WHEEL_CORNERS=[
  {code:'FL',side:1,front:1},{code:'FR',side:-1,front:1},
  {code:'RL',side:1,front:-1},{code:'RR',side:-1,front:-1}
];
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createSuspension() {
  return {heave:0,heaveVelocity:0,pitch:0,pitchVelocity:0,roll:0,rollVelocity:0,wasAir:false,lastCrash:0,impact:0,
    wheels:WHEEL_CORNERS.map(()=>({offset:0,velocity:0,compression:0,contact:true}))};
}
export function suspensionRates(profile=VEHICLE_PHYSICS){
  const mass=Math.max(1,profile.massKg),springRate=Math.max(0,profile.suspension.springRateKnPerM)*1000;
  const dampingRate=Math.max(0,profile.suspension.dampingKnSPerM)*1000;
  return {spring:4*springRate/mass,damping:4*dampingRate/mass};
}
function spring(state,key,velocity,target,stiffness,damping,dt,min,max) {
  state[velocity]+=((target-state[key])*stiffness-state[velocity]*damping)*dt;
  state[key]+=state[velocity]*dt;
  if(state[key]<min){state[key]=min;state[velocity]=Math.max(0,state[velocity])*.25;}
  if(state[key]>max){state[key]=max;state[velocity]=Math.min(0,state[velocity])*.25;}
}
export function stepSuspension(state,dt,{air=false,ground=[0,0,0,0],contacts=null,acceleration=0,lateralAcceleration=0,crash=0}={},profile=VEHICLE_PHYSICS) {
  dt=limit(dt,0,1/30);
  if(state.wasAir&&!air)state.heaveVelocity-=limit(state.impact||8,0,24)*.23;
  if(crash>state.lastCrash+.1){state.heaveVelocity-=crash*.9;state.rollVelocity+=(lateralAcceleration<0?-1:1)*crash*.65;}
  state.lastCrash=crash;state.wasAir=air;state.impact=0;
  const mean=ground.reduce((a,b)=>a+b,0)/4;
  const rates=suspensionRates(profile);
  spring(state,'heave','heaveVelocity',air?.06:limit(mean*.7,-.16,.16),rates.spring,rates.damping,dt,-.34,.28);
  spring(state,'pitch','pitchVelocity',air?0:limit(-acceleration*.0025,-.105,.11),rates.spring*(62/78),rates.damping*(7.2/6.4),dt,-.17,.17);
  spring(state,'roll','rollVelocity',air?0:limit(lateralAcceleration*.006,-.15,.15),rates.spring*(66/78),rates.damping*(6.5/6.4),dt,-.21,.21);
  state.wheels.forEach((wheel,i)=>{
    spring(wheel,'offset','velocity',air?-.23:limit(ground[i],-.36,.42),rates.spring*(air?95/78:280/78),rates.damping*(air?13/6.4:23/6.4),dt,-.38,.45);
    const corner=WHEEL_CORNERS[i];
    const bodyHeight=state.heave-corner.front*VEHICLE_DIMENSIONS.wheelbase/2*Math.sin(state.pitch)+corner.side*.83*Math.sin(state.roll);
    wheel.compression=limit(wheel.offset-bodyHeight,-.42,.48);wheel.contact=contacts?contacts[i]:!air;
  });
  return state;
}
