// Geometry and colour sampling recovered from the first published Site.
export const DURATION = 52;
export const TWO_PI = Math.PI * 2;
export const WORDS = Object.freeze(["Я", "тебя", "люблю"]);
export const WORD_TIMES = Object.freeze([39, 41.5, 44]);
export const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
export const smooth = (a,b,v) => {const q=clamp((v-a)/(b-a));return q*q*(3-2*q);};
export const mix = (a,b,t) => a+(b-a)*t;
export const gauss = (x,s) => Math.exp(-x*x/s);
export const fract = x => x-Math.floor(x);
export const hash = n => fract(Math.sin(n*127.1+311.7)*43758.5453123);
export const beats = t => {
  const p=fract(t*1.2);
  return Math.exp(-Math.pow((p-.41)/.065,2))+.47*Math.exp(-Math.pow((p-.65)/.085,2));
};
export const ecg = x => .11*gauss(x-.16,.00055)-.15*gauss(x-.32,.000065)
  +1.07*gauss(x-.365,.000075)-.32*gauss(x-.409,.0001)+.23*gauss(x-.61,.0027);
export function blinkAmount(t) {
  let value=0;
  for(const at of [4.1]) {
    const age=t-at;
    if(age<0 || age>.165)continue;
    const b=age<.045?Math.pow(age/.045,.72):age<.060?1:1-smooth(.060,.165,age);
    value=Math.max(value,b);
  }
  return value;
}
export function zoomMagnification(p,aspect) {
  // The desktop camera is unchanged. Tall phones continue until the pupil
  // covers the farthest corner instead of fading an unzoomed eye out.
  const target=Math.max(17,1.6*Math.hypot(1,aspect)/.142*1.12);
  return 1+Math.pow(clamp(p),2.5)*(target-1);
}
export function phaseAt(t) {
  if(t<7)return "eye";
  if(t<12)return "zoom";
  if(t<18)return "space";
  if(t<21)return "space-pulse";
  if(t<26)return "pulse";
  if(t<30)return "pulse-heart";
  if(t<39)return "heart";
  return "words";
}

export function eyeFrame(W,H,asp,t,zoom,eyePixels) {
    const blink = blinkAmount(t);
    const gazeX=.035*Math.sin(t*.8)+.02*Math.sin(t*1.7),gazeY=.012*Math.sin(t*.63);
    const magnify=zoomMagnification(zoom,asp);
    for(let j=0;j<H;j++) for(let i=0;i<W;i++) {
      const k=(j*W+i)*4;
      const X=(i/W-.5)*3.2/magnify+gazeX*zoom,Y=(j/H-.5)*3.2*asp/magnify+(gazeY-.025)*zoom;
      const shape=Math.pow(Math.max(0,1-Math.pow(Math.abs(X)/1.31,1.7)),.72);
      const tilt=.037*X;
      const open=.10+.90*smooth(0,1.1,t),seam=.19*shape*open+tilt;
      const upper=mix(-.415*shape*open+tilt,seam,blink),lower=mix(.330*shape*open+tilt,seam,blink);
      const upperD=Y-upper,lowerD=lower-Y;
      const inEye=Math.abs(X)<1.31 && upperD>0 && lowerD>0;
      const noise=(hash(i*1.11+j*91.1)-.5)*.03;
      let r=0,g=0,b=0;
      if(inEye) {
        const x=X-gazeX,y=Y-gazeY+.025;
        const rr=Math.hypot(x,y),angle=Math.atan2(y,x),irisR=.413;
        const lidShadow=.28+.72*smooth(0,.16,upperD);
        const edgeShadow=.59+.41*smooth(0,.10,Math.min(upperD,lowerD));
        const sclera=.73*lidShadow*edgeShadow*(1-.16*Math.abs(X))+.06;
        r=sclera*.93;g=sclera*.99;b=sclera*.93;
        const vein=.014*(.5+.5*Math.sin(35*X+8*Math.sin(Y*16)))*smooth(.50,1.2,Math.abs(X));
        r+=vein;g-=vein;
        if(rr<irisR) {
          const u=rr/irisR;
          const strands=Math.sin(angle*117+Math.sin(angle*27)*2+u*14)*.12+Math.sin(angle*61-u*28)*.13+Math.sin(angle*191+u*13)*.06;
          const radial=.49+strands+.16*Math.sin(u*22+angle*12)+.065*Math.sin(angle*9);
          const rim=smooth(.91,1,u),innerGold=gauss(u-.37,.015),collarette=.12*gauss(u-.54,.003)*(.7+.3*Math.sin(angle*36));
          const value=(radial+collarette)*lidShadow*(1-rim*.8);
          r=value*(.82+innerGold*.22);g=value*(.90+innerGold*.10);b=value*(.39-innerGold*.10);
          const pupil=.153+.005*Math.sin(t*.9);
          const mask=smooth(pupil-.009,pupil+.008,rr);
          r*=mask;g*=mask;b*=mask;
          if(rr<pupil){r=.002;g=.008;b=.006;}
        }
        const reflection=.87*Math.exp(-Math.pow((x+.14)/.074,6)-Math.pow((y+.16)/.049,6));
        const reflection2=.40*gauss(x+.047,.0005)*gauss(y+.17,.001);
        const wet=.35*gauss(Y-lower+.012,.00009)*Math.max(0,1-X*X);
        r=mix(r,.88,reflection);g=mix(g,1,reflection);b=mix(b,.96,reflection);
        r+=reflection2+wet*.5;g+=reflection2+wet*.6;b+=reflection2+wet*.55;
        if(X< -1.10){const tear=gauss(X+1.21,.004)*gauss(Y-.015,.005)*.35;r+=tear;g-=tear*.13;}
      } else {
        const distance=Math.min(Math.abs(upperD),Math.abs(lowerD));
        const skinLight=.24+.24*gauss(X+.28,1.3)*gauss(Y-.20,.7);
        const orbitShadow=.33*gauss(Y+.41,.05)*gauss(X,.95);
        const crease=gauss(Y-(upper-.105),.0007)*shape*.39;
        let skin=Math.max(.025,skinLight-orbitShadow-crease+noise);
        if(Y>lower)skin+=.11*gauss(Y-lower-.068,.006)*shape;
        skin*=1-.71*gauss(distance,.00065)*shape;
        const browY=-.65+.13*Math.pow(X+.15,2);
        const brow=smooth(-.055,.055,Y-browY)*(1-smooth(.035,.135,Y-browY))*smooth(-1.3,-.90,X)*(1-smooth(.5,1.08,X));
        skin*=1-brow*.86;
        const lashes=gauss(Y-upper+.016,.0012)*shape*(.6+.4*Math.sin(X*89+Y*21));
        skin*=1-.83*lashes;
        const vignette=Math.exp(-.75*Math.pow(X/1.6,4)-.85*Math.pow(Y/.91,4));
        skin*=vignette;
        r=skin*.94;g=skin*.69;b=skin*.52;
      }
      const vign=clamp(1-.16*Math.pow(Math.hypot((i/W-.5)*1.25,(j/H-.5)*1.3),2));
      eyePixels[k]=clamp(r*vign)*255;eyePixels[k+1]=clamp(g*vign)*255;eyePixels[k+2]=clamp(b*vign)*255;eyePixels[k+3]=255;
    }

  }

