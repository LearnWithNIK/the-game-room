export type SoundName='deal'|'play'|'draw'|'ball'|'select'|'invalid'|'turn'|'round'|'win'|'lose'|'button';
export type SoundSettings={enabled:boolean;volume:number};
export const DEFAULT_SOUND:SoundSettings={enabled:true,volume:35};
export function sanitizeSound(value:unknown):SoundSettings {
  const v=value as Partial<SoundSettings>|null;
  return {enabled:typeof v?.enabled==='boolean'?v.enabled:true,volume:typeof v?.volume==='number'&&Number.isFinite(v.volume)?Math.max(0,Math.min(100,v.volume)):35};
}
export class TableAudio {
  private context:AudioContext|null=null;private master:GainNode|null=null;private noise:AudioBuffer|null=null;
  private samples=new Map<string,AudioBuffer>();private loading=false;private sampleIndex=0;private voices:number[]=[];private unlocked=false;settings:SoundSettings={...DEFAULT_SOUND};
  configure(settings:SoundSettings){this.settings=sanitizeSound(settings);if(this.master&&this.context)this.master.gain.setTargetAtTime(this.settings.enabled?this.settings.volume/100:0,this.context.currentTime,.02);}
  unlock(){
    if(typeof window==='undefined')return;
    try{
      if(!this.context){
        const Constructor=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!Constructor)return;
        this.context=new Constructor();this.master=this.context.createGain();
        const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-20;compressor.knee.value=14;compressor.ratio.value=5;
        this.master.connect(compressor);compressor.connect(this.context.destination);
        this.noise=this.context.createBuffer(1,this.context.sampleRate*.3,this.context.sampleRate);
        const samples=this.noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
        this.configure(this.settings);
      }
      this.unlocked=true;void this.loadSamples();if(this.context.state!=='running')void this.context.resume().catch(()=>{});
    }catch{/* Audio must never interrupt play. */}
  }
  play(name:SoundName,delayMs=0){
    const ctx=this.context;if(!ctx||!this.master||!this.unlocked||!this.settings.enabled||this.settings.volume===0||ctx.state!=='running')return;
    const t=ctx.currentTime+Math.max(0,delayMs)/1000;
    this.voices=this.voices.filter(end=>end>ctx.currentTime);const level=1/Math.sqrt(Math.max(1,this.voices.length+1));
    this.voices.push(t+.5);
    if(['deal','play','draw','ball','select'].includes(name)){
      const group=name==='ball'?'dice-shake':name==='play'?'card-place':name==='draw'?'card-fan':'card-slide';
      const count=group==='card-fan'||group==='dice-shake'?1:3;const key=group+'-'+(this.sampleIndex++%count+1);const buffer=this.samples.get(key);if(!buffer)return;
      const source=ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=.98+Math.random()*.04;
      const gain=ctx.createGain();gain.gain.value=(name==='select'?.12:name==='deal'?.38:name==='ball'?.48:.65)*level;
      source.connect(gain);gain.connect(this.master);source.start(t);source.onended=()=>{source.disconnect();gain.disconnect();};return;
    }
    if(name==='button'||name==='select'){this.tone(name==='select'?460:330,t,.022,.025*level,'triangle');return;}
    if(name==='invalid'){this.tone(180,t,.12,.035*level,'sine');return;}
    const sequence=name==='win'?[261.63,329.63,392,523.25,659.25]:name==='round'?[329.63,392,523.25]:name==='lose'?[293.66,261.63]:[523.25,659.25];
    sequence.forEach((f,i)=>{
      const at=t+i*(name==='win'?.13:.12);const duration=name==='win'?.8:.45;
      this.tone(f,at,duration,.055*level,'sine');
      this.tone(f*2.003,at,.28,.018*level,'sine');
      this.tone(f*3.997,at,.12,.004*level,'sine');
    });
    if(name==='win') [130.81,196,261.63].forEach(f=>this.tone(f,t+.4,1,.03*level,'sine'));
  }
  private async loadSamples(){
    if(this.loading||!this.context)return;this.loading=true;const ctx=this.context;
    await Promise.all(['card-slide-1','card-slide-2','card-slide-3','card-place-1','card-place-2','card-place-3','card-fan-1','dice-shake-1'].map(async key=>{try{const response=await fetch('/audio/'+key+'.wav');if(!response.ok)return;const data=await response.arrayBuffer();const decoded=await ctx.decodeAudioData(data);if(this.context===ctx)this.samples.set(key,decoded);}catch{/* A failed sound must not stop the game. */}}));
  }
  private tone(frequency:number,t:number,duration:number,level:number,type:OscillatorType){
    const ctx=this.context!;const oscillator=ctx.createOscillator();oscillator.type=type;oscillator.frequency.value=frequency;const gain=ctx.createGain();
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(level,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    oscillator.connect(gain);gain.connect(this.master!);oscillator.start(t);oscillator.stop(t+duration+.02);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  close(){this.unlocked=false;if(this.context)void this.context.close().catch(()=>{});this.context=null;this.master=null;}
}
