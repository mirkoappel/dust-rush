import {createSuspension,stepSuspension,WHEEL_CORNERS} from './suspension.mjs';
import {makeObstacles,kickProp,stepProps} from './obstacles.mjs';
import {createArenaTrack,setupArena,arenaSurfaceLocal,collectArenaGates} from './arena.mjs';
import {SPEEDS,VEHICLE,resetMotion,stepPlanar,stepVertical,collideWall,collideTrucks} from './physics.mjs';
import {pedal,stepNitro} from './driving-input.mjs';
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mod = (v, n) => ((v % n) + n) % n;
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const lerp = (a,b,t) => a + (b-a)*t;
function catmull(p0,p1,p2,p3,t) {
  return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);
}
export function createTrack() {
  const control=[[0,175],[96,175],[174,138],[207,62],[186,-30],[119,-82],[48,-134],[-49,-159],[-136,-119],[-172,-40],[-150,55],[-88,139]];
  const points=[], count=560;
  for(let i=0;i<count;i++) {
    const t=i/count*control.length, j=Math.floor(t), f=t-j;
    const at=k=>control[mod(k,control.length)];
    points.push({x:catmull(at(j-1)[0],at(j)[0],at(j+1)[0],at(j+2)[0],f),z:catmull(at(j-1)[1],at(j)[1],at(j+1)[1],at(j+2)[1],f),s:0});
  }
  let length=0;
  for(let i=0;i<count;i++) {
    const p=points[i],q=points[(i+1)%count],dx=q.x-p.x,dz=q.z-p.z;
    p.s=length;p.len=Math.hypot(dx,dz);p.tx=dx/p.len;p.tz=dz/p.len;p.nx=p.tz;p.nz=-p.tx;
    p.heading=Math.atan2(p.tx,p.tz);length+=p.len;
  }
  function at(distance, lateral=0) {
    const s=mod(distance,length);
    let lo=0,hi=count-1;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].s>s)hi=mid-1;else lo=mid;}
    const p=points[lo], f=(s-p.s)/p.len, q=points[(lo+1)%count];
    return {...p,x:lerp(p.x,q.x,f)+p.nx*lateral,z:lerp(p.z,q.z,f)+p.nz*lateral,s,index:lo};
  }
  function project(x,z) {
    let best=Infinity, result=null;
    for(let i=0;i<count;i++) {
      const p=points[i], q=points[(i+1)%count], t=clamp(((x-p.x)*p.tx+(z-p.z)*p.tz)/p.len,0,1);
      const px=lerp(p.x,q.x,t), pz=lerp(p.z,q.z,t), dx=x-px,dz=z-pz,d2=dx*dx+dz*dz;
      if(d2<best){best=d2;result={x:px,z:pz,s:mod(p.s+t*p.len,length),lateral:dx*p.nx+dz*p.nz,heading:p.heading,index:i,nx:p.nx,nz:p.nz,tx:p.tx,tz:p.tz};}
    }
    return result;
  }
  return {points,length,at,project,width:24};
}
const NAMES=['DU','RUMMS','BLITZ','KRAWALL','STAUBI','ROCKET'];
export class Race {
  constructor(track=createTrack(),freestyle=false) {
    this.freestyle=freestyle;this.track=freestyle?createArenaTrack():track;this.laps=3;this.assist=false;this.events=[];this.reset();
  }
  reset() {
    this.time=0;this.countdown=3.3;this.mode='menu';this.previousMode='racing';this.finishTime=0;this.events.length=0;
    this.cars=NAMES.map((name,i)=>{
      const s=this.track.length-35-Math.floor(i/2)*9, lane=i%2===0?-4:4, p=this.track.at(s,lane);
      return {id:i,name,x:p.x,z:p.z,y:0,vy:0,heading:p.heading,speed:0,steering:0,s,projection:this.track.project(p.x,p.z),lane,
        lap:0,nextCheckpoint:0,started:false,finished:false,finishTime:0,rank:i+1,nitro:1,nitroCooldown:0,nitroLocked:false,boosting:false,
        air:false,onRamp:null,airDistance:0,airTime:0,jumpStart:null,pitch:0,roll:0,crash:0,crashCooldown:0,wrongWay:0,stuck:0,score:0,
        respawns:0,wheelAngle:0,lastLapTime:0,lapTimes:[],travelled:0,crashTotal:0,suspension:createSuspension()};
    });
    this.player=this.cars[0];
    this.ramps=[{id:0,s:this.track.length*.165,lane:-5,length:14,width:8,height:3.4},
                {id:1,s:this.track.length*.47,lane:5,length:13,width:8,height:3.1},
                {id:2,s:this.track.length*.785,lane:0,length:16,width:9,height:4.0}];
    this.pads=[];
    this.props=makeObstacles(this.track,this.ramps);
    this.gates=[];
    this.mounds=[{id:'hill1',s:this.track.length*.12,lane:0,length:12,width:20,height:.8},{id:'hill2',s:this.track.length*.40,lane:1,length:15,width:17,height:1.1},{id:'hill3',s:this.track.length*.71,lane:-1,length:12,width:20,height:.75}];
    for(let i=0;i<5;i++)this.mounds.push({id:'rumble'+i,s:this.track.length*.62+i*3.0,lane:0,length:2.4,width:21,height:.18});
    if(this.freestyle)setupArena(this);
    for(const car of this.cars)resetMotion(car);
    this.updateRanks();
  }
  start() {this.reset();this.assist=false;this.mode='countdown';}
  pause() {if(this.mode==='racing'||this.mode==='countdown'){this.previousMode=this.mode;this.mode='paused';return true;}return false;}
  resume() {if(this.mode==='paused')this.mode=this.previousMode;}
  emit(type,data={}) {this.events.push({type,...data});}
  groundAt(car) {
    const projection=car.projection;let best={height:0,ramp:null};
    for(const r of this.ramps){
      const ds=mod(projection.s-r.s,this.track.length);
      if(ds<r.length&&Math.abs(projection.lateral-r.lane)<r.width*.5){const height=ds/r.length*r.height;if(height>best.height)best={height,ramp:r};}
    }
    for(const m of this.mounds){
      const local=this.freestyle?arenaSurfaceLocal(m,projection.s,projection.lateral):{along:mod(projection.s-m.s,this.track.length),across:projection.lateral-m.lane};
      if(local.along>=0&&local.along<m.length&&Math.abs(local.across)<m.width/2){
        const phase=local.along/m.length,height=Math.sin(phase*Math.PI)**2*m.height;
        if(height>best.height)best={height,ramp:null,mound:m,phase};
      }
    }
    for(const p of this.props)if(p.type==='car'){
      const ds=mod(projection.s-(p.s-2.6),this.track.length);
      if(ds<5.2&&Math.abs(projection.lateral-p.lane)<1.55){
        const top=(1.5+(p.stackHeight||0))*(1-p.crush*.60),height=Math.sin(ds/5.2*Math.PI)**2*top;
        if(height>best.height)best={height,ramp:null,mound:{id:'car'+p.id,length:5.2,height:top},phase:ds/5.2};
      }
    }
    return best;
  }
  respawn(car=this.player,manual=true) {
    const p=this.freestyle?this.track.at(28,car.id===0?0:car.lane):this.track.at(car.s,car.id===0?0:car.lane);
    car.x=p.x;car.z=p.z;car.heading=p.heading;car.y=0;car.vy=0;car.air=false;car.onRamp=null;car.pitch=0;car.roll=0;car.crash=0;
    car.speed=manual?0:5;car.stuck=0;car.wrongWay=0;car.crashCooldown=1.2;car.respawns++;
    car.projection=this.track.project(car.x,car.z);car.s=car.projection.s;car.suspension=createSuspension();car.lastSurface=null;
    resetMotion(car);car.y=this.groundAt(car).height;car.previousPose=null;
    if(car.id===0)this.emit('reset');
  }
  checkpoint(car,oldS,newS) {
    if(this.freestyle)return;
    const L=this.track.length, ds=mod(newS-oldS+L/2,L)-L/2;
    if(ds<=0||ds>12||Math.abs(car.projection.lateral)>this.track.width/2+5||car.finished)return;
    const goal=car.nextCheckpoint*L/12, ahead=mod(goal-oldS,L);
    if(ahead<=ds+.0001) {
      if(car.nextCheckpoint===0) {
        if(car.started) {
          car.lap++;car.lapTimes.push(this.time-car.lastLapTime);car.lastLapTime=this.time;
          if(car.id===0)this.emit('lap',{lap:car.lap});
          if(car.lap>=this.laps) {
            car.finished=true;car.finishTime=this.time;
            if(car.id===0){this.finishTime=this.time;this.mode='finished';this.updateRanks();this.emit('finish',{rank:car.rank,time:this.time});}
          }
        } else {car.started=true;car.lastLapTime=this.time;}
      }
      car.nextCheckpoint=(car.nextCheckpoint+1)%12;
    }
    car.travelled+=ds;
  }
  progress(car) {return car.finished?this.laps*this.track.length+100-car.finishTime*.001:car.started?car.lap*this.track.length+car.s:car.s-this.track.length;}
  updateRanks() {
    const ordered=[...this.cars].sort((a,b)=>this.progress(b)-this.progress(a));
    ordered.forEach((c,i)=>c.rank=i+1);this.order=ordered;
  }
  wheelHeights(car) {
    return WHEEL_CORNERS.map(corner=>{
      const delta=angleDelta(car.projection.heading,car.heading);
      const wheelS=car.s+corner.front*VEHICLE.wheelbase/2*Math.cos(delta)-corner.side*VEHICLE.track/2*Math.sin(delta);
      const lateral=car.projection.lateral+corner.side*VEHICLE.track/2*Math.cos(delta)+corner.front*VEHICLE.wheelbase/2*Math.sin(delta);
      const surface=this.groundAt({projection:{s:mod(wheelS,this.track.length),lateral}});
      // No procedural vibration at rest or during the first centimetres of rolling.
      const roughness=(this.freestyle?.006:Math.abs(lateral)>12?.025:.005)*clamp(Math.abs(car.speed)/4,0,1);
      const bump=(Math.sin(wheelS*1.7+lateral*2.1)+Math.sin(wheelS*.61-lateral))*.5*roughness;
      return surface.height+bump;
    });
  }
  impact(car,strength) {
    if(strength<1.4||car.crashCooldown>0)return;
    car.crash=clamp(strength/12,.12,.65);car.crashCooldown=.55;
    if(car.id===0){car.crashTotal++;this.emit('crash',{strength:car.crash,x:car.x,z:car.z});}
  }
  drive(car,dt,input) {
    const previousSpeed=car.speed,previousHeading=car.heading,oldX=car.x,oldZ=car.z,oldS=car.s;
    car.previousPose={x:car.x,y:car.y,z:car.z,heading:car.heading,pitch:car.pitch,roll:car.roll,wheelAngle:car.wheelAngle};
    const isPlayer=car.id===0,L=this.track.length,proj=car.projection,offroad=!this.freestyle&&Math.abs(proj.lateral)>this.track.width/2;
    let throttle=0,brake=0,steer=0,limit=this.freestyle?SPEEDS.arena:SPEEDS.race;
    if(isPlayer) {
      throttle=pedal(input.forward);brake=pedal(input.brake);if(brake)throttle=0;
      // The model faces +Z; screen-right from the chase camera is local -X.
      steer=-clamp(input.steer||0,-1,1);

    } else {
      const orbit=this.time*.09+car.id*1.18,orbitRadius=35+car.id*5;
      const ahead=this.freestyle?{x:Math.sin(orbit)*orbitRadius,z:Math.cos(orbit)*orbitRadius}:this.track.at(car.s+10+Math.abs(car.speed)*.60,car.lane+Math.sin(this.time*.3+car.id)*.6);
      steer=clamp(angleDelta(car.heading,Math.atan2(ahead.x-car.x,ahead.z-car.z))*2,-1,1);
      const bend=this.freestyle?0:Math.abs(angleDelta(proj.heading,this.track.at(car.s+28).heading));
      const behind=clamp((this.progress(this.player)-this.progress(car))/90,-1,1);
      limit=this.freestyle?5.8+car.id*.3:clamp(14.6-car.id*.1-bend*2+behind*.8,10,15.3);
      throttle=car.speed<limit?1:0;brake=car.speed>limit+1?.3:0;
    }
    if(car.finished){throttle=0;brake=.3;}
    for(const key of ['crashCooldown','crash'])car[key]=Math.max(0,car[key]-dt);
    const oldWheelHeights=car.wheelHeights||this.wheelHeights(car);
    const handbrake=isPlayer&&!car.finished&&!!input.handbrake;
    if(isPlayer)stepNitro(car,dt,{requested:!car.finished&&!!input.nitro,throttle,brake,handbrake});
    stepPlanar(car,dt,{throttle,brake,steer,limit,dirt:offroad,handbrake,boost:car.boosting});
    car.wheelAngle+=car.speed*dt/(car.wheelRadius||.685);
    car.projection=this.track.project(car.x,car.z);car.s=car.projection.s;
    const ground=this.groundAt(car),oldGround=this.groundAt({projection:proj});
    // Hit a tall side/back face instead of teleporting onto a ramp.
    const wheelStep=this.wheelHeights(car).some((h,i)=>h-oldWheelHeights[i]>.55&&h>car.y+.72);
    if(wheelStep||(ground.height-oldGround.height>.55&&ground.height>car.y+.72)){
      const distance=Math.hypot(car.x-oldX,car.z-oldZ);
      if(distance>0)this.impact(car,collideWall(car,(oldX-car.x)/distance,(oldZ-car.z)/distance,distance));
      car.projection=this.track.project(car.x,car.z);car.s=car.projection.s;
    }
    if(this.freestyle){
      if(car.x>88)this.impact(car,collideWall(car,-1,0,car.x-88));
      if(car.x< -88)this.impact(car,collideWall(car,1,0,-88-car.x));
      if(car.z>88)this.impact(car,collideWall(car,0,-1,car.z-88));
      if(car.z< -88)this.impact(car,collideWall(car,0,1,-88-car.z));
    }else{
      const wall=this.track.width/2+7;
      if(Math.abs(car.projection.lateral)>wall){
        const sign=Math.sign(car.projection.lateral);
        this.impact(car,collideWall(car,-car.projection.nx*sign,-car.projection.nz*sign,Math.abs(car.projection.lateral)-wall));
      }
    }
    car.projection=this.track.project(car.x,car.z);car.s=car.projection.s;
    const vertical=stepVertical(car,dt,this.wheelHeights(car));
    if(vertical.takeoff){car.airTime=0;car.airDistance=0;car.jumpAnnounced=false;}
    if(car.air){
      car.airTime+=dt;car.airDistance+=Math.hypot(car.vx,car.vz)*dt;
      if(car.airTime>.1&&!car.jumpAnnounced){car.jumpAnnounced=true;if(isPlayer)this.emit('jump',{x:car.x,z:car.z});}
    }
    if(vertical.landing){
      car.suspension.impact=vertical.impact;
      if(isPlayer&&car.jumpAnnounced){const distance=Math.round(car.airDistance);car.score+=distance*12;this.emit('land',{distance,impact:vertical.impact,x:car.x,z:car.z});}
    }
    for(const prop of this.props){
      if(!prop.active)continue;
      if(prop.type==='car'){
        const near=Math.abs(mod(car.s-prop.s+L/2,L)-L/2)<3&&Math.abs(car.projection.lateral-prop.lane)<1.8;
        if(near&&!car.air&&car.y<2+(prop.stackHeight||0)&&Math.abs(car.speed)>.3){
          prop.crush=clamp(prop.crush+dt*.8,0,1);
          if(!prop.scored){prop.scored=true;if(isPlayer){car.score+=250;car.crashTotal++;}this.emit('crush',{prop:prop.id,x:prop.x,z:prop.z,player:isPlayer});}
        }
        continue;
      }
      if(car.y>prop.y+.6||prop.y>car.y+2.3)continue;
      if(Math.hypot(car.x-prop.x,car.z-prop.z)<prop.radius+1.45&&kickProp(prop,car)){
        if(prop.stack)for(const other of this.props)if(other.stack===prop.stack){other.hit=true;other.vx+=car.vx*.20;other.vz+=car.vz*.20;}
        if(isPlayer){if(!prop.scored)car.score+=100;car.crashTotal++;}
        prop.scored=true;this.emit('smash',{prop:prop.id,kind:prop.type,x:prop.x,z:prop.z,player:isPlayer});
      }
    }
    collectArenaGates(this,car,oldX,oldZ);
    this.checkpoint(car,oldS,car.s);
    const facing=Math.cos(angleDelta(car.heading,car.projection.heading));
    car.wrongWay=!this.freestyle&&facing<-.35&&car.speed>2?car.wrongWay+dt:Math.max(0,car.wrongWay-dt*2);
    car.stuck=Math.abs(car.speed)<.5&&!brake&&throttle?car.stuck+dt:0;
    if(!this.freestyle&&((car.stuck>5&&!isPlayer)||Math.abs(car.projection.lateral)>40))this.respawn(car,false);
    stepSuspension(car.suspension,dt,{air:car.air,ground:vertical.residual,contacts:car.wheelContacts,acceleration:clamp((car.speed-previousSpeed)/dt,-20,14),lateralAcceleration:clamp(angleDelta(previousHeading,car.heading)*car.speed/dt,-12,12),crash:car.crash});
  }
  step(dt,input={}) {
    dt=clamp(dt,0,.05);
    if(dt===0)return;
    if(this.mode==='countdown') {
      const before=Math.ceil(this.countdown);
      this.countdown-=dt;
      if(Math.ceil(this.countdown)!==before)this.emit('tick',{number:Math.max(0,Math.ceil(this.countdown))});
      if(this.countdown<=0){this.mode='racing';this.emit('go');}
      return;
    }
    if(this.mode!=='racing')return;
    // Stable integration even when a caller supplies a long frame.
    if(dt>1/120+.000001){const steps=Math.ceil(dt*120);for(let n=0;n<steps;n++)this.step(dt/steps,input);return;}
    this.time+=dt;
    for(const car of this.cars)this.drive(car,dt,input);
    for(let i=0;i<this.cars.length;i++)for(let j=i+1;j<this.cars.length;j++){
      const a=this.cars[i],b=this.cars[j],impact=collideTrucks(a,b);
      this.impact(a,impact);this.impact(b,impact);
    }
    this.updateRanks();
    stepProps(this.props,dt,(x,z)=>this.groundAt({projection:this.track.project(x,z)}).height);
  }
}
