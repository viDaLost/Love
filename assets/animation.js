import {
  TAU, DURATION, CUES, WORDS, PALETTE, clamp, mix, fract, smooth, ease, hash,
  blinkAmount, lids, gaze, eyeSample, heartbeat, ecg, heartSample, cameraScale, layout
} from "./model.js";

const RAMP = " .,:;-+=*%#@";
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
const makeCanvas = () => document.createElement("canvas");
function surface(width, height, dpr) {
  const canvas = makeCanvas();
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, context };
}

// Every visible mark is a glyph. A small atlas avoids thousands of fillText calls.
class Glyphs {
  constructor(width, dpr) {
    this.cw = width / clamp(Math.round(width / 3.5), 128, 240);
    this.ch = this.cw * 1.72;
    this.tw = Math.ceil(this.cw * dpr);
    this.th = Math.ceil(this.ch * dpr);
    this.atlas = makeCanvas();
    this.atlas.width = this.tw * RAMP.length * PALETTE.length;
    this.atlas.height = this.th * 32;
    const ctx = this.atlas.getContext("2d");
    ctx.font = (this.th * 0.91) + "px " + MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let m = 0; m < PALETTE.length; m++) {
      for (let level = 1; level < 32; level++) {
        const rgb = PALETTE[m].map(c => Math.round(c * level / 31));
        ctx.fillStyle = "rgb(" + rgb.join(",") + ")";
        for (let char = 1; char < RAMP.length; char++) {
          ctx.fillText(RAMP[char], (m * RAMP.length + char + 0.5) * this.tw, (level + 0.5) * this.th);
        }
      }
    }
  }
  draw(ctx, x, y, code, seed = 0) {
    if (!code) return;
    const level = code % 32, material = Math.floor(code / 32);
    const char = clamp(Math.round(level / 31 * (RAMP.length - 2) + 1 + (seed % 3 - 1) * 0.4), 1, RAMP.length - 1);
    ctx.drawImage(this.atlas, (material * RAMP.length + char) * this.tw, level * this.th,
      this.tw, this.th, x, y, this.cw, this.ch);
  }
}
function symbol(ctx, text, x, y, size, color, alpha = 1) {
  if (alpha < 0.01) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.font = size + "px " + MONO;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}
function lash(ctx, grid, x, y, dx, dy, length, seed) {
  // Curved lashes taper to individual symbols rather than solid vector strokes.
  const count = Math.max(3, Math.ceil(length / (grid.ch * 0.65)));
  for (let j = 0; j <= count; j++) {
    const u = j / count;
    const bend = u * u;
    const px = x + dx * length * u + dx * length * 0.26 * bend;
    const py = y + dy * length * u - length * 0.17 * bend;
    symbol(ctx, dx > 0.24 ? "/" : dx < -0.24 ? "\\" : "|", px, py,
      grid.ch * (0.85 - u * 0.22), "#baa39a", (0.46 - u * 0.31) * (0.85 + hash(seed) * 0.15));
  }
  ctx.globalAlpha = 1;
}

