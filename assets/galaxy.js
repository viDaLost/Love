import {clamp,smooth,mix,hash,gauss,TWO_PI} from "./model.js?v=galaxy-5";

export function noise2(x,y) {
  const i=Math.floor(x),j=Math.floor(y),u=smooth(0,1,x-i),v=smooth(0,1,y-j);
  return mix(mix(hash(i+j*157),hash(i+1+j*157),u),
    mix(hash(i+(j+1)*157),hash(i+1+(j+1)*157),u),v);
}
function fbm(x,y) {
  let value=0,amp=.53;
  for(let n=0;n<5;n++){value+=amp*noise2(x,y);x=x*2.03+13.4;y=y*2.01-7.7;amp*=.48;}
  return value;
}
export function spiralDensity(x,y) {
  const radius=Math.hypot(x,y);
  const phase=Math.atan2(y,x)-2.55*Math.log(radius+.12);
  const major=Math.pow(.5+.5*Math.cos(phase*2),9);
  const minor=Math.pow(.5+.5*Math.cos(phase*2+Math.PI),15)*.58;
  return (major+minor)*smooth(.10,.26,radius)*(1-smooth(.82,1.18,radius))*Math.exp(-radius*.48);
}
export function galaxySample(x,y) {
  const radius=Math.hypot(x,y),angle=Math.atan2(y,x);
  const phase=angle-2.55*Math.log(radius+.12);
  const warp=noise2(x*4+1,y*4-8);
  const cloud=fbm(x*8+warp,y*8-warp),knots=fbm(x*19-7,y*19+4);
  const arms=spiralDensity(x,y);
  const window=smooth(.13,.28,radius)*(1-smooth(.83,1.16,radius));
  const lane=Math.pow(.5+.5*Math.cos((phase-.16)*2),23);
  const dust=lane*window*(.42+.34*noise2(x*15,y*15));
  const bar=gauss(x,.058)*gauss(y,.0037);
  const core=gauss(radius,.024),halo=gauss(radius,.15);
  const coreLight=.69*core+.14*bar+.035*halo;
  const disc=.038*Math.exp(-radius*3.1)*(1-smooth(.91,1.25,radius));
  const starlight=.47*arms*(.50+cloud*1.04+knots*.25)*(1-dust*.83);
  const nebula=.075*Math.pow(knots,2)*arms;
  return [
    clamp(.002+coreLight*1.06+disc*.85+starlight*.63+nebula*.70),
    clamp(.004+coreLight*.88+disc*.92+starlight*.82+nebula*.28),
    clamp(.010+coreLight*.61+disc*1.18+starlight*1.16+nebula)
  ];
}
export function createGalaxy(doc) {
  const field=doc.createElement("canvas"),fc=field.getContext("2d");
  let W=1,H=1;
  const near=Array.from({length:270},(_,i)=>({
    x:hash(i*8.3)*2-1,y:hash(i*9.7+83)*2-1,
    depth:.24+hash(i*3.1+4)*.76,size:hash(i*7.3+15),phase:hash(i+5)*TWO_PI
  }));
  function resize(w,h) {
    W=w;H=h;field.width=Math.ceil(W*1.35);field.height=Math.ceil(H*1.35);
    const fw=field.width,fh=field.height,R=Math.min(W,H*1.65)*.39;
    const data=fc.createImageData(fw,fh);
    // Physical coordinates compensate for the taller symbol cells: the
    // galaxy remains a face-on disc in both phone and desktop orientations.
    for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
      const u=(x-fw/2)/R,v=(y-fh/2)*1.65/R,k=(y*fw+x)*4;
      const rgb=galaxySample(u,v);
      for(let c=0;c<3;c++)data.data[k+c]=Math.round(rgb[c]*255);
      data.data[k+3]=255;
    }
    fc.putImageData(data,0,0);
    for(let i=0;i<14500;i++) {
      const x=hash(i*6.31)*fw,y=hash(i*11.7+4)*fh;
      const u=(x-fw/2)/R,v=(y-fh/2)*1.65/R,r=Math.hypot(u,v);
      const density=.038+.13*gauss(r,.40)+.69*spiralDensity(u,v)+.72*gauss(r,.028);
      if(hash(i*1.71+98)>density)continue;
      const brightness=.16+Math.pow(hash(i*7.91),3)*.72;
      const size=.16+hash(i*4.7)*.45;
      fc.fillStyle=r<.26?"rgba(255,224,172,"+brightness+")":
        i%5?"rgba(204,224,255,"+brightness+")":"rgba(235,201,241,"+brightness+")";
      fc.fillRect(x,y,size,size*.76);
    }
  }
  function draw(ctx,t,opacity=1) {
    if(opacity<=0)return;
    ctx.save();ctx.globalAlpha=opacity;
    const approach=1+t*.004,drift=Math.sin(t*.065)*W*.009;
    ctx.translate(W/2+drift,H/2);ctx.scale(1,1/1.65);
    ctx.rotate(.12+t*.025);ctx.scale(approach,approach);
    ctx.drawImage(field,-field.width/2,-field.height/2*1.65,field.width,field.height*1.65);
    ctx.restore();
    ctx.save();
    for(let i=0;i<near.length;i++) {
      const s=near[i],flight=1+t*.010/s.depth;
      const x=W/2+s.x*W*.66*flight,y=H/2+s.y*H*.69*flight;
      const xx=((x%W)+W)%W,yy=((y%H)+H)%H;
      const twinkle=.64+.36*Math.sin(t*(.67+s.depth)+s.phase);
      ctx.globalAlpha=opacity*(.22+s.size*.76)*twinkle;
      ctx.fillStyle=i%7?"#f6edde":"#c4dcff";
      ctx.fillRect(xx,yy,s.size>.95?.9:.42,s.size>.95?.65:.35);
      if(s.size>.98) {
        ctx.globalAlpha*=.45;
        ctx.fillRect(xx-1.2,yy,2.8,.16);ctx.fillRect(xx+.2,yy-.75,.18,1.8);
      }
    }
    ctx.restore();
  }
  return {resize,draw};
}
