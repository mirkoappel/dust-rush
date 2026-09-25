// Optional development HUD. Collapsed: no stage timers, GPU queries or render
// hooks. GPU timings are asynchronous and never inferred from renderer CPU time.
export function createGpuTimer(gl){
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let pending=[],active=null,value=null,enabled=!!ext,frame=0;
  const clear=()=>{
    if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);gl.deleteQuery(active);active=null;}
    for(const query of pending)gl.deleteQuery(query);
    pending=[];value=null;
  };
  return {
    get supported(){return enabled;},
    get value(){return value;},
    begin(){
      if(!enabled||gl.isContextLost())return;
      try{
        if(gl.getParameter(ext.GPU_DISJOINT_EXT)){clear();return;}
        while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
          const query=pending.shift();value=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);
        }
        // Sample occasionally; at most four outstanding results, never wait.
        if(frame++%12!==0||pending.length>=4)return;
        active=gl.createQuery();
        if(active)gl.beginQuery(ext.TIME_ELAPSED_EXT,active);
      }catch{enabled=false;clear();}
    },
    end(){
      if(!active)return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(active);active=null;
    },
    dispose(){clear();enabled=false;}
  };
}

export function createPerformanceStats({button,panel,getWorld,now=()=>performance.now()}){
  let open=false,renderer=null,originalShadowRender=null,gpu=null;
  let start=0,markTime=0,samples=0,cpu=0,stages={},shadow={calls:0,triangles:0},renderStats=null;
  const output=panel.querySelector?.('[data-performance-output]')||panel;
  const dragHandle=panel.querySelector?.('[data-performance-drag-handle]');
  const view=panel.ownerDocument?.defaultView;
  if(dragHandle&&view){
    let drag=null;
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const finish=event=>{if(!drag||event.pointerId!==drag.pointerId)return;dragHandle.releasePointerCapture?.(event.pointerId);drag=null;};
    dragHandle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      const rect=panel.getBoundingClientRect();
      panel.style.left=rect.left+'px';panel.style.top=rect.top+'px';panel.style.right='auto';panel.style.bottom='auto';panel.style.transform='none';
      drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};dragHandle.setPointerCapture?.(event.pointerId);
    });
    dragHandle.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      const margin=8,rect=panel.getBoundingClientRect();
      panel.style.left=clamp(drag.left+event.clientX-drag.x,margin,Math.max(margin,view.innerWidth-rect.width-margin))+'px';
      panel.style.top=clamp(drag.top+event.clientY-drag.y,margin,Math.max(margin,view.innerHeight-rect.height-margin))+'px';
    });
    dragHandle.addEventListener('pointerup',finish);dragHandle.addEventListener('pointercancel',finish);
  }
  const reset=()=>{samples=0;cpu=0;stages={};renderStats=null;};
  const detach=()=>{
    if(renderer&&originalShadowRender)renderer.shadowMap.render=originalShadowRender;
    gpu?.dispose();gpu=null;originalShadowRender=null;renderer=null;reset();
  };
  function attach(next){
    if(renderer===next)return;
    detach();renderer=next;
    const map=renderer.shadowMap;
    originalShadowRender=map.render;
    map.render=function(...args){
      const before={...renderer.info.render};
      const result=originalShadowRender.apply(this,args);
      shadow={calls:renderer.info.render.calls-before.calls,triangles:renderer.info.render.triangles-before.triangles};
      return result;
    };
    gpu=createGpuTimer(renderer.getContext());
  }
  function setOpen(value){
    open=value;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));
    if(open){reset();output.textContent='Messung …';}else detach();
  }
  button.addEventListener('click',()=>setOpen(!open));
  // Let this control keep its normal button keyboard behavior without driving.
  button.addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='Enter')event.stopPropagation();});
  const decimal=value=>value.toFixed(1).replace('.',',');
  const number=value=>Math.round(value).toLocaleString('de-DE');
  return {
    get open(){return open;},
    setOpen,
    beginFrame(){if(!open)return;attach(getWorld().renderer);start=markTime=now();},
    mark(name){if(!open)return;const time=now();stages[name]=(stages[name]||0)+time-markTime;markTime=time;},
    render(world){
      if(!open){world.render();return;}
      const info=renderer.info,autoReset=info.autoReset;
      // This Three.js version resets info AFTER shadows. Disable that reset
      // only for the measured frame so the totals include the shadow pass.
      info.autoReset=false;info.reset();shadow={calls:0,triangles:0};
      gpu.begin();
      try{
        world.render();
        renderStats={calls:info.render.calls,triangles:info.render.triangles,shadow:{...shadow}};
      }finally{gpu.end();info.autoReset=autoReset;}
    },
    endFrame(){if(!open)return;cpu+=now()-start;samples++;},
    refresh(frameRate){
      if(!open||!samples||!renderStats)return;
      const world=getWorld(),info=renderer.info,mean=name=>(stages[name]||0)/samples;
      const scene=world.workshopActive?'Werkstatt':world.race.freestyle?'Rambazamba':'Rennen';
      const rest=Math.max(0,cpu/samples-mean('physics')-mean('scene')-mean('submit'));
      const sun=world.sun,gpuText=!gpu.supported?'nicht verfügbar':gpu.value===null?'Messung …':decimal(gpu.value)+' ms';
      const previews=world.partPreviews?.stats;
      output.textContent=[
        scene+' · '+(world.race.mode==='racing'?'Fahrt':world.race.mode==='menu'?'Vorschau':'Pause/Start'),
        'Bild: '+decimal(frameRate.frameMs)+' ms · Spitze '+number(frameRate.peakMs)+' ms',
        'CPU gesamt:     '+decimal(cpu/samples)+' ms',
        '  Physik:       '+decimal(mean('physics'))+' ms',
        '  Szene/Kamera: '+decimal(mean('scene'))+' ms',
        '  Render-Aufruf:'+decimal(mean('submit'))+' ms',
        '  UI/Audio:     '+decimal(rest)+' ms',
        'GPU Zeichnen:   '+gpuText,
        '',
        'Zeichenaufrufe: '+number(renderStats.calls),
        '  davon Schatten: '+number(renderStats.shadow.calls),
        'Dreiecke: '+number(renderStats.triangles),
        '  davon Schatten: '+number(renderStats.shadow.triangles),
        'Schatten: '+(sun.castShadow&&renderer.shadowMap.enabled?sun.shadow.mapSize.x+' × '+sun.shadow.mapSize.y:'aus'),
        'Bildpuffer: '+renderer.domElement.width+' × '+renderer.domElement.height,
        'Pixelfaktor: '+decimal(renderer.getPixelRatio()),
        '',
        'Geladene Ressourcen (alle Szenen):',
        'Geometrien '+info.memory.geometries+' · Texturen '+info.memory.textures,
        'Shader-Programme '+(info.programs?.length||0),
        ...(previews?['','Teilebilder (letzte Änderung):',
          'Rendern/Kopieren: '+decimal(previews.lastWorkMs)+' ms',
          'Bereit nach: '+decimal(previews.lastReadyMs)+' ms'+(previews.pending?' · aktualisiert …':''),
          previews.lastRendered+' neu · '+previews.lastHits+' aus Cache · '+previews.cacheSize+'/64 gespeichert']:[]),
        'CPU/GPU können sich zeitlich überlappen.'
      ].join('\n');
      reset();
    }
  };
}