export class Animation {
  constructor(canvas, announcement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    if (!this.ctx) throw new Error("Canvas 2D is not available");
    this.announcement = announcement;
    this.time = 0;
    this.last = null;
    this.frame = 0;
    this.paintClock = 0;
    this.paused = false;
    this.hidden = document.hidden;
    this.disposed = false;
    this.motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = this.motion.matches;
    this.announced = -1;
    this.stars = Array.from({ length: 420 }, (_, i) => ({
      x: hash(i * 3.1 + 1) * 2 - 1,
      y: hash(i * 3.1 + 2) * 2 - 1,
      z: hash(i * 3.1 + 3), seed: hash(i * 2.79 + 9)
    }));
    this.onFrame = this.tick.bind(this);
    this.onVisibility = () => {
      this.hidden = document.hidden;
      if (this.hidden) this.stop(); else this.start();
    };
    this.onResize = () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => { this.resize(); this.draw(this.reduced ? 39 : this.time); }, 90);
    };
    this.onMotion = event => {
      this.reduced = event.matches;
      this.stop();
      this.announced = -1;
      if (this.reduced) {
        this.draw(39);
        if (this.announcement) this.announcement.textContent = "Я тебя люблю.";
      } else {
        this.time = 0;
        this.start();
      }
    };
    this.onKey = event => {
      if (event.code === "Space" && !event.repeat && !this.reduced) {
        event.preventDefault();
        this.paused = !this.paused;
        if (this.paused) this.stop(); else this.start();
      }
      if (event.code === "Enter" && !this.reduced) {
        this.time = 0; this.announced = -1; this.paused = false; this.start();
      }
    };
    this.onPageHide = () => { this.hidden = true; this.stop(); };
    this.onPageShow = () => { this.hidden = document.hidden; this.start(); };
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("resize", this.onResize, { passive: true });
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("pagehide", this.onPageHide);
    window.addEventListener("pageshow", this.onPageShow);
    this.motion.addEventListener("change", this.onMotion);
    this.resize();
    this.draw(this.reduced ? 39 : 0);
    if (this.reduced && this.announcement) this.announcement.textContent = "Я тебя люблю.";
    this.start();
  }
  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(box.width));
    this.h = Math.max(1, Math.round(box.height));
    // The pixel budget also protects large tablets and high-DPI phones.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3000000 / (this.w * this.h)));
    this.canvas.width = Math.ceil(this.w * this.dpr);
    this.canvas.height = Math.ceil(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.geo = layout(this.w, this.h);
    this.grid = new Glyphs(this.w, this.dpr);
    this.eyeLayer = surface(this.w, this.h, this.dpr);
    this.heartLayer = surface(this.w, this.h, this.dpr);
    this.eyeRasterTime = -100;
    this.starCount = this.w < 600 ? 250 : 420;
    this.makeHeart();
    this.makeWords();
  }
  makeHeart() {
    const ctx = this.heartLayer.context, g = this.geo, grid = this.grid;
    ctx.clearRect(0, 0, this.w, this.h);
    this.heartPoints = [];
    const left = Math.max(0, g.heartX - g.heartUnit * 0.83);
    const right = Math.min(this.w, g.heartX + g.heartUnit * 0.83);
    const top = Math.max(0, g.heartY - g.heartUnit * 1.21);
    const bottom = Math.min(this.h, g.heartY + g.heartUnit * 0.94);
    let i = 0;
    for (let y = top; y < bottom; y += grid.ch) {
      for (let x = left; x < right; x += grid.cw) {
        const code = heartSample((x + grid.cw / 2 - g.heartX) / g.heartUnit,
          (y + grid.ch / 2 - g.heartY) / g.heartUnit);
        if (!code) continue;
        grid.draw(ctx, x, y, code, i);
        if (i % 2 === 0) this.heartPoints.push({ x, y, code, seed: hash(i * 1.17) });
        i++;
      }
    }
  }
  makeWords() {
    const mask = makeCanvas();
    mask.width = this.w;
    mask.height = this.h;
    const ctx = mask.getContext("2d", { willReadFrequently: true });
    const grid = this.grid, g = this.geo;
    this.wordPoints = WORDS.map((word, wordIndex) => {
      ctx.clearRect(0, 0, this.w, this.h);
      let size = Math.min(this.w * 0.225, this.h * 0.135);
      ctx.font = "600 " + size + "px Georgia, 'Times New Roman', serif";
      const measured = ctx.measureText(word).width;
      if (measured > this.w * 0.82) size *= this.w * 0.82 / measured;
      ctx.font = "600 " + size + "px Georgia, 'Times New Roman', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(word, this.w * 0.5, g.wordY[wordIndex]);
      const pixels = ctx.getImageData(0, 0, this.w, this.h).data;
      const points = [];
      const stepX = grid.cw * 0.79, stepY = grid.ch * 0.79;
      let i = 0;
      for (let y = Math.max(0, g.wordY[wordIndex] - size); y < Math.min(this.h, g.wordY[wordIndex] + size); y += stepY) {
        for (let x = this.w * 0.06; x < this.w * 0.94; x += stepX) {
          const a = pixels[(Math.floor(y) * this.w + Math.floor(x)) * 4 + 3];
          if (a < 62) continue;
          points.push({ x: x - grid.cw / 2, y: y - grid.ch / 2,
            code: 8 * 32 + Math.round(22 + a / 255 * 9),
            angle: hash(i * 2.11 + wordIndex * 7) * TAU,
            distance: (0.07 + hash(i * 4.2) * 0.15) * Math.min(this.w, this.h),
            seed: hash(i * 3.21) });
          i++;
        }
      }
      return points;
    });
    // Release the large readback buffer as soon as the three masks are sampled.
    mask.width = mask.height = 1;
  }
  rasterEye(t) {
    const ctx = this.eyeLayer.context, grid = this.grid, g = this.geo;
    const blink = blinkAmount(t), look = gaze(t);
    const pupilX = g.eyeX + look.x * g.eyeUnit;
    const pupilY = g.eyeY + look.y * g.eyeUnit;
    const radius = g.eyeUnit * 0.326 * 0.34;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#020303";
    ctx.fillRect(0, 0, this.w, this.h);
    if (blink < 0.01) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath(); ctx.arc(pupilX, pupilY, radius, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    const minX = Math.max(0, Math.floor((g.eyeX - g.eyeUnit * 1.10) / grid.cw) * grid.cw);
    const maxX = Math.min(this.w, g.eyeX + g.eyeUnit * 1.10);
    const minY = Math.max(0, Math.floor((g.eyeY - g.eyeUnit * 0.84) / grid.ch) * grid.ch);
    const maxY = Math.min(this.h, g.eyeY + g.eyeUnit * 0.53);
    let row = 0;
    for (let y = minY; y < maxY; y += grid.ch, row++) {
      let col = 0;
      for (let x = minX; x < maxX; x += grid.cw, col++) {
        const code = eyeSample((x + grid.cw / 2 - g.eyeX) / g.eyeUnit,
          (y + grid.ch / 2 - g.eyeY) / g.eyeUnit, blink, look);
        grid.draw(ctx, x, y, code, col * 17 + row * 23);
      }
    }
    // Upper lashes become longer and sweep outward towards the outer corner.
    for (let i = 0; i < 27; i++) {
      const x = mix(-0.88, 0.96, i / 26);
      const y = lids(x, blink).top;
      const length = g.eyeUnit * (0.084 + (x + 1) * 0.046) * (0.90 + hash(i) * 0.22);
      lash(ctx, grid, g.eyeX + x * g.eyeUnit, g.eyeY + y * g.eyeUnit,
        x * 0.56 + 0.06, -0.91, length, i);
    }
    for (let i = 0; i < 14; i++) {
      const x = mix(-0.79, 0.90, i / 13), y = lids(x, blink).bottom;
      lash(ctx, grid, g.eyeX + x * g.eyeUnit, g.eyeY + y * g.eyeUnit,
        x * 0.40, 0.94, g.eyeUnit * (0.040 + hash(i + 3) * 0.028), i + 40);
    }
    ctx.globalAlpha = 1;
    this.eyeRasterTime = t;
  }
  starPosition(star, t) {
    const local = Math.max(0, t - 9.4);
    const z = fract(star.z - local * 0.058), angle = local * 0.012;
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: this.w / 2 + (star.x * c - star.y * s) * this.w * 0.39 / (z + 0.27),
      y: this.h / 2 + (star.x * s + star.y * c) * this.h * 0.37 / (z + 0.27),
      depth: z
    };
  }
  drawSpace(t, opacity) {
    if (opacity < 0.005) return;
    const ctx = this.ctx;
    // A few dim symbol clouds, with ample dark space around the stars.
    for (let i = 0; i < 90; i++) {
      const a = hash(i + 91) * TAU, r = 0.10 + hash(i + 19) * 0.43;
      const x = this.w * (0.50 + Math.cos(a) * r);
      const y = this.h * (0.50 + Math.sin(a) * r * 0.77);
      symbol(ctx, i % 3 ? "." : ":", x, y, this.grid.ch,
        i % 2 ? "#4e3e65" : "#344a49", opacity * 0.23);
    }
    for (let i = 0; i < this.starCount; i++) {
      const star = this.stars[i], p = this.starPosition(star, t);
      if (p.x < -12 || p.x > this.w + 12 || p.y < -12 || p.y > this.h + 12) continue;
      const twinkle = 0.72 + 0.28 * Math.sin(t * (1.1 + star.seed * 2) + i * 3);
      const alpha = opacity * (0.26 + (1 - p.depth) * 0.61) * twinkle;
      const text = star.seed > 0.96 ? "+" : star.seed > 0.89 ? "*" : ".";
      symbol(ctx, text, p.x, p.y, this.grid.ch * (0.55 + star.seed * 0.45),
        star.seed > 0.88 ? "#e8dceb" : "#a2abc5", alpha);
    }
    // Deterministic, small supernovae. No full-screen flash.
    const clock = Math.max(0, t - 10.3), latest = Math.floor(clock / 0.92);
    for (let event = Math.max(0, latest - 2); event <= latest; event++) {
      const age = clock - event * 0.92;
      if (age < 0 || age > 1.85) continue;
      const cx = this.w * (0.15 + hash(event * 7 + 121) * 0.7);
      const cy = this.h * (0.17 + hash(event * 7 + 122) * 0.66);
      const life = Math.pow(1 - age / 1.85, 1.7);
      symbol(ctx, "+", cx, cy, this.grid.ch * (1.4 + Math.exp(-age * 8) * 0.9),
        "#fff0eb", opacity * life);
      for (let j = 0; j < 11; j++) {
        const a = j / 11 * TAU + hash(event) * TAU;
        const r = (1 - Math.exp(-age * 2.1)) * Math.min(this.w, this.h) * (0.036 + hash(j + event * 5) * 0.037);
        symbol(ctx, j % 3 ? "." : "+", cx + Math.cos(a) * r, cy + Math.sin(a) * r,
          this.grid.ch * (j % 3 ? 0.5 : 0.8), j % 2 ? "#d6b4d3" : "#f4d6b7", opacity * life * 0.75);
      }
    }
    ctx.globalAlpha = 1;
  }
  wavePoint(u, t) {
    return { x: this.w * (0.07 + u * 0.86),
      y: this.geo.waveY - ecg(u * 2.65 - Math.max(0, t - CUES.pulse) * 0.65 - 0.2) * this.geo.waveHeight };
  }
  drawGather(t) {
    const p = ease((t - CUES.gather) / (CUES.pulse - CUES.gather));
    const ctx = this.ctx, n = this.starCount;
    for (let i = 0; i < n; i++) {
      const from = this.starPosition(this.stars[i], CUES.gather), to = this.wavePoint(i / (n - 1), CUES.pulse);
      const arc = Math.sin(p * Math.PI) * (hash(i * 1.93) - 0.5) * this.h * 0.12;
      symbol(ctx, p > 0.75 ? "-" : "+", mix(from.x, to.x, p), mix(from.y, to.y, p) + arc,
        this.grid.ch * 0.75, p > 0.5 ? "#d78caa" : "#b5b7d2", (0.4 + p * 0.5) * (1 - smooth(CUES.pulse - 0.3, CUES.pulse, t)));
    }
    ctx.globalAlpha = 1;
  }
  drawPulse(t, opacity) {
    if (opacity < 0.005) return;
    const ctx = this.ctx, count = Math.ceil(this.w * 0.86 / (this.grid.cw * 0.72));
    const head = fract(Math.max(0, t - CUES.pulse) * 0.43);
    for (let i = 0; i <= count; i++) {
      const u = i / count, p = this.wavePoint(u, t), next = this.wavePoint(Math.min(1, u + 0.001), t);
      const slope = next.y - p.y;
      const mark = Math.abs(slope) < 0.4 ? "-" : Math.abs(slope) > 2 ? "|" : slope < 0 ? "/" : "\\";
      const trail = fract(head - u);
      const brightness = 0.20 + 0.80 * Math.exp(-trail * 5.0);
      symbol(ctx, mark, p.x, p.y, this.grid.ch * 0.94, "#ee9db6", brightness * opacity);
    }
    const lead = this.wavePoint(head, t);
    symbol(ctx, "*", lead.x, lead.y, this.grid.ch * 1.3, "#ffe3e6", opacity);
    ctx.globalAlpha = 1;
  }
  drawMorph(t) {
    const p = ease((t - CUES.heartStart) / (CUES.heart - CUES.heartStart));
    const ctx = this.ctx;
    ctx.globalAlpha = (1 - smooth(0.78, 1, p)) * 0.94;
    for (let i = 0; i < this.heartPoints.length; i++) {
      const point = this.heartPoints[i], u = hash(i * 1.789 + 13), from = this.wavePoint(u, CUES.heartStart);
      const curl = Math.sin(p * Math.PI);
      const x = mix(from.x, point.x, p) + Math.sin(point.seed * TAU) * curl * this.w * 0.045;
      const y = mix(from.y, point.y, p) + Math.cos(point.seed * TAU) * curl * this.h * 0.055;
      this.grid.draw(ctx, x, y, point.code, i);
    }
    ctx.globalAlpha = 1;
  }
  drawHeart(t, opacity) {
    if (opacity < 0.005) return;
    const ctx = this.ctx, g = this.geo, beat = heartbeat(t - CUES.heartStart);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(g.heartX, g.heartY);
    ctx.rotate(-0.012 + beat * 0.014);
    ctx.scale(1 - beat * 0.031, 1 - beat * 0.047);
    ctx.drawImage(this.heartLayer.canvas, -g.heartX, -g.heartY, this.w, this.h);
    ctx.restore();
  }
  drawWords(t) {
    const ctx = this.ctx, grid = this.grid;
    for (let word = 0; word < 3; word++) {
      const age = t - CUES.words[word];
      if (age < 0) continue;
      if (word > this.announced && this.announcement) {
        this.announcement.textContent = WORDS.slice(0, word + 1).join(" ");
        this.announced = word;
      }
      const p = ease((age - 0.10) / 0.87), cx = this.w * 0.5, cy = this.geo.wordY[word];
      const breath = 1 + heartbeat(t) * 0.005;
      ctx.globalAlpha = smooth(0.12, 0.6, age);
      for (let i = 0; i < this.wordPoints[word].length; i++) {
        const point = this.wordPoints[word][i];
        if (p < point.seed * 0.18) continue;
        const spread = Math.sin(Math.PI * p) * point.distance;
        const x = mix(cx, cx + (point.x - cx) * breath, p) + Math.cos(point.angle) * spread;
        const y = mix(cy, cy + (point.y - cy) * breath, p) + Math.sin(point.angle) * spread;
        grid.draw(ctx, x, y, point.code, i);
      }
      ctx.globalAlpha = 1;
      if (age > 3.4) continue;
      const count = this.w < 600 ? 90 : 150;
      for (let i = 0; i < count; i++) {
        const seed = hash(i * 4.11 + word * 151), a = hash(i * 2.11 + word * 17) * TAU;
        const delay = hash(i * 3.89) * 0.16, elapsed = age - delay;
        if (elapsed < 0) continue;
        const life = clamp(1 - elapsed / (1.9 + seed * 1.3));
        if (life <= 0) continue;
        const travel = (1 - Math.exp(-elapsed * 1.15)) * Math.min(this.w, this.h) * (0.17 + seed * 0.33);
        const x = cx + Math.cos(a) * travel;
        const y = cy + Math.sin(a) * travel * 0.70 + elapsed * elapsed * 6;
        const heart = i % 5 === 0, mark = heart ? (i % 2 ? "♡" : "♥︎") : i % 3 ? "." : "+";
        symbol(ctx, mark, x, y, grid.ch * (heart ? 1.7 + seed : 0.7 + seed * 0.55),
          i % 4 ? "#f39bb7" : "#ffe0ce", life * smooth(0, 0.12, elapsed) * (heart ? 0.85 : 0.8));
      }
    }
    ctx.globalAlpha = 1;
  }
  draw(t) {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#020303";
    ctx.fillRect(0, 0, this.w, this.h);
    if (t < CUES.space) {
      this.drawSpace(t, smooth(9.5, 11.3, t));
      // No need to recompute a frozen eye throughout the camera movement.
      const rasterTime = Math.min(t, CUES.zoom);
      if (Math.abs(rasterTime - this.eyeRasterTime) > 0.014) this.rasterEye(rasterTime);
      const g = this.geo, look = gaze(CUES.zoom);
      const px = g.eyeX + look.x * g.eyeUnit, py = g.eyeY + look.y * g.eyeUnit;
      const radius = g.eyeUnit * 0.326 * 0.34;
      const cover = Math.max(48, Math.hypot(this.w, this.h) / (2 * radius) * 1.3);
      const zoom = cameraScale(t, cover);
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(zoom, zoom);
      ctx.drawImage(this.eyeLayer.canvas, -px, -py, this.w, this.h);
      ctx.restore();
    } else if (t < CUES.pulse + 0.3) {
      this.drawSpace(t, 1 - smooth(CUES.gather, CUES.pulse, t));
    }
    if (t >= CUES.gather && t < CUES.pulse) this.drawGather(t);
    if (t >= CUES.gather && t < CUES.heart) {
      this.drawPulse(t, smooth(CUES.gather + 0.7, CUES.pulse, t) * (1 - smooth(CUES.heartStart, CUES.heart - 0.3, t)));
    }
    if (t >= CUES.heartStart && t < CUES.heart) this.drawMorph(t);
    if (t >= CUES.heartStart + 1.9 && t < 31.4) {
      this.drawHeart(t, smooth(CUES.heartStart + 1.9, CUES.heart, t) * (1 - smooth(29.8, 31.4, t)));
    }
    if (t >= CUES.words[0]) this.drawWords(t);
    if (t > CUES.fade) {
      ctx.globalAlpha = smooth(CUES.fade, DURATION, t);
      ctx.fillStyle = "#020303"; ctx.fillRect(0, 0, this.w, this.h); ctx.globalAlpha = 1;
    }
  }
  tick(now) {
    this.frame = 0;
    if (this.disposed || this.hidden || this.reduced || this.paused) { this.last = null; return; }
    if (this.last !== null) {
      // Drop long scheduling gaps instead of skipping a whole scene.
      const delta = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.time += delta;
      this.paintClock += delta;
    }
    this.last = now;
    if (this.time >= DURATION) {
      this.time %= DURATION;
      this.announced = -1;
      if (this.announcement) this.announcement.textContent = "";
    }
    // 30 fps keeps the detailed symbol rendering cool on mobile devices.
    if (this.paintClock >= 1 / 30) {
      this.draw(this.time);
      this.paintClock %= 1 / 30;
    }
    this.frame = requestAnimationFrame(this.onFrame);
  }
  start() {
    if (this.disposed || this.frame || this.hidden || this.paused || this.reduced) return;
    this.last = null;
    this.paintClock = 1 / 30;
    this.frame = requestAnimationFrame(this.onFrame);
  }
  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.last = null;
  }
  destroy() {
    this.stop();
    this.disposed = true;
    clearTimeout(this.resizeTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("pagehide", this.onPageHide);
    window.removeEventListener("pageshow", this.onPageShow);
    this.motion.removeEventListener("change", this.onMotion);
  }
}
if (typeof document !== "undefined") {
  const canvas = document.getElementById("scene");
  if (canvas) {
    const app = new Animation(canvas, document.getElementById("words"));
    window.addEventListener("pagehide", event => { if (!event.persisted) app.destroy(); }, { once: true });
  }
}
