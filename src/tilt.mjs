const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const radians=Math.PI/180;
export function screenRoll(beta,gamma,screenAngle=0){
  if(!Number.isFinite(beta)||!Number.isFinite(gamma)||!Number.isFinite(screenAngle))return null;
  const b=beta*radians,g=gamma*radians,a=screenAngle*radians;
  // Gravity in device axes, from the W3C Z-X-Y rotation matrix.
  const gx=Math.cos(b)*Math.sin(g),gy=-Math.sin(b);
  // A nearly flat screen has no reliable gravity-projected horizon. Keep the
  // last valid sample briefly instead of switching to discontinuous Euler angles.
  if(Math.hypot(gx,gy)<.22)return null;
  // screen.orientation.angle is counter-clockwise. Undo the display rotation
  // in device coordinates; the opposite sign put landscape near ±180°, which
  // the camera clamped alternately to ±45° on either side of level.
  const x=gx*Math.cos(a)-gy*Math.sin(a),y=gy*Math.cos(a)+gx*Math.sin(a);
  return Math.atan2(x,-y)/radians;
}
export function steeringFromRoll(roll,neutral=0){
  const delta=Math.atan2(Math.sin((roll-neutral)*radians),Math.cos((roll-neutral)*radians))/radians;
  return Math.sign(delta)*clamp((Math.abs(delta)-2)/23,0,1);
}
export function horizonCompensation(roll){
  // The phone rolls with the player's hands; counter-roll only the 3D camera.
  // A limit keeps extreme sensor readings from flipping the entire scene.
  const limited=Number.isFinite(roll)?clamp(roll,-45,45):0;
  return limited===0?0:-limited*radians;
}
export class TiltControl {
  constructor(onChange=()=>{}){
    this.enabled=false;this.onChange=onChange;this.reset();
    this.receive=e=>{
      if(!this.enabled)return;
      const angle=screen.orientation?.angle??window.orientation??0;
      if(angle!==this.screenAngle){this.reset();this.screenAngle=angle;}
      const roll=screenRoll(e.beta,e.gamma,angle);if(roll===null)return;
      this.lastRoll=roll;if(this.neutral===null)this.neutral=roll;
      this.value+=(steeringFromRoll(roll,this.neutral)-this.value)*.22;this.lastEvent=performance.now();
      if(!this.ready){this.ready=true;this.onChange();}
    };
    this.orientationChange=()=>{this.reset();this.onChange();};
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
  reset(){this.ready=false;this.neutral=null;this.lastRoll=0;this.value=0;this.lastEvent=0;this.screenAngle=null;}
  calibrate(){this.neutral=this.active?this.lastRoll:null;this.value=0;}
  disable(){this.enabled=false;this.reset();window.removeEventListener('deviceorientation',this.receive);this.onChange();}
  read(){if(!this.enabled||!this.ready||performance.now()-this.lastEvent>1500)return 0;return this.value;}
  get active(){return this.enabled&&this.ready&&performance.now()-this.lastEvent<1500;}
}
