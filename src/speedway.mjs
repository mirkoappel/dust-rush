// A flat stadium circuit. Analytic projection avoids scanning kilometres of
// road at every wheel contact; render points are only a visual tessellation.
export function createSpeedway({straightLength=3000,radius=180,laneWidth=3.75,laneCount=4,shoulder=3}={}){
  const width=laneCount*laneWidth+2*shoulder;
  const arc=Math.PI*radius,length=2*straightLength+2*arc;
  const wrap=s=>((s%length)+length)%length;
  const half=straightLength/2;
  function at(distance,lateral=0){
    const s=wrap(distance);let x,z,heading;
    if(s<straightLength){x=-radius;z=-half+s;heading=0;}
    else if(s<straightLength+arc){
      const angle=(s-straightLength)/radius;
      x=-radius*Math.cos(angle);z=half+radius*Math.sin(angle);heading=angle;
    }else if(s<2*straightLength+arc){x=radius;z=half-(s-straightLength-arc);heading=Math.PI;}
    else{
      const angle=(s-2*straightLength-arc)/radius;
      x=radius*Math.cos(angle);z=-half-radius*Math.sin(angle);heading=Math.PI+angle;
    }
    const tx=Math.sin(heading),tz=Math.cos(heading),nx=tz,nz=-tx;
    return {x:x+nx*lateral,z:z+nz*lateral,s,heading,tx,tz,nx,nz};
  }
  function project(x,z){
    let s;
    if(z>half){const angle=Math.atan2(z-half,-x);s=straightLength+radius*angle;}
    else if(z< -half){const angle=Math.atan2(-z-half,x);s=2*straightLength+arc+radius*angle;}
    else s=x<0?z+half:straightLength+arc+half-z;
    const p=at(s);
    return {...p,lateral:(x-p.x)*p.nx+(z-p.z)*p.nz};
  }
  const points=[];
  for(const [start,span,count] of [[0,straightLength,Math.ceil(straightLength/30)],[straightLength,arc,96],[straightLength+arc,straightLength,Math.ceil(straightLength/30)],[2*straightLength+arc,arc,96]]){
    for(let i=0;i<count;i++)points.push(at(start+span*i/count));
  }
  return {id:'speedway',timeTrial:true,flat:true,width,length,straightLength,radius,at,project,points,
    laneWidth,laneCount,shoulder,guardrailOffset:width/2+.6,guardrailThickness:.15,
    bounds:{width:2*radius+400,depth:straightLength+2*radius+400},
    straights:[{s:0,length:straightLength},{s:straightLength+arc,length:straightLength}]};
}
