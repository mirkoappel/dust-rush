const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const pedal=value=>value===true?1:Number.isFinite(value)?clamp(value,0,1):0;
export function combineDrivingInput(keys,stick,tilt=0,actions={}){
  const left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD');
  const nitro=keys.has('ArrowUp')||keys.has('KeyC')||!!actions.nitro;
  const forward=keys.has('KeyW')||keys.has('Space')||!!actions.forward||nitro;
  const brake=keys.has('KeyS')||keys.has('ShiftLeft');
  return {forward:forward?1:0,brake:brake?1:0,
    steer:left||right?Number(right)-Number(left):stick.active&&stick.steer!==0?stick.steer:tilt,
    handbrake:keys.has('ArrowDown')||keys.has('KeyX')||!!actions.handbrake,nitro};
}

export const NITRO={duration:2.4,recharge:12,delay:2,speedGain:4,power:1.6};
// Charge belongs to the simulation, not to a DOM button or render frame.
export function stepNitro(car,dt,{requested=false,throttle=0,brake=0,handbrake=false}={}){
  car.nitro=Number.isFinite(car.nitro)?clamp(car.nitro,0,1):1;
  car.nitroCooldown=Math.max(0,(car.nitroCooldown||0)-dt);
  // Releasing rearms even a tiny refill; no quarter-tank threshold.
  if(!requested)car.nitroLocked=false;
  const active=requested&&!car.nitroLocked&&car.nitro>0&&throttle>.05&&!brake&&!handbrake&&!car.air&&car.speed>=0;
  car.boosting=!!active;
  if(active){
    car.nitro=Math.max(0,car.nitro-dt/NITRO.duration);car.nitroCooldown=NITRO.delay;
    if(car.nitro<=1e-6){car.nitro=0;car.nitroLocked=true;}
  }else if(car.nitroCooldown===0)car.nitro=Math.min(1,car.nitro+dt/NITRO.recharge);
  return car.boosting;
}
