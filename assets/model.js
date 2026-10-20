// Pure geometry and timing; shared by the renderer and the automated checks.
export const TAU = Math.PI * 2;
export const DURATION = 42;
export const CUES = Object.freeze({
  zoom: 7.2, space: 11.8, gather: 17.4, pulse: 19.6,
  heartStart: 22.4, heart: 25.2, words: [30.6, 33.1, 35.6], fade: 40.4
});
export const WORDS = Object.freeze(["Я", "тебя", "люблю"]);
export const PALETTE = Object.freeze([
  [190, 145, 126], // warm eyelid
  [215, 225, 202], // ivory sclera
  [123, 138, 71],  // muted marsh olive
  [167, 151, 85],  // fine golden iris fibres
  [54, 84, 51],    // deep iris
  [241, 245, 226], // reflections
  [212, 76, 105],  // myocardium
  [122, 105, 161], // large vessels
  [251, 153, 173], // coronary arteries / love
  [182, 192, 223]  // stars
]);
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const fract = x => x - Math.floor(x);
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const ease = t => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
export const ink = (material, light) => material * 32 + Math.max(1, Math.round(clamp(light) * 31));
export function decodeInk(value) {
  return { material: Math.floor(value / 32), light: (value % 32) / 31 };
}

export function blinkAmount(t) {
  // Opening is a little slower than closing. Each complete blink is 185 ms.
  let amount = 1 - smooth(0.08, 0.27, t);
  for (const start of [2.05, 5.02, 5.30]) {
    const age = t - start;
    if (age < 0 || age > 0.185) continue;
    const b = age < 0.055 ? Math.pow(age / 0.055, 0.72)
      : age < 0.071 ? 1 : 1 - smooth(0.071, 0.185, age);
    amount = Math.max(amount, b);
  }
  return clamp(amount);
}
export function lids(x, blink = 0) {
  const dome = Math.max(0, 1 - x * x);
  const upper = -0.325 * Math.pow(dome, 0.72) + 0.044 * x;
  const lower = 0.222 * Math.pow(dome, 0.86) + 0.044 * x;
  const seam = lower * 0.76 + 0.012;
  return { top: mix(upper, seam, blink), bottom: mix(lower, seam, blink) };
}
export function gaze(t) {
  // Tiny saccades, frozen before the camera moves into the pupil.
  const s = Math.min(t, CUES.zoom);
  return { x: 0.017 + 0.009 * Math.sin(s * 1.8) + 0.003 * Math.sin(s * 6.1),
    y: 0.006 + 0.004 * Math.sin(s * 1.3) };
}
export function eyeSample(x, y, blink = 0, g = { x: 0.017, y: 0.006 }) {
  const ax = Math.abs(x);
  if (ax > 1.09 || y < -0.83 || y > 0.52) return 0;
  const { top, bottom } = lids(clamp(x, -1, 1), blink);
  const dome = Math.max(0, 1 - x * x);
  const irisRadius = 0.326;
  const dx = x - g.x, dy = y - g.y;
  const r = Math.hypot(dx, dy) / irisRadius;
  const inEye = ax < 1 && y > top && y < bottom && blink < 0.995;
  if (inEye) {
    let shadow = Math.exp(-(y - top) / 0.066);
    const glint = Math.pow((dx + 0.074) / 0.049, 2) + Math.pow((dy + 0.083) / 0.027, 2);
    const smallGlint = Math.pow((dx - 0.065) / 0.017, 2) + Math.pow((dy - 0.085) / 0.013, 2);
    if (r < 1 && (glint < 1 || smallGlint < 1)) return ink(5, glint < 0.65 ? 0.98 : 0.7);
    if (r < 0.34) return 0;
    if (r < 1) {
      const a = Math.atan2(dy, dx);
      const fibres = 0.19 * Math.sin(a * 67 + Math.sin(a * 19) * 2.7 + r * 17)
        + 0.12 * Math.sin(a * 143 - r * 36) + 0.07 * Math.sin(a * 293 + r * 24);
      let light = 0.64 + fibres + dy * 0.36 - shadow * 0.29;
      light -= 0.25 * smooth(0.86, 1, r); // limbal ring
      light -= 0.14 * Math.exp(-Math.pow((r - 0.45 - Math.sin(a * 29) * 0.026) / 0.028, 2));
      light += 0.08 * Math.exp(-Math.pow((r - 0.54) / 0.09, 2));
      const material = r < 0.51 && Math.sin(a * 31 + r * 12) > -0.3 ? 3
        : fibres < -0.16 ? 4 : 2;
      return ink(material, clamp(light, 0.18, 0.96));
    }
    const corner = Math.pow(ax, 5);
    let light = 0.86 - corner * 0.5 - shadow * 0.48;
    light -= 0.13 * Math.pow((y - (top + bottom) / 2) / Math.max(0.07, bottom - top), 2);
    // A few very faint scleral capillaries, confined to the corners.
    const vein = Math.abs(Math.sin(x * 37 + y * 17 + Math.sin(x * 12) * 2));
    if (ax > 0.72 && vein < 0.08) return ink(0, light * 0.5);
    if (x < -0.9) return ink(0, light * 0.72);
    return ink(1, clamp(light, 0.18, 0.96));
  }
  if (ax > 1.02) return 0;
  const creaseY = top - 0.11 * Math.sqrt(dome) - 0.025;
  const crease = Math.exp(-Math.pow((y - creaseY) / 0.019, 2)) * dome;
  const upperRim = Math.exp(-Math.pow((y - top + 0.014) / 0.025, 2));
  const lowerRim = Math.exp(-Math.pow((y - bottom - 0.017) / 0.023, 2));
  const lidVolume = y < top ? Math.exp(-Math.pow((y - top + 0.085) / 0.10, 2)) * dome : 0;
  const underEye = Math.exp(-Math.pow((y - bottom - 0.105) / 0.085, 2)) * dome;
  const browY = -0.635 + 0.13 * x * x - 0.05 * x;
  const brow = Math.exp(-Math.pow((y - browY) / (0.018 + 0.016 * (1 - x) / 2), 2))
    * smooth(-0.94, -0.65, x) * (1 - smooth(0.64, 0.96, x));
  const grain = 0.84 + 0.16 * Math.sin(x * 153 + y * 123);
  let light = (lidVolume * 0.28 + upperRim * 0.41 + lowerRim * 0.43 + underEye * 0.10) * grain;
  light -= crease * 0.07;
  if (brow > 0.12) light = Math.max(light, brow * (0.27 + 0.11 * Math.sin(x * 139)));
  if (blink > 0.1 && ax < 0.98 && y > top - 0.09 && y < bottom + 0.035) {
    light = Math.max(light, (0.12 + 0.12 * dome) * (1 - Math.exp(-Math.abs(y - top) * 20)));
  }
  return light < 0.045 ? 0 : ink(0, light);
}

