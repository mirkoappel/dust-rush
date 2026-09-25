const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const CAMERA_TUNING={maxBoostGap:16,boostFollowFrequency:.2};

// Relative longitudinal motion: acceleration lets the truck get ahead while the
// camera initially keeps its previous velocity. A critically damped follower
// then catches up, without a preset "Nitro on" dolly or oscillation.
export function createDrivingCameraMotion(){
  let gap=0,relativeSpeed=0,previousSpeed=null,brake=0;
  const value=()=>{
    const distance=CAMERA_TUNING.maxBoostGap*Math.tanh(gap/CAMERA_TUNING.maxBoostGap);
    return {distanceOffset:distance-brake*.55,fovOffset:distance/CAMERA_TUNING.maxBoostGap*4-brake*1.5};
  };
  const reset=()=>{gap=0;relativeSpeed=0;previousSpeed=null;brake=0;};
  return {
    reset,
    get value(){return value();},
    step(dt,{mode='racing',boosting=false,braking=0,speed=0,reducedMotion=false}={}){
      if(reducedMotion||!['racing','paused'].includes(mode)){reset();return value();}
      if(mode==='paused'||!Number.isFinite(dt)||dt<=0)return value();
      const velocity=Number.isFinite(speed)?speed:0;
      const brakeTarget=clamp(Number(braking)||0,0,1)*clamp(velocity/3,0,1);
      const followingBoost=boosting&&brakeTarget===0&&velocity>=0;
      // First frame, resumed/stalled frames and invalid samples only establish
      // a baseline. Holding Nitro at steady speed cannot push the camera back.
      const acceleration=followingBoost&&previousSpeed!==null&&Number.isFinite(speed)&&dt<=.25
        ?clamp((velocity-previousSpeed)/dt,0,12):0;
      previousSpeed=Number.isFinite(speed)?velocity:null;
      const frequency=brakeTarget>0||velocity<=0?4:followingBoost?CAMERA_TUNING.boostFollowFrequency:1.8;
      // Exact critically damped response for a constant acceleration over dt:
      // gap'' + 2*w*gap' + w*w*gap = measured forward acceleration.
      const equilibrium=acceleration/(frequency*frequency);
      const displacement=gap-equilibrium;
      const coefficient=relativeSpeed+frequency*displacement;
      const decay=Math.exp(-frequency*dt);
      gap=equilibrium+(displacement+coefficient*dt)*decay;
      relativeSpeed=(relativeSpeed-frequency*coefficient*dt)*decay;
      if(gap<0){gap=0;relativeSpeed=0;}
      if(gap<1e-7&&Math.abs(relativeSpeed)<1e-7){gap=0;relativeSpeed=0;}
      brake+=(brakeTarget-brake)*(1-Math.exp(-5*dt));
      return value();
    }
  };
}
