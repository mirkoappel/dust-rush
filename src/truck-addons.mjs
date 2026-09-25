import * as THREE from 'three';
import {normalizeBuild,isPartAvailable} from './customization.mjs';
import {box,rod,mesh,mergeStatic} from './models/geometry.mjs';
import {getBodyMounts,enginePlacement,curvedPipeGeometry,FRAME_RAIL_Y,LIGHT_BAR_SPANS} from './models/vehicle-mounts.mjs';

function disposeGeometry(group){
  group.traverse(object=>object.geometry?.dispose());
  group.clear();group.position.set(0,0,0);
}
function bolt(parent,x,y,z,material){
  rod(parent,[x,y,z],[x,y+.016,z],.014,material,6);
}
function footPlate(parent,x,z,steel,rubber,y=0){
  box(parent,.19,.025,.24,rubber,x,y+.004,z,.009);
  box(parent,.19,.022,.24,steel,x,y+.027,z,.009);
  for(const dx of [-.056,.056])for(const dz of [-.072,.072])bolt(parent,x+dx,y+.039,z+dz,steel);
}
function mouth(parent,end,previous,radius,steel,dark){
  const normal=new THREE.Vector3(...end).sub(new THREE.Vector3(...previous)).normalize();
  const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
  const rim=mesh(parent,new THREE.TorusGeometry(radius*.89,radius*.12,6,16),steel,end);rim.quaternion.copy(rotation);
  const inset=new THREE.Vector3(...end).addScaledVector(normal,-.042);
  const bore=mesh(parent,new THREE.CircleGeometry(radius*.78,16),dark,inset.toArray());bore.quaternion.copy(rotation);
}