export function heartbeat(t) {
  const phase = fract(t / (60 / 72));
  return Math.exp(-Math.pow((phase - 0.12) / 0.057, 2))
    + 0.37 * Math.exp(-Math.pow((phase - 0.29) / 0.075, 2));
}
export function ecg(phase) {
  const p = fract(phase);
  const bell = (at, width, amp) => amp * Math.exp(-Math.pow((p - at) / width, 2));
  return bell(0.16, 0.042, 0.105) - bell(0.349, 0.014, 0.14)
    + bell(0.38, 0.014, 0.94) - bell(0.414, 0.019, 0.28)
    + bell(0.64, 0.075, 0.21);
}

function cubic(a, b, c, d, t) {
  const s = 1 - t;
  return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
}
function curve(points, radius, material, count = 24) {
  const segments = [];
  let prev = points[0];
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const next = [0, 1, 2].map(k => cubic(points[0][k], points[1][k], points[2][k], points[3][k], t));
    segments.push({ a: prev, b: next, r: radius * (1 - 0.12 * t), material });
    prev = next;
  }
  return segments;
}
const VESSELS = [
  ...curve([[0.02,-0.31,0.12],[-0.13,-0.78,0.12],[-0.09,-1.10,0.08],[0.30,-0.78,-0.04]],0.094,6,32),
  ...curve([[0.015,-0.82,0.10],[-0.04,-0.96,0.10],[-0.05,-1.06,0.08],[-0.08,-1.12,0.06]],0.029,6,10),
  ...curve([[0.12,-0.89,0.09],[0.11,-1.02,0.09],[0.13,-1.07,0.07],[0.14,-1.13,0.05]],0.030,6,10),
  ...curve([[0.22,-0.86,0.06],[0.25,-0.98,0.06],[0.28,-1.00,0.02],[0.31,-1.05,0.00]],0.025,6,10),
  ...curve([[-0.43,-0.16,-0.04],[-0.49,-0.42,-0.01],[-0.46,-0.73,-0.01],[-0.46,-0.92,0.00]],0.080,7),
  ...curve([[-0.02,-0.22,0.36],[-0.13,-0.46,0.37],[0.02,-0.68,0.30],[0.28,-0.64,0.12]],0.088,7),
  ...curve([[0.16,-0.64,0.17],[0.29,-0.69,0.11],[0.46,-0.63,0.00],[0.59,-0.62,-0.05]],0.064,7),
  ...curve([[0.00,-0.57,0.23],[-0.15,-0.69,0.12],[-0.32,-0.63,0.02],[-0.57,-0.61,-0.04]],0.057,7),
  ...curve([[0.36,-0.28,-0.06],[0.46,-0.37,-0.04],[0.56,-0.36,-0.06],[0.66,-0.40,-0.08]],0.047,6),
  ...curve([[0.37,-0.17,-0.10],[0.49,-0.21,-0.08],[0.57,-0.22,-0.08],[0.65,-0.24,-0.10]],0.041,6)
];
const CORONARIES = [
  ...curve([[0.00,-0.29,0],[-0.10,-0.07,0],[0.09,0.28,0],[0.22,0.67,0]],0.014,8,32),
  ...curve([[0.00,-0.23,0],[-0.20,-0.11,0],[-0.40,-0.17,0],[-0.51,-0.06,0]],0.011,8),
  ...curve([[0.04,0.06,0],[0.22,0.01,0],[0.37,0.08,0],[0.48,0.18,0]],0.009,8),
  ...curve([[0.13,0.30,0],[0.29,0.25,0],[0.34,0.29,0],[0.41,0.39,0]],0.007,8),
  ...curve([[-0.01,0.00,0],[-0.16,0.06,0],[-0.21,0.23,0],[-0.30,0.29,0]],0.008,8),
  ...curve([[0.19,0.47,0],[0.06,0.47,0],[-0.02,0.48,0],[-0.08,0.50,0]],0.006,8),
  ...curve([[-0.24,-0.11,0],[-0.22,0.04,0],[-0.34,0.13,0],[-0.40,0.18,0]],0.006,8)
];
const CHAMBERS = [
  { x:0.115, y:0.125, z:0.00, rx:0.445, ry:0.675, rz:0.315, angle:-0.23, mat:6 },
  { x:-0.225, y:0.03, z:-0.027, rx:0.365, ry:0.455, rz:0.28, angle:-0.32, mat:6 },
  { x:-0.365, y:-0.295, z:-0.02, rx:0.235, ry:0.245, rz:0.205, angle:0.10, mat:6 },
  { x:0.325, y:-0.265, z:0.065, rx:0.225, ry:0.195, rz:0.175, angle:-0.50, mat:6 }
];
function segmentPoint(x, y, segment) {
  const dx = segment.b[0] - segment.a[0], dy = segment.b[1] - segment.a[1];
  const u = clamp(((x - segment.a[0]) * dx + (y - segment.a[1]) * dy) / Math.max(1e-10, dx * dx + dy * dy));
  const px = mix(segment.a[0], segment.b[0], u), py = mix(segment.a[1], segment.b[1], u);
  return { dx:x-px, dy:y-py, z:mix(segment.a[2], segment.b[2], u) };
}
export function heartSample(x, y) {
  if (Math.abs(x) > 0.82 || y < -1.2 || y > 0.91) return 0;
  let front = -10, nx = 0, ny = 0, nz = 1, material = 6;
  for (const e of CHAMBERS) {
    const c = Math.cos(e.angle), s = Math.sin(e.angle);
    const dx = x - e.x, dy = y - e.y;
    const a = dx * c + dy * s, b = -dx * s + dy * c;
    const inside = 1 - (a / e.rx) ** 2 - (b / e.ry) ** 2;
    if (inside <= 0) continue;
    const z = e.z + e.rz * Math.sqrt(inside);
    if (z > front) {
      front = z; material = e.mat;
      const gx = a / (e.rx * e.rx), gy = b / (e.ry * e.ry);
      nx = gx * c - gy * s; ny = gx * s + gy * c; nz = (z-e.z) / (e.rz*e.rz);
    }
  }
  let vessel = false;
  for (const tube of VESSELS) {
    // Bounding rejection avoids calculating a projection for most of the tubes.
    if (x < Math.min(tube.a[0],tube.b[0])-tube.r || x > Math.max(tube.a[0],tube.b[0])+tube.r
      || y < Math.min(tube.a[1],tube.b[1])-tube.r || y > Math.max(tube.a[1],tube.b[1])+tube.r) continue;
    const p = segmentPoint(x,y,tube), d2 = p.dx*p.dx+p.dy*p.dy;
    if (d2 >= tube.r*tube.r) continue;
    const dz = Math.sqrt(tube.r*tube.r-d2), z = p.z+dz;
    if (z > front) { front=z; nx=p.dx; ny=p.dy; nz=dz; material=tube.material; vessel=true; }
  }
  if (front === -10) return 0;
  const length = Math.hypot(nx,ny,nz); nx/=length; ny/=length; nz/=length;
  const diffuse = Math.max(0, -0.42*nx-0.51*ny+0.75*nz);
  let light = 0.21 + diffuse*0.63 + Math.pow(Math.max(0,-0.24*nx-0.31*ny+0.92*nz),22)*0.21;
  light += 0.045 * Math.sin(y*43+x*19+Math.sin(x*12)*2) * Math.sin(x*37-y*11);
  if (!vessel) {
    let closest = 20, radius = 0;
    for (const branch of CORONARIES) {
      if (Math.abs(x-(branch.a[0]+branch.b[0])/2)>0.075
        || Math.abs(y-(branch.a[1]+branch.b[1])/2)>0.075) continue;
      const p = segmentPoint(x,y,branch), d = Math.hypot(p.dx,p.dy);
      if (d < closest) { closest=d; radius=branch.r; }
    }
    if (closest < radius) { material=8; light=0.60+diffuse*0.33; }
    else if (closest < radius+0.012) light *= 0.56;
  }
  return ink(material, clamp(light,0.08,1));
}
export function cameraScale(t, target = 48) {
  return Math.exp(ease((t - CUES.zoom) / (CUES.space - CUES.zoom)) * Math.log(target));
}
export function layout(width, height) {
  return {
    width, height,
    eyeUnit: Math.min(width * 0.455, height * 0.54),
    eyeX: width * 0.5, eyeY: height * 0.49,
    heartUnit: Math.min(width * 0.58, height * 0.30),
    heartX: width * 0.5, heartY: height * 0.53,
    waveY: height * 0.5,
    waveHeight: Math.min(width * 0.16, height * 0.17),
    wordY: [height * 0.31, height * 0.50, height * 0.69]
  };
}
