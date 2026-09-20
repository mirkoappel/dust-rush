import {ensureMotion,refreshSpeed} from './physics.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dimensions={cone:[.52,.65,8],tyre:[.75,.8,45],barrel:[.73,.9,80],crate:[.9,.825,160],car:[1.25,.85,1100]};
export function createProp(type,id,x,z,s,lane,heading=0){
  const [radius,halfHeight,mass]=dimensions[type];
  return {id,x,z,s,lane,heading,type,radius,halfHeight,mass,y:halfHeight,vx:0,vy:0,vz:0,rx:0,ry:0,rz:0,spinX:0,spinY:0,spinZ:0,active:true,cooldown:0,hit:false,crush:0,scored:false};
}
export function makeObstacles(track,ramps){
  const props=[];
  const add=(s,lane,type,id)=>{const p=track.at(s,lane);props.push(createProp(type,id,p.x,p.z,p.s,lane,p.heading));};
  for(let i=0;i<44;i++){
    const s=(.07+i*.020)*track.length;if(ramps.some(r=>Math.abs(r.s-s)<20))continue;
    add(s,[-7,6,-2,8,3,-8][i%6],['cone','barrel','crate','tyre'][i%4],i);
    if(i%7===0){add(s+2,-5,'cone',100+i);add(s+3,-3,'barrel',200+i);}
  }
  [.225,.525,.845].forEach((f,j)=>{for(let n=0;n<3;n++)add(f*track.length+n*4.9,j===1?4:-3,'car',300+j*10+n);});
  return props;
}
export function kickProp(prop,car){
  if(prop.type==='car')return false;ensureMotion(car);
  let nx=prop.x-car.x,nz=prop.z-car.z,d=Math.hypot(nx,nz);
  if(d>.001){nx/=d;nz/=d;}else{nx=Math.sin(car.heading);nz=Math.cos(car.heading);}
  const closing=(car.vx-prop.vx)*nx+(car.vz-prop.vz)*nz;
  const overlap=Math.max(0,prop.radius+1.45-d),sum=car.mass+prop.mass;
  prop.x+=nx*overlap*car.mass/sum;prop.z+=nz*overlap*car.mass/sum;
  car.x-=nx*overlap*prop.mass/sum;car.z-=nz*overlap*prop.mass/sum;
  if(closing<=.08)return false;
  const impulse=closing*1.08/(1/car.mass+1/prop.mass);
  car.vx-=nx*impulse/car.mass;car.vz-=nz*impulse/car.mass;
  prop.vx+=nx*impulse/prop.mass;prop.vz+=nz*impulse/prop.mass;refreshSpeed(car);
  prop.hit=true;
  // A tyre strike tips objects; it does not launch every crate vertically.
  prop.vy=Math.max(prop.vy,Math.min(1.2,closing*.055));
  prop.spinX=clamp(prop.vz*.48,-6,6);prop.spinZ=clamp(-prop.vx*.48,-6,6);prop.spinY=clamp(car.lateralSpeed*.25,-2,2);
  const announce=prop.cooldown===0&&closing>.7;prop.cooldown=.35;return announce;
}
function supportHeight(p){
  const up=Math.abs(Math.cos(p.rx)*Math.cos(p.rz));
  if(p.type==='crate')return Math.min(1.4,p.halfHeight*(up+Math.abs(Math.sin(p.rx))+Math.abs(Math.sin(p.rz))));
  if(p.type==='cone')return .32+up*.33;
  return p.radius+(p.halfHeight-p.radius)*up;
}
export function stepProps(props,dt,groundAt=()=>0){
  for(const p of props){
    p.cooldown=Math.max(0,p.cooldown-dt);if(!p.hit||p.type==='car')continue;
    p.vy-=9.81*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
    p.rx+=p.spinX*dt;p.ry+=p.spinY*dt;p.rz+=p.spinZ*dt;
    const support=groundAt(p.x,p.z)+supportHeight(p);
    if(p.y<support){
      p.y=support;if(p.vy< -1.2)p.vy*=-.16;else p.vy=0;
      const v=Math.hypot(p.vx,p.vz),friction=p.type==='tyre'?.9:2.7,factor=v?Math.max(0,1-friction*dt/v):0;
      p.vx*=factor;p.vz*=factor;p.spinX*=Math.exp(-2.8*dt);p.spinY*=Math.exp(-2*dt);p.spinZ*=Math.exp(-2.8*dt);
    }
    if(Math.hypot(p.vx,p.vz)<.06&&Math.abs(p.vy)<.06){p.vx=p.vz=p.spinX=p.spinY=p.spinZ=0;}
  }
  for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++){
    const a=props[i],b=props[j];if((!a.hit&&!b.hit)||a.type==='car'||b.type==='car'||Math.abs(a.y-b.y)>1.4)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),r=(a.radius+b.radius)*.88;
    if(d<.001||d>=r)continue;
    const nx=dx/d,nz=dz/d,relative=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
    if(relative>0){const impulse=relative*1.16/(1/a.mass+1/b.mass);a.vx-=nx*impulse/a.mass;a.vz-=nz*impulse/a.mass;b.vx+=nx*impulse/b.mass;b.vz+=nz*impulse/b.mass;a.hit=b.hit=true;b.spinX+=b.vz*.12;b.spinZ-=b.vx*.12;}
    const push=r-d,total=a.mass+b.mass;
    a.x-=nx*push*b.mass/total;a.z-=nz*push*b.mass/total;b.x+=nx*push*a.mass/total;b.z+=nz*push*a.mass/total;
  }
}
