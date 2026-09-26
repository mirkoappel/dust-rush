// Measurements use simulation time, so pauses and rendering frame rate cannot
// affect the results. A flying lap never pretends to be a standing 0–100 run.
export class TimeTrial {
  constructor(){
    this.lapStart=0;this.topKmh=0;this.zeroToHundred=null;this.runStart=null;
    this.armed=true;this.previousSpeed=0;this.nitroUsed=false;this.valid=true;
    this.last=null;this.best=null;this.lapDistanceM=0;this.totalDistanceM=0;
  }
  sample(time,dt,car,input,distanceM=0){
    this.lapDistanceM+=Math.max(0,distanceM);this.totalDistanceM+=Math.max(0,distanceM);
    const speed=Math.max(0,car.speed);
    this.topKmh=Math.max(this.topKmh,speed*3.6);
    this.nitroUsed ||= !!car.boosting;
    if(speed<.1&&!input.forward){this.armed=true;this.runStart=null;}
    if(this.armed&&input.forward&&!input.brake&&!input.handbrake){
      this.runStart=time-dt;this.armed=false;
    }
    const target=100/3.6;
    if(this.runStart!==null&&this.previousSpeed<target&&speed>=target){
      const fraction=(target-this.previousSpeed)/(speed-this.previousSpeed);
      const seconds=time-dt+dt*fraction-this.runStart;
      this.zeroToHundred=this.zeroToHundred===null?seconds:Math.min(this.zeroToHundred,seconds);
      this.runStart=null;
    }
    this.previousSpeed=speed;
  }
  invalidate(){this.valid=false;this.runStart=null;this.armed=false;}
  finish(time,lap){
    const result={lap,seconds:time-this.lapStart,distanceM:this.lapDistanceM,topKmh:this.topKmh,zeroToHundred:this.zeroToHundred,nitroUsed:this.nitroUsed,valid:this.valid};
    this.last=result;
    if(result.valid&&(!this.best||result.seconds<this.best.seconds))this.best={...result};
    this.lapStart=time;this.lapDistanceM=0;this.topKmh=this.previousSpeed*3.6;this.zeroToHundred=null;
    this.runStart=null;this.nitroUsed=false;this.valid=true;
    return result;
  }
}

export function formatLapTime(seconds){
  if(!Number.isFinite(seconds))return '—';
  const ticks=Math.max(0,Math.round(seconds*100));
  return `${Math.floor(ticks/6000)}:${String(Math.floor(ticks/100)%60).padStart(2,'0')},${String(ticks%100).padStart(2,'0')}`;
}
