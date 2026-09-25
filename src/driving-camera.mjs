const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Presentation only: this envelope never moves the truck or changes its physics.
export function createDrivingCameraMotion(){
  let boost=0,brake=0;
  const value=()=>({distanceOffset:boost*1.5-brake*.55,fovOffset:boost*4-brake*1.5});
  const reset=()=>{boost=0;brake=0;};
  return {
    reset,
    get value(){return value();},
    step(dt,{mode='racing',boosting=false,braking=0,speed=0,reducedMotion=false}={}){
      if(reducedMotion||!['racing','paused'].includes(mode)){reset();return value();}
      if(mode==='paused'||!Number.isFinite(dt)||dt<=0)return value();
      const brakeTarget=clamp(Number(braking)||0,0,1)*clamp((Number(speed)||0)/3,0,1);
      const boostTarget=boosting&&brakeTarget===0?1:0;
      const ease=1-Math.exp(-5*dt);
      boost+=(boostTarget-boost)*ease;brake+=(brakeTarget-brake)*ease;
      return value();
    }
  };
}
