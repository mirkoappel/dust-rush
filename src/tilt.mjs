const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const radians=Math.PI/180;
export function screenRoll(beta,gamma,screenAngle=0){
  if(!Number.isFinite(beta)||!Number.isFinite(gamma))return null;
  const b=beta*radians,g=gamma*radians,a=screenAngle*radians;
  const gx=Math.cos(b)*Math.sin(g),gy=-Math.sin(b);
  if(Math.hypot(gx,gy)<.22)return gamma*Math.cos(a)-beta*Math.sin(a);
  const x=gx*Math.cos(a)+gy*Math.sin(a),y=gy*Math.cos(a)-gx*Math.sin(a);
  return Math.atan2(x,-y)/radians;
}
export function steeringFromRoll(roll,neutral=0){
  const delta=Math.atan2(Math.sin((roll-neutral)*radians),Math.cos((roll-neutral)*radians))/radians;
  return Math.sign(delta)*clamp((Math.abs(delta)-2)/23,0,1);
}
export class TiltControl {
  constructor(onChange=()=>{}){
    this.enabled=false;this.ready=false;this.neutral=null;this.lastRoll=0;this.value=0;this.lastEvent=0;this.onChange=onChange;
    this.receive=e=>{
      if(!this.enabled)return;
      const angle=screen.orientation?.angle??window.orientation??0;
      const roll=screenRoll(e.beta,e.gamma,angle);if(roll===null)return;
      this.lastRoll=roll;if(this.neutral===null)this.neutral=roll;
      this.value+=(steeringFromRoll(roll,this.neutral)-this.value)*.22;this.lastEvent=performance.now();
      if(!this.ready){this.ready=true;this.onChange();}
    };
    this.orientationChange=()=>{this.neutral=null;this.value=0;};
    screen.orientation?.addEventListener('change',this.orientationChange);
    window.addEventListener('orientationchange',this.orientationChange);
  }
  async enable(){
    if(!window.isSecureContext||!window.DeviceOrientationEvent)return false;
    try{
      if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')return false;
      if(!this.enabled)window.addEventListener('deviceorientation',this.receive,{passive:true});
      this.enabled=true;this.calibrate();this.onChange();return true;
    }catch{return false;}
  }
  calibrate(){this.neutral=this.ready?this.lastRoll:null;this.value=0;}
  disable(){this.enabled=false;this.ready=false;this.value=0;window.removeEventListener('deviceorientation',this.receive);this.onChange();}
  read(){if(!this.enabled||!this.ready||performance.now()-this.lastEvent>1500)return 0;return this.value;}
  get active(){return this.enabled&&this.ready&&performance.now()-this.lastEvent<1500;}
}

