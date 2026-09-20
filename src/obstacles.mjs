const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function makeObstacles(track,ramps){
  const props=[];
  const add=(s,lane,type,id)=>{const p=track.at(s,lane),data={cone:[.52,.65,.25],tyre:[.75,.8,.8],barrel:[.73,.9,1.2],crate:[.9,.825,1.8],car:[1.25,.85,20]}[type];
    props.push({id,x:p.x,z:p.z,s:p.s,lane,heading:p.heading,type,radius:data[0],halfHeight:data[1],mass:data[2],y:data[1],vx:0,vy:0,vz:0,rx:0,ry:0,rz:0,spinX:0,spinY:0,spinZ:0,active:true,cooldown:0,hit:false,crush:0,scored:false});};
  for(let i=0;i<44;i++){
    const s=(.07+i*.020)*track.length;
    if(ramps.some(r=>Math.abs(r.s-s)<20))continue;
    add(s,[-7,6,-2,8,3,-8][i%6],['cone','barrel','crate','tyre'][i%4],i);
    if(i%7===0){add(s+2,-5,'cone',100+i);add(s+3,-3,'barrel',200+i);}
  }
  [.225,.525,.845].forEach((f,j)=>{for(let n=0;n<3;n++)add(f*track.length+n*4.9,j===1?4:-3,'car',300+j*10+n);});
  return props;
}
export function kickProp(prop,car){
  if(prop.type==='car'||prop.cooldown>0)return false;
  let dx=prop.x-car.x,dz=prop.z-car.z,d=Math.hypot(dx,dz);
  if(d>.001){dx/=d;dz/=d;}else{dx=Math.sin(car.heading);dz=Math.cos(car.heading);}
  const power=clamp(Math.abs(car.speed)*.58,4,27)/Math.sqrt(prop.mass);
  prop.vx+=dx*power+Math.sin(car.heading)*car.speed*.12;
  prop.vz+=dz*power+Math.cos(car.heading)*car.speed*.12;
  prop.vy=clamp(2+Math.abs(car.speed)*.10,2,7);prop.hit=true;prop.cooldown=.45;
  prop.spinX=prop.vz*.35;prop.spinZ=-prop.vx*.35;prop.spinY=(car.id%2?1:-1)*2.8;
  return true;
}
export function stepProps(props,dt){
  for(const p of props){
    p.cooldown=Math.max(0,p.cooldown-dt);
    if(!p.hit||p.type==='car')continue;
    p.vy-=15*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
    p.rx+=p.spinX*dt;p.ry+=p.spinY*dt;p.rz+=p.spinZ*dt;
    const support=p.type==='cone'?.4:p.type==='barrel'?.74:p.halfHeight;
    if(p.y<support){p.y=support;if(p.vy<-.9)p.vy*=-.30;else p.vy=0;
      const friction=Math.exp(-(p.type==='tyre'?1.1:2.8)*dt);p.vx*=friction;p.vz*=friction;
      p.spinX*=Math.exp(-3.5*dt);p.spinY*=Math.exp(-2*dt);p.spinZ*=Math.exp(-3.5*dt);}
    if(Math.hypot(p.vx,p.vz)<.09&&Math.abs(p.vy)<.09){p.vx=p.vz=p.spinX=p.spinY=p.spinZ=0;}
  }
  for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++){
    const a=props[i],b=props[j];if((!a.hit&&!b.hit)||a.type==='car'||b.type==='car'||Math.abs(a.y-b.y)>1.4)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),r=(a.radius+b.radius)*.88;
    if(d<.001||d>=r)continue;const nx=dx/d,nz=dz/d,relative=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
    if(relative>0){const impulse=relative*1.32/(1/a.mass+1/b.mass);a.vx-=nx*impulse/a.mass;a.vz-=nz*impulse/a.mass;b.vx+=nx*impulse/b.mass;b.vz+=nz*impulse/b.mass;a.hit=b.hit=true;b.spinX+=b.vz*.12;b.spinZ-=b.vx*.12;}
    const push=(r-d)*.5;a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;
  }
}

