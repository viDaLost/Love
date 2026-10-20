import test from "node:test";
import assert from "node:assert/strict";
import {
  DURATION,CUES,WORDS,PALETTE,blinkAmount,eyeSample,heartSample,decodeInk,
  heartbeat,ecg,cameraScale,layout,gaze
} from "../assets/model.js";
import { Animation } from "../assets/animation.js";
import { installCanvasStub } from "./canvas-stub.mjs";

test("scenes and three separate word bursts occur in the requested order",()=>{
  assert.deepEqual(WORDS,["Я","тебя","люблю"]);
  const order=[0,CUES.zoom,CUES.space,CUES.gather,CUES.pulse,CUES.heartStart,CUES.heart,...CUES.words,CUES.fade,DURATION];
  for(let i=1;i<order.length;i++)assert.ok(order[i]>order[i-1]);
  assert.ok(CUES.words[0]-CUES.heart>=5);
  assert.ok(CUES.fade-CUES.words[2]>=4);
});
test("eyelids close quickly, briefly touch, then fully reopen",()=>{
  assert.equal(blinkAmount(1),0);
  assert.equal(blinkAmount(2.11),1);
  assert.equal(blinkAmount(2.3),0);
  assert.ok(blinkAmount(2.08)>0.5);
  const closed=[];
  for(let t=1.95;t<2.35;t+=0.001)if(blinkAmount(t)>0.05)closed.push(t);
  const span=closed.at(-1)-closed[0];
  assert.ok(span>0.12 && span<0.20);
  assert.equal(blinkAmount(7.2),0);
});
test("marsh iris, pale sclera, pupil and eyelid occlusion stay distinct",()=>{
  const iris=decodeInk(eyeSample(0.20,0.04));
  assert.ok([2,3,4].includes(iris.material));
  assert.equal(decodeInk(eyeSample(0.55,0.02)).material,1);
  assert.equal(eyeSample(0.017,0.006),0);
  assert.equal(eyeSample(1.3,0.0),0);
  assert.equal(decodeInk(eyeSample(0,-0.1,1)).material,0);
  assert.ok(PALETTE[2][1]>PALETTE[2][0] && PALETTE[2][0]>PALETTE[2][2]);
});
test("anatomical heart has myocardium, a visible great vessel and a lower apex",()=>{
  assert.ok(heartSample(0.25,0.70)>0);
  assert.equal(decodeInk(heartSample(-0.46,-0.83)).material,7);
  assert.ok([6,8].includes(decodeInk(heartSample(0.2,0.2)).material));
  assert.equal(heartSample(-0.8,0.85),0);
  assert.equal(heartSample(0.8,-1.2),0);
  assert.ok(heartSample(0.12,-0.99)>0);
});
test("geometry produces valid glyph palette values throughout both objects",()=>{
  let eyePixels=0,heartPixels=0;
  for(let y=-1.2;y<=1;y+=0.026)for(let x=-1.2;x<=1.2;x+=0.026) {
    for(const [sample,isEye] of [[eyeSample(x,y,0,gaze(4)),true],[heartSample(x,y),false]]) {
      assert.ok(Number.isInteger(sample) && sample>=0 && sample<PALETTE.length*32);
      if(sample){if(isEye)eyePixels++;else heartPixels++;}
    }
  }
  assert.ok(eyePixels>800);assert.ok(heartPixels>900);
});
test("camera enters the pupil monotonically and covers a tall phone",()=>{
  let previous=1;
  for(let t=7.2;t<11.9;t+=0.05) {
    const current=cameraScale(t);assert.ok(current>=previous-1e-8);previous=current;
  }
  assert.ok(Math.abs(cameraScale(11.8)-48)<1e-8);
  for(const [w,h] of [[320,568],[390,844],[430,932],[1920,1080],[280,1700]]) {
    const geo=layout(w,h),radius=geo.eyeUnit*0.326*0.34;
    const cover=Math.max(48,Math.hypot(w,h)/(2*radius)*1.3);
    assert.ok(radius*cameraScale(11.8,cover)>Math.hypot(w,h)/2);
    assert.ok(geo.wordY[0]>0 && geo.wordY[2]<h);
  }
});
test("heartbeat and ECG have a stable period, R peak and double contraction",()=>{
  const period=60/72;
  assert.ok(Math.abs(heartbeat(0.1)-heartbeat(0.1+period))<1e-10);
  assert.ok(heartbeat(period*0.12)>heartbeat(period*0.5));
  assert.ok(heartbeat(period*0.29)>heartbeat(period*0.5));
  assert.ok(ecg(0.38)>0.85);assert.ok(ecg(0.414)<-0.20);
  assert.ok(Math.abs(ecg(0.20)-ecg(1.20))<1e-10);
});
for(const [width,height] of [[320,568],[390,844],[1440,900]]) {
  test("all transitions render finite coordinates at "+width+"×"+height,()=>{
    const env=installCanvasStub(width,height);
    let app;
    try {
      app=new Animation(env.canvas,env.announcement);
      const times=new Set([0,0.08,0.19,2.08,2.11,2.22,5.08,5.36,...Object.values(CUES).flat(),41.99]);
      for(let t=0;t<DURATION;t+=0.47)times.add(t);
      for(const cue of [CUES.space,CUES.gather,CUES.pulse,CUES.heartStart,CUES.heart,...CUES.words]) {
        for(const offset of [-0.01,0.01,0.18,0.6,1.0])times.add(cue+offset);
      }
      for(const t of [...times].sort((a,b)=>a-b))app.draw(t);
      assert.ok(env.stats.glyphs>50000);
      assert.ok(app.heartPoints.length>300);
      assert.ok(app.wordPoints.every(points=>points.length>10));
      assert.equal(env.announcement.textContent,"Я тебя люблю");
      assert.ok(env.canvas.width*env.canvas.height<3010000);
    } finally { app?.destroy();env.cleanup(); }
  });
}
test("hiding or pausing the page cancels frames without skipping scenes",()=>{
  const env=installCanvasStub(390,844);
  let app;
  try {
    app=new Animation(env.canvas,env.announcement);
    assert.equal(env.pending.size,1);
    app.start();assert.equal(env.pending.size,1);
    env.advance(100);env.advance(134);
    const before=app.time;
    env.document.hidden=true;app.onVisibility();
    assert.equal(env.pending.size,0);
    env.advance(20000);assert.equal(app.time,before);
    env.document.hidden=false;app.onVisibility();env.advance(20100);
    assert.equal(app.time,before);
    env.advance(20134);assert.ok(app.time>before && app.time-before<0.05);
    app.onKey({code:"Space",repeat:false,preventDefault(){}});
    assert.equal(env.pending.size,0);
    app.onKey({code:"Space",repeat:false,preventDefault(){}});
    assert.equal(env.pending.size,1);
    app.time=DURATION-0.01;env.advance(20200);env.advance(20234);
    assert.ok(app.time<DURATION);
    app.destroy();assert.equal(env.pending.size,0);
  } finally { app?.destroy();env.cleanup(); }
});
test("reduced motion shows a still confession and schedules no animation",()=>{
  const env=installCanvasStub(390,844,true);
  let app;
  try {
    app=new Animation(env.canvas,env.announcement);
    assert.equal(env.pending.size,0);
    assert.equal(env.announcement.textContent,"Я тебя люблю.");
    assert.ok(env.stats.glyphs>1000);
  } finally { app?.destroy();env.cleanup(); }
});
