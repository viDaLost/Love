import {
  DURATION,TWO_PI,WORDS,WORD_TIMES,HEART_TIMES,clamp,smooth,mix,gauss,fract,hash,beats,ecg,loopBlend,
  blinkAmount,zoomMagnification,eyeFrame
} from "./model.js?v=eye-4";
import {createGalaxy} from "./galaxy.js?v=eye-4";
import {heartGeometry,drawVessels} from "./vessels.js?v=eye-4";
import {createSoundtrack} from "./sound.js?v=eye-4";

// Original eye and symbol pipeline, with a layered galactic sky and vascular heart.
export function startAnimation(canvas, announcement) {
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx)throw new Error("Canvas 2D is unavailable");
  const raw=document.createElement("canvas"),rc=raw.getContext("2d",{willReadFrequently:true});
  const base=document.createElement("canvas"),bc=base.getContext("2d",{willReadFrequently:true});
  const galaxy=createGalaxy(document),sound=createSoundtrack(window);
  const atlas=document.createElement("canvas"),ac=atlas.getContext("2d");
  const chars=" .,:;i!lI+trcxvXYUVZJQ0O8B#W@";
  const hues=[[.91,.66,.48],[.38,1,.59],[.88,.97,1],[1,.29,.30],[.26,.59,.90],[.95,.79,.40],[1,.44,.64],[.47,.77,.25],[.30,.84,.73],[.65,.70,.34],[.98,.82,.70]];
  const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const state={time:motion.matches?52:0,playing:!motion.matches,speed:1,cols:170,rows:92,w:1000,h:550,frames:0};
  let imageData,eyePixels,lastFrame=0,lastTick=0,slowFrames=0,resizeTimer,raf=0,disposed=false,announced=-1;
  let wordLayers=[],wordPoints=[];

