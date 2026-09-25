import {ENGINE_TUNING} from './customization.mjs';
import {VEHICLE_DIMENSIONS} from './vehicle-dimensions.mjs';
import {pedal} from './driving-input.mjs';
import {VEHICLE_PHYSICS,VEHICLE_PHYSICS_DEFAULTS} from './vehicle-physics-profile.mjs';
// Metres, seconds, kilograms. A deliberately forgiving force-based arcade vehicle.
export const VEHICLE={get mass(){return VEHICLE_PHYSICS.massKg;},wheelbase:VEHICLE_DIMENSIONS.wheelbase,track:VEHICLE_DIMENSIONS.track,gravity:9.81};
export const SPEEDS=VEHICLE_PHYSICS.speed;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const corners=[[1,1],[-1,1],[1,-1],[-1,-1]];
export function drivetrainTopSpeed(profile=VEHICLE_PHYSICS,wheelRadius=VEHICLE_DIMENSIONS.wheelRadius){
  const topGear=profile.drivetrain.gears.at(-1);
  return profile.drivetrain.redlineRpm*Math.PI*2*wheelRadius/(60*profile.drivetrain.finalRatio*topGear);
}
export function engineRpmAtSpeed(speed,gear,profile=VEHICLE_PHYSICS,wheelRadius=VEHICLE_DIMENSIONS.wheelRadius){
  const ratio=profile.drivetrain.gears[clamp(gear-1,0,profile.drivetrain.gears.length-1)]*profile.drivetrain.finalRatio;
  return Math.abs(speed)*ratio*60/(Math.PI*2*wheelRadius);
}
export function resetMotion(c,profile=VEHICLE_PHYSICS){
  c.mass=profile.massKg;c.vx=Math.sin(c.heading)*c.speed;c.vz=Math.cos(c.heading)*c.speed;
  c.yawRate=0;c.pitchRate=0;c.rollRate=0;c.pedal=0;c.brakePedal=0;c.reverseHold=0;c.handbrakeAmount=0;c.boosting=false;c.groundedFraction=c.air?0:1;
  c.gear=1;c.engineRpm=profile.drivetrain.idleRpm;c.shiftTime=0;c.gearHoldTime=0;
  c.wheelHeights=null;c.motionSpeed=c.speed;c.lateralSpeed=0;c.motionReady=true;
  c.driftReverseHold=0;c.driftReversing=false;
}
export function refreshSpeed(c){
  c.speed=c.vx*Math.sin(c.heading)+c.vz*Math.cos(c.heading);
  c.lateralSpeed=c.vx*Math.cos(c.heading)-c.vz*Math.sin(c.heading);c.motionSpeed=c.speed;
}
export function ensureMotion(c,profile=VEHICLE_PHYSICS){
  if(!c.motionReady)resetMotion(c,profile);
  // Supports intentional spawn/test placement; normal physics always calls refreshSpeed.
  if(Math.abs(c.speed-c.motionSpeed)>.001){c.vx=Math.sin(c.heading)*c.speed;c.vz=Math.cos(c.heading)*c.speed;c.motionSpeed=c.speed;}
}
export function stepPlanar(c,dt,controls={},profile=VEHICLE_PHYSICS){
  let {throttle=0,brake=0,steer=0,limit,dirt=false,handbrake=false,driftBrake=false,boost=false}=controls;
  ensureMotion(c,profile);
  c.mass=profile.massKg;
  throttle=pedal(throttle);brake=pedal(brake);
  if(!driftBrake){c.driftReverseHold=0;c.driftReversing=false;}
  else {
    throttle=0;
    // Wait for a real stop, including sideways motion, before engaging reverse.
    // Latch until release so the brake does not re-engage as reverse speed grows.
    c.driftReverseHold=!c.air&&Math.hypot(c.vx,c.vz)<.2?c.driftReverseHold+dt:0;
    if(c.driftReverseHold>.45)c.driftReversing=true;
    if(c.driftReversing)brake=1;
    else handbrake=true;
  }
  const brakingResponse=Math.max(.01,profile.brakingResponse);
  c.handbrakeAmount=lerp(c.handbrakeAmount,handbrake?1:0,1-Math.exp(-dt/brakingResponse));
  const slide=c.handbrakeAmount,contact=c.air?0:c.groundedFraction;
  const surfaceGrip=dirt?6.8/8.8:1;
  const longitudinalGrip=profile.grip*VEHICLE.gravity*surfaceGrip*contact;
  const brakingGrip=profile.brakingGrip*VEHICLE.gravity*surfaceGrip*contact;
  const lateralGrip=longitudinalGrip*(1-slide*.58);
  boost=boost&&!handbrake&&!brake&&throttle>0&&contact>0;
  limit=Number.isFinite(limit)?limit:drivetrainTopSpeed(profile,c.wheelRadius||VEHICLE_DIMENSIONS.wheelRadius);
  if(boost)limit+=profile.nitro.speedGain;
  const motor=ENGINE_TUNING[c.engine]||ENGINE_TUNING.classic;
  const gears=profile.drivetrain.gears,wheelRadius=c.wheelRadius||VEHICLE_DIMENSIONS.wheelRadius;
  const shiftDuration=Math.max(0,profile.drivetrain.shiftDuration||0);
  const gearHoldTime=Math.max(0,profile.drivetrain.gearHoldTime||0);
  c.shiftTime=Math.max(0,(c.shiftTime||0)-dt);
  c.gearHoldTime=Math.max(0,(c.gearHoldTime||0)-dt);
  // Live tuning may replace the gearbox while the truck is already in a
  // higher gear. Keep the transmission valid before reading its new ratios.
  const validGear=clamp(Math.round(c.gear)||1,1,gears.length);
  if(validGear!==c.gear){c.gear=validGear;c.shiftTime=shiftDuration;c.gearHoldTime=gearHoldTime;}
  let rpm=engineRpmAtSpeed(c.speed,c.gear,profile,wheelRadius);
  if(c.shiftTime<=0&&c.gearHoldTime<=0){
    const previousGear=c.gear;
    if(rpm>profile.drivetrain.redlineRpm*.9&&c.gear<gears.length)c.gear++;
    else if(rpm<profile.drivetrain.redlineRpm*.48&&c.gear>1)c.gear--;
    if(c.gear!==previousGear){c.shiftTime=shiftDuration;c.gearHoldTime=gearHoldTime;}
  }
  rpm=engineRpmAtSpeed(c.speed,c.gear,profile,wheelRadius);
  c.engineRpm=Math.max(profile.drivetrain.idleRpm,Math.min(profile.drivetrain.redlineRpm*1.04,rpm));
  const rpmRange=Math.max(1,profile.drivetrain.redlineRpm-profile.drivetrain.idleRpm);
  const rpmFraction=clamp((c.engineRpm-profile.drivetrain.idleRpm)/rpmRange,0,1);
  // A big-displacement monster-truck engine already delivers substantial
  // torque at idle; the remaining band builds progressively to its peak.
  const powerBand=rpmFraction<.72?.72+.28*rpmFraction/.72:1-.16*Math.pow((rpmFraction-.72)/.28,2);
  const gearTorque=Math.pow(gears[c.gear-1]/gears.at(-1),.18);
  const throttleResponse=Math.max(.01,profile.throttleResponse*ENGINE_TUNING.classic.response/motor.response);
  c.pedal=lerp(c.pedal,handbrake?0:throttle,1-Math.exp(-dt/throttleResponse));
  const steeringMax=lerp(.66,.31,clamp(Math.abs(c.speed)/15,0,1));
  c.steering=lerp(c.steering,steer*steeringMax*profile.steering,1-Math.exp(-5*dt));
  const targetYaw=clamp(c.speed/VEHICLE.wheelbase*Math.tan(c.steering)*(1+slide*.4),-1.6,1.6);
  if(contact)c.yawRate=lerp(c.yawRate,targetYaw,1-Math.exp(-3.5*contact*dt));
  else c.yawRate*=Math.exp(-.55*dt);
  c.heading+=c.yawRate*dt;
  const fx=Math.sin(c.heading),fz=Math.cos(c.heading),nx=fz,nz=-fx;
  const longitudinal=c.vx*fx+c.vz*fz,side=c.vx*nx+c.vz*nz;
  c.reverseHold=brake>.12&&!throttle&&!handbrake&&longitudinal<.2?c.reverseHold+dt:0;
  const reverse=brake>.12&&!throttle&&!handbrake&&(c.driftReversing||c.reverseHold>.45||longitudinal<-.1);
  c.brakePedal=lerp(c.brakePedal,brake&&!reverse?brake:0,1-Math.exp(-dt/brakingResponse));
  let drive=0;
  const powerToWeight=profile.powerPs/VEHICLE_PHYSICS_DEFAULTS.powerPs*VEHICLE_PHYSICS_DEFAULTS.massKg/profile.massKg;
  const shiftDrive=shiftDuration&&c.shiftTime>0?clamp(1-c.shiftTime/shiftDuration,.08,1):1;
  if(!brake&&!handbrake)drive=c.pedal*5.8*motor.power*powerToWeight*powerBand*gearTorque*shiftDrive*(boost?profile.nitro.power:1)*clamp((limit*c.pedal-longitudinal)/Math.max(.05,profile.accelerationFalloff),0,1);
  if(reverse)drive=-4.0*brake*clamp((profile.speed.reverse*brake+longitudinal)/.8,0,1);
  const sideAcceleration=clamp(-side*(6.5-slide*4.5),-lateralGrip,lateralGrip);
  const traction=Math.sqrt(Math.max(0,lateralGrip*lateralGrip-sideAcceleration*sideAcceleration*.6));
  // Arcade boost raises forward traction only: steering and lateral grip stay
  // unchanged, and the existing grounded/brake checks still gate all thrust.
  drive=clamp(drive,-traction,traction*(boost?profile.nitro.forwardGrip:1));
  c.vx+=(fx*(drive+VEHICLE.gravity*Math.sin(c.pitch)*contact)+nx*(sideAcceleration-VEHICLE.gravity*Math.sin(c.roll)*contact))*dt;
  c.vz+=(fz*(drive+VEHICLE.gravity*Math.sin(c.pitch)*contact)+nz*(sideAcceleration-VEHICLE.gravity*Math.sin(c.roll)*contact))*dt;
  const v=Math.hypot(c.vx,c.vz);
  if(contact&&v>0){
    const brakeDrag=brake&&!reverse?Math.min(profile.brakingG*VEHICLE.gravity*c.brakePedal,brakingGrip):0;
    // The combined drift/reverse control may reduce lateral grip for a slide,
    // but it still performs a real longitudinal stop up to the tyre/surface limit.
    const handbrakeDrag=Math.min(slide*profile.brakingG*VEHICLE.gravity,brakingGrip);
    const drag=.48+v*.035+brakeDrag+handbrakeDrag+Math.max(0,longitudinal-limit)*2.5;
    const factor=Math.max(0,1-Math.min(v,drag*contact*dt)/v);c.vx*=factor;c.vz*=factor;
  }
  if(Math.hypot(c.vx,c.vz)<.035&&!throttle&&!reverse){c.vx=0;c.vz=0;}
  // A safety ceiling, not a motor speed clamp: collisions and downhill momentum remain possible.
  const safetyCeiling=Math.max(24,profile.speed.race+profile.nitro.speedGain+1);
  const total=Math.hypot(c.vx,c.vz);if(total>safetyCeiling){c.vx*=safetyCeiling/total;c.vz*=safetyCeiling/total;}
  c.x+=c.vx*dt;c.z+=c.vz*dt;refreshSpeed(c);
}
export function stepVertical(c,dt,heights){
  ensureMotion(c);
  const previous=c.wheelHeights||heights,wasAir=c.air,fallSpeed=c.vy;
  // A wheel that has passed a ramp edge must not aim the body at the ground far below.
  // Continue the existing wheel plane for unloaded wheels; only nearby terrain sets attitude.
  const supporting=heights.map((h,i)=>{
    const [side,front]=corners[i],plane=c.y-front*VEHICLE.wheelbase/2*Math.sin(c.pitch)+side*VEHICLE.track/2*Math.sin(c.roll);
    return h<plane-.38?plane:h;
  });
  const targetPitch=-Math.atan2((supporting[0]+supporting[1]-supporting[2]-supporting[3])/2,VEHICLE.wheelbase);
  const targetRoll=Math.atan2((supporting[0]+supporting[2]-supporting[1]-supporting[3])/2,VEHICLE.track);
  if(!wasAir){
    const oldPitch=c.pitch,oldRoll=c.roll;
    c.pitch+=clamp((clamp(targetPitch,-.75,.75)-c.pitch)*(1-Math.exp(-8*dt)),-1.6*dt,1.6*dt);
    c.roll+=clamp((clamp(targetRoll,-.55,.55)-c.roll)*(1-Math.exp(-8*dt)),-1.3*dt,1.3*dt);
    c.pitchRate=clamp(lerp(c.pitchRate,(c.pitch-oldPitch)/dt,.15),-.38,.38);
    c.rollRate=clamp(lerp(c.rollRate,(c.roll-oldRoll)/dt,.15),-.28,.28);
  }else{
    // Modest angular inertia, not a forced nose-dive or mid-air steering correction.
    c.pitchRate*=Math.exp(-1.8*dt);c.rollRate*=Math.exp(-2*dt);
    c.pitch=clamp(c.pitch+c.pitchRate*dt,-.75,.75);c.roll=clamp(c.roll+c.rollRate*dt,-.55,.55);
  }
  let contacts=0,force=0;c.wheelContacts=[];
  const residual=heights.map((h,i)=>{
    const [side,front]=corners[i],plane=c.y-front*VEHICLE.wheelbase/2*Math.sin(c.pitch)+side*VEHICLE.track/2*Math.sin(c.roll);
    const gap=h-plane,rate=clamp((h-previous[i])/dt,-10,10);
    const spring=gap>-.32?clamp(VEHICLE.gravity+gap*82+(rate-c.vy)*8.5,0,75):0;
    c.wheelContacts.push(spring>0);if(spring>0){contacts++;force+=spring/4;}
    return gap;
  });
  c.vy+=(force-VEHICLE.gravity)*dt;c.y+=c.vy*dt;
  const bottom=Math.max(...heights.map((h,i)=>h+corners[i][1]*VEHICLE.wheelbase/2*Math.sin(c.pitch)-corners[i][0]*VEHICLE.track/2*Math.sin(c.roll)))-.36;
  if(c.y<bottom){c.y=bottom;if(c.vy<0)c.vy*=-.08;}
  c.groundedFraction=contacts/4;c.air=contacts===0;c.wheelHeights=[...heights];
  c.wheelResiduals=residual;
  return {takeoff:!wasAir&&c.air,landing:wasAir&&!c.air,impact:Math.max(0,-fallSpeed),residual};
}
export function collideWall(c,nx,nz,penetration){
  ensureMotion(c);c.x+=nx*penetration;c.z+=nz*penetration;
  const into=c.vx*nx+c.vz*nz;
  if(into>=0)return 0;
  c.vx-=nx*into*1.12;c.vz-=nz*into*1.12;c.yawRate*=.7;refreshSpeed(c);return -into;
}
export function collideTrucks(a,b){
  ensureMotion(a);ensureMotion(b);
  if(Math.abs(a.y-b.y)>1.65)return 0;
  // Two overlapping contact discs per vehicle give front/rear contacts and off-centre torque.
  let hit=null;
  const contactOffset=VEHICLE.wheelbase*.38;
  for(const af of [-contactOffset,contactOffset])for(const bf of [-contactOffset,contactOffset]){
    const ax=a.x+Math.sin(a.heading)*af,az=a.z+Math.cos(a.heading)*af,bx=b.x+Math.sin(b.heading)*bf,bz=b.z+Math.cos(b.heading)*bf;
    const dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz),penetration=2.42-d;
    if(penetration>0&&(!hit||penetration>hit.penetration))hit={nx:d>.001?dx/d:1,nz:d>.001?dz/d:0,penetration,ax,az,bx,bz};
  }
  if(!hit)return 0;
  const {nx,nz,penetration,ax,az,bx,bz}=hit,invA=1/a.mass,invB=1/b.mass;
  a.x-=nx*penetration*invA/(invA+invB);a.z-=nz*penetration*invA/(invA+invB);
  b.x+=nx*penetration*invB/(invA+invB);b.z+=nz*penetration*invB/(invA+invB);
  const closing=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
  if(closing<=0)return 0;
  const impulse=closing*1.12/(invA+invB);
  a.vx-=nx*impulse*invA;a.vz-=nz*impulse*invA;b.vx+=nx*impulse*invB;b.vz+=nz*impulse*invB;
  const torqueA=(az-a.z)*(-nx*impulse)-(ax-a.x)*(-nz*impulse),torqueB=(bz-b.z)*(nx*impulse)-(bx-b.x)*(nz*impulse);
  a.yawRate=clamp(a.yawRate+torqueA/(a.mass*3),-1.7,1.7);b.yawRate=clamp(b.yawRate+torqueB/(b.mass*3),-1.7,1.7);
  refreshSpeed(a);refreshSpeed(b);return closing;
}
