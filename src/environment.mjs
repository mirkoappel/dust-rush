import * as THREE from 'three';
export function makeEnvironment(renderer){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#78aac5');gradient.addColorStop(.46,'#e2eef0');gradient.addColorStop(.55,'#e7d8b6');gradient.addColorStop(1,'#7c6552');
  c.fillStyle=gradient;c.fillRect(0,0,512,256);
  const glow=c.createRadialGradient(350,70,3,350,70,90);glow.addColorStop(0,'#fff7ddee');glow.addColorStop(1,'#fff7dd00');c.fillStyle=glow;c.fillRect(0,0,512,256);
  const sky=new THREE.CanvasTexture(canvas);sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;
  // Broad softbox reflections supply readable paint/chrome highlights without a
  // post-processing pipeline or remote HDR texture.
  const room=new THREE.Scene();room.background=new THREE.Color(.065,.085,.10);
  const panelMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(5,4.6,3.9)});
  for(const [x,y,z,w,h] of [[-8,7,5,7,10],[7,9,-4,5,10],[0,12,1,8,5]]){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),panelMaterial);panel.position.set(x,y,z);panel.lookAt(0,0,0);room.add(panel);
  }
  const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromScene(room,.08,.1,50);
  room.traverse(o=>o.geometry?.dispose());panelMaterial.dispose();pmrem.dispose();
  return {sky,reflection:target.texture,dispose:()=>{sky.dispose();target.dispose();}};
}
export function groundTexture(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');
  c.fillStyle='#ba9269';c.fillRect(0,0,512,512);let seed=17;
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<11000;i++){const v=115+Math.floor(rnd()*95);c.fillStyle='rgba('+v+','+(v*.84|0)+','+(v*.63|0)+',.22)';c.fillRect(rnd()*512,rnd()*512,1+rnd()*3,1+rnd()*3);}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(45,45);t.anisotropy=4;return t;
}
