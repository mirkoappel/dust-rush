import * as THREE from 'three';
import {WHEEL_TYPES} from '../customization.mjs';
import {VEHICLE_DIMENSIONS as DIM} from '../vehicle-dimensions.mjs';
import {box,rod,mesh,mergeStatic} from './geometry.mjs';
import {BODY_STYLES,getBodyMounts,enginePlacement,curvedPipeGeometry,FRAME_RAIL_Y,FRAME_HALF_WIDTH,TRANSFER_POINT} from './vehicle-mounts.mjs';
export {BODY_STYLES} from './vehicle-mounts.mjs';

function makeEngineAssembly(motor,mounts,kind,materials,{shadow=false}={}){
  const placement=enginePlacement(mounts,kind),group=new THREE.Group(),supports=new THREE.Group();
  group.name='Mounted_engine_'+mounts.body+'_'+kind;
  supports.name='Engine_mounts_and_transmission';
  motor.name='Configured_engine_'+kind;
  motor.position.set(...placement.position);motor.scale.setScalar(placement.scale);motor.rotation.y=placement.yaw;
  group.add(motor,supports);
  const {dark,steel,rubber}=materials;
  const frameAnchors=[];
  const rows=[...new Set(placement.feet.map(foot=>foot[2]))];
  for(const z of rows){
    box(supports,FRAME_HALF_WIDTH*2+.07,.065,.10,dark,0,FRAME_RAIL_Y,z,.012);
    for(const side of [-1,1]){
      const x=side*FRAME_HALF_WIDTH;frameAnchors.push([x,FRAME_RAIL_Y,z]);
      rod(supports,[x,FRAME_RAIL_Y+.032,z],[x,FRAME_RAIL_Y+.049,z],.019,steel,6);
    }
  }
  for(const foot of placement.feet){
    const [x,y,z]=foot,rail=[Math.sign(x)*FRAME_HALF_WIDTH,FRAME_RAIL_Y+.028,z];
    // A bracket reaches from the frame rail to the engine foot. The rubber
    // biscuit sits between them; neither the engine nor its sump is floating.
    rod(supports,rail,[x,y-.048,z],.032,dark,10);
    box(supports,.13,.028,.13,steel,x,y-.062,z,.008);
    box(supports,.10,.045,.105,rubber,x,y-.026,z,.012);
    box(supports,.13,.018,.12,steel,x,y+.005,z,.007);
    rod(supports,[x,y+.014,z],[x,y+.032,z],.017,steel,6);
  }

  const [x,inputY,inputZ]=placement.output,direction=placement.direction;
  const bellEnd=[x,inputY,inputZ+direction*.12];
  rod(supports,placement.output,bellEnd,.133,steel,16);
  const length=THREE.MathUtils.clamp((Math.abs(inputZ)-.12)*.55,.16,.36);
  const outputZ=bellEnd[2]+direction*length;
  // A compact drop gearbox keeps the prop shaft's articulation plausible even
  // on the short hotrod nose, rather than pointing a shaft almost vertically.
  const outputY=Math.min(inputY-.10,TRANSFER_POINT[1]+Math.abs(outputZ)*.6);
  const gearboxHeight=inputY-outputY+.21,gearboxY=(inputY+outputY)/2;
  box(supports,.285,gearboxHeight,length,dark,x,gearboxY,bellEnd[2]+direction*length/2,.045);
  for(const z of [bellEnd[2]+direction*.06,outputZ-direction*.035]){
    box(supports,.303,gearboxHeight*.82,.019,steel,x,gearboxY,z,.007);
  }
  const output=[x,outputY,outputZ];
  rod(supports,output,TRANSFER_POINT,.033,steel,12);
  const shaftDirection=new THREE.Vector3(...TRANSFER_POINT).sub(new THREE.Vector3(...output)).normalize();
  for(const [at,sign] of [[output,1],[TRANSFER_POINT,-1]]){
    const point=new THREE.Vector3(...at),end=point.clone().addScaledVector(shaftDirection,.07*sign);
    rod(supports,point.toArray(),end.toArray(),.057,dark,12);
    rod(supports,[point.x-.055,point.y,point.z],[point.x+.055,point.y,point.z],.015,steel,8);
  }
  if(kind!=='electric'){
    for(const {collector,junction} of placement.exhaust){
      mesh(supports,curvedPipeGeometry(collector,.038,.07),steel);
      const from=collector[1],mid=[junction[0],FRAME_RAIL_Y+.08,from[2]];
      mesh(supports,curvedPipeGeometry([from,mid,junction],.036,.075),steel);
      rod(supports,[junction[0],junction[1]-.025,junction[2]],[junction[0],junction[1]+.025,junction[2]],.043,dark,10);
    }
  }
  supports.userData={frameAnchors,feet:placement.feet,engineOutput:placement.output,gearboxOutput:output,transfer:[...TRANSFER_POINT],exhaustJunctions:kind==='electric'?[]:placement.exhaust.map(port=>port.junction)};
  mergeStatic(supports);
  supports.traverse(object=>{if(object.isMesh){object.castShadow=shadow;object.receiveShadow=true;}});
  return {group,motor,supports};
}

