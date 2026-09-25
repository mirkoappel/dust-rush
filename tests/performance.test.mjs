import test from 'node:test';
import assert from 'node:assert/strict';
import {createGpuTimer,createPerformanceStats} from '../src/ui/performance.mjs';

function gpuFixture(supported=true){
  let id=0,disjoint=false,available=false,queries=0,reads=0,deleted=0;
  const ext={GPU_DISJOINT_EXT:1,TIME_ELAPSED_EXT:2};
  const gl={
    QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,
    getExtension:()=>supported?ext:null,isContextLost:()=>false,
    getParameter:()=>disjoint,createQuery:()=>{queries++;return ++id;},
    beginQuery(){},endQuery(){},deleteQuery(){deleted++;},
    getQueryParameter(query,type){if(type===3)return available;reads++;return 8500000;}
  };
  return {gl,get queries(){return queries;},get reads(){return reads;},get deleted(){return deleted;},ready(){available=true;},disjoint(){disjoint=true;}};
}

test('GPU-Messung wartet nie synchron und liest nur fertige Resultate',()=>{
  const f=gpuFixture(),timer=createGpuTimer(f.gl);
  timer.begin();timer.end();assert.equal(f.queries,1);assert.equal(timer.value,null);
  timer.begin();timer.end();assert.equal(f.reads,0);
  f.ready();timer.begin();timer.end();
  assert.equal(timer.value,8.5);assert.equal(f.reads,1);assert.equal(f.deleted,1);
  timer.dispose();assert.equal(timer.supported,false);
});
test('Nicht verfügbare oder ungültige GPU-Zeiten werden nicht als Null ausgegeben',()=>{
  const f=gpuFixture(false),timer=createGpuTimer(f.gl);
  timer.begin();timer.end();assert.equal(timer.supported,false);assert.equal(timer.value,null);assert.equal(f.queries,0);
  const active=gpuFixture(),gpu=createGpuTimer(active.gl);
  gpu.begin();gpu.end();active.disjoint();gpu.begin();
  assert.equal(gpu.value,null);assert.equal(active.deleted,1);
});
test('Offene GPU-Abfragen sind begrenzt und werden beim Schließen freigegeben',()=>{
  const f=gpuFixture(),timer=createGpuTimer(f.gl);
  for(let i=0;i<150;i++){timer.begin();timer.end();}
  assert.equal(f.queries,4);assert.equal(f.reads,0);
  timer.dispose();assert.equal(f.deleted,4);
});

function fixture(){
  let clock=0,extensions=0;
  const events={},attributes={};
  const button={addEventListener:(name,fn)=>events[name]=fn,setAttribute:(name,value)=>attributes[name]=value};
  const panel={hidden:true,textContent:''};
  const info={autoReset:true,render:{calls:0,triangles:0},memory:{geometries:45,textures:8},programs:[1,2],reset(){this.render.calls=0;this.render.triangles=0;}};
  const renderer={info,domElement:{width:1200,height:800},getPixelRatio:()=>1.5,getContext:()=>({getExtension(){extensions++;return null;}}),shadowMap:{enabled:true,render(){info.render.calls+=3;info.render.triangles+=200;}}};
  const shadow=renderer.shadowMap.render;
  const world={renderer,workshopActive:true,race:{mode:'menu'},sun:{castShadow:true,shadow:{mapSize:{x:2048,y:2048}}},render(){
    renderer.shadowMap.render();
    if(info.autoReset)info.reset();
    info.render.calls+=5;info.render.triangles+=600;
  }};
  const stats=createPerformanceStats({button,panel,getWorld:()=>world,now:()=>clock});
  return {world,renderer,panel,events,attributes,shadow,stats,advance:ms=>clock+=ms,get extensions(){return extensions;}};
}
test('Geschlossene Statistik misst nicht und installiert keine Render-Hooks',()=>{
  const f=fixture();
  f.stats.beginFrame();f.stats.mark('physics');f.stats.render(f.world);f.stats.endFrame();
  assert.equal(f.renderer.shadowMap.render,f.shadow);assert.equal(f.extensions,0);
  assert.equal(f.renderer.info.render.calls,5);assert.equal(f.panel.hidden,true);
});
test('Offene Statistik trennt CPU-Stufen und zählt Hauptbild plus Schatten korrekt',()=>{
  const f=fixture();f.events.click();
  f.stats.beginFrame();f.advance(2);f.stats.mark('physics');f.advance(3);f.stats.mark('scene');
  f.stats.render(f.world);f.advance(4);f.stats.mark('submit');f.advance(1);f.stats.endFrame();
  f.stats.refresh({frameMs:16.7,peakMs:25});
  assert.match(f.panel.textContent,/CPU gesamt:     10,0 ms/);
  assert.match(f.panel.textContent,/Physik:       2,0 ms/);
  assert.match(f.panel.textContent,/Szene\/Kamera: 3,0 ms/);
  assert.match(f.panel.textContent,/Render-Aufruf:4,0 ms/);
  assert.match(f.panel.textContent,/UI\/Audio:     1,0 ms/);
  assert.match(f.panel.textContent,/GPU Zeichnen:   nicht verfügbar/);
  assert.match(f.panel.textContent,/Zeichenaufrufe: 8\n  davon Schatten: 3/);
  assert.match(f.panel.textContent,/Dreiecke: 800\n  davon Schatten: 200/);
  assert.equal(f.renderer.info.autoReset,true);
  f.events.click();assert.equal(f.panel.hidden,true);assert.equal(f.attributes['aria-expanded'],'false');
  assert.equal(f.renderer.shadowMap.render,f.shadow);
});
test('Auch bei Renderfehlern bleibt der ursprüngliche Reset-Zustand erhalten',()=>{
  const f=fixture();f.stats.setOpen(true);f.stats.beginFrame();f.world.render=()=>{throw Error('render');};
  assert.throws(()=>f.stats.render(f.world),/render/);assert.equal(f.renderer.info.autoReset,true);
  f.stats.setOpen(false);assert.equal(f.renderer.shadowMap.render,f.shadow);
});
test('Leistungsfenster lässt sich am festen Kopf verschieben',()=>{
  const events={},captured=new Set(),handle={listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},setPointerCapture(id){captured.add(id);},releasePointerCapture(id){captured.delete(id);}};
  const output={textContent:''},panel={hidden:true,style:{},ownerDocument:{defaultView:{innerWidth:800,innerHeight:600}},getBoundingClientRect:()=>({left:100,top:80,width:280,height:220}),querySelector:selector=>selector==='[data-performance-output]'?output:handle};
  const button={addEventListener:(type,fn)=>events[type]=fn,setAttribute(){}};
  createPerformanceStats({button,panel,getWorld:()=>null});
  handle.listeners.pointerdown({button:0,pointerId:7,clientX:140,clientY:100});
  handle.listeners.pointermove({pointerId:7,clientX:240,clientY:180});
  assert.equal(panel.style.left,'200px');assert.equal(panel.style.top,'160px');assert.ok(captured.has(7));
  handle.listeners.pointerup({pointerId:7});assert.equal(captured.size,0);
});
