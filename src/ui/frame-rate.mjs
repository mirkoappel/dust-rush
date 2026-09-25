// Wall-clock frame intervals, including slow frames; never use the capped
// physics timestep. A half-second window keeps the tiny readout quiet.
export function createFrameRateMonitor(){
  let frames=0,elapsed=0,longest=0,value=0,frameMs=0,peakMs=0;
  return {
    get value(){return value;},
    get frameMs(){return frameMs;},
    get peakMs(){return peakMs;},
    reset(){frames=0;elapsed=0;longest=0;value=0;frameMs=0;peakMs=0;},
    sample(seconds){
      if(!Number.isFinite(seconds)||seconds<=0)return null;
      frames++;elapsed+=seconds;longest=Math.max(longest,seconds);
      if(elapsed<.5-1e-9)return null;
      value=Math.round(frames/elapsed);frameMs=elapsed/frames*1000;peakMs=longest*1000;
      frames=0;elapsed=0;longest=0;
      return value;
    }
  };
}
