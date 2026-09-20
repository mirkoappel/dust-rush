import {createSuspension,stepSuspension,WHEEL_CORNERS} from './suspension.mjs';
import {makeObstacles,kickProp,stepProps} from './obstacles.mjs';
import {createArenaTrack,setupArena} from './arena.mjs';
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
    this.freestyle=freestyle;this.track=freestyle?createArenaTrack():track;this.laps=3;this.assist=true;this.events=[];this.reset();
  }
  reset() {
    this.time=0;this.countdown=3.3;this.mode='menu';this.previousMode='racing';this.finishTime=0;this.events.length=0;
    this.cars=NAMES.map((name,i)=>{
      const s=this.track.length-35-Math.floor(i/2)*9, lane=i%2===0?-4:4, p=this.track.at(s,lane);
      return {id:i,name,x:p.x,z:p.z,y:0,vy:0,heading:p.heading,speed:0,steering:0,s,projection:this.track.project(p.x,p.z),lane,
        lap:0,nextCheckpoint:0,started:false,finished:false,finishTime:0,rank:i+1,boost:100,boosting:false,padBoost:0,padCooldown:0,
        air:false,onRamp:null,airDistance:0,airTime:0,jumpStart:null,pitch:0,roll:0,crash:0,crashCooldown:0,wrongWay:0,stuck:0,score:0,
        respawns:0,wheelAngle:0,lastLapTime:0,lapTimes:[],travelled:0,crashTotal:0,suspension:createSuspension()};
    });
    this.player=this.cars[0];
    this.ramps=[{id:0,s:this.track.length*.165,lane:-5,length:14,width:8,height:3.4},
                {id:1,s:this.track.length*.47,lane:5,length:13,width:8,height:3.1},
                {id:2,s:this.track.length*.785,lane:0,length:16,width:9,height:4.0}];
    this.pads=[{s:this.track.length*.055,lane:3},{s:this.track.length*.315,lane:-4},{s:this.track.length*.685,lane:4},{s:this.track.length*.925,lane:-2}];
    this.props=makeObstacles(this.track,this.ramps);
    this.mounds=[{id:'hill1',s:this.track.length*.12,lane:0,length:12,width:20,height:.8},{id:'hill2',s:this.track.length*.40,lane:1,length:15,width:17,height:1.1},{id:'hill3',s:this.track.length*.71,lane:-1,length:12,width:20,height:.75}];
    for(let i=0;i<5;i++)this.mounds.push({id:'rumble'+i,s:this.track.length*.62+i*3.0,lane:0,length:2.4,width:21,height:.18});
    if(this.freestyle)setupArena(this);
    this.updateRanks();
  }
  start(assist=this.assist) {this.reset();this.assist=assist;this.mode='countdown';}
  pause() {if(this.mode==='racing'||this.mode==='countdown'){this.previousMode=this.mode;this.mode='paused';return true;}return false;}
  resume() {if(this.mode==='paused')this.mode=this.previousMode;}
  emit(type,data={}) {this.events.push({type,...data});}
  groundAt(car) {
    const projection=car.projection;
    for(const r of this.ramps) {
      const ds=mod(projection.s-r.s,this.track.length);
      if(ds<r.length && Math.abs(projection.lateral-r.lane)<r.width*.5)
        return {height:ds/r.length*r.height,ramp:r};
    }
    for(const m of this.mounds) {
      const ds=mod(projection.s-m.s,this.track.length);
      if(ds<m.length&&Math.abs(projection.lateral-m.lane)<m.width/2)return {height:Math.sin(ds/m.length*Math.PI)**2*m.height,ramp:null,mound:m,phase:ds/m.length};
    }
    for(const p of this.props)if(p.type==='car'){
      const ds=mod(projection.s-(p.s-2.6),this.track.length);
      if(ds<5.2&&Math.abs(projection.lateral-p.lane)<1.55){
        const height=1.5*(1-p.crush*.60);
        return {height:Math.sin(ds/5.2*Math.PI)**2*height,ramp:null,mound:{id:'car'+p.id,length:5.2,height},phase:ds/5.2};
      }
    }
    return {height:0,ramp:null};
  }
  respawn(car=this.player,manual=true) {
    const p=this.freestyle?this.track.at(28,car.id===0?0:car.lane):this.track.at(car.s,car.id===0?0:car.lane);
    car.x=p.x;car.z=p.z;car.heading=p.heading;car.y=0;car.vy=0;car.air=false;car.onRamp=null;car.pitch=0;car.roll=0;car.crash=0;
    car.speed=manual?0:15;car.stuck=0;car.wrongWay=0;car.crashCooldown=1.2;car.respawns++;
    car.projection=this.track.project(car.x,car.z);car.suspension=createSuspension();car.lastSurface=null;
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
  drive(car,dt,input) {
    const previousSpeed=car.speed,previousHeading=car.heading;
    const isPlayer=car.id===0,L=this.track.length,proj=car.projection,offroad=Math.abs(proj.lateral)>this.track.width/2;
    let throttle=0,brake=0,steer=0,boost=false;
    if(isPlayer) {
      throttle=input.forward?1:this.assist?1:0;
      brake=input.brake?1:0;
      if(brake)throttle=0;
      // The asset faces +Z: from the chase camera, screen-right is local -X.
      steer=-clamp(input.steer||0,-1,1);
      boost=!!input.boost;
    } else {
      const orbit=this.time*.12+car.id*1.18,orbitRadius=35+car.id*6;
      const ahead=this.freestyle?{x:Math.sin(orbit)*orbitRadius,z:Math.cos(orbit)*orbitRadius}:this.track.at(car.s+12+Math.abs(car.speed)*.60,car.lane+Math.sin(this.time*.45+car.id)*1.1);
      const want=Math.atan2(ahead.x-car.x,ahead.z-car.z);
      const err=angleDelta(car.heading,want);
      steer=clamp(err*2.7,-1,1);
      const bend=Math.abs(angleDelta(proj.heading,this.track.at(car.s+35).heading));
      const behind=clamp((this.progress(this.player)-this.progress(car))/90,-1,1);
      const target=this.freestyle?17+car.id*.8:clamp(25-car.id*.15-bend*4+behind*2,18,28);
      throttle=car.speed<target?1:.15;brake=car.speed>target+2?.35:0;
      boost=(Math.sin(this.time*.34+car.id*1.9)>.89 && bend<.5 && car.boost>45);
    }
    if(car.finished){throttle=0;brake=.2;boost=false;}
    car.padCooldown=Math.max(0,car.padCooldown-dt);
    car.padBoost=Math.max(0,car.padBoost-dt);
    car.crashCooldown=Math.max(0,car.crashCooldown-dt);
    car.crash=Math.max(0,car.crash-dt);
    const canBoost=(boost && car.boost>1 || car.padBoost>0) && !brake && car.speed>3 && !car.finished;
    car.boosting=!!canBoost;
    car.boost=clamp(car.boost+(canBoost&&car.padBoost===0?-37:canBoost?0:16)*dt,0,100);
    let acceleration=throttle*(canBoost?22:12)-car.speed*(offroad?.72:.16)-car.speed*Math.abs(car.speed)*.0015;
    if(!canBoost && car.speed>=26)acceleration=Math.min(acceleration,-(car.speed-26)*1.35-.8);
    if(brake)acceleration-=car.speed>1?34:car.speed>-10?12:0;
    if(!throttle&&!brake&&Math.abs(car.speed)<.25)car.speed=0;
    car.speed=clamp(car.speed+acceleration*dt,-7,38);
    if(offroad&&!car.air)car.speed=Math.min(car.speed,20);
    const steeringMax=lerp(.48,.19,clamp(Math.abs(car.speed)/55,0,1));
    car.steering=lerp(car.steering,steer*steeringMax,1-Math.exp(-9*dt));
    car.heading+=car.speed/3.4*Math.tan(car.steering)*dt*(car.air?.22:1);
    if(isPlayer && this.assist && car.speed>0 && !car.air && !this.freestyle) {
      const helpTarget=this.track.at(car.s+14+car.speed*.22,clamp(proj.lateral,-7,7));
      const wanted=Math.atan2(helpTarget.x-car.x,helpTarget.z-car.z);
      const edgeHelp=Math.max(0,Math.abs(proj.lateral)-9)*.8;
      car.heading+=angleDelta(car.heading,wanted)*dt*(2.9*(1-Math.abs(steer)*.68)+edgeHelp);
    }
    car.x+=Math.sin(car.heading)*car.speed*dt;car.z+=Math.cos(car.heading)*car.speed*dt;
    car.wheelAngle+=car.speed*dt/.685;
    car.roll=lerp(car.roll,-car.steering*car.speed*.015,1-Math.exp(-7*dt));
    const oldS=car.s;
    car.projection=this.track.project(car.x,car.z);car.s=car.projection.s;
    const ground=this.groundAt(car);
    if(!car.air&&ground.mound&&ground.mound.height>.35&&car.speed>18&&car.lastSurface?.id===ground.mound.id&&((car.lastSurface.phase<.50&&ground.phase>=.50)||(this.freestyle&&car.lastSurface.phase>.50&&ground.phase<=.50))){
      car.air=true;car.vy=clamp(car.speed*ground.mound.height/ground.mound.length*1.35,2.1,9);
      car.y=Math.max(car.y,ground.height);car.airDistance=0;car.airTime=0;
      if(isPlayer)this.emit('jump',{x:car.x,z:car.z});
    }
    car.lastSurface=ground.mound?{id:ground.mound.id,phase:ground.phase}:null;
    if(car.air) {
      car.vy-=19*dt;car.y+=car.vy*dt;car.airTime+=dt;car.airDistance+=Math.abs(car.speed)*dt;
      car.pitch=lerp(car.pitch,clamp(-car.vy*.025,-.32,.32),1-Math.exp(-4*dt));
      if(car.y<=ground.height && car.vy<0) {
        car.suspension.impact=Math.abs(car.vy);
        car.y=ground.height;car.air=false;car.vy=0;car.pitch=0;
        if(isPlayer){const distance=Math.round(car.airDistance);car.score+=distance*12;this.emit('land',{distance,x:car.x,z:car.z});}
        car.airDistance=0;
      }
    } else {
      if(car.onRamp && ground.ramp!==car.onRamp && car.speed>8) {
        car.air=true;car.vy=clamp(car.speed*car.onRamp.height/car.onRamp.length*.84,3.2,14);
        car.y=Math.max(car.y,car.onRamp.height);car.airDistance=0;car.airTime=0;
        if(isPlayer)this.emit('jump',{x:car.x,z:car.z});
      } else {
        car.y=ground.height;
        car.pitch=lerp(car.pitch,ground.ramp?-Math.atan2(ground.ramp.height,ground.ramp.length):0,1-Math.exp(-12*dt));
      }
    }
    car.onRamp=ground.ramp;
    if(this.freestyle&&(Math.abs(car.x)>88||Math.abs(car.z)>88)){
      car.x=clamp(car.x,-88,88);car.z=clamp(car.z,-88,88);
      const inward=Math.atan2(-car.x,-car.z);car.heading+=angleDelta(car.heading,inward)*.28;
      if(car.crashCooldown===0){car.speed*=.55;car.crash=.55;car.crashCooldown=.8;if(isPlayer)this.emit('crash',{strength:.5,x:car.x,z:car.z});}
    }
    const wall=this.track.width/2+8;
    if(Math.abs(car.projection.lateral)>wall) {
      const sign=Math.sign(car.projection.lateral), excess=Math.abs(car.projection.lateral)-wall;
      car.x-=car.projection.nx*sign*excess;car.z-=car.projection.nz*sign*excess;
      car.heading+=angleDelta(car.heading,car.projection.heading)*.18;
      if(car.crashCooldown===0){car.speed*=.66;car.crash=.6;car.crashCooldown=.65;if(isPlayer){car.crashTotal++;this.emit('crash',{strength:.55,x:car.x,z:car.z});}}
    }
    for(const pad of this.pads) {
      if(car.padCooldown===0 && Math.abs(mod(car.s-pad.s+L/2,L)-L/2)<3 && Math.abs(car.projection.lateral-pad.lane)<3.5 && car.y<.6) {
        car.boost=100;car.padBoost=1.8;car.padCooldown=2.3;
        if(isPlayer){car.score+=50;this.emit('pad',{x:car.x,z:car.z});}
      }
    }
    for(const prop of this.props) {
      if(!prop.active)continue;
      if(prop.type==='car'){
        const near=Math.abs(mod(car.s-prop.s+L/2,L)-L/2)<3&&Math.abs(car.projection.lateral-prop.lane)<1.9;
        if(near&&car.y<2.5&&Math.abs(car.speed)>2){prop.crush=clamp(prop.crush+dt*3.5,0,1);
          if(!prop.scored){prop.scored=true;if(isPlayer){car.score+=250;car.crashTotal++;}this.emit('crush',{prop:prop.id,x:prop.x,z:prop.z,player:isPlayer});}}
        continue;
      }
      if(car.y>prop.y+1.2||prop.y>car.y+2.6||Math.abs(car.speed)<1.5)continue;
      if(Math.hypot(car.x-prop.x,car.z-prop.z)<prop.radius+1.5) {
        if(kickProp(prop,car)){
          car.speed*=prop.type==='cone'?.998:.977;car.suspension.heaveVelocity-=.13*prop.mass;
          if(isPlayer){if(!prop.scored)car.score+=100;car.crashTotal++;}
          prop.scored=true;this.emit('smash',{prop:prop.id,kind:prop.type,x:prop.x,z:prop.z,player:isPlayer});
        }
      }
    }
    this.checkpoint(car,oldS,car.s);
    const facing=Math.cos(angleDelta(car.heading,car.projection.heading));
    car.wrongWay=!this.freestyle&&facing<-.35&&car.speed>2?car.wrongWay+dt:Math.max(0,car.wrongWay-dt*2);
    car.stuck=Math.abs(car.speed)<2&&!brake&&throttle?car.stuck+dt:0;
    if(car.stuck>4 || (!this.freestyle&&Math.hypot(car.x-car.projection.x,car.z-car.projection.z)>40))this.respawn(car,false);
    const wheelGround=WHEEL_CORNERS.map(corner=>{
      const delta=angleDelta(car.projection.heading,car.heading);
      const wheelS=car.s+corner.front*1.0416*Math.cos(delta)-corner.side*1.1036*Math.sin(delta);
      const lateral=car.projection.lateral+corner.side*1.1036*Math.cos(delta)+corner.front*1.0416*Math.sin(delta);
      const sample={projection:{s:mod(wheelS,L),lateral}};
      const surface=this.groundAt(sample);
      const roughness=Math.abs(lateral)>12?.055:.012;
      const bump=(Math.sin(wheelS*1.7+lateral*2.1)+Math.sin(wheelS*.61-lateral))*.5*roughness;
      const curb=Math.abs(lateral)>11.6&&Math.abs(lateral)<13.0?.14:0;
      return surface.height-car.y+bump+curb;
    });
    stepSuspension(car.suspension,dt,{air:car.air,ground:wheelGround,acceleration:clamp((car.speed-previousSpeed)/dt,-38,32),lateralAcceleration:clamp(angleDelta(previousHeading,car.heading)*car.speed/dt,-30,30),crash:car.crash});
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
    this.time+=dt;
    for(const car of this.cars)this.drive(car,dt,input);
    for(let i=0;i<this.cars.length;i++)for(let j=i+1;j<this.cars.length;j++) {
      const a=this.cars[i],b=this.cars[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
      if(d<3.15 && Math.abs(a.y-b.y)<1.65) {
        const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0,push=(3.15-d)*.5;
        a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;
        if(a.crashCooldown===0&&b.crashCooldown===0) {
          a.speed*=.87;b.speed*=.91;a.crashCooldown=b.crashCooldown=.7;a.crash=b.crash=.45;
          if(i===0){a.crashTotal++;this.emit('crash',{strength:.32,x:a.x,z:a.z});}
        }
      }
    }
    this.updateRanks();
    stepProps(this.props,dt);
  }
}
