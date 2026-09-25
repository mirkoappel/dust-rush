// The lightweight HTML screen exists before WebGL starts. Progress follows
// completed preparation stages, not a timer or a pretend download percentage.
const afterPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
export function createLoadingScreen({screen,progress,status,retry,paint=afterPaint}){
  let value=0,failed=false;
  return {
    async advance(next,label){
      if(failed)return;
      value=Math.max(value,Math.min(100,Math.max(0,next)));
      progress.style.setProperty('--progress',String(value/100));
      progress.setAttribute('aria-valuenow',String(value));
      progress.setAttribute('aria-valuetext',label);
      status.textContent=label;
      await paint();
    },
    finish(){
      if(failed||value<100)return;
      screen.hidden=true;
    },
    fail(message){
      failed=true;screen.hidden=false;screen.dataset.state='error';
      progress.hidden=true;status.classList.remove('sr-only');status.textContent=message;
      retry.hidden=false;
    }
  };
}