export function makeTruckAddons({library=null,shadow=true,build={},bodyMounts=null,parts=['wing','lights','pipes']}={}){
  // Root is in FINAL body-local game metres, exactly like the body-kit root.
  // World attaches it at scale 1/modelScale, Y=.187/modelScale under sprung mass.
  const root=new THREE.Group(),wing=new THREE.Group(),lights=new THREE.Group(),pipes=new THREE.Group();
  root.name='Mounted_truck_accessories';wing.name='Mounted_wing';lights.name='Mounted_roof_lights';pipes.name='Mounted_exhaust';
  root.add(wing,lights,pipes);
  const accent=new THREE.MeshPhysicalMaterial({color:'#ff941f',metalness:.20,roughness:.34,clearcoat:.55});
  const dark=new THREE.MeshStandardMaterial({color:'#233039',metalness:.45,roughness:.58});
  const rubber=new THREE.MeshStandardMaterial({color:'#242a2c',roughness:.87});
  const steel=new THREE.MeshStandardMaterial({color:'#a4b6bb',metalness:.78,roughness:.30});
  const lamp=new THREE.MeshStandardMaterial({color:'#fff2ce',emissive:'#ffd89a',emissiveIntensity:.55,roughness:.24});
  const paintMaterials={wing:accent,lights:accent.clone(),pipes:steel.clone()};
  let setup=normalizeBuild(build),focus='truck',mounts=null;
  const geometryKeys=new Map(),enabled=new Set(parts);

  function attachSculpted(part,prefix,kind,span,y,z){
    const source=library?.getObjectByName('DR2_'+prefix+'_'+kind);
    if(!source)throw new Error('Missing workshop asset: '+prefix+' '+kind);
    const model=source.clone(true);
    // Merging owns/disposes its input geometry: never hand it the shared GLB buffers.
    model.traverse(object=>{
      if(!object.isMesh)return;
      object.geometry=object.geometry.clone();
      const tint=material=>material.name.includes('Orange')?paintMaterials[part]:
        material.name.includes('Lamp')?lamp:material.name.includes('Rubber')?rubber:
        material.name.includes('Graphite')?dark:steel;
      object.material=Array.isArray(object.material)?object.material.map(tint):tint(object.material);
    });
    model.scale.x=span/source.userData.reference_span;
    model.position.set(0,y,z);
    ({wing,lights}[part]).add(model);
  }
  function buildWing(){
    const base={pickup:.42,buggy:.40,van:.15,hotrod:.35}[setup.body];
    const height=setup.wing==='lip'?.085:setup.wing==='sport'?Math.max(.16,base*.65):base;
    const half=mounts.width,span=Math.max(1.55,half*2+(setup.wing==='lip'?.20:.50));
    wing.position.set(...mounts.wing);
    for(const x of [-half,half]){
      footPlate(wing,x,0,steel,rubber);
      rod(wing,[x,.039,.055],[x,height-.022,-.060],.032,dark,8);
      rod(wing,[x,.039,-.080],[x,height-.022,-.060],.023,dark,8);
      box(wing,.15,.035,.12,dark,x,height-.02,-.06,.008);
    }
    attachSculpted('wing','Wing',setup.wing,span,height,0);
    wing.userData.footPlates=[-half,half].map(x=>[mounts.wing[0]+x,mounts.wing[1],mounts.wing[2]]);
  }
  function buildLights(){
    const span=LIGHT_BAR_SPANS[setup.body],half=span*.38;
    lights.position.set(...mounts.roof);
    [-half,half].forEach((x,index)=>{
      const contact=(mounts.roofFootHeights?.[index]??mounts.roof[1])-mounts.roof[1];
      footPlate(lights,x,0,steel,rubber,contact);
      rod(lights,[x,contact+.039,0],[x,.139,.023],.027,dark,8);
      if(setup.body==='buggy')for(const dx of [-.056,.056]){
        mesh(lights,curvedPipeGeometry([[x+dx,contact+.039,-.072],[x+dx,contact-.050,-.072],
          [x+dx,contact-.096,0],[x+dx,contact-.050,.072],[x+dx,contact+.039,.072]],.008,.045),steel);
      }
    });
    attachSculpted('lights','Lights',setup.lights,span,.149,.024);
    mesh(lights,curvedPipeGeometry([[0,.147,-.026],[0,.10,-.10],[0,.0,-.10]],.009,.045),rubber);
    lights.userData.footPlates=[-half,half].map((x,index)=>[mounts.roof[0]+x,mounts.roofFootHeights?.[index]??mounts.roof[1],mounts.roof[2]]);
  }
  function buildPipes(){
    const placement=enginePlacement(mounts,'classic'),routes=[],mountPoints=[];
    for(const port of placement.exhaust){
      const side=Math.sign(port.junction[0]),mount=[side*mounts.exhaust[0],mounts.exhaust[1],mounts.exhaust[2]];
      const under=[side*.46,FRAME_RAIL_Y-.04,mount[2]];
      let points;
      if(setup.body==='pickup'){
        // Rise through the bed behind the cab, inboard of the rear tyres. The
        // door-side mounting point is only a low hanger, never a stack in a door.
        points=[port.junction,under,mount,[side*.50,mount[1],-.41],
          [side*.50,-.26,-1.39],[side*.50,.69,-1.39],[side*.55,.77,-1.47]];
        box(pipes,.17,.034,.18,dark,side*.50,.195,-1.39,.011);
        rod(pipes,[side*.50,.28,-1.39],[side*.727,.28,-1.39],.025,dark,8);
      }else if(setup.body==='buggy'){
        // Inboard rear exits keep the pipe clear of the very large rear wheels.
        points=[port.junction,under,mount,[side*.48,-.28,-1.74],
          [side*.48,.08,-1.87],[side*.48,.12,-1.98]];
      }else if(setup.body==='van'){
        points=[port.junction,under,mount,[side*.47,-.43,mount[2]],
          [side*.47,-.43,-1.79],[side*.50,-.38,-2.02]];
        rod(pipes,[side*.47,-.43,-1.45],[side*.40,FRAME_RAIL_Y,-1.45],.024,dark,8);
      }else{
        points=[port.junction,under,mount,[side*.74,-.25,-.28],[side*.90,-.18,-.44]];
        rod(pipes,[side*.73,-.25,-.15],[side*.57,-.25,-.15],.024,dark,8);
      }
      const radius=setup.body==='pickup'?.050:.043;
      mesh(pipes,curvedPipeGeometry(points,radius,.115),paintMaterials.pipes);
      mouth(pipes,points[points.length-1],points[points.length-2],radius,steel,rubber);
      // The hanger is bolted to the same solid frame rail as the motor mounts,
      // with a rubber-isolated clamp at the pipe, not an unattached door ornament.
      const frame=[side*.40,FRAME_RAIL_Y,mount[2]];
      box(pipes,.12,.035,.14,dark,...frame,.010);
      rod(pipes,frame,mount,.025,steel,8);
      rod(pipes,[mount[0],mount[1]-.035,mount[2]],[mount[0],mount[1]+.035,mount[2]],radius*1.10,rubber,12);
      routes.push(points);mountPoints.push(mount);
    }
    pipes.userData={routes,bodyMounts:mountPoints,engineJunctions:placement.exhaust.map(port=>port.junction)};
  }
  function syncVisibility(){
    wing.visible=enabled.has('wing')&&setup.wing!=='none'&&focus!=='engine';
    lights.visible=enabled.has('lights')&&setup.lights!=='none'&&focus!=='engine';
    pipes.visible=enabled.has('pipes')&&setup.pipes&&isPartAvailable('pipes',setup)&&focus!=='engine';
  }
  function setBuild(value,bodyMounts){
    setup=normalizeBuild({...setup,...value});mounts=bodyMounts||getBodyMounts(null,setup.body);
    for(const [name,part,builder] of [['wing',wing,buildWing],['lights',lights,buildLights],['pipes',pipes,buildPipes]]){
      const variant=name==='pipes'?'routed':setup[name],key=JSON.stringify([mounts,variant]);
      if(!enabled.has(name)||geometryKeys.get(name)===key)continue;
      disposeGeometry(part);part.userData={variant};
      if(variant!=='none'&&variant!==false){
        builder();mergeStatic(part);
        part.traverse(object=>{if(object.isMesh){object.castShadow=shadow;object.receiveShadow=true;}});
      }
      geometryKeys.set(name,key);
    }
    syncVisibility();
  }
  setBuild(setup,bodyMounts);
  return {
    root,wing,lights,pipes,accent,paintMaterials,setBuild,
    setFocus(value){focus=value;syncVisibility();},
    getBuild(){return {...setup};},
    focusTarget(part){
      const object={wing,lights,pipes}[part];if(!object||!object.visible)return null;
      object.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    }
  };
}
