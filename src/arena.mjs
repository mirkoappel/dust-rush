// Flat arena coordinates reuse the vehicle, suspension and collision simulation.
export function createArenaTrack(){
  const at=(distance,lateral=0)=>({x:lateral,z:distance-95,s:distance,lateral,heading:0,index:0,nx:1,nz:0,tx:0,tz:1,len:190});
  return {length:190,width:180,points:[at(0),at(190)],at,project:(x,z)=>({...at(z+95,x),x:0,z,lateral:x})};
}
export function setupArena(race){
  race.ramps=[];race.pads=[];
  race.mounds=[
    {id:'big-air',s:80,lane:0,length:30,width:20,height:4.6},
    {id:'left-jump',s:46,lane:-43,length:22,width:13,height:3.1},
    {id:'right-jump',s:122,lane:42,length:24,width:14,height:3.6},
    {id:'small-jump',s:148,lane:-28,length:15,width:18,height:1.4},
    {id:'bumpy1',s:42,lane:28,length:8,width:15,height:.7},
    {id:'bumpy2',s:52,lane:28,length:8,width:15,height:.9},
    {id:'bumpy3',s:62,lane:28,length:8,width:15,height:.7}
  ];
  race.props=[];let id=1000;
  const add=(x,z,type)=>{
    const data={cone:[.52,.65,.25],tyre:[.75,.8,.8],barrel:[.73,.9,1.2],crate:[.9,.825,1.8],car:[1.25,.85,20]}[type];
    race.props.push({id:id++,x,z,s:z+95,lane:x,heading:0,type,radius:data[0],halfHeight:data[1],mass:data[2],y:data[1],vx:0,vy:0,vz:0,rx:0,ry:0,rz:0,spinX:0,spinY:0,spinZ:0,active:true,cooldown:0,hit:false,crush:0,scored:false});
  };
  for(const lane of [-24,24])for(let i=0;i<5;i++)add(lane,-8+i*5,'car');
  for(let i=0;i<48;i++){
    const angle=i*2.39996,radius=24+(i%7)*7,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(Math.abs(x)<12&&z<20&&z>-17)continue;
    add(x,z,['cone','barrel','crate','tyre'][i%4]);
  }
  for(let i=0;i<7;i++)add(-15+i*5,52,i%2?'barrel':'cone');
  race.cars.forEach((car,i)=>{
    const x=i===0?0:((i-1)%3-1)*15,z=i===0?-67:-48+Math.floor((i-1)/3)*12,p=race.track.at(z+95,x);
    Object.assign(car,{x,z,heading:0,lane:x,s:p.s,projection:race.track.project(x,z)});
  });
}

