import test from "node:test";
import assert from "node:assert/strict";
import {
  DURATION,WORDS,WORD_TIMES,HEART_TIMES,phaseAt,blinkAmount,loopBlend,
  zoomMagnification,eyeFrame,beats,ecg
} from "../assets/model.js";
import {galaxySample,noise2,spiralDensity} from "../assets/galaxy.js";
import {VESSEL_ROUTES,heartGeometry,vesselCurve,curvePoint,vascularPulse} from "../assets/vessels.js";
import {cueEvents,createSoundtrack} from "../assets/sound.js";

test("the sequence starts with an eye and retains the words, three hearts and seamless return",()=>{
  assert.deepEqual([0,6.5,11.5,20,23,28,32,40,47.4,53.5].map(phaseAt),
    ["eye","zoom","milky-way","space-pulse","pulse","pulse-heart","heart","words","pixel-hearts","return"]);
  assert.deepEqual(WORDS,["Я","тебя","люблю"]);
  assert.deepEqual(WORD_TIMES,[40,42.5,45]);
  assert.deepEqual(HEART_TIMES,[47.4,48.7,50]);
  assert.equal(DURATION,58);assert.equal(loopBlend(DURATION),1);assert.equal(loopBlend(0),0);
});
test("the eyelid closes in 45 ms and reopens within 165 ms",()=>{
  assert.equal(blinkAmount(4),0);assert.equal(blinkAmount(4.15),1);assert.equal(blinkAmount(4.28),0);
  assert.ok(blinkAmount(4.13)>.6);assert.ok(blinkAmount(4.22)>0&&blinkAmount(4.22)<.5);
});
function pixels(W,H,t,p=0) {
  const data=new Uint8ClampedArray(W*H*4);eyeFrame(W,H,H/W*1.65,t,p,data);return data;
}
function sample(data,W,H,x,y) {
  const i=Math.max(0,Math.min(W-1,Math.round((x/3.2+.5)*W)));
  const j=Math.max(0,Math.min(H-1,Math.round((y/(3.2*H/W*1.65)+.5)*H)));
  return [...data.slice((j*W+i)*4,(j*W+i)*4+3)];
}
test("the iris is muted olive/hazel and the sclera remains much lighter",()=>{
  const W=240,H=82,t=3,p=pixels(W,H,t);
  const gx=.035*Math.sin(t*.8)+.02*Math.sin(t*1.7),gy=.012*Math.sin(t*.63);
  const iris=sample(p,W,H,gx+.27,gy-.025),white=sample(p,W,H,.72,0);
  assert.ok(iris[1]>iris[0]*.85&&iris[0]>iris[2]*1.4);
  assert.ok(iris[1]>iris[2]*1.6);assert.ok(white[1]>iris[1]*1.3);
});
test("the fast blink occludes the eye instead of fading it",()=>{
  const W=240,H=82,a=sample(pixels(W,H,4),W,H,.70,-.08),b=sample(pixels(W,H,4.15),W,H,.70,-.08);
  assert.ok(a[1]>b[1]*1.8);
});
for(const [W,H] of [[114,149],[200,68],[96,354]]) {
  test("the eye and pupil zoom are finite and fully enter on "+W+"×"+H,()=>{
    for(const t of [0,.1,.48,3,4.15,4.25,6.5,9,11.5]){
      const data=new Float64Array(W*H*4);
      eyeFrame(W,H,H/W*1.65,t,Math.max(0,Math.min(1,(t-6.5)/5)),data);
      for(const value of data)assert.ok(Number.isFinite(value)&&value>=0&&value<=255);
    }
    const asp=H/W*1.65;
    assert.ok(.142*zoomMagnification(1,asp)>1.6*Math.hypot(1,asp));
    assert.equal(zoomMagnification(0,asp),1);
  });
}
test("the galactic sky has continuous multiscale detail and bounded natural colours",()=>{
  for(let y=-1.2;y<=1.2;y+=.13)for(let x=-1.2;x<=1.2;x+=.13){
    for(const c of galaxySample(x,y))assert.ok(Number.isFinite(c)&&c>=0&&c<=1);
  }
  assert.ok(Math.abs(noise2(1-1e-5,.62)-noise2(1+1e-5,.62))<.001);
  const core=galaxySample(0,0),empty=galaxySample(1,1);
  assert.ok(core[0]>empty[0]*5);assert.ok(core[0]>core[2]);
  assert.deepEqual(galaxySample(.14,.2),galaxySample(.14,.2));
});
test("a larger heart keeps every incoming vessel attached throughout the heartbeat",()=>{
  for(const [W,H] of [[114,149],[200,68],[96,354]])for(const t of [32,32.5,33.675,37]){
    const g=heartGeometry(W,H,t);
    assert.ok(g.w<=W*.62);assert.ok(g.h<=H*.72);
    for(const [i,r] of VESSEL_ROUTES.entries()){
      const curve=vesselCurve(r,W,H,g,i),end=curvePoint(curve,1);
      assert.ok(Math.abs(end.x-g.x-g.w*r.anchor[0])<1e-8);
      assert.ok(Math.abs(end.y-g.y-g.h*r.anchor[1])<1e-8);
      for(let u=0;u<=1;u+=.05){const p=curvePoint(curve,u);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
    }
  }
  assert.ok(VESSEL_ROUTES.some(r=>r.start[0]<0));assert.ok(VESSEL_ROUTES.some(r=>r.start[0]>1));
  assert.ok(VESSEL_ROUTES.some(r=>r.start[1]<0));assert.ok(VESSEL_ROUTES.some(r=>r.start[1]>1));
});
test("flow reaches the vessel roots at the exact same double pulse as the heart",()=>{
  for(let t=32;t<40;t+=.07)assert.equal(vascularPulse(t,1),beats(t));
  const at=(40+.41)/1.2;
  assert.ok(vascularPulse(at-.45,0)>.99);assert.ok(vascularPulse(at,1)>.99);
});
test("audio heartbeat events follow the 72 bpm visual peaks and one chime per word",()=>{
  const events=cueEvents(0,DURATION);
  assert.deepEqual(events.filter(e=>e.type==="word").map(e=>e.at),WORD_TIMES);
  assert.deepEqual(events.filter(e=>e.type==="pixel-heart").map(e=>e.at),HEART_TIMES);
  for(const e of events) {
    assert.ok(e.at>=0&&e.at<DURATION);
    if(e.type==="lub")assert.ok(beats(e.at)>.99);
    if(e.type==="dub")assert.ok(beats(e.at)>.46);
  }
  assert.ok(events.filter(e=>e.type==="lub").length>=20);
});
test("sound creates no audio context until an explicit user gesture",()=>{
  let created=0;
  const sound=createSoundtrack({AudioContext:class {constructor(){created++;}}});
  assert.equal(sound.available,true);assert.equal(sound.enabled,false);assert.equal(created,0);
  sound.update(24,true);sound.setPlaying(true);sound.reset();sound.destroy();
  assert.equal(created,0);
  const unavailable=createSoundtrack({});assert.equal(unavailable.toggle(),false);unavailable.destroy();
});
test("the ECG and double heartbeat repeat at 72 bpm",()=>{
  assert.ok(Math.abs(beats(.1)-beats(.1+60/72))<1e-10);
  assert.ok(ecg(.365)>.95);assert.ok(ecg(.409)<-.2);
});

test("a face-on galactic disc has major and minor spiral arms around all four quadrants",()=>{
  const radius=.60,angle=2.55*Math.log(radius+.12);
  const value=at=>spiralDensity(Math.cos(at)*radius,Math.sin(at)*radius);
  const arms=[0,Math.PI/2,Math.PI,Math.PI*1.5].map(offset=>value(angle+offset));
  const between=value(angle+Math.PI/4);
  for(const arm of arms)assert.ok(arm>between*20);
  assert.ok(arms[0]>arms[1]);
  assert.ok(Math.abs(arms[0]-arms[2])<1e-8);
  assert.ok(Math.abs(arms[1]-arms[3])<1e-8);
});
test("the enlarged phone heart fills more of the scene while leaving room for incoming vessels",()=>{
  const g=heartGeometry(114,149,32);
  assert.ok(g.w>114*.55&&g.w<114*.63);
  assert.ok(g.x>0&&g.x+g.w<114);
});
