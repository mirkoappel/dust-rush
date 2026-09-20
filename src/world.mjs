import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clamp, mod } from './simulation.mjs';
import {stepSuspension,WHEEL_CORNERS} from './suspension.mjs';
import modelData from '../assets/monstertruck.glb';
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
export class World {
  constructor(canvas,race) {
    this.race=race;this.track=race.track;this.canvas=canvas;this.clock=0;this.shake=0;this.dustClock=0;this.props=new Map();this.trucks=[];this.smoothedTarget=new V();this.temp=new V();
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#bdddea');this.scene.fog=new THREE.Fog('#bdddea',145,440);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.camera=new THREE.PerspectiveCamera(60,1,.15,650);
    this.scene.add(new THREE.HemisphereLight('#eaf7ff','#b58055',2.2));
    this.sun=new THREE.DirectionalLight('#fff1d5',3.1);this.sun.position.set(-50,90,35);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=200;
    Object.assign(this.sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.07;
    this.scene.add(this.sun,this.sun.target);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),mat('#cc9a70'));floor.rotation.x=-Math.PI/2;floor.position.y=-.05;floor.receiveShadow=true;this.scene.add(floor);
    if(race.freestyle)this.buildArena();else{this.buildTrack();this.buildScenery();}
    this.buildRamps();this.buildProps();this.buildFinish();this.buildParticles();this.finishGroup.visible=!race.freestyle;
    this.handleResize=()=>this.resize();this.resize();window.addEventListener('resize',this.handleResize);
  }
  resize(){const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  dispose(){window.removeEventListener('resize',this.handleResize);this.scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}});this.renderer.dispose();}
  buildArena(){
    this.boostPads=[];
    const dirt=new THREE.Mesh(new THREE.PlaneGeometry(184,184),mat('#c79660'));dirt.rotation.x=-Math.PI/2;dirt.position.y=.02;dirt.receiveShadow=true;this.scene.add(dirt);
    const barriers=[],crowd=[];
    for(let side=0;side<4;side++){
      const angle=side*Math.PI/2,g=new THREE.Group();g.rotation.y=angle;
      for(let row=0;row<5;row++){
        const seat=box(172,1.3,3.4,mat(row%2?'#234652':'#f0ad60'));seat.position.set(0,1+row*1.7,98+row*3.2);g.add(seat);
        for(let n=0;n<54;n++){const x=-84+n*3.2,z=98+row*3.2;crowd.push({p:[Math.cos(angle)*x+Math.sin(angle)*z,2.1+row*1.7,-Math.sin(angle)*x+Math.cos(angle)*z],s:[.65,1.1,.65],c:['#ff8851','#40bfc9','#f9d279','#66758e'][(n+row+side)%4]});}
      }
      this.scene.add(g);
      for(let n=-87;n<=87;n+=6){const x=n,z=91;barriers.push({p:[Math.cos(angle)*x+Math.sin(angle)*z,.85,-Math.sin(angle)*x+Math.cos(angle)*z],r:[0,angle,0],c:(n+87)%12?'#ff8145':'#f4e1b9'});}
      const banner=new THREE.Mesh(new THREE.PlaneGeometry(44,5),new THREE.MeshBasicMaterial({map:label('RAMBAZAMBA!',1400,180,'#14343d','#ffca76',128)}));banner.position.set(Math.sin(angle)*111,12,Math.cos(angle)*111);banner.rotation.y=angle+Math.PI;this.scene.add(banner);
    }
    instanced(this.scene,new THREE.BoxGeometry(5.7,1.7,1.4),mat('#ffffff'),barriers);
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
      const p=this.track.at(s,sign*20.1);rails.push({p:[p.x,.62,p.z],r:[0,p.heading,0],c:Math.floor(s/11)%3?'#d0c5ae':'#df713a'});
    }
    instanced(this.scene,new THREE.BoxGeometry(.85,.15,4.4),mat('#ffffff'),curbs).receiveShadow=true;
    instanced(this.scene,new THREE.BoxGeometry(1.1,1.24,7.2),mat('#ffffff'),rails);
    instanced(this.scene,new THREE.BoxGeometry(.16,.012,2.2),mat('#b8ad9a'),marks);
    this.boostPads=[];
    for(const pad of this.race.pads) {
      const p=this.track.at(pad.s,pad.lane),g=new THREE.Group();g.position.set(p.x,.07,p.z);g.rotation.y=p.heading;
      const base=box(6,.07,6,mat('#097b85'));g.add(base);
      const glow=new THREE.MeshBasicMaterial({color:'#56fff0'});
      for(let row=0;row<3;row++)for(const side of [-1,1]) {
        const arrow=box(1.65,.025,.30,glow);arrow.position.set(side*.65,.065,-1.7+row*1.6);arrow.rotation.y=side*.55;g.add(arrow);
      }
      this.scene.add(g);this.boostPads.push(g);
    }
  }
  buildScenery() {
    let seed=62;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const rocks=[],mesas=[],cacti=[],arms=[];
    for(let i=0;i<205;i++) {
      const x=(random()-.5)*660,z=(random()-.5)*650,p=this.track.project(x,z);
      if(Math.hypot(x-p.x,z-p.z)<30)continue;
      const size=3+random()*16;
      if(i%3===0)mesas.push({p:[x,size*.9,z],s:[size*1.8,size*1.8,size*1.4],r:[0,random()*6,0],c:['#c77951','#b96849','#d78c60'][i%3]});
      else rocks.push({p:[x,size*.3,z],s:[size,size*.72,size*.8],r:[random(),random()*6,random()],c:['#ba7654','#d89564','#e0a677'][i%3]});
    }
    instanced(this.scene,new THREE.IcosahedronGeometry(1,0),mat('#ffffff'),rocks);
    instanced(this.scene,new THREE.CylinderGeometry(.68,1,1,7,1),mat('#ffffff'),mesas);
    for(let i=0;i<75;i++) {
      const p=this.track.at(random()*this.track.length,(random()>.5?1:-1)*(24+random()*14)),height=2.8+random()*2.8;
      cacti.push({p:[p.x,height/2,p.z],s:[.48,height,.48],r:[0,random()*6,0]});
      for(const side of [-1,1]) {
        arms.push({p:[p.x+side*.60,height*.50,p.z],s:[1.2,.36,.36]});
        arms.push({p:[p.x+side*1.0,height*.63,p.z],s:[.36,height*.32,.36]});
      }
    }
    instanced(this.scene,new THREE.CylinderGeometry(.8,1,1,7),mat('#447366'),cacti);
    instanced(this.scene,new THREE.BoxGeometry(1,1,1),mat('#447366'),arms);
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
    const rampMat=mat('#ed7136');
    for(const r of this.race.ramps) {
      const p=this.track.at(r.s+r.length/2,r.lane),g=new THREE.Group();g.position.set(p.x,.05,p.z);g.rotation.y=p.heading;
      const w=r.width/2,L=r.length/2,h=r.height;
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute([-w,0,-L,w,0,-L,-w,h,L,w,h,L,-w,0,L,w,0,L],3));
      geo.setIndex([0,2,1,1,2,3,0,4,2,1,3,5,2,4,3,3,4,5]);geo.computeVertexNormals();
      const ramp=new THREE.Mesh(geo,rampMat);ramp.receiveShadow=true;g.add(ramp);
      const stripes=mat('#fff0c3'),angle=-Math.atan2(h,r.length);
      for(let i=1;i<6;i++){const z=-L+i*r.length/6,o=box(r.width*.82,.04,.2,stripes);o.position.set(0,i*h/6+.045,z);o.rotation.x=angle;g.add(o);}
      for(const x of [-w,w]){const o=box(.2,Math.hypot(r.length,h),.2,dark);o.position.set(x,h/2,0);o.rotation.x=Math.atan2(r.length,h);g.add(o);}
      this.scene.add(g);
    }
    for(const m of this.race.mounds){
      const vertices=[],indices=[],steps=24;
      for(let i=0;i<=steps;i++)for(const side of [-1,1]){
        const p=this.track.at(m.s+m.length*i/steps,m.lane+side*m.width/2);
        vertices.push(p.x,.055+Math.sin(Math.PI*i/steps)**2*m.height,p.z);
      }
      for(let i=0;i<steps;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      const bottomOffset=vertices.length/3;
      for(let i=0;i<bottomOffset;i++)vertices.push(vertices[i*3],.035,vertices[i*3+2]);
      for(let i=0;i<steps;i++){const a=i*2,b=bottomOffset+a;indices.push(a,b,a+2,a+2,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
      const mound=new THREE.Mesh(geo,mat(m.height>.3?'#c59059':'#dc9b50'));mound.receiveShadow=true;this.scene.add(mound);
      if(this.race.freestyle&&m.height>2)for(const phase of [.12,.20,.28,.72,.80,.88]){
        const p=this.track.at(m.s+m.length*phase,m.lane),stripe=box(m.width*.72,.055,.35,mat('#ffe1a1'));
        stripe.position.set(p.x,.11+Math.sin(Math.PI*phase)**2*m.height,p.z);stripe.rotation.set(-Math.atan(Math.sin(2*Math.PI*phase)*Math.PI*m.height/m.length),p.heading,0);this.scene.add(stripe);
      }
    }
  }
  buildProps() {
    this.propGroup=new THREE.Group();this.scene.add(this.propGroup);
    for(const prop of this.race.props) {
      const group=new THREE.Group();group.position.set(prop.x,0,prop.z);group.rotation.y=prop.heading;
      if(prop.type==='crate') {
        const c=box(1.65,1.65,1.65,mat('#d98a45'));c.position.y=.825;group.add(c);
        for(const x of [-.51,.51]){const strap=box(.12,1.73,1.73,mat('#5d513d'));strap.position.set(x,.83,0);group.add(strap);}
      } else if(prop.type==='barrel') {
        const b=new THREE.Mesh(new THREE.CylinderGeometry(.73,.73,1.8,12),mat('#e65b32'));b.position.y=.9;group.add(b);
        for(const y of [.45,1.35]){const o=new THREE.Mesh(new THREE.CylinderGeometry(.76,.76,.16,12),mat('#f6d9ac'));o.position.y=y;group.add(o);}
      } else if(prop.type==='cone') {
        const base=box(1.05,.12,1.05,dark);base.position.y=.06;group.add(base);
        const cone=new THREE.Mesh(new THREE.ConeGeometry(.45,1.2,12),orange);cone.position.y=.7;group.add(cone);
        const stripe=new THREE.Mesh(new THREE.CylinderGeometry(.13,.23,.27,12),mat('#fff3da'));stripe.position.y=.8;group.add(stripe);
      } else if(prop.type==='tyre') {
        const tyre=new THREE.Mesh(new THREE.TorusGeometry(.53,.27,8,16),dark);tyre.position.y=.8;group.add(tyre);
        for(let i=0;i<12;i++){const a=i*Math.PI/6,tread=box(.26,.17,.58,dark);tread.position.set(Math.sin(a)*.74,.8+Math.cos(a)*.74,0);tread.rotation.z=-a;group.add(tread);}
      } else {
        const b=box(2.15,.65,4.0,mat('#7eaaaf'));b.position.y=.8;group.add(b);
        const cab=box(1.85,.6,1.8,dark);cab.position.set(0,1.4,-.25);group.add(cab);
        for(const x of [-1.0,1.0])for(const z of [-1.15,1.15]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.35,10),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.5,z);group.add(wheel);}
      }
      for(const child of group.children){child.position.y-=prop.halfHeight;child.castShadow=false;child.receiveShadow=true;}
      group.position.y=prop.y;
      this.propGroup.add(group);this.props.set(prop.id,group);
    }
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
    const bytes=Uint8Array.from(atob(modelData),c=>c.charCodeAt(0));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
    this.template=gltf.scene;
    for(let i=0;i<6;i++) {
      const group=new THREE.Group(),model=this.template.clone(true);model.scale.setScalar(.62);group.add(model);this.scene.add(group);
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
      const steer=['FL','FR'].map(c=>model.getObjectByName('Steer_'+c));
      const body=model.getObjectByName('Body'),baseBodyY=body.position.y;
      const sprung=new THREE.Group();sprung.name='Sprung_mass';sprung.position.y=baseBodyY;
      model.getObjectByName('Truck').add(sprung);sprung.add(body);body.position.y=0;
      const suspensionNodes=WHEEL_CORNERS.map(c=>model.getObjectByName('Suspension_'+c.code));
      const baseWheelY=suspensionNodes.map(n=>n.position.y);
      const springs=WHEEL_CORNERS.map(c=>{
        const node=model.getObjectByName('Spring_and_damper_'+c.code);
        const bottom=new V(c.side*1.32,1.23,c.front*1.68),top=new V(c.side*1.04,2.52,c.front*1.68);
        const direction=top.clone().sub(bottom),length=direction.length();
        const rotation=new THREE.Quaternion().setFromUnitVectors(new V(0,1,0),direction.normalize());
        const restToOrigin=new THREE.Matrix4().makeRotationFromQuaternion(rotation).invert().multiply(new THREE.Matrix4().makeTranslation(-bottom.x,-bottom.y,-bottom.z));
        node.matrixAutoUpdate=false;
        return {node,bottom,top,length,restToOrigin};
      });
      const frameParts=[];
      model.getObjectByName('Frame_and_bumpers').traverse(o=>{
        if(!o.isMesh)return;o.geometry=o.geometry.clone();
        frameParts.push({node:o,rest:new Float32Array(o.geometry.attributes.position.array),normals:new Float32Array(o.geometry.attributes.normal.array)});
      });
      const sprite=null;
      if(sprite){sprite.position.y=3.5;sprite.scale.set(3.7,.82,1);group.add(sprite);}
      this.trucks.push({group,model,wheels,steer,body,baseBodyY,paintMaterials,sprite,sprung,suspensionNodes,baseWheelY,springs,frameParts,massMatrix:new THREE.Matrix4(),poseKey:null});
    }
    this.reset();this.sync(0);return this;
  }
  setPlayerColor(hex){for(const m of this.trucks[0].paintMaterials)if(m.name.includes('Turquoise'))m.color.set(hex);}
  testSuspension(){const s=this.race.player.suspension;s.heaveVelocity=-3.5;s.rollVelocity=.38;}
  syncSuspension(t,c) {
    const s=c.suspension,scale=.62,pose=[s.heave,s.pitch,s.roll,c.air?0:c.pitch,...s.wheels.map(w=>w.offset)];
    if(t.poseKey&&pose.every((v,i)=>Math.abs(v-t.poseKey[i])<1e-7))return;
    t.poseKey=pose;
    t.sprung.position.y=t.baseBodyY+s.heave/scale;
    t.sprung.rotation.set(s.pitch+(c.air?0:c.pitch),0,s.roll,'YXZ');t.sprung.updateMatrix();
    t.massMatrix.copy(t.sprung.matrix).multiply(new THREE.Matrix4().makeTranslation(0,-t.baseBodyY,0));
    const offsets=s.wheels.map(w=>w.offset/scale),m=t.massMatrix.elements;
    t.suspensionNodes.forEach((node,i)=>node.position.y=t.baseWheelY[i]+offsets[i]);
    t.springs.forEach((spring,i)=>{
      const bottom=spring.bottom.clone();bottom.y+=offsets[i];
      const top=spring.top.clone().applyMatrix4(t.massMatrix),direction=top.sub(bottom),length=direction.length();
      const rotation=new THREE.Quaternion().setFromUnitVectors(new V(0,1,0),direction.normalize());
      spring.node.matrix.compose(bottom,rotation,new V(1,length/spring.length,1)).multiply(spring.restToOrigin);
      spring.node.matrixWorldNeedsUpdate=true;
    });
    // Lower axle vertices follow the wheels; upper frame and bumpers follow the body.
    for(const part of t.frameParts) {
      const p=part.node.geometry.attributes.position,n=part.node.geometry.attributes.normal,r=part.rest,rn=part.normals;
      for(let k=0;k<r.length;k+=3){
        const x=r[k],y=r[k+1],z=r[k+2],weight=clamp((y-1.25)/.53,0,1),left=clamp(x/3.56+.5,0,1),front=clamp(z/3.36+.5,0,1);
        const rearY=offsets[3]+(offsets[2]-offsets[3])*left,frontY=offsets[1]+(offsets[0]-offsets[1])*left,wheelY=rearY+(frontY-rearY)*front;
        p.array[k]=x+(m[0]*x+m[4]*y+m[8]*z+m[12]-x)*weight;
        p.array[k+1]=y+wheelY+(m[1]*x+m[5]*y+m[9]*z+m[13]-y-wheelY)*weight;
        p.array[k+2]=z+(m[2]*x+m[6]*y+m[10]*z+m[14]-z)*weight;
        const nx=rn[k],ny=rn[k+1],nz=rn[k+2];
        n.array[k]=nx+(m[0]*nx+m[4]*ny+m[8]*nz-nx)*weight;
        n.array[k+1]=ny+(m[1]*nx+m[5]*ny+m[9]*nz-ny)*weight;
        n.array[k+2]=nz+(m[2]*nx+m[6]*ny+m[10]*nz-nz)*weight;
      }
      p.needsUpdate=true;n.needsUpdate=true;
    }
  }
  reset(){for(const g of this.props.values()){g.visible=true;g.scale.set(1,1,1);}this.finishRibbon.visible=false;this.shake=0;for(const p of this.particleData)p.life=0;}
  event(e) {
    if(e.type==='smash'){this.burst(e.x,1,e.z,9,['#eb7c35','#f3c89a','#788785'],5);if(e.player)this.shake=.10;}
    if(e.type==='crush'){this.burst(e.x,1,e.z,18,['#ffc353','#c3d5d5','#788785'],7);if(e.player)this.shake=.19;}
    if(e.type==='crash'){this.shake=.3*e.strength;this.burst(e.x,1,e.z,10,['#ffc353','#ffecba'],7);}
    if(e.type==='land'){this.shake=.11;this.burst(e.x,.2,e.z,20,['#d8b68d','#e9c59c'],7);}
    if(e.type==='pad'){this.burst(e.x,.2,e.z,15,['#39f3e5','#a8fff7'],5);}
    if(e.type==='finish'){
      this.finishRibbon.visible=false;const p=this.race.player;
      this.burst(p.x,3,p.z,105,['#ff6b35','#2eeee0','#fff0be','#a293ff'],18);
    }
  }
  sync(dt) {
    this.clock+=dt;this.shake=Math.max(0,this.shake-dt*.45);
    const car=this.race.player,active=this.race.mode==='racing',menu=this.race.mode==='menu';
    for(const p of this.race.props){const g=this.props.get(p.id);if(!g)continue;
      g.scale.y=p.type==='car'?1-p.crush*.60:1;
      g.position.set(p.x,p.type==='car'?p.halfHeight*g.scale.y:p.y,p.z);
      g.rotation.set(p.rx,p.heading+p.ry,p.rz,'YXZ');
    }
    this.race.cars.forEach((c,i)=>{
      const t=this.trucks[i];if(!t)return;
      if(menu)stepSuspension(c.suspension,Math.min(dt,1/60),{});
      t.group.position.set(c.x,c.y+.02,c.z);t.group.rotation.set(c.air?c.pitch:0,c.heading,0,'YXZ');
      for(const w of t.wheels)w.rotation.x=c.wheelAngle;
      for(const s of t.steer)s.rotation.y=c.steering;
      this.syncSuspension(t,c);
      if(t.sprite)t.sprite.visible=!menu&&Math.hypot(c.x-car.x,c.z-car.z)<90;
    });
    this.finishRibbon.visible=car.lap>=this.race.laps-1 && this.race.mode!=='finished';
    const forward=new V(Math.sin(car.heading),0,Math.cos(car.heading)),normal=new V(forward.z,0,-forward.x);
    let desired,target;
    if(menu) {
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
      this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,59+clamp(car.speed/38,0,1)*4+(car.boosting?1:0),1-Math.exp(-2.5*dt));
    }
    if(!this.cameraInitialized){this.camera.position.copy(desired);this.smoothedTarget.copy(target);this.cameraInitialized=true;}
    const smooth=1-Math.exp(-(menu?5:20)*dt);
    this.camera.position.lerp(desired,smooth||1);this.smoothedTarget.lerp(target,1-Math.exp(-(menu?7:14)*dt)||1);
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){this.camera.position.x+=Math.sin(this.clock*91)*this.shake;this.camera.position.y+=Math.sin(this.clock*73)*this.shake*.5;}
    this.camera.lookAt(this.smoothedTarget);this.camera.updateProjectionMatrix();
    this.sun.position.set(car.x-45,80,car.z+30);this.sun.target.position.set(car.x,0,car.z);
    if(active&&car.speed>12&&!car.air) {
      this.dustClock+=dt;
      if(this.dustClock>.045){this.dustClock=0;for(const side of [-1,1])this.particle(car.x-forward.x*1.7+normal.x*side*1.25,.15,car.z-forward.z*1.7+normal.z*side*1.25,car.boosting?'#e9d1af':'#c8ad8b',.22+car.speed*.004,2,.65);}
    }
    for(let i=0;i<this.particleData.length;i++){
      const p=this.particleData[i];p.life=Math.max(0,p.life-dt);
      if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=6*dt;dummy.position.set(p.x,Math.max(.02,p.y),p.z);dummy.rotation.set(p.life,0,p.life*.6);dummy.scale.setScalar(p.size*p.life/p.max);}
      else dummy.scale.setScalar(0);
      dummy.updateMatrix();this.particleMesh.setMatrixAt(i,dummy.matrix);this.particleMesh.setColorAt(i,p.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate=true;this.particleMesh.instanceColor.needsUpdate=true;
    this.boostPads.forEach((p,i)=>p.children.forEach((o,j)=>{if(j)o.material.color.setHSL(.48,.85,.65+Math.sin(this.clock*5+i)*.15);}));
  }
  render(){this.renderer.render(this.scene,this.camera);}
}
