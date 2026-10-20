import {clamp,smooth,mix,hash,beats,TWO_PI} from "./model.js?v=galaxy-5";

// Attachment coordinates are the actual open vessels in the 600 × 720 heart SVG.
export const VESSEL_ROUTES=Object.freeze([
  {start:[-.04,.09],anchor:[157/600,117/720],normal:[-.22,-1],vein:true},
  {start:[.15,-.04],anchor:[157/600,117/720],normal:[-.22,-1],vein:true},
  {start:[.37,-.04],anchor:[268/600,48/720],normal:[-.18,-1]},
  {start:[.58,-.04],anchor:[317/600,28/720],normal:[0,-1]},
  {start:[.87,-.04],anchor:[365/600,51/720],normal:[.22,-1]},
  {start:[1.04,.17],anchor:[425/600,191/720],normal:[1,-.1],vein:true},
  {start:[1.04,.43],anchor:[504/600,226/720],normal:[1,.08]},
  {start:[1.04,.77],anchor:[511/600,290/720],normal:[1,.1]},
  {start:[.91,1.04],anchor:[182/600,483/720],normal:[0,1],vein:true},
  {start:[.50,1.04],anchor:[182/600,483/720],normal:[0,1],vein:true},
  {start:[.10,1.04],anchor:[182/600,483/720],normal:[-.08,1],vein:true},
  {start:[-.04,.69],anchor:[157/600,117/720],normal:[-.22,-1],vein:true},
  {start:[-.04,.36],anchor:[157/600,117/720],normal:[-.22,-1],vein:true}
]);
export function heartGeometry(W,H,t,emergence=1) {
  const pulse=beats(t),aspect=.82;
  let h=H*.72,w=h*1.65*aspect;
  if(w>W*.62){w=W*.62;h=w/(1.65*aspect);}
  w*=(1-.040*pulse)*(.76+.24*emergence);h*=1-.022*pulse;
  return {x:W*.5-w*.5,y:H*.50-h*.48,w,h,pulse};
}
export function vesselCurve(route,W,H,heart,index) {
  const end={x:heart.x+heart.w*route.anchor[0],y:heart.y+heart.h*route.anchor[1]};
  const start={x:route.start[0]*W,y:route.start[1]*H};
  const bend=(hash(index*8.3)-.5)*W*.18;
  return [start,
    {x:mix(start.x,end.x,.38)+bend,y:mix(start.y,end.y,.38)-bend/1.65},
    {x:end.x+route.normal[0]*W*.13,y:end.y+route.normal[1]*H*.14},end];
}
export function curvePoint(c,u) {
  const v=1-u;
  return {x:v*v*v*c[0].x+3*v*v*u*c[1].x+3*v*u*u*c[2].x+u*u*u*c[3].x,
    y:v*v*v*c[0].y+3*v*v*u*c[1].y+3*v*u*u*c[2].y+u*u*u*c[3].y};
}
export function vascularPulse(t,u) {return beats(t+(1-u)*.45);}
export function drawVessels(ctx,W,H,t,opacity,emergence,heart) {
  const grow=smooth(.0,.88,emergence);if(opacity<=0||grow<=0)return;
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
  for(let n=0;n<VESSEL_ROUTES.length;n++) {
    const route=VESSEL_ROUTES[n],curve=vesselCurve(route,W,H,heart,n);
    const segments=38;
    for(let i=0;i<segments*grow;i++) {
      const u=i/segments,v=Math.min((i+1)/segments,grow),p=curvePoint(curve,u),q=curvePoint(curve,v);
      const wave=vascularPulse(t,(u+v)/2),width=(.34+.67*u)*(1+heart.pulse*.14);
      ctx.globalAlpha=opacity*(.38+.37*u);
      ctx.strokeStyle=route.vein?"#273c55":"#582039";ctx.lineWidth=width*2.0;
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
      ctx.globalAlpha=opacity*(.33+wave*.59);
      ctx.strokeStyle=route.vein?"#8da5c0":"#ec8599";ctx.lineWidth=width*.58;
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    }
    // Fine tributaries join the main vessels away from the heart.
    for(let b=0;b<2;b++) {
      const join=.30+b*.24;if(grow<join)continue;
      const p=curvePoint(curve,join),side=(n+b)%2?1:-1;
      const x=p.x+side*W*(.08+hash(n*11+b)*.09),y=p.y+H*(hash(n*7+b)-.5)*.20;
      const glow=vascularPulse(t,join);
      ctx.globalAlpha=opacity*(.28+glow*.35);ctx.lineWidth=.39;
      ctx.strokeStyle=route.vein?"#6e88ab":"#d66b86";
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.bezierCurveTo(mix(x,p.x,.35),mix(y,p.y,.65),p.x+side*W*.025,p.y-H*.012,p.x,p.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}
