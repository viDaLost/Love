import {clamp,smooth,WORD_TIMES,HEART_TIMES,DURATION,hash} from "./model.js?v=cinema-6";

const noises=new WeakMap();
function noiseBuffer(ctx) {
  if(noises.has(ctx))return noises.get(ctx);
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*2.5),ctx.sampleRate);
  const data=buffer.getChannelData(0);let brown=0;
  for(let i=0;i<data.length;i++){brown=(brown+(hash(i*1.37)-.5)*.12)/1.018;data[i]=brown*3.2;}
  noises.set(ctx,buffer);return buffer;
}
export function scoreGain(t) {
  if(t<39.2||t>=40.4)return 1;
  return clamp(1-smooth(39.2,39.62,t)+smooth(40.22,40.4,t));
}
export function musicState(t) {
  const galaxy=smooth(5.7,12,t)*(1-smooth(20,24,t));
  const heart=smooth(28,34,t)*(1-smooth(38.7,39.2,t));
  const ending=smooth(40.3,41.9,t)*(1-smooth(54,58.8,t));
  const returning=smooth(54,56,t)*(1-smooth(63,65.8,t));
  let frequencies=[130.81,196,246.94,293.66,329.63];
  if(t>=23&&t<40.4)frequencies=[110,164.81,220,261.63,329.63];
  else if(t>=40.4&&t<43)frequencies=[130.81,196,261.63,329.63,392];
  else if(t>=43&&t<45.6)frequencies=[87.31,130.81,174.61,220,329.63];
  else if(t>=45.6)frequencies=[130.81,196,261.63,329.63,493.88];
  return {level:(galaxy*.58+heart*.065+ending*(.27+.14*smooth(44.8,47,t))+returning*.14)*scoreGain(t),frequencies};
}
export function cueEvents(from,to) {
  const events=[];
  const add=(at,type,index=0,pan=0)=>{if(at>=from&&at<to)events.push({at,type,index,pan});};
  add(6.5,"zoom");add(11.5,"arrival");
  for(let n=0;n<17;n++){
    const g=n*.93,at=g<3.5?6.5+g/.7:8+g;
    if(at<22.5)add(at,"star",n,(hash(n*13+71)-.5)*1.14);
  }
  for(let n=Math.floor(from*1.2)-1;n<=Math.ceil(to*1.2);n++){
    const first=(n+.41)/1.2,second=(n+.65)/1.2;
    if(first>=23&&first<39.2)add(first,"lub",n);
    if(second>=23&&second<39.2)add(second,"dub",n);
  }
  WORD_TIMES.forEach((at,i)=>add(at,"word",i,(i-1)*.14));
  HEART_TIMES.forEach((at,i)=>add(at,"pixel-heart",i,(i-1)*.32));
  [12.4,14.6,16.7,18.7,45.9,47.1,48.3,49.5].forEach((at,i)=>add(at,"melody",i,Math.sin(i*1.7)*.45));
  add(54,"return");
  for(let i=0;i<8;i++)add(54.15+i*.32,"return-star",i,Math.sin(i*2.4)*.65);
  add(59.1,"reflection",0,-.2);
  return events.sort((a,b)=>a.at-b.at||a.type.localeCompare(b.type));
}
export function scheduleCue(ctx,output,event,when) {
  const active=[],ended=new Set();
  const bus=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();
  if(bus.pan)bus.pan.value=clamp(event.pan||0,-.85,.85);
  bus.connect(output);
  function finished(source) {ended.add(source);if(ended.size===active.length)bus.disconnect();}
  function tone(freq,offset,duration,peak,type="sine",slide=0) {
    const source=ctx.createOscillator(),gain=ctx.createGain();
    source.type=type;source.frequency.setValueAtTime(freq,when+offset);
    if(slide)source.frequency.exponentialRampToValueAtTime(slide,when+offset+duration*.65);
    gain.gain.setValueAtTime(.00001,when+offset);
    gain.gain.exponentialRampToValueAtTime(Math.max(.00002,peak),when+offset+.008);
    gain.gain.exponentialRampToValueAtTime(.00001,when+offset+duration);
    source.connect(gain);gain.connect(bus);
    source.onended=()=>{source.disconnect();gain.disconnect();finished(source);};
    source.start(when+offset);source.stop(when+offset+duration+.02);active.push(source);
  }
  function air(offset,duration,peak,startFrequency,endFrequency) {
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=noiseBuffer(ctx);filter.type="bandpass";filter.Q.value=.75;
    filter.frequency.setValueAtTime(startFrequency,when+offset);
    filter.frequency.exponentialRampToValueAtTime(endFrequency,when+offset+duration);
    gain.gain.setValueAtTime(.00001,when+offset);
    gain.gain.exponentialRampToValueAtTime(peak,when+offset+duration*.43);
    gain.gain.exponentialRampToValueAtTime(.00001,when+offset+duration);
    source.connect(filter);filter.connect(gain);gain.connect(bus);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();finished(source);};
    source.start(when+offset);source.stop(when+offset+duration+.02);active.push(source);
  }
  function bell(freq,offset=0,volume=.075,duration=1.4) {
    tone(freq,offset,duration,volume);
    tone(freq*2.002,offset,duration*.48,volume*.17);
    tone(freq*3.004,offset,duration*.28,volume*.045);
  }
  if(event.type==="lub"||event.type==="dub") {
    const first=event.type==="lub";
    tone(first?78:62,0,first?.20:.15,first?.32:.23,"sine",first?44:39);
    tone(first?122:98,0,.09,first?.055:.04,"sine",first?70:57);
    air(0,.09,.025,190,95);
  } else if(event.type==="zoom") {
    air(0,2.4,.12,300,2400);tone(145,0,2.3,.026,"sine",62);
  } else if(event.type==="arrival") {
    bell(261.63,0,.045,2.0);bell(392,.16,.028,1.8);bell(523.25,.32,.02,1.7);
  } else if(event.type==="star") {
    const scale=[523.25,587.33,659.25,783.99,880];
    bell(scale[event.index%5],0,.016,1.15);
  } else if(event.type==="word") {
    const root=[261.63,349.23,261.63][event.index];
    bell(root,0,.078,2.2);
    bell(root*1.25,.12,.043,1.9);bell(root*1.5,.25,.037,1.8);bell(root*2,.42,.025,1.7);
    if(event.index===2){bell(493.88,.57,.022,2.0);bell(587.33,.72,.018,1.9);}
  } else if(event.type==="pixel-heart") {
    bell([523.25,659.25,783.99][event.index],0,.055,1.5);
  } else if(event.type==="melody") {
    bell([523.25,659.25,783.99,587.33,523.25,659.25,783.99,1046.5][event.index],0,.029,1.8);
  } else if(event.type==="return") {
    air(0,2.1,.042,1700,450);
  } else if(event.type==="return-star") {
    bell([1046.5,880,783.99,659.25,587.33,523.25,392,329.63][event.index],0,.017,1.45);
  } else if(event.type==="reflection") {
    bell(1046.5,0,.023,1.7);
  }
  return {stop(){for(const node of active)try{node.stop();}catch{}},sources:active};
}
export function createSoundtrack(host=window) {
  let ctx=null,master=null,musicGain=null,wetGain=null,enabled=false,playing=false,last=-1,destroyed=false;
  let scheduled=new Set(),voices=new Set(),ambient=[],musicVoices=[],suspended=false;
  let musicLevel=-1,duckLevel=-1;
  function prepare() {
    const Audio=host.AudioContext||host.webkitAudioContext;if(!Audio)return false;
    ctx=new Audio({latencyHint:"interactive"});
    master=ctx.createGain();master.gain.value=0;
    const compressor=ctx.createDynamicsCompressor();
    compressor.threshold.value=-15;compressor.knee.value=15;compressor.ratio.value=3;
    const dry=ctx.createGain(),wet=ctx.createGain(),reverb=ctx.createConvolver();
    dry.gain.value=.82;wet.gain.value=.24;wetGain=wet;
    const impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*2.15),ctx.sampleRate);
    for(let channel=0;channel<2;channel++){
      const data=impulse.getChannelData(channel);
      for(let i=0;i<data.length;i++)data[i]=(hash(i*1.73+channel*91)-.5)*Math.pow(1-i/data.length,3.2)*.55;
    }
    reverb.buffer=impulse;
    master.connect(dry);dry.connect(compressor);
    master.connect(reverb);reverb.connect(wet);wet.connect(compressor);compressor.connect(ctx.destination);
    musicGain=ctx.createGain();musicGain.gain.value=0;musicGain.connect(master);
    for(const [i,freq] of [130.81,196,261.63,293.66,329.63].entries()){
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sine";
      osc.frequency.value=freq;osc.detune.value=(i-2)*1.7;
      gain.gain.value=[.035,.020,.014,.010,.012][i];
      const pan=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();
      if(pan.pan)pan.pan.value=(i-2)*.30;
      osc.connect(gain);gain.connect(pan);pan.connect(musicGain);osc.start();
      ambient.push(osc,gain,pan);musicVoices.push({osc,pan,frequency:freq});
    }
    return true;
  }
  function clear() {
    for(const voice of voices)voice.stop();voices.clear();scheduled.clear();last=-1;
  }
  function resume() {
    if(!ctx||!enabled||!playing||destroyed)return;
    suspended=false;duckLevel=-1;
    const promise=ctx.resume();if(promise?.catch)promise.catch(()=>{});
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(.36,ctx.currentTime,.18);
  }
  function setPlaying(value) {
    playing=value;
    if(!value) {
      clear();
      if(ctx){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setValueAtTime(0,ctx.currentTime);const p=ctx.suspend();if(p?.catch)p.catch(()=>{});suspended=true;}
    } else resume();
  }
  function toggle() {
    if(destroyed)return false;
    if(!ctx&&!prepare())return false;
    enabled=!enabled;
    if(enabled)resume();
    else {clear();master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.08);}
    return enabled;
  }
  function update(time,isPlaying=true) {
    if(!ctx||!enabled||!isPlaying||!playing||ctx.state!=="running")return;
    if(last<0||time<last||Math.abs(time-last)>.35)clear();
    last=time;
    const now=ctx.currentTime;
    const music=musicState(time),duck=scoreGain(time);
    if(Math.abs(music.level-musicLevel)>.004){musicGain.gain.setTargetAtTime(music.level,now,.30);musicLevel=music.level;}
    if(Math.abs(duck-duckLevel)>.005){master.gain.setTargetAtTime(.36*duck,now,.035);wetGain.gain.setTargetAtTime(.24*duck,now,.035);duckLevel=duck;}
    for(let i=0;i<musicVoices.length;i++) {
      const v=musicVoices[i],freq=music.frequencies[i];
      if(v.frequency!==freq){v.osc.frequency.setTargetAtTime(freq,now,.75);v.frequency=freq;}
      if(v.pan.pan)v.pan.pan.setTargetAtTime((i-2)*.29+Math.sin(time*.12+i)*.05,now,.7);
    }
    for(const event of cueEvents(time-.008,time+.16)) {
      const key=event.type+":"+event.index+":"+event.at;
      if(scheduled.has(key))continue;scheduled.add(key);
      const voice=scheduleCue(ctx,master,event,Math.max(now,now+event.at-time));
      voices.add(voice);
      // Sources disconnect themselves after playback; prune their handles as well.
      let remaining=voice.sources.length;
      for(const source of voice.sources) {
        const previous=source.onended;
        source.onended=()=>{previous?.();if(--remaining===0)voices.delete(voice);};
      }
    }
  }
  function reset() {clear();}
  function destroy() {
    destroyed=true;clear();
    for(const node of ambient){try{node.stop?.();}catch{}try{node.disconnect();}catch{}}
    if(ctx){const p=ctx.close();if(p?.catch)p.catch(()=>{});}
  }
  return {toggle,setPlaying,update,reset,destroy,get enabled(){return enabled;},get available(){return !!(host.AudioContext||host.webkitAudioContext);}};
}
