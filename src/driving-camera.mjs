const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const CAMERA_DEFAULTS=Object.freeze({targetDistance:8,reactionTime:0,acceleration:7,braking:9,speedReserve:40,speedResponse:.35});
export const CAMERA_PRESETS=Object.freeze({
  compact:{targetDistance:7,reactionTime:0,acceleration:7,braking:9,speedReserve:35,speedResponse:.35},
  family:{targetDistance:7.5,reactionTime:0,acceleration:8,braking:10,speedReserve:40,speedResponse:.32},
  sports:{targetDistance:8.5,reactionTime:0,acceleration:11,braking:13,speedReserve:55,speedResponse:.24},
  suv:{targetDistance:8,reactionTime:0,acceleration:7,braking:9,speedReserve:40,speedResponse:.35},
  pickup:{targetDistance:8.5,reactionTime:0,acceleration:8,braking:10,speedReserve:45,speedResponse:.35},
  tractor:{targetDistance:7,reactionTime:0,acceleration:4,braking:6,speedReserve:25,speedResponse:.5},
  truck:{targetDistance:9,reactionTime:0,acceleration:6,braking:8,speedReserve:35,speedResponse:.45},
  formula:{targetDistance:10,reactionTime:0,acceleration:14,braking:16,speedReserve:70,speedResponse:.18},
  monsterBeginner:{targetDistance:7.5,reactionTime:0,acceleration:5,braking:7,speedReserve:25,speedResponse:.45},
  monsterSlow:{targetDistance:8,reactionTime:0,acceleration:6,braking:8,speedReserve:30,speedResponse:.4},
  monsterMedium:{targetDistance:8,reactionTime:0,acceleration:7,braking:9,speedReserve:35,speedResponse:.35},
  monster:{...CAMERA_DEFAULTS}
});
export const CAMERA_TUNING={...CAMERA_DEFAULTS};
export function applyCameraPreset(target,key){
  const preset=CAMERA_PRESETS[key];
  if(!preset)return false;
  Object.assign(target,preset);return true;
}
const VISUAL_MAX_GAP=20,VISUAL_MIN_GAP=2.5;
const GAP_GAIN=.8;

// The camera is a separate longitudinal follower. It keeps its own speed,
// receives the truck state after a configurable reaction delay, then
// accelerates or brakes towards its normal position behind the truck.
export function createDrivingCameraMotion(){
  let gap=0,cameraSpeed=null,previousSpeed=null,clock=0,history=[];
  // The gameplay camera has a finite framing envelope. Clamp the simulated
  // relative gap to the same envelope so no invisible distance debt can build.
  const value=()=>({distanceOffset:gap,fovOffset:gap>=0
    ?gap/VISUAL_MAX_GAP*4:gap/VISUAL_MIN_GAP*1.5});
  const reset=()=>{gap=0;cameraSpeed=null;previousSpeed=null;clock=0;history=[];};
  const delayedState=(time,reaction)=>{
    const target=time-reaction;
    while(history.length>2&&history[1].time<target-5)history.shift();
    let index=0;while(index+1<history.length&&history[index+1].time<=target)index++;
    const a=history[index],b=history[Math.min(index+1,history.length-1)];
    if(!a)return {speed:0,gap:0};
    if(a===b||target<=a.time)return a;
    const amount=clamp((target-a.time)/(b.time-a.time),0,1);
    return {speed:a.speed+(b.speed-a.speed)*amount,gap:a.gap+(b.gap-a.gap)*amount};
  };
  return {
    reset,
    get value(){return value();},
    step(dt,{mode='racing',speed=0,reducedMotion=false}={}){
      if(reducedMotion||!['racing','paused'].includes(mode)){reset();return value();}
      if(mode==='paused'||!Number.isFinite(dt)||dt<=0)return value();
      const velocity=Number.isFinite(speed)?speed:previousSpeed??0;
      if(previousSpeed===null){
        previousSpeed=velocity;cameraSpeed=velocity;history=[{time:clock,speed:velocity,gap}];
        return value();
      }
      // A stalled or resumed frame changes the velocity baseline, but must
      // never be interpreted as a huge physical acceleration.
      if(dt>.25){
        previousSpeed=velocity;cameraSpeed=velocity;clock=0;history=[{time:clock,speed:velocity,gap}];
        return value();
      }
      const steps=Math.ceil(dt*120),slice=dt/steps,from=previousSpeed;
      const reaction=Math.max(0,CAMERA_TUNING.reactionTime);
      for(let i=1;i<=steps;i++){
        const truckSpeed=from+(velocity-from)*i/steps;clock+=slice;
        history.push({time:clock,speed:truckSpeed,gap});
        const observed=delayedState(clock,reaction);
        const targetSpeed=Math.min(observed.speed+CAMERA_TUNING.speedReserve,
          observed.speed+gap*GAP_GAIN);
        const acceleration=clamp((targetSpeed-cameraSpeed)/Math.max(.01,CAMERA_TUNING.speedResponse),
          -CAMERA_TUNING.braking,CAMERA_TUNING.acceleration);
        cameraSpeed+=acceleration*slice;
        gap=clamp(gap+(truckSpeed-cameraSpeed)*slice,-VISUAL_MIN_GAP,VISUAL_MAX_GAP);
      }
      previousSpeed=velocity;
      if(Math.abs(gap)<1e-8&&Math.abs(cameraSpeed-velocity)<1e-8)gap=0;
      return value();
    }
  };
}
