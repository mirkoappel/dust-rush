import * as THREE from 'three';
import {makeEnvironment} from '../environment.mjs';
import {normalizeBuild,normalizePaint} from '../customization.mjs';
import {createPreviewCatalog} from './preview-models.mjs';
import {createPreviewCache,previewKey} from './preview-cache.mjs';
export {createPartPreview} from './preview-models.mjs';

const SIZE=160,CAPACITY=64;
// One offscreen sprite sheet, not one WebGL context per button or one file per color.
export function createPreviewAtlas({document,size=SIZE,capacity=CAPACITY}){
  const columns=Math.ceil(Math.sqrt(capacity)),canvas=document.createElement('canvas');
  canvas.width=columns*size;canvas.height=Math.ceil(capacity/columns)*size;
  const context=canvas.getContext('2d'),free=Array.from({length:capacity},(_,i)=>capacity-1-i);
  const cache=createPreviewCache(capacity,entry=>free.push(entry.slot));
  const rect=slot=>({x:slot%columns*size,y:Math.floor(slot/columns)*size});
  return {
    get size(){return cache.size;},
    get(key){return cache.get(key);},
    store(key,source){
      let entry=cache.get(key);
      if(!entry){entry={slot:-1};cache.set(key,entry);entry.slot=free.pop();}
      const {x,y}=rect(entry.slot);
      context.clearRect(x,y,size,size);context.drawImage(source,0,0,source.width,source.height,x,y,size,size);
      return entry;
    },
    copy(entry,target){
      const {x,y}=rect(entry.slot),ctx=target.getContext('2d');
      ctx.clearRect(0,0,size,size);ctx.drawImage(canvas,x,y,size,size,0,0,size,size);
    },
    dispose(){cache.clear();canvas.width=canvas.height=1;}
  };
}

// Work happens only after a changed model/color, never in the game's render loop.
export function createPartPreviews(library,initial={},options={}){
  const doc=options.document||document,now=options.now||(()=>performance.now());
  const schedule=options.schedule||requestAnimationFrame,cancel=options.cancel||cancelAnimationFrame;
  const buttons=[...doc.querySelectorAll('[data-build]')].filter(button=>button.dataset.value!=='none');
  const catalog=createPreviewCatalog(library),atlas=createPreviewAtlas({document:doc});
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setSize(SIZE,SIZE,false);renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000,0);
  // Render-target textures cannot be shared between WebGL contexts.
  const environment=makeEnvironment(renderer);
  const scene=new THREE.Scene();scene.environment=environment.reflection;
  scene.add(new THREE.HemisphereLight('#fff6e1','#3c4b50',1.5));
  const key=new THREE.DirectionalLight('#fff3d5',3);key.position.set(3,5,6);scene.add(key);
  const outputs=new Map(),shown=new Map();
  let frame=null,pending=null,lastSignature='',disposed=false;
  let stats={rendered:0,hits:0,lastRendered:0,lastHits:0,lastWorkMs:0,lastReadyMs:0,batches:0};
  function output(button){
    if(!outputs.has(button)){
      const canvas=doc.createElement('canvas');canvas.width=canvas.height=SIZE;
      canvas.className='part-preview';canvas.setAttribute('aria-hidden','true');
      button.prepend(canvas);button.querySelector('svg')?.setAttribute('hidden','');
      outputs.set(button,canvas);
    }
    return outputs.get(button);
  }
  function draw(button,job){
    const part=button.dataset.build,value=button.dataset.value;
    const id=previewKey(part,value,job.build,job.paint);
    if(shown.get(button)===id)return;
    let picture=atlas.get(id);
    if(picture){job.hits++;stats.hits++;}
    else{
      const entry=catalog.get(part,value,job.build.body);entry.setPaint(job.paint[part],job.paint,job.build);
      scene.add(entry.model);
      try{
        renderer.render(scene,entry.camera);
        // Copy immediately while the drawing buffer is valid; no PNG encoding/readback.
        picture=atlas.store(id,renderer.domElement);
      }finally{scene.remove(entry.model);}
      job.rendered++;stats.rendered++;
    }
    atlas.copy(picture,output(button));shown.set(button,id);
  }
  function flush(all=false){
    frame=null;if(disposed||!pending)return;
    const job=pending,start=now();
    do{draw(job.buttons[job.index++],job);}
    while(job.index<job.buttons.length&&(all||now()-start<5));
    job.work+=now()-start;
    if(job.index===job.buttons.length){
      stats={...stats,lastRendered:job.rendered,lastHits:job.hits,lastWorkMs:job.work,lastReadyMs:now()-job.requested,batches:stats.batches+1};
      pending=null;
    }else frame=schedule(()=>flush());
  }
  function update(state={},immediate=false){
    if(disposed)return;
    const build=normalizeBuild(state.build),paint=normalizePaint(state.paint);
    const signature=JSON.stringify([build.body,build.decals,paint]);if(signature===lastSignature)return;
    lastSignature=signature;
    // Visible choices first. Changes queued in the same frame collapse to the newest color.
    const ordered=[...buttons].sort((a,b)=>Number(!!a.closest('[data-workshop-panel]')?.hidden)-Number(!!b.closest('[data-workshop-panel]')?.hidden));
    pending={build,paint,buttons:ordered,index:0,requested:now(),work:0,rendered:0,hits:0};
    if(frame!==null){cancel(frame);frame=null;}
    if(immediate)flush(true);else frame=schedule(()=>flush());
  }
  function dispose(){
    disposed=true;if(frame!==null)cancel(frame);frame=null;pending=null;
    atlas.dispose();catalog.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();
    for(const canvas of outputs.values())canvas.remove();
    for(const button of buttons)button.querySelector('svg')?.removeAttribute('hidden');
    outputs.clear();shown.clear();
  }
  update(initial,true);
  return {update,dispose,get stats(){return {...stats,cacheSize:atlas.size,models:catalog.size,pending:!!pending};}};
}
