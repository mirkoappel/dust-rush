import { clamp } from './simulation.mjs';
export class Sound {
  constructor(){this.enabled=true;this.ready=false;this.lastBeat=-1;}
  async init() {
    if(!this.ready) {
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=.42;this.master.connect(this.ctx.destination);
      this.engine=this.ctx.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=40;
      this.engineFilter=this.ctx.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=250;
      this.engineGain=this.ctx.createGain();this.engineGain.gain.value=0;
      this.engine.connect(this.engineFilter);this.engineFilter.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
      const b=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate),data=b.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);
      this.noiseBuffer=b;
      const wind=this.ctx.createBufferSource();wind.buffer=b;wind.loop=true;
      this.windFilter=this.ctx.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=800;
      this.windGain=this.ctx.createGain();this.windGain.gain.value=0;wind.connect(this.windFilter);this.windFilter.connect(this.windGain);this.windGain.connect(this.master);wind.start();
      this.ready=true;
    }
    if(this.ctx?.state==='suspended')await this.ctx.resume();
  }
  setEnabled(value){this.enabled=value;if(this.ready)this.master.gain.setTargetAtTime(value?.42:0,this.ctx.currentTime,.05);}
  tone(frequency,duration=.1,volume=.1,type='sine',endFrequency=null) {
    if(!this.ready||!this.enabled)return;
    const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(frequency,t);if(endFrequency)o.frequency.exponentialRampToValueAtTime(endFrequency,t+duration);
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);
  }
  noise(duration=.2,volume=.18,freq=700) {
    if(!this.ready||!this.enabled)return;
    const t=this.ctx.currentTime,n=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();
    n.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.value=freq;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    n.connect(f);f.connect(g);g.connect(this.master);n.start();n.stop(t+duration);
  }
  update(car,mode,time) {
    if(!this.ready)return;
    const t=this.ctx.currentTime,running=mode==='racing';
    this.engine.frequency.setTargetAtTime(36+Math.abs(car.speed)*1.72,t,.06);
    this.engineFilter.frequency.setTargetAtTime(260+Math.abs(car.speed)*15,t,.1);
    this.engineGain.gain.setTargetAtTime(running?.032+Math.abs(car.speed)*.00055:0,t,.1);
    this.windGain.gain.setTargetAtTime(running?clamp(car.speed/70,0,1)*.045:0,t,.15);
    if(running){
      const beat=Math.floor(time*2.2);
      if(beat!==this.lastBeat){this.lastBeat=beat;if(beat%2===0)this.tone(78,.12,.075,'sine',34);else this.noise(.045,.018,2600);}
    }
  }
  event(e) {
    if(e.type==='tick'&&e.number>0)this.tone(520,.13,.2);
    if(e.type==='go')this.tone(920,.38,.2);
    if(e.type==='crash'||e.type==='smash'||e.type==='crush'){this.noise(.22,.22,1200);this.tone(85,.19,.13,'triangle',28);}
    if(e.type==='land'){this.noise(.2,.13,420);this.tone(66,.15,.12,'sine',25);}
    if(e.type==='pad'){this.tone(270,.28,.13,'triangle',850);this.noise(.3,.045,1700);}
    if(e.type==='jump')this.tone(190,.18,.09,'sine',390);
    if(e.type==='lap')this.tone(710,.25,.12,'triangle',1100);
    if(e.type==='finish'){[0,1,2,3].forEach((i)=>setTimeout(()=>this.tone([523,659,784,1046][i],.5,.16,'triangle'),i*130));}
  }
}
