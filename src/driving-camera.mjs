const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const CAMERA_TUNING={targetDistance:8,reactionTime:0,acceleration:7,braking:9,maxSpeed:40,speedResponse:.35};
const VISUAL_MAX_GAP=20,VISUAL_MIN_GAP=2.5;
const GAP_GAIN=.8;

// The camera is a separate longitudinal follower. It keeps its own speed,
// perceives the truck and their separation with a configurable delay, then
// accelerates or brakes towards its normal position behind the truck.
export function createDrivingCameraMotion(){
  let gap=0,cameraSpeed=null,observedSpeed=null,observedGap=0,previousSpeed=null;
  const value=()=>{
    // Framing is only a soft safety net; the simulated drone has no hard
    // distance limit and can briefly overtake the truck's speed to catch up.
    const distance=gap>=0?VISUAL_MAX_GAP*Math.tanh(gap/VISUAL_MAX_GAP)
      :VISUAL_MIN_GAP*Math.tanh(gap/VISUAL_MIN_GAP);
    return {distanceOffset:distance,fovOffset:distance>=0
      ?distance/VISUAL_MAX_GAP*4:distance/VISUAL_MIN_GAP*1.5};
  };
  const reset=()=>{gap=0;cameraSpeed=null;observedSpeed=null;observedGap=0;previousSpeed=null;};
  return {
    reset,
    get value(){return value();},
    step(dt,{mode='racing',speed=0,reducedMotion=false}={}){
      if(reducedMotion||!['racing','paused'].includes(mode)){reset();return value();}
      if(mode==='paused'||!Number.isFinite(dt)||dt<=0)return value();
      const velocity=Number.isFinite(speed)?speed:previousSpeed??0;
      if(previousSpeed===null){
        previousSpeed=velocity;cameraSpeed=velocity;observedSpeed=velocity;
        return value();
      }
      // A stalled or resumed frame changes the velocity baseline, but must
      // never be interpreted as a huge physical acceleration.
      if(dt>.25){
        previousSpeed=velocity;cameraSpeed=velocity;observedSpeed=velocity;observedGap=gap;
        return value();
      }
      const steps=Math.ceil(dt*120),slice=dt/steps,from=previousSpeed;
      const reaction=Math.max(0,CAMERA_TUNING.reactionTime);
      const perception=reaction===0?1:1-Math.exp(-slice/reaction);
      for(let i=1;i<=steps;i++){
        const truckSpeed=from+(velocity-from)*i/steps;
        observedSpeed+=(truckSpeed-observedSpeed)*perception;
        observedGap+=(gap-observedGap)*perception;
        const targetSpeed=Math.min(CAMERA_TUNING.maxSpeed,observedSpeed+observedGap*GAP_GAIN);
        const acceleration=clamp((targetSpeed-cameraSpeed)/Math.max(.01,CAMERA_TUNING.speedResponse),
          -CAMERA_TUNING.braking,CAMERA_TUNING.acceleration);
        cameraSpeed+=acceleration*slice;
        gap+=(truckSpeed-cameraSpeed)*slice;
      }
      previousSpeed=velocity;
      if(Math.abs(gap)<1e-8&&Math.abs(cameraSpeed-velocity)<1e-8)gap=0;
      return value();
    }
  };
}
