// Shared timing, easing and heartbeat geometry for the symbol animation.
export const DURATION=61;
export const TWO_PI=Math.PI*2;
export const WORDS=Object.freeze(["Я","тебя","люблю"]);
export const WORD_TIMES=Object.freeze([42,44.5,47]);
export const HEART_TIMES=Object.freeze([49.4,50.7,52]);
export const LOOP_RETURN=55.5;
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const smooth=(a,b,v)=>{const q=clamp((v-a)/(b-a));return q*q*(3-2*q);};
export const mix=(a,b,t)=>a+(b-a)*t;
export const gauss=(x,s)=>Math.exp(-x*x/s);
export const fract=x=>x-Math.floor(x);
export const hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453123);
export const beats=t=>{
  const p=fract(t*1.2);
  return Math.exp(-Math.pow((p-.41)/.065,2))+.47*Math.exp(-Math.pow((p-.65)/.085,2));
};
export const ecg=x=>.11*gauss(x-.16,.00055)-.15*gauss(x-.32,.000065)
  +1.07*gauss(x-.365,.000075)-.32*gauss(x-.409,.0001)+.23*gauss(x-.61,.0027);
export function blinkAmount(t) {
  const age=t-5.35;
  if(age<0||age>.165)return 0;
  return age<.045?Math.pow(age/.045,.72):age<.060?1:1-smooth(.060,.165,age);
}
export function phaseAt(t) {
  if(t<6.2)return "portrait";
  if(t<9.5)return "eye";
  if(t<14.5)return "zoom";
  if(t<21)return "milky-way";
  if(t<24)return "space-pulse";
  if(t<29)return "pulse";
  if(t<33)return "pulse-heart";
  if(t<42)return "heart";
  if(t<49.4)return "words";
  if(t<LOOP_RETURN)return "pixel-hearts";
  return "return";
}
export const loopBlend=t=>smooth(LOOP_RETURN,DURATION,t);