export function installBodyKits(sprung,originalBody,wheels,library,{shadow=false}={}){
  const root=new THREE.Group();root.name='Configurable_body_and_powertrain';
  root.scale.setScalar(1/DIM.modelScale);root.position.y=.187/DIM.modelScale;sprung.add(root);
  originalBody.visible=false;
  const variants=new Map(),assemblies=new Map(),wheelVariants=new Map(),paintGroups={body:[],wheels:[],engine:[]},mountsByBody=new Map();
  const mechanicalMaterials={
    dark:new THREE.MeshStandardMaterial({color:'#2b3c42',metalness:.65,roughness:.46}),
    steel:new THREE.MeshStandardMaterial({color:'#91a2a5',metalness:.78,roughness:.34}),
    rubber:new THREE.MeshStandardMaterial({color:'#252a2c',roughness:.86}),
  };
  let body='pickup',engine='classic',wheelStyle='standard',focus='truck',colors={body:'#14bdd1',wheels:'#ff6c24',engine:'#ff6c24'};
  function currentMounts(){
    if(!mountsByBody.has(body))mountsByBody.set(body,getBodyMounts(library,body));
    return mountsByBody.get(body);
  }
  function clone(name,category){
    const source=library.getObjectByName('DR2_'+name);
    if(!source)throw new Error('Missing truck asset: '+name);
    const result=source.clone(true);
    result.traverse(o=>{
      if(!o.isMesh)return;o.castShadow=shadow;o.receiveShadow=true;
      const tint=m=>{
        if((category==='body'&&m.name.includes('Turquoise'))||(category!=='body'&&m.name.includes('Orange'))){
          const copy=m.clone();copy.color.set(colors[category]);paintGroups[category].push(copy);return copy;
        }
        return m;
      };
      o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);
    });
    return result;
  }
  for(const wheel of wheels)for(const child of wheel.children)child.visible=false;
  function setWheels(value){
    const kind=Object.hasOwn(WHEEL_TYPES,value)?value:'standard';wheelStyle=kind;
    if(!wheelVariants.has(kind)){
      wheelVariants.set(kind,wheels.map(wheel=>{
        const tire=clone('Wheel_'+kind,'wheels');tire.scale.setScalar(1/DIM.modelScale);wheel.add(tire);return tire;
      }));
    }
    for(const [key,tires] of wheelVariants)for(const tire of tires)tire.visible=key===kind;
  }
  function currentAssembly(){return assemblies.get(body+':'+engine);}
  function sync(){
    if(!variants.has(body)){const shell=clone('Body_'+body,'body');variants.set(body,shell);root.add(shell);}
    for(const [key,shell] of variants)shell.visible=key===body&&focus!=='engine';
    const key=body+':'+engine;
    if(!assemblies.has(key)){
      const assembly=makeEngineAssembly(clone('Engine_'+engine,'engine'),currentMounts(),engine,mechanicalMaterials,{shadow});
      assemblies.set(key,assembly);root.add(assembly.group);
    }
    // The assembly stays complete while the body shell is hidden for inspection.
    // The van's internal motor is naturally occluded by its body, not switched off.
    for(const [name,assembly] of assemblies)assembly.group.visible=name===key;
  }
  setWheels('standard');sync();
  return {
    root,setWheels,getMounts:currentMounts,
    setFocus(value){if(focus===value)return;focus=value;sync();},
    focusTarget(part){
      const object=part==='engine'?currentAssembly()?.motor:part==='wheels'||part==='lift'?wheelVariants.get(wheelStyle)?.[0]:part==='body'?variants.get(body):null;
      if(!object)return null;
      object.updateWorldMatrix(true,true);
      const center=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
      if(part==='lift')center.y+=.55;
      return center;
    },
    setStyle(value){const next=BODY_STYLES.includes(value)?value:'pickup';if(body===next)return;body=next;sync();},
    setEngine(value){const next=['classic','supercharged','electric'].includes(value)?value:'classic';if(engine===next)return;engine=next;sync();},
    setPaint(value){colors={...colors,...value};for(const [key,materials] of Object.entries(paintGroups))for(const material of materials)material.color.set(colors[key]);}
  };
}
