import * as THREE from 'three';
import {prepareBodyDecor,decalMask} from '../models/body-decor.mjs';
import {WHEEL_TYPES,LIFT_HEIGHTS} from '../customization.mjs';
import {VEHICLE_DIMENSIONS as DIM} from '../vehicle-dimensions.mjs';
import {makeRunningGear} from '../models/running-gear.mjs';
import {makeTruckAddons} from '../truck-addons.mjs';
import {getBodyMounts} from '../models/vehicle-mounts.mjs';

export function createPartPreview(template,wheelType=null,{extent=null,direction=null}={}){
  const model=template.clone(true);model.visible=true;
  if(wheelType)model.scale.multiplyScalar(WHEEL_TYPES[wheelType].scale);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  model.position.sub(center);
  let camera;
  if(wheelType||extent){
    // A common world-metre scale keeps tire diameters and shock heights comparable.
    const half=extent||DIM.wheelRadius*Math.max(...Object.values(WHEEL_TYPES).map(type=>type.scale))*1.38;
    camera=new THREE.OrthographicCamera(-half,half,half,-half,.02,30);
    camera.position.set(...(direction||[4,1.3,2.3]));
  }else{
    camera=new THREE.PerspectiveCamera(35,1,.02,100);
    const distance=Math.max(size.x,size.y,size.z)*1.65;
    camera.position.set(distance*.73,distance*.46,distance*.87);
  }
  camera.lookAt(0,0,0);camera.updateMatrixWorld();model.updateMatrixWorld(true);
  return {model,camera};
}

export function createPreviewCatalog(library){
  const entries=new Map(),ownedRoots=[],ownedPaint=new Set(),decorations=[];
  let gear;
  function get(part,value,body='pickup'){
    const addon=['wing','lights','pipes'].includes(part),id=[part,value||'',addon?body:''].join('|');
    if(entries.has(id))return entries.get(id);
    let template,paintSource=null,options={};
    if(part==='lift'){
      if(!gear){gear=makeRunningGear();ownedRoots.push(gear.root);}
      const height=LIFT_HEIGHTS[value];
      gear.sync(new THREE.Matrix4().makeTranslation(0,height/DIM.modelScale,0),[0,0,0,0],height);
      template=gear.snapshotShock();paintSource=template.getObjectByName('Coil_FL').material;
      options={extent:.91,direction:[3,1,6]};
    }else if(addon){
      const kit=makeTruckAddons({shadow:false,build:{body,[part]:value||true},bodyMounts:getBodyMounts(library,body),parts:[part]});
      ownedRoots.push(kit.root);template=kit[part];paintSource=kit.paintMaterials[part];
    }else if(part==='decals'){
      // Exactly the same mask as the truck, shown flat and large without a body silhouette.
      template=new THREE.Group();template.name='Decal_motif_'+value;
      const geometry=new THREE.PlaneGeometry(2,1),mask=decalMask(value);
      const outlineMaterial=new THREE.MeshBasicMaterial({color:'#f8eedb',alphaMap:mask,transparent:true,depthWrite:false,toneMapped:false});
      const outline=new THREE.InstancedMesh(geometry,outlineMaterial,8);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;outline.setMatrixAt(i,new THREE.Matrix4().makeTranslation(Math.cos(a)*.015,Math.sin(a)*.015,-.002));}
      outline.instanceMatrix.needsUpdate=true;outline.renderOrder=0;template.add(outline);
      paintSource=new THREE.MeshBasicMaterial({color:'#ff941f',alphaMap:mask,transparent:true,depthWrite:false,toneMapped:false});
      const motif=new THREE.Mesh(geometry,paintSource);motif.name='Decal_color';motif.renderOrder=1;template.add(motif);
      ownedRoots.push(template);options={extent:1.03,direction:[0,0,3]};
    }else{
      const prefix={body:'Body',wheels:'Wheel',engine:'Engine'}[part];
      template=library.getObjectByName('DR2_'+prefix+'_'+value);
      if(!template)throw new Error('Missing preview model: '+part+' '+value);
    }
    const entry=createPartPreview(template,part==='wheels'?value:null,options),copies=new Map();
    const decor=part==='body'?prepareBodyDecor(entry.model,value):null;
    if(decor)decorations.push(decor);
    entry.model.traverse(object=>{
      if(!object.isMesh)return;
      object.castShadow=false;object.receiveShadow=false;
      const tint=material=>{
        const painted=paintSource?material===paintSource:material.name.includes(decor?'Turquoise':'Orange');
        if(!painted)return material;
        if(!copies.has(material)){const copy=decor?material:material.clone();copies.set(material,copy);if(!decor)ownedPaint.add(copy);}
        return copies.get(material);
      };
      object.material=Array.isArray(object.material)?object.material.map(tint):tint(object.material);
    });
    entry.setPaint=(color,paint,build)=>{
      for(const material of copies.values())material.color.set(color);
      if(decor){decor.setStyle(build?.decals||'stripes');decor.setPaint(paint?.decals||'#ff941f');}
    };
    entries.set(id,entry);return entry;
  }
  function dispose(){
    // Imported GLB geometry/materials and the environment are shared with the game.
    // Only procedural preview models and private tint materials belong to this catalog.
    const geometries=new Set(),materials=new Set(ownedPaint);
    for(const root of ownedRoots)root.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
      for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])materials.add(material);
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    for(const decor of decorations)decor.dispose();decorations.length=0;
    entries.clear();ownedRoots.length=0;ownedPaint.clear();gear=null;
  }
  return {get,dispose,get size(){return entries.size;}};
}
