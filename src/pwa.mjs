// Resolve before any WebGL resources are built. A late update is staged for the
// next navigation, never applied after the player has watched the loading bar.
export function setupPWA({checkTimeoutMs=1200,activationTimeoutMs=1500}={}){
  const proceed=Promise.resolve(true);
  if(!/^https?:$/.test(location.protocol))return proceed;
  const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='./manifest.webmanifest';document.head.append(manifest);
  const apple=document.createElement('link');apple.rel='apple-touch-icon';apple.href='./assets/apple-touch-icon.png';document.head.append(apple);
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  if(local&&'serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(registrations=>{for(const reg of registrations)if(reg.scope===new URL('./',location.href).href)reg.unregister();}).catch(()=>{});
    return proceed;
  }
  if(!('serviceWorker' in navigator))return proceed;
  const sw=navigator.serviceWorker,scope=new URL('./',location.href).href;
  const register=()=>navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
  sw.ready.then(()=>{document.body.dataset.pwa='offline-ready';}).catch(()=>{});
  // First visits already have an online document: install offline support in the
  // background, without delaying WebGL or reloading on the first clients.claim().
  if(!sw.controller){
    document.body.dataset.pwaStartup='first-load';
    if(navigator.onLine!==false)void Promise.resolve().then(register).catch(()=>{document.body.dataset.pwa='unavailable';});
    return proceed;
  }
  document.body.dataset.pwaStartup='checking';
  return new Promise(resolve=>{
    let open=true,applying=false,timer;
    const cleanups=[],watched=new Set(),initialController=sw.controller;
    const listen=(target,event,fn)=>{
      target.addEventListener(event,fn);
      cleanups.push(()=>target.removeEventListener(event,fn));
    };
    const finish=(start,status)=>{
      if(!open)return;
      open=false;clearTimeout(timer);for(const cleanup of cleanups)cleanup();
      document.body.dataset.pwaStartup=status;resolve(start);
    };
    const reload=()=>{
      if(!open||!sw.controller||sw.controller===initialController)return;
      try{location.reload();finish(false,'reload');}catch{finish(true,'continue');}
    };
    const adopt=worker=>{
      if(!open||applying||!worker)return;
      applying=true;clearTimeout(timer);
      // Even a worker that never activates cannot hold the start screen forever.
      timer=setTimeout(()=>finish(true,'activation-timeout'),activationTimeoutMs);
      try{worker.postMessage({type:'SKIP_WAITING'});}catch{finish(true,'continue');}
    };
    const watch=worker=>{
      if(!worker||watched.has(worker)||!open)return;
      watched.add(worker);
      const state=()=>{
        if(worker.state==='installed')adopt(worker);
        if(worker.state==='redundant')finish(true,'continue');
      };
      listen(worker,'statechange',state);state();
    };
    listen(sw,'controllerchange',reload);
    timer=setTimeout(()=>finish(true,'deferred'),checkTimeoutMs);
    Promise.resolve().then(()=>sw.getRegistration(scope)).then(reg=>reg||register()).then(reg=>{
      if(!open)return;
      const offer=()=>{adopt(reg.waiting);watch(reg.installing);};
      listen(reg,'updatefound',offer);offer();
      if(applying)return;
      // An already downloaded waiting update can be used offline too.
      if(navigator.onLine===false){finish(true,'offline');return;}
      return reg.update().then(()=>{
        if(!open||applying)return;
        offer();
        if(!applying&&!reg.installing)finish(true,'current');
      });
    }).catch(()=>{if(!applying)finish(true,'continue');});
  });
}