const heartSVG="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"720\" viewBox=\"0 0 600 720\">\n  <defs>\n    <radialGradient id=\"lv\" cx=\"35%\" cy=\"30%\" r=\"80%\"><stop stop-color=\"#f28f82\"/><stop offset=\".27\" stop-color=\"#cb4e50\"/><stop offset=\".62\" stop-color=\"#902a40\"/><stop offset=\"1\" stop-color=\"#260f23\"/></radialGradient>\n    <radialGradient id=\"rv\" cx=\"37%\" cy=\"30%\" r=\"80%\"><stop stop-color=\"#e17d70\"/><stop offset=\".4\" stop-color=\"#ae3f50\"/><stop offset=\"1\" stop-color=\"#49142d\"/></radialGradient>\n    <radialGradient id=\"atrium\" cx=\"25%\" cy=\"25%\" r=\"85%\"><stop stop-color=\"#c66f70\"/><stop offset=\".5\" stop-color=\"#8e3b55\"/><stop offset=\"1\" stop-color=\"#38152e\"/></radialGradient>\n    <linearGradient id=\"artery\"><stop stop-color=\"#69263e\"/><stop offset=\".26\" stop-color=\"#e89383\"/><stop offset=\".55\" stop-color=\"#e07572\"/><stop offset=\"1\" stop-color=\"#751f35\"/></linearGradient>\n    <linearGradient id=\"vein\"><stop stop-color=\"#193c51\"/><stop offset=\".27\" stop-color=\"#67a7ba\"/><stop offset=\".55\" stop-color=\"#487b99\"/><stop offset=\"1\" stop-color=\"#1e304e\"/></linearGradient>\n    <linearGradient id=\"trunk\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\".3\"><stop stop-color=\"#2c455f\"/><stop offset=\".35\" stop-color=\"#7aaebc\"/><stop offset=\".7\" stop-color=\"#406c8c\"/><stop offset=\"1\" stop-color=\"#152e4b\"/></linearGradient>\n    <linearGradient id=\"coronary\"><stop stop-color=\"#8e253d\"/><stop offset=\".35\" stop-color=\"#efb28d\"/><stop offset=\".6\" stop-color=\"#cb745f\"/><stop offset=\"1\" stop-color=\"#5a172a\"/></linearGradient>\n    <filter id=\"blur\"><feGaussianBlur stdDeviation=\"2\"/></filter>\n  </defs>\n  <g stroke-linejoin=\"round\" stroke-linecap=\"round\">\n    <!-- Posterior pulmonary veins and the descending aorta. -->\n    <path d=\"M350 244Q446 194 501 210L510 241Q449 228 378 279Z\" fill=\"url(#artery)\" stroke=\"#421c30\" stroke-width=\"3\"/>\n    <path d=\"M378 283Q453 250 513 273L509 307Q458 284 397 322Z\" fill=\"url(#artery)\" stroke=\"#421c30\" stroke-width=\"3\"/>\n    <ellipse cx=\"504\" cy=\"226\" rx=\"9\" ry=\"15\" fill=\"#581d31\" transform=\"rotate(-15 504 226)\"/>\n    <ellipse cx=\"511\" cy=\"290\" rx=\"9\" ry=\"15\" fill=\"#581d31\"/>\n    <path d=\"M335 168Q410 186 396 323L362 371 330 308Z\" fill=\"#742b44\"/>\n    <!-- Superior and inferior vena cava into the right atrium. -->\n    <path d=\"M157 286Q159 206 135 124L181 110Q210 186 210 281Z\" fill=\"url(#vein)\" stroke=\"#182b3c\" stroke-width=\"3\"/>\n    <ellipse cx=\"157\" cy=\"117\" rx=\"24\" ry=\"10\" transform=\"rotate(-14 157 117)\" fill=\"#131f31\" stroke=\"#74a5b2\" stroke-width=\"4\"/>\n    <path d=\"M153 411L158 487 204 483 205 399Z\" fill=\"url(#vein)\"/>\n    <!-- Aortic arch and its three upper branches. -->\n    <path d=\"M265 247C238 214 231 145 253 106C277 61 341 73 364 113C380 140 381 179 370 218L337 213C350 175 347 140 331 123C318 108 298 109 289 125C276 148 285 188 300 219Z\" fill=\"url(#artery)\" stroke=\"#62243a\" stroke-width=\"4\"/>\n    <path d=\"M273 103L258 50Q261 40 278 43L299 91Z\" fill=\"url(#artery)\" stroke=\"#6e2b3e\" stroke-width=\"3\"/>\n    <path d=\"M307 86L305 30Q315 22 329 30L332 91Z\" fill=\"url(#artery)\" stroke=\"#6e2b3e\" stroke-width=\"3\"/>\n    <path d=\"M340 105L353 50Q365 44 377 54L366 127Z\" fill=\"url(#artery)\" stroke=\"#6e2b3e\" stroke-width=\"3\"/>\n    <ellipse cx=\"268\" cy=\"48\" rx=\"11\" ry=\"5\" fill=\"#55172d\" stroke=\"#dc9281\" stroke-width=\"2\" transform=\"rotate(-10 268 48)\"/>\n    <ellipse cx=\"317\" cy=\"28\" rx=\"11\" ry=\"4\" fill=\"#55172d\" stroke=\"#dc9281\" stroke-width=\"2\"/>\n    <ellipse cx=\"365\" cy=\"51\" rx=\"11\" ry=\"5\" fill=\"#55172d\" stroke=\"#dc9281\" stroke-width=\"2\" transform=\"rotate(12 365 51)\"/>\n    <path d=\"M266 167Q259 123 278 107\" fill=\"none\" stroke=\"#ffb09a\" stroke-opacity=\".55\" stroke-width=\"6\"/>\n    <!-- Atria. -->\n    <path d=\"M195 242C155 231 115 266 112 314C106 358 115 408 153 436C170 448 199 432 215 409L244 290Z\" fill=\"url(#atrium)\" stroke=\"#4b2237\" stroke-width=\"3\"/>\n    <path d=\"M338 226C388 201 432 232 444 271C450 307 432 340 407 355L324 289Z\" fill=\"url(#atrium)\" stroke=\"#492138\" stroke-width=\"3\"/>\n    <!-- Ventricular silhouette: broad base, tapered left-ventricular apex. -->\n    <path d=\"M182 307C209 270 259 257 306 269C335 249 388 261 420 292C465 334 478 407 455 474C432 544 381 594 342 637C327 654 306 652 290 638C249 602 189 565 158 510C128 457 131 368 182 307Z\" fill=\"url(#lv)\" stroke=\"#511d30\" stroke-width=\"4\"/>\n    <path d=\"M185 307C218 283 271 280 305 295C277 337 285 382 305 430C319 471 315 532 339 626C278 591 217 553 181 501C146 452 141 360 185 307Z\" fill=\"url(#rv)\"/>\n    <path d=\"M324 293C287 339 306 392 325 433C342 482 325 547 343 622\" fill=\"none\" stroke=\"#561c32\" stroke-width=\"14\" opacity=\".7\"/>\n    <path d=\"M348 312C386 289 429 331 438 382C450 427 428 487 402 518\" fill=\"none\" stroke=\"#faaa8b\" stroke-width=\"16\" opacity=\".18\" filter=\"url(#blur)\"/>\n    <path d=\"M179 364C159 407 170 459 192 488\" fill=\"none\" stroke=\"#f6a18c\" stroke-width=\"14\" opacity=\".15\" filter=\"url(#blur)\"/>\n    <!-- Pulmonary trunk lies in front of the ascending aorta and bifurcates. -->\n    <path d=\"M256 305C253 277 261 235 291 204C320 179 368 174 420 172L431 211C391 214 349 215 330 235C314 255 314 279 316 300Z\" fill=\"url(#trunk)\" stroke=\"#233d53\" stroke-width=\"3\"/>\n    <path d=\"M299 210Q251 182 197 196L198 231Q251 220 279 248Z\" fill=\"url(#vein)\" stroke=\"#2b4358\" stroke-width=\"3\"/>\n    <ellipse cx=\"425\" cy=\"191\" rx=\"10\" ry=\"20\" transform=\"rotate(-16 425 191)\" fill=\"#182d44\" stroke=\"#82aab7\" stroke-width=\"3\"/>\n    <path d=\"M285 280C282 251 304 217 334 207Q365 193 398 194\" fill=\"none\" stroke=\"#a1c7c9\" stroke-opacity=\".45\" stroke-width=\"6\"/>\n    <!-- Auricles wrap the roots of the great vessels. -->\n    <path d=\"M196 254C203 230 229 224 246 239L259 271Q242 289 222 288L192 279Z\" fill=\"url(#atrium)\" stroke=\"#60283c\" stroke-width=\"3\"/>\n    <path d=\"M374 244Q418 239 427 270L403 293Q374 284 355 264Z\" fill=\"url(#atrium)\" stroke=\"#60283c\" stroke-width=\"3\"/>\n    <path d=\"M207 252L219 264 226 246 235 269 242 250M383 254L388 273 399 257 407 276\" stroke=\"#df9a8b\" stroke-opacity=\".25\" stroke-width=\"3\" fill=\"none\"/>\n    <!-- Coronary arteries and their branches along the ventricular surface. -->\n    <g fill=\"none\" stroke=\"#491929\" stroke-width=\"12\" opacity=\".8\"><path d=\"M324 294C302 332 306 377 321 418C341 470 325 529 343 613\"/><path d=\"M301 303C262 310 218 305 184 330C152 354 151 397 160 427\"/></g>\n    <g fill=\"none\" stroke=\"url(#coronary)\">\n      <path d=\"M324 290C303 330 305 377 321 418C340 470 327 529 343 616\" stroke-width=\"8\"/>\n      <path d=\"M301 301C264 309 220 304 185 330C153 355 150 397 160 427\" stroke-width=\"7\"/>\n      <path d=\"M311 357C345 352 369 365 393 390L426 416M317 395C356 395 372 418 382 444L406 461M330 451C356 455 371 482 375 511M334 507Q356 530 359 557\" stroke-width=\"5\"/>\n      <path d=\"M309 369C282 378 254 396 245 423L229 452M323 428C296 441 286 467 272 485L252 498M332 492Q310 515 302 539M192 327C203 350 213 360 211 384M166 364Q184 390 183 414L198 443M161 412Q177 438 169 462\" stroke-width=\"4\"/>\n      <path d=\"M391 389L401 366 409 359M381 444L367 454M245 422L263 432 269 446M279 476L292 484M211 383L230 396M302 540L319 550M353 528L367 533M188 421L210 426\" stroke-width=\"2.5\"/>\n    </g>\n    <g fill=\"none\" stroke=\"#638495\" opacity=\".65\"><path d=\"M333 315C321 351 327 389 340 420C358 460 345 512 358 576\" stroke-width=\"4\"/><path d=\"M338 383Q371 380 404 408M349 454Q382 469 389 490\" stroke-width=\"3\"/></g>\n    <g fill=\"none\" stroke=\"#f7b39b\" opacity=\".12\" stroke-width=\"2\"><path d=\"M351 365Q396 398 415 445M351 381Q400 427 403 473M355 416Q390 451 384 493M350 483Q370 512 369 538M203 413Q225 469 273 502M195 436Q217 492 282 529M213 489Q245 533 285 550M222 520Q256 557 297 575\"/></g>\n  </g></svg>";
  function makeAtlas() {
    atlas.width=chars.length*10; atlas.height=hues.length*16*16;
    ac.font='700 13px "Courier New",monospace';ac.textBaseline='middle';ac.textAlign='center';
    for(let h=0;h<hues.length;h++) for(let s=0;s<16;s++) {
      const v=.14+.86*(s/15), col=hues[h].map(c=>Math.round(c*v*255));
      ac.fillStyle=`rgb(${col.join(',')})`;
      for(let g=1;g<chars.length;g++) ac.fillText(chars[g],g*10+5,(h*16+s)*16+8);
    }
  }

  makeAtlas();
  const particles=Array.from({length:300},(_,i)=>({x:hash(i*1.1+4),y:hash(i*3.7+2),phase:hash(i+73),size:.25+hash(i*9.1)*.9}));
  const heart=new Image();
  const heartReady=new Promise((resolve,reject)=>{heart.onload=resolve;heart.onerror=reject;});
  heart.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(heartSVG);

  function resetGrid(cols) {
    state.cols=cols;state.rows=Math.max(1,Math.round(cols*(state.h/state.w)/1.65));
    raw.width=base.width=state.cols;raw.height=base.height=state.rows;
    imageData=rc.createImageData(state.cols,state.rows);eyePixels=imageData.data;
    galaxy.resize(state.cols,state.rows);prepareWords();
  }
  function resize() {
    const box=canvas.getBoundingClientRect();
    state.w=Math.max(1,box.width);state.h=Math.max(1,box.height);
    const dpr=Math.min(window.devicePixelRatio||1,1.7,Math.sqrt(3000000/(state.w*state.h)));
    canvas.width=Math.round(state.w*dpr);canvas.height=Math.round(state.h*dpr);
    state.targetCols=state.w<500?114:state.w<850?158:200;
    resetGrid(state.targetCols);
    ctx.imageSmoothingEnabled=true;
    render(state.time);
  }
  function drawEye(t,zoom) {
    eyeFrame(state.cols,state.rows,state.h/state.w,t,zoom,eyePixels);
    rc.putImageData(imageData,0,0);
    drawLashes(t,zoom);
  }
  function drawLashes(t,zoom) {
    const W=state.cols,H=state.rows,asp=state.h/state.w,mag=zoomMagnification(zoom,asp);
    const gx=.035*Math.sin(t*.8)+.02*Math.sin(t*1.7),gy=.012*Math.sin(t*.63);
    const open=.14+.86*smooth(0,.48,t),blink=blinkAmount(t);
    const px=X=>W*((X-gx*zoom)*mag/3.2+.5);
    const py=Y=>H*((Y-(gy-.025)*zoom)*mag/(3.2*asp)+.5);
    rc.save();rc.strokeStyle="#100c0a";rc.lineWidth=Math.max(.24,W/3.2*mag*.010);
    for(let i=0;i<25;i++) {
      const X=mix(-1.14,1.23,i/24);
      const shape=Math.pow(Math.max(0,1-Math.pow(Math.abs(X)/1.31,1.85)),.76);
      const tilt=-.045*X,seam=.16*shape*open+tilt;
      const upper=mix(-.335*shape*open+tilt,seam,blink);
      const length=(.085+.10*(X+1.31)/2.62)*(.8+hash(i+51)*.35);
      const dx=(X/1.31)*length*.63;
      rc.beginPath();rc.moveTo(px(X),py(upper));
      rc.quadraticCurveTo(px(X+dx*.35),py(upper-length*.78),px(X+dx),py(upper-length));
      rc.stroke();
    }
    rc.globalAlpha=.62;rc.lineWidth=Math.max(.18,W/3.2*mag*.006);
    for(let i=0;i<13;i++) {
      const X=mix(-1.04,1.16,i/12);
      const shape=Math.pow(Math.max(0,1-Math.pow(Math.abs(X)/1.31,1.85)),.76);
      const tilt=-.045*X,seam=.16*shape*open+tilt;
      const lower=mix(.255*shape*open+tilt,seam,blink);
      const length=.045+hash(i+91)*.032;
      rc.beginPath();rc.moveTo(px(X),py(lower));
      rc.quadraticCurveTo(px(X+X*length*.2),py(lower+length*.6),px(X+X*length*.45),py(lower+length));
      rc.stroke();
    }
    rc.restore();
  }
  function drawSpace(t,opacity=1) {
    galaxy.draw(rc,t,opacity);drawStarBursts(t,opacity);
  }

  function drawStarBursts(t,opacity) {
    const W=state.cols,H=state.rows,last=Math.floor(Math.max(0,t)/.93);
    rc.save();
    for(let n=Math.max(0,last-2);n<=last;n++) {
      const age=t-n*.93;if(age<0||age>1.8)continue;
      const x=W*(.12+hash(n*13+71)*.76),y=H*(.13+hash(n*13+72)*.74);
      const life=Math.pow(1-age/1.8,1.8);
      rc.globalAlpha=opacity*life;
      rc.fillStyle="#f2e2d8";
      rc.fillRect(x-1.1,y,2.2,.20);rc.fillRect(x,y-.66,.20,1.32);
      for(let j=0;j<10;j++) {
        const angle=j/10*TWO_PI+hash(n)*TWO_PI;
        const radius=(1-Math.exp(-age*2))*W*(.025+hash(j+n*9)*.022);
        rc.globalAlpha=opacity*life*.68;
        rc.fillStyle=j%2?"#dfafd1":"#e6d4be";
        rc.fillRect(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius/1.65,.45,.35);
      }
    }
    rc.restore();
  }

  function prepareWords() {
    const W=state.cols,H=state.rows;
    wordLayers=[];wordPoints=[];
    for(let i=0;i<WORDS.length;i++) {
      const layer=document.createElement("canvas");layer.width=W;layer.height=H;
      const c=layer.getContext("2d",{willReadFrequently:true});
      let size=Math.min(W*.245,H*.145*1.65);
      c.font="600 "+size+"px Georgia, 'Times New Roman', serif";
      const width=c.measureText(WORDS[i]).width;
      if(width>W*.86)size*=W*.86/width;
      c.save();c.translate(W/2,H*[.30,.49,.68][i]);c.scale(1,1/1.65);
      c.font="600 "+size+"px Georgia, 'Times New Roman', serif";
      c.textAlign="center";c.textBaseline="middle";c.fillStyle="#f3a8c1";c.fillText(WORDS[i],0,0);c.restore();
      const pixels=c.getImageData(0,0,W,H).data,points=[];
      for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
        const a=pixels[(y*W+x)*4+3];if(a<32)continue;
        const n=points.length;
        points.push({x,y,a:a/255,angle:hash(n*2.1+i*57)*TWO_PI,spread:W*(.04+hash(n*3.8)*.14)});
      }
      wordLayers.push(layer);wordPoints.push(points);
    }
  }
  function drawWords(t) {
    const W=state.cols,H=state.rows;
    for(let word=0;word<3;word++) {
      const age=t-WORD_TIMES[word];if(age<0)continue;
      if(word>announced&&announcement){announcement.textContent=WORDS.slice(0,word+1).join(" ");announced=word;}
      const cx=W*.5,cy=H*[.30,.49,.68][word],p=smooth(.1,.95,age);
      rc.save();
      if(p>=1)rc.drawImage(wordLayers[word],0,0);
      else {
        for(const point of wordPoints[word]) {
          const spread=Math.sin(p*Math.PI)*point.spread;
          const x=mix(cx,point.x,p)+Math.cos(point.angle)*spread;
          const y=mix(cy,point.y,p)+Math.sin(point.angle)*spread/1.65;
          rc.globalAlpha=point.a*smooth(.1,.5,age);rc.fillStyle="#f3a8c1";rc.fillRect(x,y,1,1);
        }
      }
      rc.restore();
      if(age>3.5)continue;
      rc.save();
      for(let i=0;i<110;i++) {
        const seed=hash(i*4.11+word*151),angle=hash(i*2.11+word*17)*TWO_PI;
        const elapsed=age-hash(i*3.89)*.14;if(elapsed<0)continue;
        const life=clamp(1-elapsed/(2+seed*1.25));if(!life)continue;
        const radius=(1-Math.exp(-elapsed*1.12))*W*(.14+seed*.31);
        const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius/1.65+elapsed*elapsed*H*.004;
        rc.globalAlpha=life*smooth(0,.12,elapsed);
        rc.fillStyle=i%4?"#f191b6":"#ffe1cc";
        if(i%5===0) {
          rc.save();rc.translate(x,y);rc.scale(1,1/1.65);
          rc.font=(3.5+seed*2.5)+"px Georgia,serif";rc.textAlign="center";rc.textBaseline="middle";
          rc.fillText(i%2?"♡":"♥︎",0,0);rc.restore();
        } else rc.fillRect(x,y,i%3?.45:.85,i%3?.30:.48);
      }
      rc.restore();
    }
  }
  function drawECG(t,opacity=1) {
    const W=state.cols,H=state.rows,cycle=t*1.2,travel=fract(cycle/2.35);
    rc.save();rc.globalAlpha=opacity;
    rc.strokeStyle='#3d1822';rc.lineWidth=.12;
    for(let x=0;x<W;x+=W/18){rc.beginPath();rc.moveTo(x,H*.2);rc.lineTo(x,H*.8);rc.stroke();}
    for(let y=H*.2;y<H*.81;y+=H/12){rc.beginPath();rc.moveTo(0,y);rc.lineTo(W,y);rc.stroke();}
    const pulseX=travel*W,amp=H*.235;
    for(let i=0;i<W*2;i++) {
      const x=i*.5,phase=fract(x/W*2.35),y=H*.52-ecg(phase)*amp;
      const distance=fract((pulseX-x)/W),v=.22+.78*Math.exp(-distance*4.7);
      rc.strokeStyle=`rgba(255,76,72,${v})`;rc.lineWidth=.95;
      const pn=fract((x+.5)/W*2.35),yn=H*.52-ecg(pn)*amp;
      rc.beginPath();rc.moveTo(x,y);rc.lineTo(x+.5,yn);rc.stroke();
    }
    // One bright tracing point, following the same P–QRS–T waveform.
    const phase=fract(pulseX/W*2.35),py=H*.52-ecg(phase)*amp;
    rc.fillStyle='#ffc1b5';rc.beginPath();rc.ellipse(pulseX,py,.85,.53,0,0,TWO_PI);rc.fill();
    rc.restore();
  }

  function drawHeart(t,opacity=1,emergence=1) {
    if(opacity<=0)return;
    const W=state.cols,H=state.rows,g=heartGeometry(W,H,t,emergence);
    drawVessels(rc,W,H,t,opacity,emergence,g);
    rc.save();rc.globalAlpha=opacity;
    const aura=rc.createRadialGradient(W/2,H*.51,0,W/2,H*.51,W*.28);
    aura.addColorStop(0,"rgba(145,25,57,"+(.08+.10*g.pulse)+")");
    aura.addColorStop(1,"#00000000");rc.fillStyle=aura;rc.fillRect(0,0,W,H);
    if(heart.complete&&heart.naturalWidth)rc.drawImage(heart,g.x,g.y,g.w,g.h);
    rc.restore();
  }

  function drawMorph(from,to,p,t) {
    const W=state.cols,H=state.rows;
    // Dimming sources preserve their shape while points gather along the next silhouette.
    from(1-smooth(.05,.73,p));to(smooth(.28,.95,p));
    rc.save();rc.globalAlpha=Math.sin(p*Math.PI)*.65;
    for(let i=0;i<particles.length;i++) {
      const q=particles[i],f=smooth(0,1,clamp(p*1.3-q.phase*.3));
      const sx=q.x*W,sy=q.y*H;
      const ex=q.x*W,ey=H*.52-ecg(fract(q.x*2.35))*H*.235;
      const x=mix(sx,ex,f),y=mix(sy,ey,f);
      rc.fillStyle=i%4?'#e88499':'#ffe0da';rc.fillRect(x,y,.6,.48);
    }
    rc.restore();
  }

  function renderScene(t) {
    const W=state.cols,H=state.rows;
    rc.globalAlpha=1;rc.fillStyle="#020605";rc.fillRect(0,0,W,H);
    if(t<6.5)drawEye(t,0);
    else if(t<11.5) {
      const p=smooth(6.5,11.5,t);drawEye(t,p);
      bc.clearRect(0,0,W,H);bc.drawImage(raw,0,0);
      rc.fillStyle="#020605";rc.fillRect(0,0,W,H);drawSpace((t-6.5)*.7);
      const saved=rc.getImageData(0,0,W,H),space=saved.data,eye=bc.getImageData(0,0,W,H).data;
      const asp=state.h/state.w,mag=zoomMagnification(p,asp);
      const gx=.035*Math.sin(t*.8)+.02*Math.sin(t*1.7),gy=.012*Math.sin(t*.63);
      for(let j=0;j<H;j++)for(let i=0;i<W;i++) {
        const k=(j*W+i)*4,x=(i/W-.5)*3.2,y=(j/H-.5)*3.2*asp;
        const d=Math.hypot(x-gx*(1-p)*mag,y-(gy-.025)*(1-p)*mag);
        const alpha=(1-smooth(.142*mag,.164*mag,d))*smooth(6.65,8,t);
        space[k]=mix(eye[k],space[k],alpha);space[k+1]=mix(eye[k+1],space[k+1],alpha);space[k+2]=mix(eye[k+2],space[k+2],alpha);
      }
      rc.putImageData(saved,0,0);
    } else if(t<20)drawSpace(3.5+t-11.5);
    else if(t<23)drawMorph(alpha=>drawSpace(12+t-20,alpha),alpha=>drawECG(t,alpha),(t-20)/3,t);
    else if(t<28)drawECG(t);
    else if(t<32) {
      const p=smooth(28,32,t);
      drawECG(t,1-smooth(.05,.64,p));drawHeart(t,smooth(.12,.95,p),p);
      rc.save();rc.globalAlpha=Math.sin(p*Math.PI)*.4;
      rc.strokeStyle="#f5a6b6";rc.lineWidth=.6;rc.beginPath();
      for(let i=0;i<W;i++) {
        const u=i/W,x=W*.5+(u-.5)*W*(1-p*.55);
        const y=H*.5-ecg(fract(u*2.35))*H*.2*(1-p)+Math.sin(u*TWO_PI)*H*.25*p;
        i?rc.lineTo(x,y):rc.moveTo(x,y);
      }
      rc.stroke();rc.restore();
    } else if(t<40)drawHeart(t);
    else {
      drawHeart(t,1-smooth(40,41.3,t));drawWords(t);
      const back=loopBlend(t);
      if(back>0) {
        bc.clearRect(0,0,W,H);bc.drawImage(raw,0,0);drawEye(0,0);
        rc.save();rc.globalAlpha=1-back;rc.drawImage(base,0,0);rc.restore();
      }
    }
  }
  function drawPixelHearts(t) {
    const fade=1-loopBlend(t);if(fade<=0)return;
    const W=canvas.width,H=canvas.height;
    const bitmap=["01100110","11111111","11111111","11111111","01111110","00111100","00011000"];
    const block=Math.max(2,Math.floor(Math.min(W/76,H/95)));
    ctx.save();ctx.imageSmoothingEnabled=false;
    for(let h=0;h<3;h++) {
      const age=t-HEART_TIMES[h];if(age<0)continue;
      const pop=clamp(age/.6),scale=pop<1?.58+.42*smooth(0,.65,pop)+Math.sin(pop*Math.PI)*.16:1;
      const cell=Math.max(1,Math.round(block*scale));
      const x=Math.round(W*[.33,.5,.67][h]-cell*4),y=Math.round(H*.84-cell*3.5);
      ctx.globalAlpha=fade*smooth(0,.16,age);
      for(let row=0;row<bitmap.length;row++)for(let col=0;col<8;col++) {
        if(bitmap[row][col]!=="1")continue;
        ctx.fillStyle=row<2&&col<4?"#f7a3b9":row>4?"#ad355e":"#e96c96";
        ctx.fillRect(x+col*cell,y+row*cell,cell,cell);
      }
      if(age<1.5)for(let i=0;i<18;i++) {
        const angle=i/18*TWO_PI+hash(h+91),r=(1-Math.exp(-age*3))*block*(6+hash(i+h*33)*4);
        const size=Math.max(1,Math.round(block*.36));
        ctx.globalAlpha=fade*(1-age/1.5)*smooth(0,.1,age);
        ctx.fillStyle=i%3?"#f2a9c1":"#ffe4c7";
        ctx.fillRect(Math.round(W*[.33,.5,.67][h]+Math.cos(angle)*r),
          Math.round(H*.84+Math.sin(angle)*r),size,size);
      }
    }
    ctx.restore();
  }
  function ascii() {
    const W=state.cols,H=state.rows,pixels=rc.getImageData(0,0,W,H).data;
    const cw=canvas.width/W,ch=canvas.height/H;
    ctx.fillStyle='#020605';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let j=0;j<H;j++)for(let i=0;i<W;i++) {
      const k=(j*W+i)*4,r=pixels[k]/255,g=pixels[k+1]/255,b=pixels[k+2]/255;
      const max=Math.max(r,g,b),min=Math.min(r,g,b);if(max<.048)continue;
      let hue=0;
      if(max-min<max*.19)hue=2;
      else if(r>g*1.15&&b>g*1.05)hue=6;
      else if(r>g&&g>r*.72&&b>g*.70)hue=10;
      else if(g>=r*.90&&r>g*.62&&b<g*.65)hue=9;
      else if(g>r*1.16&&g>b*1.12)hue=r>g*.56?7:1;
      else if(b>r*1.16)hue=4;
      else if(g>r*1.02&&b>r*1.04)hue=8;
      else if(r>g*1.45&&b>g*1.18)hue=6;
      else if(r>g*1.45&&g<b*1.1)hue=3;
      else if(r>g*1.45&&r>b*1.45)hue=3;
      else if(g>r*.78&&b<g*.72)hue=5;
      const brightness=.25*max+.75*(r*.24+g*.59+b*.17);
      const glyph=clamp(Math.floor(Math.pow(brightness,.65)*(chars.length-2)+hash(i*2.14+j*51.9)*1.5),1,chars.length-1);
      const shade=clamp(Math.floor(Math.sqrt(max)*16),0,15);
      ctx.drawImage(atlas,glyph*10,(hue*16+shade)*16,10,16,i*cw,j*ch,cw+.3,ch+.3);
    }
  }

  function render(t) {t=clamp(t,0,DURATION);renderScene(t);ascii();drawPixelHearts(t);}
  function seek(t) {state.time=clamp(t,0,DURATION-.001);announced=-1;sound.reset();render(state.time);}
  function stop() {cancelAnimationFrame(raf);raf=0;lastTick=0;sound.setPlaying(false);}
  function start() {
    if(!disposed&&!raf&&state.playing&&!document.hidden&&!motion.matches){
      sound.setPlaying(true);lastTick=0;lastFrame=0;raf=requestAnimationFrame(frame);
    }
  }
  function frame(now) {
    raf=0;
    if(disposed||document.hidden||!state.playing||motion.matches){lastTick=0;return;}
    if(!lastTick)lastTick=now;
    const dt=Math.min(.1,Math.max(0,(now-lastTick)/1000));lastTick=now;
    state.time+=dt*state.speed;
    if(state.time>=DURATION){state.time%=DURATION;announced=-1;if(announcement)announcement.textContent="";if(state.cols!==state.targetCols)resetGrid(state.targetCols);}
    sound.update(state.time,true);
    if(now-lastFrame>=1000/30) {
      const began=performance.now();render(state.time);const duration=performance.now()-began;
      lastFrame=now;state.frames++;
      if(duration>45&&state.cols>100)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
      if(slowFrames>18){resetGrid(Math.max(96,Math.floor(state.cols*.85)));slowFrames=0;}
    }
    raf=requestAnimationFrame(frame);
  }
  const onResize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,120);};
  const onVisibility=()=>{if(document.hidden)stop();else start();};
  const onMotion=e=>{
    stop();state.playing=!e.matches;
    seek(e.matches?52:0);if(e.matches&&announcement)announcement.textContent="Я тебя люблю.";start();
  };
  const onSound=()=>{const enabled=sound.toggle();if(announcement)announcement.textContent=enabled?"Звук включён.":"Звук выключен.";};
  const onKey=e=>{
    if(e.repeat)return;
    if(e.code==="KeyM"){e.preventDefault();onSound();}
    if(e.code==="Space"&&!motion.matches){e.preventDefault();state.playing=!state.playing;if(state.playing)start();else stop();}
    if(e.code==="Enter"&&!motion.matches){seek(0);state.playing=true;start();}
  };
  const onHide=()=>stop(),onShow=()=>start();
  function destroy() {
    disposed=true;stop();sound.destroy();clearTimeout(resizeTimer);
    canvas.removeEventListener("pointerdown",onSound);
    window.removeEventListener("resize",onResize);window.removeEventListener("keydown",onKey);
    window.removeEventListener("pagehide",onHide);window.removeEventListener("pageshow",onShow);
    document.removeEventListener("visibilitychange",onVisibility);motion.removeEventListener("change",onMotion);
  }
  canvas.addEventListener("pointerdown",onSound,{passive:true});
  window.addEventListener("resize",onResize,{passive:true});window.addEventListener("keydown",onKey);
  window.addEventListener("pagehide",onHide);window.addEventListener("pageshow",onShow);
  document.addEventListener("visibilitychange",onVisibility);motion.addEventListener("change",onMotion);
  resize();
  heartReady.then(()=>{if(!disposed){render(state.time);start();}}).catch(()=>{
    if(announcement)announcement.textContent="Не удалось подготовить изображение сердца. Перезагрузите страницу.";
  });
  if(motion.matches&&announcement)announcement.textContent="Я тебя люблю.";
  return {state,duration:DURATION,seek,render,heartReady,resize,ecg,beats,sound,start,stop,destroy};
}
if(typeof document!=="undefined") {
  const canvas=document.getElementById("scene");
  if(canvas)window.Vnutri=startAnimation(canvas,document.getElementById("words"));
}
