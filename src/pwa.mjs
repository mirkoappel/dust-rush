export function setupPWA({install,update,hint,isSafe}){
  if(!/^https?:$/.test(location.protocol))return;
  const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='./manifest.webmanifest';document.head.append(manifest);
  const apple=document.createElement('link');apple.rel='apple-touch-icon';apple.href='./assets/apple-touch-icon.png';document.head.append(apple);
  let prompt=null,waiting=null;
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(!standalone&&/iPad|iPhone|iPod/.test(navigator.userAgent))hint.textContent='Installieren: Teilen → Zum Home-Bildschirm.';
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;install.hidden=false;});
  install.addEventListener('click',async()=>{
    if(!prompt)return;try{await prompt.prompt();await prompt.userChoice;}catch{}prompt=null;install.hidden=true;
  });
  window.addEventListener('appinstalled',()=>{prompt=null;install.hidden=true;hint.textContent='Dust Rush ist installiert.';});
  let applying=false;
  update.addEventListener('click',()=>{
    if(!waiting||!isSafe())return;applying=true;waiting.postMessage({type:'SKIP_WAITING'});update.disabled=true;
  });
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying)location.reload();});
    navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
      navigator.serviceWorker.ready.then(()=>{document.body.dataset.pwa='offline-ready';});
      const offer=()=>{waiting=reg.waiting;if(waiting)update.hidden=false;};
      offer();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});
    }).catch(()=>{hint.textContent='Offline-Speicherung ist in diesem Browser nicht verfügbar.';});
  }
}
