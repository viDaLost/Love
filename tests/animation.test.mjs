import test from "node:test";
import assert from "node:assert/strict";
import {
  DURATION,WORDS,WORD_TIMES,phaseAt,blinkAmount,zoomMagnification,
  eyeFrame,ecg,beats
} from "../assets/model.js";

function frame(width,height,aspect,t,zoom=0) {
  const pixels=new Float64Array(width*height*4);
  eyeFrame(width,height,aspect,t,zoom,pixels);
  return pixels;
}
function pixelAt(pixels,width,height,aspect,x,y) {
  const i=Math.max(0,Math.min(width-1,Math.round((x/3.2+.5)*width)));
  const j=Math.max(0,Math.min(height-1,Math.round((y/(3.2*aspect)+.5)*height)));
  return [...pixels.slice((j*width+i)*4,(j*width+i)*4+3)];
}
test("the original scene order and timing are retained before the new ending",()=>{
  assert.deepEqual([0,7,12,18,21,26,30,39].map(phaseAt),
    ["eye","zoom","space","space-pulse","pulse","pulse-heart","heart","words"]);
  assert.deepEqual(WORDS,["Я","тебя","люблю"]);
  assert.deepEqual(WORD_TIMES,[39,41.5,44]);
  assert.equal(DURATION,52);
  assert.ok(DURATION-WORD_TIMES[2]>7);
});
test("a natural blink closes in 45 ms and fully reopens within 165 ms",()=>{
  assert.equal(blinkAmount(3),0);
  assert.equal(blinkAmount(4.150),1);
  assert.equal(blinkAmount(4.30),0);
  assert.ok(blinkAmount(4.130)>.6);
  assert.ok(blinkAmount(4.22)>0 && blinkAmount(4.22)<.5);
});
test("the sclera is pale and the iris has a muted olive rather than neon colour",()=>{
  const W=240,H=82,asp=82/240*1.65,t=3;
  const pixels=frame(W,H,asp,t);
  const gx=.035*Math.sin(t*.8)+.02*Math.sin(t*1.7),gy=.012*Math.sin(t*.63);
  const iris=pixelAt(pixels,W,H,asp,gx+.28,gy-.025);
  const sclera=pixelAt(pixels,W,H,asp,.72,0);
  assert.ok(iris[1]>iris[0] && iris[0]>iris[2]);
  assert.ok(iris[0]/iris[1]>.7);
  assert.ok(iris[2]/iris[1]<.6);
  assert.ok(sclera[1]>iris[1]*1.4);
});
test("closing the upper eyelid occludes the eye instead of fading the image",()=>{
  const W=240,H=82,asp=82/240*1.65;
  const open=frame(W,H,asp,4.0),closed=frame(W,H,asp,4.15);
  const a=pixelAt(open,W,H,asp,.70,-.10);
  const b=pixelAt(closed,W,H,asp,.70,-.10);
  assert.ok(a[1]>b[1]*2);
});
for(const [W,H,asp] of [[114,149,844/390],[158,96,1],[200,68,9/16]]) {
  test("all eye frames have finite bounded colours at "+W+"×"+H,()=>{
    for(const t of [0,.2,1,3,4.13,4.15,4.23,6.9,7,9,10.5,11.99]) {
      const p=t<7?0:Math.min(1,(t-7)/5);
      const pixels=frame(W,H,asp,t,p);
      for(const value of pixels)assert.ok(Number.isFinite(value)&&value>=0&&value<=255);
    }
  });
}
test("zoom follows the pupil continuously and enters it completely on tall phones",()=>{
  for(const asp of [.5625,1,844/390,1700/280]) {
    let previous=1;
    for(let p=0;p<=1;p+=.01){const mag=zoomMagnification(p,asp);assert.ok(mag>=previous);previous=mag;}
    const farthestCorner=1.6*Math.hypot(1,asp);
    assert.ok(.142*zoomMagnification(1,asp)>farthestCorner);
    assert.equal(zoomMagnification(0,asp),1);
  }
});
test("the original ECG and double heartbeat repeat at 72 beats per minute",()=>{
  const period=60/72;
  assert.ok(Math.abs(beats(.1)-beats(.1+period))<1e-10);
  assert.ok(ecg(.365)>.95);
  assert.ok(ecg(.409)<-.2);
  assert.ok(beats(.41/1.2)>beats(.85/1.2));
  assert.ok(beats(.65/1.2)>beats(.85/1.2));
});
