import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clamp, mod } from './simulation.mjs';
import {stepSuspension,WHEEL_CORNERS} from './suspension.mjs';
import modelData from '../assets/monstertruck.glb';
import {buildGeometry} from './customization.mjs';
import {makeWorkshop} from './workshop.mjs';
import {makeTruckAddons} from './truck-addons.mjs';
import {installBodyKits} from './models/body-kits.mjs';
import libraryData from '../assets/truck-library-v2.glb';
import workshopPartData from '../assets/workshop-parts-v1.glb';
import worldAssetData from '../assets/world-assets-v1.glb';
import trackAssetData from '../assets/track-assets-v1.glb';
import {instanceAsset} from './models/asset-library.mjs';
import {createPartPreviews} from './ui/part-previews.mjs';
import {makePropInstances} from './models/props.mjs';
import {makeEnvironment,groundTexture} from './environment.mjs';
import {arenaSurfacePoint} from './arena.mjs';
import {makeWheelMotion} from './wheel-motion.mjs';
import {extendChassis} from './models/chassis.mjs';
import {makeRunningGear} from './models/running-gear.mjs';
import {VEHICLE_DIMENSIONS as DIM} from './vehicle-dimensions.mjs';
import {horizonCompensation} from './tilt.mjs';
export const TEAM_COLORS=['#14bdd1','#fc593e','#b9ea48','#a98aff','#ffd04c','#ff78b9'];
const V=THREE.Vector3, dummy=new THREE.Object3D();
const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
const dark=mat('#24333a'),steel=mat('#73858a',.45),orange=mat('#ff6b27'),sand=mat('#c99162');
function box(w,h,d,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);return o;}
function label(text,width=1024,height=160,bg='#162b34',fg='#fff0d5',fontSize=85) {
  const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');
  x.fillStyle=bg;x.fillRect(0,0,width,height);x.fillStyle=fg;x.font='900 italic '+fontSize+'px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,width/2,height/2,width-40);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function instanced(scene,geometry,material,transforms) {
  const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);
  transforms.forEach((t,i)=>{dummy.position.set(...t.p);dummy.rotation.set(...(t.r||[0,0,0]));dummy.scale.set(...(t.s||[1,1,1]));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(t.c)mesh.setColorAt(i,new THREE.Color(t.c));});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;scene.add(mesh);return mesh;
}
// Both cached courses live for the page's lifetime. One renderer, environment
// and set of immutable GLB templates serve them; changing course never disposes
// resources that the other course still uses.
export async function createWorldResources(canvas,progress=async()=>{},previewState={}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const environment=makeEnvironment(renderer);
  await progress(12,'Modelle werden vorbereitet.');
  let complete=0;
  const parse=async data=>(await new GLTFLoader().parseAsync(Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer,'')).scene;
  const templates=await Promise.all([modelData,libraryData,worldAssetData,trackAssetData,workshopPartData].map(async data=>{
    const template=await parse(data);await progress(12+(++complete)*8,'Modelle werden vorbereitet.');return template;
  }));
  templates[1].add(templates.pop());
  const partPreviews=createPartPreviews(templates[1],previewState);
  await progress(52,'Truck-Teile sind bereit.');
  return {renderer,environment,templates,partPreviews};
}
export class World {
  constructor(canvas,race,resources) {
    this.race=race;this.track=race.track;this.canvas=canvas;this.clock=0;this.shake=0;this.dustClock=0;this.props=new Map();this.trucks=[];this.sceneryAssets=[];this.smoothedTarget=new V();this.temp=new V();this.horizonRoll=0;this.cameraHorizonRoll=0;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#bdddea');this.scene.fog=new THREE.Fog('#bdddea',145,440);
    this.renderer=resources.renderer;
    this.partPreviews=resources.partPreviews;
    [this.template,this.library,this.propLibrary,this.sceneryLibrary]=resources.templates;
    this.camera=new THREE.PerspectiveCamera(60,1,.15,650);
    this.environment=resources.environment;this.scene.environment=this.environment.reflection;this.scene.background=this.environment.sky;
    this.scene.add(new THREE.HemisphereLight('#eaf7ff','#b58055',.95));
    this.sun=new THREE.DirectionalLight('#fff1d5',3.1);this.sun.position.set(-50,90,35);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=200;
    Object.assign(this.sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.025;
    this.scene.add(this.sun,this.sun.target);
    const ground=mat('#ddc1a0');ground.map=groundTexture();
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),ground);floor.rotation.x=-Math.PI/2;floor.position.y=-.05;floor.receiveShadow=true;this.scene.add(floor);
    if(race.freestyle)this.buildArena();else{this.buildTrack();this.buildScenery();}
    this.buildRamps();this.buildGates();this.buildFinish();this.buildParticles();this.finishGroup.visible=!race.freestyle;
    this.resize();
  }
  resize(){const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  buildArena(){
    const dirtMaterial=mat('#ead5b9',.98);dirtMaterial.map=groundTexture();dirtMaterial.map.repeat.set(9,9);dirtMaterial.bumpMap=dirtMaterial.map;dirtMaterial.bumpScale=.035;
    const dirt=new THREE.Mesh(new THREE.PlaneGeometry(184,184),dirtMaterial);dirt.rotation.x=-Math.PI/2;dirt.position.y=.02;dirt.receiveShadow=true;this.scene.add(dirt);
    const barriers=[],crowd=[];
    for(let side=0;side<4;side++){
      const angle=side*Math.PI/2,g=new THREE.Group();g.rotation.y=angle;
      for(let row=0;row<5;row++){
        const seat=box(172,1.3,3.4,mat(row%2?'#234652':'#f0ad60'));seat.position.set(0,1+row*1.7,98+row*3.2);g.add(seat);
        for(let n=0;n<54;n++){const x=-84+n*3.2,z=98+row*3.2;crowd.push({p:[Math.cos(angle)*x+Math.sin(angle)*z,2.1+row*1.7,-Math.sin(angle)*x+Math.cos(angle)*z],s:[.65,1.1,.65],c:['#ff8851','#40bfc9','#f9d279','#66758e'][(n+row+side)%4]});}
      }
      this.scene.add(g);
      for(let n=-87;n<=87;n+=6){const x=n,z=91;barriers.push({p:[Math.cos(angle)*x+Math.sin(angle)*z,0,-Math.sin(angle)*x+Math.cos(angle)*z],r:[0,angle,0]});}
      const banner=new THREE.Mesh(new THREE.PlaneGeometry(44,5),new THREE.MeshBasicMaterial({map:label('RAMBAZAMBA!',1400,180,'#14343d','#ffca76',128)}));banner.position.set(Math.sin(angle)*111,12,Math.cos(angle)*111);banner.rotation.y=angle+Math.PI;this.scene.add(banner);
    }
    this.sceneryAssets.push(['DRS_Barrier',barriers]);
    instanced(this.scene,new THREE.IcosahedronGeometry(1,0),mat('#ffffff'),crowd);
    for(const x of [-96,96])for(const z of [-96,96]){const pole=box(.55,23,.55,steel);pole.position.set(x,11.5,z);this.scene.add(pole);const lamp=box(6,1.7,1.0,mat('#fff3c7'));lamp.position.set(x,23,z);this.scene.add(lamp);}
  }
  ribbon(inner,outer,y,color) {
    const pts=this.track.points,verts=[],indices=[];
    for(let i=0;i<=pts.length;i++){const p=pts[i%pts.length];for(const w of [inner,outer])verts.push(p.x+p.nx*w,y,p.z+p.nz*w);}
    for(let i=0;i<pts.length;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,mat(color));mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
  }
  buildTrack() {
    this.ribbon(-18,18,.0,'#e1ad79');this.ribbon(-12,12,.035,'#554b46');
    this.ribbon(-12,-11.6,.045,'#f4dfbe');this.ribbon(11.6,12,.045,'#f4dfbe');
    const curbs=[],rails=[],marks=[];
    for(let s=0;s<this.track.length;s+=5) {
      const p=this.track.at(s);
      if(Math.floor(s/5)%2===0)marks.push({p:[p.x,.056,p.z],r:[0,p.heading,0]});
      for(const sign of [-1,1]) {
        const q=this.track.at(s,sign*12.45);curbs.push({p:[q.x,.10,q.z],r:[0,q.heading,0],c:Math.floor(s/5)%2?'#f7e3bf':'#de6239'});
      }
    }
    for(let s=0;s<this.track.length;s+=11)for(const sign of [-1,1]) {
      const p=this.track.at(s,sign*20.1);rails.push({p:[p.x,0,p.z],r:[0,p.heading+Math.PI/2,0],s:[7.2/5.7,1.24/1.7,1.1/1.4]});
    }
    instanced(this.scene,new THREE.BoxGeometry(.85,.15,4.4),mat('#ffffff'),curbs).receiveShadow=true;
    this.sceneryAssets.push(['DRS_Barrier',rails]);
    instanced(this.scene,new THREE.BoxGeometry(.16,.012,2.2),mat('#b8ad9a'),marks);
  }
  buildScenery() {
    let seed=62;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const rocks=[],mesas=[],cacti=[];
    for(let i=0;i<205;i++) {
      const x=(random()-.5)*660,z=(random()-.5)*650,p=this.track.project(x,z);
      if(Math.hypot(x-p.x,z-p.z)<30)continue;
      const size=3+random()*16;
      if(i%3===0)mesas.push({p:[x,size*.6,z],s:[size*1.5,size,size*1.2],r:[0,random()*6,0]});
      else rocks.push({p:[x,size*.3,z],s:[size,size*.72,size*.8],r:[random(),random()*6,random()],c:['#ba7654','#d89564','#e0a677'][i%3]});
    }
    this.sceneryAssets.push(['DRS_Rock',rocks.concat(mesas)]);
    for(let i=0;i<75;i++) {
      const p=this.track.at(random()*this.track.length,(random()>.5?1:-1)*(24+random()*14)),height=2.8+random()*2.8;
      cacti.push({p:[p.x,0,p.z],s:[height/4,height/4,height/4],r:[0,random()*6,0]});
    }
    this.sceneryAssets.push(['DRS_Cactus',cacti]);
    const cloudMat=new THREE.MeshBasicMaterial({color:'#fff6e3',transparent:true,opacity:.76});
    for(let i=0;i<10;i++){
      const o=new THREE.Mesh(new THREE.SphereGeometry(1,12,6),cloudMat);o.scale.set(22+i%3*8,2.5,7);o.position.set(Math.cos(i*2.1)*250,72+i%3*9,Math.sin(i*2.1)*250);this.scene.add(o);
    }
    const signs=[.14,.29,.44,.64,.76,.9];
    signs.forEach((f,i)=>{
      const p=this.track.at(f*this.track.length,i%2?17:-17),g=new THREE.Group();g.position.set(p.x,0,p.z);g.rotation.y=p.heading;
      const pole=box(.20,4.5,.20,steel);pole.position.y=2.25;g.add(pole);
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(6,1.5),new THREE.MeshBasicMaterial({map:label(i%3===0?'AIR TIME':i%3===1?'VOLL DRAUF':'DUST RUSH',1024,180,'#19343a','#ffe4b2',92),side:THREE.DoubleSide}));sign.position.y=4.1;g.add(sign);this.scene.add(g);
    });
  }
  buildRamps() {
    const ramps=[];
    for(const r of this.race.ramps) {
      const p=this.track.at(r.s+r.length/2,r.lane);
      ramps.push({p:[p.x,.05,p.z],r:[0,p.heading,0],s:[r.width/2,r.height,r.length/4]});
    }
    if(ramps.length)this.sceneryAssets.push(['DRS_Ramp',ramps]);
    for(const m of this.race.mounds){
      const vertices=[],indices=[],steps=24;
      for(let i=0;i<=steps;i++)for(const side of [-1,1]){
        const p=this.race.freestyle?arenaSurfacePoint(m,i/steps,side):this.track.at(m.s+m.length*i/steps,m.lane+side*m.width/2);
        vertices.push(p.x,.055+Math.sin(Math.PI*i/steps)**2*m.height,p.z);
      }
      for(let i=0;i<steps;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      const bottomOffset=vertices.length/3;
      for(let i=0;i<bottomOffset;i++)vertices.push(vertices[i*3],.035,vertices[i*3+2]);
      for(let i=0;i<steps;i++){const a=i*2,b=bottomOffset+a;indices.push(a,b,a+2,a+2,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
      const mound=new THREE.Mesh(geo,mat(m.zone==='sky'?'#ba8253':m.zone==='rhythm'?'#c99b66':m.height>.3?'#c59059':'#dc9b50'));mound.receiveShadow=true;this.scene.add(mound);
      if(this.race.freestyle&&m.height>2)for(const phase of [.12,.20,.28,.72,.80,.88]){
        const p=this.race.freestyle?arenaSurfacePoint(m,phase):this.track.at(m.s+m.length*phase,m.lane),stripe=box(m.width*.72,.055,.35,mat('#ffe1a1'));
        stripe.position.set(p.x,.11+Math.sin(Math.PI*phase)**2*m.height,p.z);stripe.rotation.set(-Math.atan(Math.sin(2*Math.PI*phase)*Math.PI*m.height/m.length),p.heading,0);this.scene.add(stripe);
      }
    }
  }
  buildGates(){
    this.gateNodes=[];
    for(const gate of this.race.gates||[]){
      const group=new THREE.Group();group.position.set(gate.x,gate.y,gate.z);group.rotation.y=gate.heading;
      const material=new THREE.MeshStandardMaterial({color:'#ffc552',emissive:'#e98e19',emissiveIntensity:.28,metalness:.5,roughness:.32});
      const hoop=new THREE.Mesh(new THREE.TorusGeometry(gate.radius,.13,8,64),material);group.add(hoop);
      for(let i=0;i<12;i++){const a=i*Math.PI/6,light=new THREE.Mesh(new THREE.SphereGeometry(.20,8,6),new THREE.MeshBasicMaterial({color:'#fff0a5'}));light.position.set(Math.cos(a)*gate.radius,Math.sin(a)*gate.radius,0);group.add(light);}
      this.scene.add(group);this.gateNodes.push({group,hoop,gateId:gate.id});
    }
  }
  buildProps() {
    this.propInstances=makePropInstances(this.propLibrary,this.race.props);
    this.propGroup=this.propInstances.group;this.props=this.propInstances.handles;this.scene.add(this.propGroup);
  }
  buildFinish() {
    const p=this.track.at(0),g=new THREE.Group();g.position.set(p.x,0,p.z);g.rotation.y=p.heading;this.scene.add(g);
    for(const x of [-13.2,13.2]){
      const post=box(.65,7.0,.65,orange);post.position.set(x,3.5,0);g.add(post);
      const foot=box(2.0,.4,2.0,dark);foot.position.set(x,.2,0);g.add(foot);
    }
    const banner=new THREE.Mesh(new THREE.BoxGeometry(27.6,2,.42),new THREE.MeshStandardMaterial({map:label('DUST RUSH',1400,200,'#172e35','#ffecd0',134),roughness:.7}));
    banner.position.y=6.6;g.add(banner);
    for(let i=0;i<24;i++)for(let row=0;row<3;row++){
      const tile=box(1,.02,1,mat((i+row)%2?'#f7e7cd':'#1f302f'));tile.position.set(i-11.5,.064,row-1);g.add(tile);
    }
    const tex=label('Z I E L',1600,120,'#ef6032','#fff2d1',93);
    this.finishRibbon=new THREE.Mesh(new THREE.PlaneGeometry(24,1.1),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
    this.finishRibbon.position.y=2.0;this.finishRibbon.visible=false;g.add(this.finishRibbon);
    this.finishGroup=g;
  }
  buildParticles() {
    this.particleData=Array.from({length:220},()=>({life:0,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:0,color:new THREE.Color()}));
    this.particleMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:'#ffffff'}),this.particleData.length);
    this.particleMesh.frustumCulled=false;this.particleCursor=0;
    for(let i=0;i<this.particleData.length;i++){dummy.scale.setScalar(0);dummy.updateMatrix();this.particleMesh.setMatrixAt(i,dummy.matrix);this.particleMesh.setColorAt(i,new THREE.Color('#cba782'));}
    this.scene.add(this.particleMesh);
  }
  particle(x,y,z,color,size=.35,power=4,life=.8) {
    const p=this.particleData[this.particleCursor++%this.particleData.length];
    Object.assign(p,{x,y,z,vx:(Math.random()-.5)*power,vy:Math.random()*power*.7,vz:(Math.random()-.5)*power,size,life,max:life});p.color.set(color);
  }
  burst(x,y,z,count,colors,power=9) {for(let i=0;i<count;i++)this.particle(x,y,z,colors[i%colors.length],.10+Math.random()*.25,power,.7+Math.random()*1.0);}
  async load() {
    for(const [name,transforms] of this.sceneryAssets)instanceAsset(this.scene,this.sceneryLibrary,name,transforms);
    this.buildProps();
    for(let i=0;i<6;i++) {
      const group=new THREE.Group(),model=this.template.clone(true);extendChassis(model);model.scale.setScalar(DIM.modelScale);group.add(model);this.scene.add(group);
      const paintMaterials=[];
      model.traverse(o=>{
        if(!o.isMesh)return;
        o.castShadow=i===0;o.receiveShadow=true;
        const tint=m=>{
          if(m.name.includes('Turquoise')||m.name.includes('Orange')) {
            const copy=m.clone();copy.color.set(m.name.includes('Turquoise')?TEAM_COLORS[i]:i===0?'#ff6c24':['#fff0cd','#2a4449','#f7d26b','#394956','#423a64'][i-1]);paintMaterials.push(copy);return copy;
          }return m;
        };
        o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);
      });
      const wheels=['FL','FR','RL','RR'].map(c=>model.getObjectByName('Wheel_'+c));
      const wheelMotion=makeWheelMotion();
      const steer=['FL','FR'].map(c=>model.getObjectByName('Steer_'+c));
      const body=model.getObjectByName('Body'),baseBodyY=body.position.y;
      const sprung=new THREE.Group();sprung.name='Sprung_mass';sprung.position.y=baseBodyY;
      model.getObjectByName('Truck').add(sprung);sprung.add(body);body.position.y=0;
      const suspensionNodes=WHEEL_CORNERS.map(c=>model.getObjectByName('Suspension_'+c.code));
      const baseWheelY=suspensionNodes.map(n=>n.position.y);
      // The source mesh combined suspension links with duplicate bumpers.
      // Keep it in the imported asset, but render the articulated assembly.
      model.getObjectByName('Frame_and_bumpers').visible=false;
      for(const c of WHEEL_CORNERS)model.getObjectByName('Spring_and_damper_'+c.code).visible=false;
      const gear=makeRunningGear({shadow:i===0});model.getObjectByName('Truck').add(gear.root);
      const addons=i===0?makeTruckAddons({library:this.library}):null;
      if(addons){addons.root.scale.setScalar(1/DIM.modelScale);addons.root.position.y=.187/DIM.modelScale;sprung.add(addons.root);}
      const kit=installBodyKits(sprung,body,wheels,this.library,{shadow:i===0});
      kit.setPaint({body:TEAM_COLORS[i],wheels:i===0?'#ff6c24':'#ebc184',engine:'#ff6c24'});
      kit.setStyle(['pickup','buggy','van','hotrod','pickup','buggy'][i]);
      this.trucks.push({group,model,wheels,wheelMotion,kit,steer,body,baseBodyY,paintMaterials,sprung,addons,suspensionNodes,baseWheelY,gear,massMatrix:new THREE.Matrix4(),poseKey:null});
    }
    this.reset();this.sync(0);return this;
  }
  setPlayerPaint(paint){
    const t=this.trucks[0];t.kit.setPaint(paint);
    t.gear.setPaint(paint.lift);
    for(const key of ['wing','lights','pipes'])t.addons.paintMaterials[key].color.set(paint[key]);
  }
  setPlayerBuild(config){
    const setup=buildGeometry(config),t=this.trucks[0];
    t.buildConfig=setup;
    Object.assign(this.race.player,{wheelRadius:setup.wheelRadius,groundLift:setup.groundLift,bodyLift:setup.bodyLift,engine:setup.engine});
    for(const wheel of t.wheels)wheel.scale.setScalar(setup.wheelScale);
    t.kit.setStyle(setup.body);t.kit.setEngine(setup.engine);t.kit.setWheels(setup.wheels);t.kit.setDecals(setup.decals);
    t.addons.setBuild(setup,t.kit.getMounts());t.addons.setFocus(this.inspection?.focus||'truck');
    this.workshopGroup?.userData.setWheelScale(setup.wheelScale);
    t.poseKey=null;
  }
  setWorkshop(active){
    if(this.workshopActive===active)return;
    this.workshopActive=active;
    const extent=active?11:42;
    Object.assign(this.sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.normalBias=active?.006:.025;this.sun.shadow.bias=active?-.00006:-.0003;
    this.sun.shadow.intensity=active?.68:1;
    this.scene.environmentIntensity=active?.72:1;
    if(active){
      if(!this.workshopGroup){this.workshopGroup=makeWorkshop(this.propLibrary);this.workshopGroup.visible=false;this.scene.add(this.workshopGroup);}
      this.workshopSceneState=this.scene.children.map(o=>[o,o.visible]);
      this.normalBackground=this.scene.background;
      for(const o of this.scene.children)if(!o.isLight&&o!==this.trucks[0].group)o.visible=false;
      const c=this.race.player;this.workshopGroup.position.set(c.x,0,c.z);this.workshopGroup.rotation.y=c.heading;this.workshopGroup.visible=true;
      this.workshopGroup.userData.setWheelScale(this.trucks[0].buildConfig?.wheelScale||1);
      this.scene.background=new THREE.Color('#819da2');
    }else{
      for(const [o,visible] of this.workshopSceneState||[])o.visible=visible;
      if(this.workshopGroup)this.workshopGroup.visible=false;
      if(this.normalBackground)this.scene.background=this.normalBackground;
    }
    this.cameraInitialized=false;
  }
  pickTruck(x,y){
    const bounds=this.canvas.getBoundingClientRect(),pointer=new THREE.Vector2((x-bounds.left)/bounds.width*2-1,-(y-bounds.top)/bounds.height*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);
    return ray.intersectObject(this.trucks[0].group,true).some(hit=>{for(let o=hit.object;o;o=o.parent)if(!o.visible)return false;return true;});
  }
  testSuspension(){const s=this.race.player.suspension;s.heaveVelocity=-3.5;s.rollVelocity=.38;}
  syncSuspension(t,c) {
    const s=c.suspension,scale=DIM.modelScale,pose=[s.heave,s.pitch,s.roll,c.bodyLift||0,...s.wheels.map(w=>w.offset)];
    if(t.poseKey&&pose.every((v,i)=>Math.abs(v-t.poseKey[i])<1e-7))return;
    t.poseKey=pose;
    t.sprung.position.y=t.baseBodyY+(s.heave+(c.bodyLift||0))/scale;
    t.sprung.rotation.set(s.pitch,0,s.roll,'YXZ');t.sprung.updateMatrix();
    t.massMatrix.copy(t.sprung.matrix).multiply(new THREE.Matrix4().makeTranslation(0,-t.baseBodyY,0));
    const offsets=s.wheels.map(w=>w.offset/scale);
    t.suspensionNodes.forEach((node,i)=>node.position.y=t.baseWheelY[i]+offsets[i]);
    t.gear.sync(t.massMatrix,offsets,c.bodyLift||0);
  }
  reset(){for(const g of this.props.values()){g.visible=true;g.scale.set(1,1,1);}this.finishRibbon.visible=false;this.shake=0;for(const p of this.particleData)p.life=0;}
  event(e) {
    if(e.type==='gate')this.burst(e.x,e.y,e.z,32,['#ffce63','#fff1b8','#8cdbc9'],10);
    if(e.type==='smash'){this.burst(e.x,1,e.z,9,['#eb7c35','#f3c89a','#788785'],5);if(e.player)this.shake=.10;}
    if(e.type==='crush'){this.burst(e.x,1,e.z,18,['#ffc353','#c3d5d5','#788785'],7);if(e.player)this.shake=.19;}
    if(e.type==='crash'){this.shake=.3*e.strength;this.burst(e.x,1,e.z,10,['#ffc353','#ffecba'],7);}
    if(e.type==='land'){this.shake=clamp((e.impact||0)*.012,0,.13);this.burst(e.x,.2,e.z,20,['#d8b68d','#e9c59c'],7);}
    if(e.type==='finish'){
      this.finishRibbon.visible=false;const p=this.race.player;
      this.burst(p.x,3,p.z,105,['#ff6b35','#2eeee0','#fff0be','#a293ff'],18);
    }
  }
  sync(dt,alpha=1) {
    this.clock+=dt;this.shake=Math.max(0,this.shake-dt*.45);
    const active=this.race.mode==='racing',menu=this.race.mode==='menu';
    const smoothPose=c=>{const p=c.previousPose;if(!active||!p)return c;const pose={...c};for(const key of ['x','y','z','heading','pitch','roll','wheelAngle'])pose[key]=THREE.MathUtils.lerp(p[key],c[key],alpha);return pose;};
    const car=smoothPose(this.race.player);
    const inspectionFocus=menu&&this.workshopActive&&this.inspection?.focus||'truck',playerTruck=this.trucks[0];
    if(playerTruck?.kit&&this.appliedInspectionFocus!==inspectionFocus){
      this.appliedInspectionFocus=inspectionFocus;playerTruck.kit.setFocus(inspectionFocus);
      playerTruck.addons.setFocus(inspectionFocus);
    }
    for(const node of this.gateNodes||[]){const gate=this.race.gates.find(g=>g.id===node.gateId);node.group.visible=!!gate&&!gate.collected&&!this.workshopActive;}
    for(const p of this.race.props){const g=this.props.get(p.id);if(!g)continue;
      g.scale.y=p.type==='car'?1-p.crush*.60:1;
      g.position.set(p.x,p.type==='car'?(p.halfHeight+(p.stackHeight||0))*g.scale.y:p.y,p.z);
      g.rotation.set(p.rx,p.heading+p.ry,p.rz,'YXZ');
    }
    this.propInstances?.sync();
    this.race.cars.forEach((c,i)=>{
      const t=this.trucks[i];if(!t)return;
      if(menu)stepSuspension(c.suspension,Math.min(dt,1/60),{});
      const pose=smoothPose(c);
      t.group.position.set(pose.x,pose.y+.02+(c.groundLift||0),pose.z);t.group.rotation.set(pose.pitch,pose.heading,pose.roll,'YXZ');
      const visualWheelAngle=t.wheelMotion.update(pose.wheelAngle,dt,active);
      for(const w of t.wheels)w.rotation.x=visualWheelAngle;
      for(const s of t.steer)s.rotation.y=c.steering;
      this.syncSuspension(t,c);
    });
    this.finishRibbon.visible=car.lap>=this.race.laps-1 && this.race.mode!=='finished';
    const forward=new V(Math.sin(car.heading),0,Math.cos(car.heading)),normal=new V(forward.z,0,-forward.x);
    let desired,target;
    if(menu&&this.workshopActive&&this.inspection){
      const view=this.inspection,angle=car.heading+view.yaw;
      const portrait=this.camera.aspect<.85,distance=view.distance*(portrait?1.65:1);
      target=playerTruck.kit.focusTarget(view.focus)||new V(car.x,1.45+(car.groundLift||0)+(car.bodyLift||0)*.5,car.z);
      if(['wing','lights','pipes'].includes(view.focus)){
        const addon=playerTruck.addons[view.focus];
        if(addon.visible){addon.updateWorldMatrix(true,true);new THREE.Box3().setFromObject(addon).getCenter(target);}
      }
      desired=new V(target.x+Math.sin(angle)*distance*Math.cos(view.pitch),Math.max(.18,target.y+Math.sin(view.pitch)*distance),target.z+Math.cos(angle)*distance*Math.cos(view.pitch));
      if(portrait){
        // Leave the lower third free for the configurator without changing the orbit pivot.
        const screenUp=new V(-Math.sin(angle)*Math.sin(view.pitch),Math.cos(view.pitch),-Math.cos(angle)*Math.sin(view.pitch));
        target.addScaledVector(screenUp,-distance*.14);desired.addScaledVector(screenUp,-distance*.14);
      }else{
        const screenRight=new V(Math.cos(angle),0,-Math.sin(angle)),offset=distance*.11;
        target.addScaledVector(screenRight,-offset);desired.addScaledVector(screenRight,-offset);
        // Lower the framing anchor, not the orbit angle: the truck sits higher
        // in the free image area while retaining its natural viewing angle.
        if(view.focus==='truck'||view.focus==='body'){
          const screenUp=new V(-Math.sin(angle)*Math.sin(view.pitch),Math.cos(view.pitch),-Math.cos(angle)*Math.sin(view.pitch));
          target.addScaledVector(screenUp,-distance*.055);desired.addScaledVector(screenUp,-distance*.055);
        }
      }
      desired.y=Math.max(.18,desired.y);
      this.camera.fov=45;
    }else if(menu) {
      const orbit=Math.sin(this.clock*.23)*1.2;
      desired=new V(car.x,4.3,car.z).addScaledVector(forward,8.5).addScaledVector(normal,7.5+orbit);
      target=new V(car.x,1.2,car.z).addScaledVector(normal,-2.1);
      if(this.camera.aspect<.85){desired=new V(car.x,6.3,car.z).addScaledVector(forward,13).addScaledVector(normal,11);target=new V(car.x,.2,car.z);}
      this.camera.fov=52;
    } else if(this.race.mode==='finished') {
      const a=this.clock*.18;desired=new V(car.x+Math.sin(a)*15,7,car.z+Math.cos(a)*15);target=new V(car.x,1.3,car.z);this.camera.fov=57;
    } else {
      desired=new V(car.x,car.y+3.8+car.speed*.006,car.z).addScaledVector(forward,-8.0-Math.abs(car.speed)*.012);
      target=new V(car.x,car.y+1.2,car.z).addScaledVector(forward,5+car.speed*.055);
      this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,59,1-Math.exp(-2.5*dt));
    }
    if(!this.cameraInitialized){this.camera.position.copy(desired);this.smoothedTarget.copy(target);this.cameraInitialized=true;}
    const smooth=1-Math.exp(-(menu?5:9)*dt);
    this.camera.position.lerp(desired,smooth||1);this.smoothedTarget.lerp(target,1-Math.exp(-(menu?7:9)*dt)||1);
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){this.camera.position.x+=Math.sin(this.clock*91)*this.shake;this.camera.position.y+=Math.sin(this.clock*73)*this.shake*.5;}
    this.camera.lookAt(this.smoothedTarget);
    const targetRoll=menu?0:horizonCompensation(this.horizonRoll);
    this.cameraHorizonRoll+=(targetRoll-this.cameraHorizonRoll)*(1-Math.exp(-12*dt));
    this.camera.rotateZ(this.cameraHorizonRoll);
    this.camera.updateProjectionMatrix();
    this.sun.position.set(car.x-45,80,car.z+30);this.sun.target.position.set(car.x,0,car.z);
    if(active&&car.speed>3&&!car.air) {
      this.dustClock+=dt;
      if(this.dustClock>.045){this.dustClock=0;for(const side of [-1,1])this.particle(car.x-forward.x*1.7+normal.x*side*1.25,.15,car.z-forward.z*1.7+normal.z*side*1.25,'#c8ad8b',.22+car.speed*.004,2,.65);}
    }
    for(let i=0;i<this.particleData.length;i++){
      const p=this.particleData[i];p.life=Math.max(0,p.life-dt);
      if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=6*dt;dummy.position.set(p.x,Math.max(.02,p.y),p.z);dummy.rotation.set(p.life,0,p.life*.6);dummy.scale.setScalar(p.size*p.life/p.max);}
      else dummy.scale.setScalar(0);
      dummy.updateMatrix();this.particleMesh.setMatrixAt(i,dummy.matrix);this.particleMesh.setColorAt(i,p.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate=true;this.particleMesh.instanceColor.needsUpdate=true;
  }
  render(){
    if(this.workshopActive)this.workshopGroup?.userData.updateCameraVisibility(this.camera.position);
    this.renderer.render(this.scene,this.camera);
  }
}
