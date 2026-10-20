import test from "node:test";
import assert from "node:assert/strict";
import {
  DURATION,WORDS,WORD_TIMES,HEART_TIMES,LOOP_RETURN,phaseAt,blinkAmount,
  loopBlend,ecg,beats
} from "../assets/model.js";
import {PORTRAIT,poseAt,projectPoint,portraitFrame} from "../assets/portrait.js";

test("portrait, eye, galaxy, rhythm, heart and declaration play in the requested order",()=>{
  assert.deepEqual([0,6.2,9.5,14.5,21,24,29,33,42,49.4,55.5].map(phaseAt),
    ["portrait","eye","zoom","milky-way","space-pulse","pulse","pulse-heart","heart","words","pixel-hearts","return"]);
  assert.deepEqual(WORDS,["Я","тебя","люблю"]);
  assert.deepEqual(WORD_TIMES,[42,44.5,47]);
  assert.deepEqual(HEART_TIMES,[49.4,50.7,52]);
  assert.ok(HEART_TIMES[0]>WORD_TIMES.at(-1)+2);
  assert.ok(LOOP_RETURN>HEART_TIMES.at(-1)+3);
  assert.equal(DURATION,61);
});
test("the head turns first, makes eye contact, then smiles before the camera moves",()=>{
  const half=poseAt(0),front=poseAt(3.3),smile=poseAt(4.85);
  assert.ok(half.yaw<-.6);assert.equal(half.smile,0);assert.equal(half.gaze,1);
  assert.equal(front.yaw,0);assert.equal(front.gaze,0);
  assert.ok(front.smile<.1);assert.equal(smile.smile,1);
  let yaw=half.yaw;
  for(let t=0;t<=3.4;t+=.01){assert.ok(poseAt(t).yaw>=yaw);yaw=poseAt(t).yaw;}
});
test("a natural blink closes in 45 ms and reopens within 165 ms",()=>{
  assert.equal(blinkAmount(5.3),0);
  assert.equal(blinkAmount(5.40),1);
  assert.equal(blinkAmount(5.52),0);
  assert.ok(blinkAmount(5.38)>.6);
  assert.ok(blinkAmount(5.47)>0&&blinkAmount(5.47)<.5);
  assert.equal(poseAt(5.40).opening,0);
});
test("depth projection keeps the portrait landmarks finite throughout the turn",()=>{
  for(let t=0;t<10;t+=.07) {
    for(const point of [[160,434,0],[300,152,0],[303,413,85],[304,478,72],PORTRAIT.leftEye]) {
      const p=projectPoint(...point,poseAt(t));
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.scale>.8&&p.scale<1.3);
    }
  }
  assert.ok(projectPoint(303,413,85,poseAt(0)).x<projectPoint(303,413,85,poseAt(3.3)).x-35);
});
for(const [W,H] of [[114,149],[158,96],[200,68],[96,354],[220,53]]) {
  test("the camera enters the projected pupil completely on "+W+"×"+H+" grids",()=>{
    const close=portraitFrame(W,H,9.5,0);
    assert.equal(close.zoom,6.8);
    assert.ok(Math.abs(close.pupilX-W/2)<1e-8);
    assert.ok(Math.abs(close.pupilY-H/2)<1e-8);
    const near=portraitFrame(W,H,9.5,1e-8);
    assert.ok(Math.abs(close.zoom-near.zoom)<1e-7);
    let previous=close.zoom;
    for(let portal=0;portal<=1;portal+=.01) {
      const f=portraitFrame(W,H,9.5+portal*5,portal);
      assert.ok(Number.isFinite(f.zoom)&&f.zoom>=previous);previous=f.zoom;
    }
    const inside=portraitFrame(W,H,14.5,1);
    const corner=Math.hypot(W/(2*inside.radiusX),H/(2*inside.radiusY));
    assert.ok(corner<.88,"all corners must be inside the fully revealed galaxy");
  });
}
test("the return dissolves into the same half-turned pose as frame zero",()=>{
  assert.equal(loopBlend(LOOP_RETURN),0);
  assert.equal(loopBlend(DURATION),1);
  assert.equal(loopBlend(DURATION+.1),1);
  assert.ok(loopBlend(58)>0&&loopBlend(58)<1);
  let previous=0;
  for(let t=LOOP_RETURN;t<=DURATION;t+=.01){assert.ok(loopBlend(t)>=previous);previous=loopBlend(t);}
  assert.equal(poseAt(0).smile,0);assert.equal(poseAt(0).opening,1);
});
test("the ECG and double heartbeat repeat at 72 beats per minute",()=>{
  const period=60/72;
  assert.ok(Math.abs(beats(.1)-beats(.1+period))<1e-10);
  assert.ok(ecg(.365)>.95);assert.ok(ecg(.409)<-.2);
  assert.ok(beats(.41/1.2)>beats(.85/1.2));
  assert.ok(beats(.65/1.2)>beats(.85/1.2));
});
