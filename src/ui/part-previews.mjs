import * as THREE from 'three';
// Thumbnail images are rendered from the actual game meshes, not unrelated pictures.
const thumbnails=new Map();
export function renderPartPreviews(library,environment){
  const buttons=[...document.querySelectorAll('[data-preview]')];
  if(!buttons.length)return;
  let renderer;
  const scene=new THREE.Scene();scene.environment=environment;
  scene.add(new THREE.HemisphereLight('#fff6e1','#3c4b50',1.5));
  const key=new THREE.DirectionalLight('#fff3d5',3);key.position.set(3,5,6);scene.add(key);
  const camera=new THREE.PerspectiveCamera(35,1,.02,100);
  for(const button of buttons){
    const name=button.dataset.preview;
    if(!thumbnails.has(name)){
      const template=library.getObjectByName('DR2_'+name);if(!template)continue;
      renderer||=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
      renderer.setSize(160,160);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.setClearColor(0x000000,0);
      const model=template.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);scene.add(model);
      const distance=Math.max(size.x,size.y,size.z)*1.65;
      camera.position.set(distance*.73,distance*.46,distance*.87);camera.lookAt(0,0,0);
      renderer.render(scene,camera);thumbnails.set(name,renderer.domElement.toDataURL('image/png'));scene.remove(model);
    }
    let image=button.querySelector('img');
    if(!image){image=document.createElement('img');image.className='part-preview';image.alt='';button.prepend(image);}
    image.src=thumbnails.get(name);
    if(button.dataset.build==='wheels'&&button.dataset.value==='standard')image.style.transform='scale(.82)';
    button.querySelector('svg')?.setAttribute('hidden','');
  }
  renderer?.dispose();
}
