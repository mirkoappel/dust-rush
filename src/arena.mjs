import {createProp} from './obstacles.mjs';
export function createArenaTrack(){
  const at=(distance,lateral=0)=>({x:lateral,z:distance-95,s:distance,lateral,heading:0,index:0,nx:1,nz:0,tx:0,tz:1,len:190});
  return {length:190,width:180,points:[at(0),at(190)],at,project:(x,z)=>({...at(z+95,x),x:0,z,lateral:x})};
}
// Shared by collision sampling and rendering, including sideways and diagonal jumps.
export function arenaSurfaceLocal(surface,s,lateral){
  const angle=surface.heading||0,dx=lateral-surface.lane,dz=s-surface.s;
  return {along:dx*Math.sin(angle)+dz*Math.cos(angle),across:dx*Math.cos(angle)-dz*Math.sin(angle)};
}
export function arenaSurfacePoint(surface,phase,side=0){
  const angle=surface.heading||0,along=surface.length*phase,across=side*surface.width/2;
  return {x:surface.lane+Math.sin(angle)*along+Math.cos(angle)*across,z:surface.s-95+Math.cos(angle)*along-Math.sin(angle)*across,heading:angle};
}
export function setupArena(race){
  race.ramps=[];race.pads=[];
  race.mounds=[
    {id:'big-air',s:80,lane:0,length:24,width:20,height:4.6,zone:'sky'},
    {id:'left-jump',s:46,lane:-43,length:22,width:13,height:3.1,zone:'sky'},
    {id:'right-jump',s:122,lane:42,length:24,width:14,height:3.6,zone:'sky'},
    {id:'small-jump',s:148,lane:-28,length:15,width:18,height:1.4,zone:'crush'},
    {id:'bumpy1',s:42,lane:28,length:8,width:15,height:.7,zone:'rhythm'},
    {id:'bumpy2',s:52,lane:28,length:8,width:15,height:.9,zone:'rhythm'},
    {id:'bumpy3',s:62,lane:28,length:8,width:15,height:.7,zone:'rhythm'},
    {id:'cross-over',s:140,lane:-2,length:25,width:11,height:2.7,heading:Math.PI/2,zone:'sky'},
    {id:'diagonal',s:53,lane:50,length:23,width:12,height:3.3,heading:-Math.PI/4,zone:'sky'},
    {id:'side-hop',s:107,lane:-70,length:20,width:11,height:2.5,heading:Math.PI/2,zone:'crush'},
    {id:'low-wave1',s:162,lane:30,length:10,width:15,height:.6,zone:'rhythm'},
    {id:'low-wave2',s:162,lane:43,length:10,width:15,height:.9,zone:'rhythm'}
  ];
  race.gates=[
    {id:0,x:0,z:0,y:6.7,heading:0,radius:3.6},
    {id:1,x:-43,z:-33,y:5,heading:0,radius:3.4},
    {id:2,x:42,z:44,y:5.5,heading:0,radius:3.6},
    {id:3,x:12,z:45,y:4.8,heading:Math.PI/2,radius:3.4},
    {id:4,x:-55,z:12,y:4.4,heading:Math.PI/2,radius:3.5}
  ].map(g=>({...g,collected:false}));
  race.props=[];let id=1000;
  const add=(x,z,type,extra={})=>{const p=createProp(type,id++,x,z,z+95,x);Object.assign(p,extra);race.props.push(p);return p;};
  for(const lane of [-24,24])for(let i=0;i<5;i++)add(lane,-8+i*5,'car');
  // A crushable car pyramid, with approach lanes on both sides.
  for(let row=0;row<3;row++)for(let col=0;col<3-row;col++)add(-56+col*3+row*1.5,54,'car',{stackHeight:row*.62});
  for(let i=0;i<42;i++){
    const angle=i*2.39996,radius=27+(i%7)*7,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(Math.abs(x)<13&&z<22&&z>-20)continue;
    add(x,z,['cone','barrel','crate','tyre'][i%4]);
  }
  // Bowling rows and stacks that wake up and fall when struck.
  for(let row=0;row<4;row++)for(let col=0;col<=row;col++)add(51+(col-row/2)*2.0,-13+row*2.2,'barrel');
  for(let stack=0;stack<4;stack++)for(let level=0;level<3;level++){
    const p=add(-59+stack*3.1,-9,'crate',{stack:'crates-'+stack});p.y+=level*1.65;
  }
  for(let i=0;i<7;i++)add(-15+i*5,68,i%2?'barrel':'cone');
  race.cars.forEach((car,i)=>{
    const x=i===0?0:((i-1)%3-1)*15,z=i===0?-67:-48+Math.floor((i-1)/3)*12,p=race.track.at(z+95,x);
    Object.assign(car,{x,z,heading:0,lane:x,s:p.s,projection:race.track.project(x,z)});
  });
}
export function collectArenaGates(race,car,oldX,oldZ){
  if(!race.freestyle||car.id!==0)return;
  for(const gate of race.gates||[]){
    if(gate.collected)continue;
    const sn=Math.sin(gate.heading),cs=Math.cos(gate.heading);
    const before=(oldX-gate.x)*sn+(oldZ-gate.z)*cs,after=(car.x-gate.x)*sn+(car.z-gate.z)*cs;
    if(before*after>0||Math.abs(after-before)<.001)continue;
    const across=(car.x-gate.x)*cs-(car.z-gate.z)*sn,vertical=car.y+1.2-gate.y;
    if(Math.hypot(across,vertical)<gate.radius-.35){gate.collected=true;car.score+=500;race.emit('gate',{x:gate.x,y:gate.y,z:gate.z});}
  }
}
