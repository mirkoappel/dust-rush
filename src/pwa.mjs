export function setupPWA({isSafe}){
  const noop=()=>{};
  if(!/^https?:$/.test(location.protocol))return noop;
  const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='./manifest.webmanifest';document.head.append(manifest);
  const apple=document.createElement('link');apple.rel='apple-touch-icon';apple.href='./assets/apple-touch-icon.png';document.head.append(apple);
  // Installation stays in the browser's native menu. No extra in-game prompts.
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  if(local&&'serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(registrations=>{for(const reg of registrations)if(reg.scope===new URL('./',location.href).href)reg.unregister();}).catch(()=>{});
    return noop;
  }
  let waiting=null,applying=false;
  const applyWhenSafe=()=>{
    // Never interrupt a race, paused run, or an active workshop session.
    if(!waiting||applying||!isSafe())return;
    applying=true;waiting.postMessage({type:'SKIP_WAITING'});
  };
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying)location.reload();});
    navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
      navigator.serviceWorker.ready.then(()=>{document.body.dataset.pwa='offline-ready';});
      const offer=()=>{waiting=reg.waiting;applyWhenSafe();};
      offer();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});
    }).catch(()=>{document.body.dataset.pwa='unavailable';});
  }
  return applyWhenSafe;
}
