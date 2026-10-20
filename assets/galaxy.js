import {clamp,smooth,mix,hash,gauss,TWO_PI} from "./model.js?v=eye-4";

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
export function galaxySample(x,y) {
  const along=x*.66-y*.75;
  const across=x*.75+y*.66+.10*(noise2(along*2.8,9.2)-.5);
  const warp=noise2(x*4+1,y*4-8);
  const cloud=fbm(x*4+warp,y*4-warp);
  const knots=fbm(x*10-7,y*10+4);
  const haze=gauss(across,.16),plane=gauss(across,.016);
  const bulge=gauss(along+.06,.36);
  const lane=across+.032*Math.sin(along*11)+.037*(knots-.5);
  const dust=gauss(lane,.0015)*(.48+.48*noise2(along*19,3.8));
  const split=gauss(across-.092-.023*Math.sin(along*8),.00048)*.22;
  const texture=.38+cloud*1.42+knots*.20;
  const light=Math.max(0,(haze*.043+plane*(.16+.42*bulge))*texture*(1-dust*.93-split));
  const blue=haze*(1-plane)*(.010+.014*cloud);
  return [clamp(.003+light*(1.08+bulge*.10)),
    clamp(.004+light*(.85+bulge*.12)+blue*.52),
    clamp(.010+light*(.73+bulge*.08)+blue)];
}

export function createGalaxy(doc) {
  const field=doc.createElement("canvas"),fc=field.getContext("2d");
  let W=1,H=1;
  const near=Array.from({length:270},(_,i)=>({
    x:hash(i*8.3)*2-1,y:hash(i*9.7+83)*2-1,
    depth:.24+hash(i*3.1+4)*.76,size:hash(i*7.3+15),phase:hash(i+5)*TWO_PI
  }));
  function resize(w,h) {
    W=w;H=h;field.width=Math.ceil(W*1.24);field.height=Math.ceil(H*1.24);
    const fw=field.width,fh=field.height,data=fc.createImageData(fw,fh);
    for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
      const u=(x/fw-.5)*2.48,v=(y/fh-.5)*2.48,k=(y*fw+x)*4;
      const rgb=galaxySample(u,v);
      for(let c=0;c<3;c++)data.data[k+c]=Math.round(rgb[c]*255);
      data.data[k+3]=255;
    }
    fc.putImageData(data,0,0);
    for(let i=0;i<11500;i++) {
      const u=hash(i*6.31),v=hash(i*11.7+4);
      const distance=(u-.5)*1.5+(v-.5)*1.32;
      const density=.085+.78*gauss(distance,.035);
      if(hash(i*1.71+98)>density)continue;
      const brightness=.12+Math.pow(hash(i*7.91),3)*.72;
      const x=u*fw,y=v*fh,size=.15+hash(i*4.7)*.40;
      fc.fillStyle=i%9?"rgba(246,229,201,"+brightness+")":"rgba(192,211,249,"+brightness+")";
      fc.fillRect(x,y,size,size*.76);
    }
  }
  function draw(ctx,t,opacity=1) {
    if(opacity<=0)return;
    ctx.save();ctx.globalAlpha=opacity;
    const approach=1+t*.0035,drift=Math.sin(t*.065)*W*.012;
    ctx.translate(W/2+drift,H/2);ctx.scale(1,1/1.65);ctx.rotate(.018*Math.sin(t*.08));
    ctx.scale(approach,approach);
    ctx.drawImage(field,-W*.62,-H*.62*1.65,W*1.24,H*1.24*1.65);
    ctx.restore();
    ctx.save();
    for(let i=0;i<near.length;i++) {
      const s=near[i],flight=1+t*.010/s.depth;
      const x=W/2+s.x*W*.66*flight,y=H/2+s.y*H*.69*flight;
      const xx=((x%W)+W)%W,yy=((y%H)+H)%H;
      const twinkle=.64+.36*Math.sin(t*(.67+s.depth)+s.phase);
      ctx.globalAlpha=opacity*(.22+s.size*.76)*twinkle;
      ctx.fillStyle=i%7?"#efe8db":"#b9d2ef";
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
