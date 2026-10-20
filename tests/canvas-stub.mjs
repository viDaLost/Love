// A deterministic Canvas contract stub. It checks finite coordinates and frame
// scheduling; it intentionally does not claim to be a visual browser test.
export function installCanvasStub(width, height, reduced = false) {
  const saved = new Map();
  const put = (key, value) => {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable:true, configurable:true });
  };
  const stats = { glyphs:0, texts:0, frames:0 };
  const pending = new Map();
  let nextFrame = 1;
  const finite = values => {
    for (const v of values) if (!Number.isFinite(v)) throw new Error("Non-finite drawing coordinate: " + v);
  };
  class Context {
    constructor(canvas) { this.canvas=canvas; this.font="12px monospace"; this.alpha=1; this.texts=[]; }
    set globalAlpha(v) { finite([v]); if (v<0 || v>1) throw new Error("Invalid alpha"); this.alpha=v; }
    get globalAlpha() { return this.alpha; }
    setTransform(...a) { finite(a); }
    fillRect(...a) { finite(a); }
    clearRect(...a) { finite(a); this.texts=[]; }
    beginPath() {}
    fill() {}
    arc(...a) { finite(a); if (a[2]<0) throw new Error("Negative radius"); }
    save() {}
    restore() {}
    translate(...a) { finite(a); }
    rotate(...a) { finite(a); }
    scale(...a) { finite(a); }
    drawImage(canvas,...a) {
      finite(a);
      if (![2,4,8].includes(a.length)) throw new Error("Invalid drawImage overload");
      if (a.length===8 && (a[2]<=0 || a[3]<=0 || a[6]<=0 || a[7]<=0)) throw new Error("Empty image rectangle");
      stats.glyphs++;
    }
    fillText(text,x,y) { finite([x,y]); stats.texts++; this.texts.push({text,x,y,font:this.font}); }
    measureText(text) { return {width:parseFloat(this.font.replace(/^\d+\s+/,""))*text.length*0.57}; }
    getImageData(x,y,w,h) {
      const data=new Uint8ClampedArray(w*h*4);
      for (const item of this.texts) {
        const size=parseFloat(item.font.replace(/^\d+\s+/,""));
        const tw=Math.min(w*0.9,size*item.text.length*0.57), th=size*0.74;
        for(let py=Math.max(0,Math.floor(item.y-th/2));py<Math.min(h,item.y+th/2);py++) {
          for(let px=Math.max(0,Math.floor(item.x-tw/2));px<Math.min(w,item.x+tw/2);px++) {
            if((px+py)%7>1)data[(py*w+px)*4+3]=255;
          }
        }
      }
      return {data};
    }
  }
  class Canvas {
    constructor() { this.width=width; this.height=height; this.context=new Context(this); }
    getContext(type) { if(type!=="2d")throw new Error("Unexpected context"); return this.context; }
    getBoundingClientRect() { return {width,height}; }
  }
  const listeners = new Map();
  const media={matches:reduced,addEventListener(){},removeEventListener(){}};
  const documentStub={hidden:false,createElement(type){if(type!=="canvas")throw new Error("Unexpected element");return new Canvas();},
    getElementById(){return null;},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}};
  const windowStub={devicePixelRatio:3,matchMedia(){return media;},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}};
  put("document",documentStub); put("window",windowStub);
  put("requestAnimationFrame", fn=>{const id=nextFrame++;pending.set(id,fn);return id;});
  put("cancelAnimationFrame", id=>pending.delete(id));
  return { canvas:new Canvas(), announcement:{textContent:""}, document:documentStub, stats, pending,
    advance(now) {
      const callbacks=[...pending.values()];pending.clear();
      for(const cb of callbacks){stats.frames++;cb(now);}
    },
    cleanup() {
      for(const [key,descriptor] of saved) {
        if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
      }
    }
  };
}
