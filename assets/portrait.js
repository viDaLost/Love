import {clamp,smooth,mix,hash,blinkAmount} from "./model.js?v=portrait-3";

export const PORTRAIT={width:600,height:900,leftEye:[237,338,56],pupil:[5.9,7.3]};
export function poseAt(t) {
  return {
    yaw:mix(-.67,0,smooth(.8,3.3,t)),
    roll:mix(-.035,-.015,smooth(.8,3.3,t)),
    smile:smooth(3.15,4.85,t),
    gaze:1-smooth(1.2,3.25,t),
    opening:1-blinkAmount(t)
  };
}
export function projectPoint(x,y,z,pose) {
  const dx=x-300,dy=y-350;
  const xx=dx*Math.cos(pose.yaw)+z*Math.sin(pose.yaw);
  const zz=-dx*Math.sin(pose.yaw)+z*Math.cos(pose.yaw);
  const scale=760/(760-zz);
  const a=xx*scale,b=dy*scale,c=Math.cos(pose.roll),s=Math.sin(pose.roll);
  return {x:300+a*c-b*s,y:350+a*s+b*c,scale};
}
export function portraitFrame(W,H,t,portal=0) {
  const pose=poseAt(t),eye=projectPoint(...PORTRAIT.leftEye,pose);
  const fit=Math.min(W/600,H*1.65/900)*.98;
  const approach=smooth(6.2,9.5,t);
  const close=6.8;
  const rx=PORTRAIT.pupil[0]*eye.scale*fit,ry=PORTRAIT.pupil[1]*eye.scale*fit/1.65;
  const cover=Math.max(close*8,Math.hypot(W/(2*rx),H/(2*ry))*1.20);
  const zoom=portal>0?close*Math.pow(cover/close,smooth(0,1,portal)):mix(1,close,approach);
  const focusX=mix(300,eye.x,approach),focusY=mix(450,eye.y,approach);
  return {pose,fit,zoom,focusX,focusY,
    pupilX:W/2+(eye.x-focusX)*fit*zoom,
    pupilY:H/2+(eye.y-focusY)*fit*zoom/1.65,
    radiusX:rx*zoom,radiusY:ry*zoom};
}

