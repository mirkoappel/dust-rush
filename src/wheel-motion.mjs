// The GLB tire repeats its tread 24 times. Moving more than half a tread per
// rendered frame aliases into stationary or backwards motion. Keep visual spin
// below that limit; the simulation still uses the real distance / wheel radius.
export const MAX_VISIBLE_WHEEL_STEP=2*Math.PI/24*.32;
export function visibleWheelStep(physicalDelta){
  if(!Number.isFinite(physicalDelta))return 0;
  return Math.max(-MAX_VISIBLE_WHEEL_STEP,Math.min(MAX_VISIBLE_WHEEL_STEP,physicalDelta));
}
export function makeWheelMotion(){
  let previousAngle=null,visualAngle=0;
  return {
    update(physicalAngle,dt,active){
      if(!Number.isFinite(physicalAngle))return visualAngle;
      const delta=previousAngle===null?0:physicalAngle-previousAngle;
      previousAngle=physicalAngle;
      // Ignore discontinuities from a restart; keep the current visual pose in
      // the workshop or paused, with no extra spin after releasing the controls.
      if(!active||!Number.isFinite(dt)||dt<=0||dt>.1||Math.abs(delta)>Math.PI/2)return visualAngle;
      visualAngle+=visibleWheelStep(delta);
      return visualAngle;
    }
  };
}