// A projected vector portrait: the landmarks, colouring, freckles, centre
// part and softly arched brows are drawn from the supplied photo references.
export function drawPortrait(ctx,W,H,t,portal=0) {
  const frame=portraitFrame(W,H,t,portal),pose=frame.pose,smile=pose.smile;
  ctx.save();
  ctx.translate(W/2,H/2);ctx.scale(frame.fit*frame.zoom,frame.fit*frame.zoom/1.65);
  ctx.translate(-frame.focusX,-frame.focusY);
  const cyaw=Math.cos(pose.yaw),syaw=Math.sin(pose.yaw),cr=Math.cos(pose.roll),sr=Math.sin(pose.roll);
  const P=(x,y,z=0)=>{
    const dx=x-300,dy=y-350,scale=760/(760+dx*syaw-z*cyaw);
    const a=(dx*cyaw+z*syaw)*scale,b=dy*scale;
    return {x:300+a*cr-b*sr,y:350+a*sr+b*cr};
  };
  function trace(segments) {
    ctx.beginPath();
    for(const s of segments) {
      if(s[0]==="Z"){ctx.closePath();continue;}
      const points=[];
      for(let i=1;i<s.length;i+=3){const p=P(s[i],s[i+1],s[i+2]);points.push(p.x,p.y);}
      if(s[0]==="M")ctx.moveTo(...points);
      if(s[0]==="L")ctx.lineTo(...points);
      if(s[0]==="C")ctx.bezierCurveTo(...points);
      if(s[0]==="Q")ctx.quadraticCurveTo(...points);
    }
  }
  function shape(segments,fill,stroke=null,line=1) {
    trace(segments);
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
  }
  function ellipse(x,y,z,rx,ry,fill,stroke=null,line=1) {
    ctx.beginPath();
    const steps=Math.max(rx,ry)<4?8:32;
    for(let i=0;i<=steps;i++){
      const a=i/steps*Math.PI*2,p=P(x+Math.cos(a)*rx,y+Math.sin(a)*ry,z);
      i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);
    }
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
  }
  function gradient(x,y,z,r,stops) {
    const p=P(x,y,z),g=ctx.createRadialGradient(p.x,p.y,r*.04,p.x,p.y,r);
    for(const [at,color] of stops)g.addColorStop(at,color);
    return g;
  }
  const hair=gradient(225,250,-30,500,[[0,"#9b754d"],[.25,"#725135"],[.58,"#3a2c20"],[1,"#151a16"]]);
  const skin=gradient(253+pose.yaw*26,316,35,330,[[0,"#f5d3b1"],[.32,"#e9bb96"],[.69,"#be8d6d"],[1,"#624a3a"]]);
  const neck=gradient(287,608,0,210,[[0,"#ddb18a"],[.55,"#b38460"],[1,"#5b4635"]]);
  const face=[
    ["M",300,152,0],["C",367,149,0,413,180,0,437,242,0],
    ["C",454,292,0,455,370,0,445,427,5],
    ["C",433,491,8,392,542,12,348,565,15],
    ["C",319,583,14,283,581,14,252,564,13],
    ["C",204,539,8,174,494,4,160,434,0],
    ["C",148,378,-2,151,293,-4,171,239,-3],
    ["C",194,184,-2,241,153,0,300,152,0],["Z"]
  ];

  // Shoulders, neck and back hair stay behind the moving face.
  if(frame.zoom<5) {
    shape([["M",190,616,-30],["C",107,645,-40,52,730,-40,21,900,-40],
      ["L",580,900,-40],["C",550,743,-40,481,659,-35,410,620,-30],
      ["L",190,616,-30],["Z"]],"#202726");
    shape([["M",227,497,-10],["L",220,654,-10],
      ["C",232,699,0,281,742,0,309,746,0],
      ["C",358,715,0,387,674,-4,389,632,-10],["L",375,492,-10],["Z"]],neck);
    shape([["M",164,223,-35],["C",154,133,-45,226,81,-45,301,91,-43],
      ["C",382,79,-45,441,135,-35,462,214,-35],
      ["C",491,313,-35,479,427,-35,489,548,-40],
      ["C",503,676,-40,547,796,-45,557,900,-45],["L",420,900,-40],
      ["C",401,786,-30,405,661,-30,434,523,-25],
      ["L",183,518,-25],["C",210,662,-30,192,796,-35,181,900,-35],
      ["L",63,900,-40],["C",76,746,-40,113,630,-35,119,491,-35],
      ["C",126,374,-30,135,279,-30,164,223,-35],["Z"]],hair);
    for(let i=0;i<105;i++) {
      const side=i%2?1:-1,seed=hash(i*3.71),x=300+side*(122+seed*58);
      ctx.globalAlpha=.10+hash(i*6.11)*.14;
      shape([["M",x,150+seed*85,-28],
        ["C",x+side*46,350,-25,x+side*24,653,-30,x+side*(30+seed*34),895,-36]],
        null,i%4?"#bc9868":"#31251b",.7+seed*.8);
    }
    ctx.globalAlpha=1;
    // Fine highlights along the black shirt collar.
    shape([["M",220,657,-8],["Q",300,769,-4,391,635,-8]],null,"#4c5148",3.2);
  }

  // Ears are partly screened by the hair and the cheeks.
  ellipse(153,368,-11,24,52,"#b78566");
  ellipse(450,367,-11,24,51,"#cc9c77");
  shape([["M",453,337,-8],["Q",475,360,-8,453,393,-8]],null,"#9c7058",3);
  shape(face,skin);
  ctx.save();trace(face);ctx.clip();
  ellipse(192,393,16,66,142,gradient(180,391,15,150,[[0,"#79544188"],[1,"#79544100"]]));
  ellipse(397,403,18,68,149,gradient(425,390,12,150,[[0,"#81544288"],[1,"#81544200"]]));
  ellipse(225,399-smile*8,39,63,57,gradient(225,399,39,71,[[0,"#d58a7844"],[1,"#d58a7800"]]));
  ellipse(377,397-smile*8,38,63,57,gradient(377,397,38,71,[[0,"#d58a7844"],[1,"#d58a7800"]]));
  // Under-chin and cheek planes give the jaw an oval, softly tapered shape.
  shape([["M",175,459,5],["C",224,536,22,284,557,25,346,549,20],
    ["C",388,540,10,418,510,6,436,470,4],["L",450,592,0],["L",157,596,0],["Z"]],
    gradient(302,579,10,150,[[0,"#62463799"],[1,"#62463700"]]));
  for(let i=0;i<(frame.zoom>6?0:frame.zoom<2?110:170);i++) {
    const x=198+hash(i*4.17)*209,y=368+hash(i*7.31)*112;
    const acrossNose=Math.abs(x-302)<32&&y<418;
    if(!acrossNose&&Math.abs(x-300)<33)continue;
    const z=acrossNose?60:34;
    ctx.globalAlpha=.13+hash(i*2.31)*.19;
    ellipse(x,y,z,.7+hash(i*11.3)*1.2,.55+hash(i*5.9)*.7,"#895e43");
  }
  ctx.globalAlpha=1;ellipse(219,468,25,1.7,1.35,"#81563f88");
  ctx.restore();

  // Nose: bridge, alae and a softly lit rounded tip, projected in depth.
  if(frame.zoom<6) {
  shape([["M",288,328,44],["C",278,359,54,278,383,70,278,405,77],
    ["C",280,424,84,290,433,85,305,432,85],
    ["C",319,435,81,333,426,76,333,413,74],
    ["C",328,398,71,323,390,65,320,369,53],
    ["L",312,327,43],["Z"]],gradient(292,381,63,73,[[0,"#f3d0ab"],[.62,"#d8a880"],[1,"#ac795a"]]));
  ellipse(303,413,85,23,17,gradient(299,407,85,29,[[0,"#f2c9a3"],[.55,"#d8a582"],[1,"#ac765a"]]));
  ellipse(284,422,80,9,4.5,"#77513b");
  ellipse(321,421,79,9,4.2,"#7c533e");
  shape([["M",290,436,73],["Q",304,443,71,318,433,73]],null,"#c09274",1.5);
  shape([["M",296,346,54],["Q",290,374,68,293,395,79]],null,"#f6d9bb88",4);
  }

  function eye(side) {
    const left=side<0,cx=left?237:368,cy=left?338:337,z=53;
    const a=left?[202,339,z]:[334,337,z],b=left?[272,335,z]:[402,338,z];
    const closedY=cy+10-smile*2;
    const upper1=[cx-17,mix(closedY,cy-18,pose.opening),z];
    const upper2=[cx+17,mix(closedY-2,cy-21,pose.opening),z];
    const lower2=[cx+17,mix(closedY-2,cy+15-smile*4,pose.opening),z];
    const lower1=[cx-17,mix(closedY,cy+18-smile*4,pose.opening),z];
    const outline=[["M",...a],["C",...upper1,...upper2,...b],
      ["C",...lower2,...lower1,...a],["Z"]];
    const white=gradient(cx-5,cy-8,z,49,[[0,"#ece8d3"],[.60,"#dbd5bd"],[1,"#8a7c68"]]);
    ctx.save();trace(outline);ctx.clip();shape(outline,white);
    const ix=cx-pose.gaze*4,iy=cy+pose.gaze*.6;
    ellipse(ix,iy,z+1,15.3,18.3,gradient(ix-4,iy-4,z+1,20,
      [[0,"#b8a363"],[.38,"#8d9457"],[.72,"#667b43"],[1,"#253d29"]]),"#35452e",1.2);
    const fibres=frame.zoom<2?28:84;
    for(let i=0;i<fibres;i++) {
      const ang=i/fibres*Math.PI*2+.03*Math.sin(i*3),inner=6+hash(i*4.1)*2.8;
      const end=15+hash(i*8.1)*2.5;
      ctx.globalAlpha=.24+hash(i*7.2)*.24;
      shape([["M",ix+Math.cos(ang)*inner,iy+Math.sin(ang)*inner*1.17,z+2],
        ["Q",ix+Math.cos(ang+.045)*(inner+5),iy+Math.sin(ang+.045)*(inner+5)*1.17,z+2,
          ix+Math.cos(ang)*end,iy+Math.sin(ang)*end*1.17,z+2]],
        null,i%3?"#354e2c":"#d2ba77",.65);
    }
    ctx.globalAlpha=1;
    ellipse(ix,iy,z+3,5.9,7.3,"#0b1411");
    ellipse(ix-4.8,iy-6.2,z+4,3.1,2.25,"#faf3df");
    ellipse(ix+4.8,iy+6.1,z+4,1.1,1.0,"#dddac0");
    ctx.restore();
    // The upper crease, rim and separate, tapered lashes move with the lid.
    shape([["M",a[0],a[1]-7,z],["C",upper1[0],upper1[1]-9,z,
      upper2[0],upper2[1]-9,z,b[0],b[1]-6,z]],null,"#b18569",1.6);
    shape([["M",...a],["C",...upper1,...upper2,...b]],null,"#624a37",2.0);
    shape([["M",...a],["C",...lower1,...lower2,...b]],null,"#b4866b",1.1);
    for(let i=0;i<17;i++) {
      const u=i/16,om=1-u;
      const x=om*om*om*a[0]+3*om*om*u*upper1[0]+3*om*u*u*upper2[0]+u*u*u*b[0];
      const y=om*om*om*a[1]+3*om*om*u*upper1[1]+3*om*u*u*upper2[1]+u*u*u*b[1];
      const len=5+hash(i*3.6+side)*4.5+Math.abs(u-.5)*6;
      shape([["M",x,y,z+1],["Q",x+(u-.5)*len*.4,y-len*.8,z+1,
        x+(u-.5)*len*.95,y-len,z+1]],null,"#54412f",.85);
    }
  }
  eye(-1);if(frame.zoom<5)eye(1);

  function brow(side) {
    const cx=side<0?237:369;
    shape([["M",cx-41,304,40],["C",cx-20,286,42,cx+7,286,42,cx+35,300,40],
      ["C",cx+7,293,42,cx-17,297,42,cx-40,311,40],["Z"]],"#796144");
    for(let i=0;i<31;i++) {
      const u=i/30,x=cx-39+u*74,y=303-Math.sin(u*Math.PI)*11;
      ctx.globalAlpha=.25+hash(i*4.2)*.35;
      shape([["M",x,y+4,41],["Q",x+2,y-3,41,x+4,y-5,41]],null,"#5c4c36",.65);
    }
    ctx.globalAlpha=1;
  }
  brow(-1);if(frame.zoom<5)brow(1);

  if(frame.zoom<5) {
  // Full rosy lips; the corners lift, the lower lids and cheeks follow.
  const mouthW=mix(47,61,smile),cornerY=mix(478,466,smile),cx=304;
  const top=467-smile*1.2,lower=496-smile*2;
  shape([["M",cx-mouthW,cornerY,64],
    ["C",cx-24,top+3,69,cx-13,top-8,70,cx,top-2,72],
    ["C",cx+13,top-9,70,cx+27,top+4,68,cx+mouthW,cornerY,64],
    ["C",cx+26,482-smile*2,72,cx-24,484-smile*2,72,cx-mouthW,cornerY,64],["Z"]],
    gradient(cx-5,473,70,75,[[0,"#d38e88"],[.55,"#b96e6c"],[1,"#87514e"]]));
  shape([["M",cx-mouthW,cornerY,64],
    ["C",cx-23,484-smile*1.5,73,cx+24,484-smile*1.5,73,cx+mouthW,cornerY,64],
    ["C",cx+30,lower+1,70,cx-24,lower+4,71,cx-mouthW,cornerY,64],["Z"]],
    gradient(cx,486,73,65,[[0,"#e8aaa1"],[.5,"#ce8c84"],[1,"#925b54"]]));
  shape([["M",cx-mouthW,cornerY,65],
    ["C",cx-24,481-smile,75,cx+23,482-smile,75,cx+mouthW,cornerY,65]],null,"#804b46",1.4);
  if(smile>.1) {
    ctx.globalAlpha=smile*.52;
    shape([["M",cx-30,477,74],["Q",cx,482,76,cx+30,477,74]],null,"#f5dfc7",2.0);
    ctx.globalAlpha=1;
  }
  shape([["M",cx-20,487,74],["Q",cx+2,492,75,cx+20,486,74]],null,"#f4c5b5aa",1.5);
  ellipse(303,516,45,42,23,gradient(303,516,45,49,[[0,"#f1c6a155"],[1,"#f1c6a100"]]));

  // The centre part and the two front locks frame the oval face.
  const frontHair=gradient(232,196,-6,350,[[0,"#b18b5c"],[.30,"#80603d"],[.72,"#463426"],[1,"#201e17"]]);
  shape([["M",300,134,-6],["C",264,154,9,229,176,7,202,223,6],
    ["C",173,278,8,165,366,7,176,446,7],
    ["C",185,510,7,203,548,5,201,598,-4],
    ["C",173,548,-3,145,493,-4,143,412,-5],
    ["C",139,302,-7,150,222,-8,184,164,-10],
    ["C",211,118,-12,259,102,-11,300,134,-6],["Z"]],frontHair);
  shape([["M",302,134,-6],["C",341,136,5,392,172,7,423,228,7],
    ["C",450,286,8,451,372,7,442,447,6],
    ["C",436,512,4,432,557,-3,444,611,-9],
    ["C",473,552,-5,481,494,-7,483,419,-8],
    ["C",488,302,-10,465,206,-12,422,159,-14],
    ["C",384,119,-15,338,100,-13,302,134,-6],["Z"]],frontHair);
  for(let i=0;i<72;i++) {
    const side=i%2?1:-1,u=hash(i*2.17),x=300+side*(10+u*59);
    ctx.globalAlpha=.11+hash(i*9.1)*.15;
    shape([["M",x,133+u*5,-3],
      ["C",x+side*74,179+u*25,7,x+side*108,287+u*70,9,x+side*(110+u*17),474+u*75,4]],
      null,i%4?"#d0ab78":"#382c20",.6+u*.7);
  }
  ctx.globalAlpha=1;
  shape([["M",300,134,-3],["Q",289,147,6,279,155,7]],null,"#d2b18a",2.1);
  }
  ctx.restore();
  return frame;
}
