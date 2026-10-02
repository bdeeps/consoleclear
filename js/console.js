// Shared models, numbers and helpers for ConsoleClear.
//
// Every model here is generic: a plain console box and a plain gamepad, with no maker's logo,
// button symbols or trade dress. The worked example in the text is the PlayStation 5 (launch
// model, 2020), and the numbers below are its published specifications.
//
// Sources for SPEC:
//  - Sony Interactive Entertainment, "Unveiling new details of PlayStation 5: hardware technical
//    specs" (PlayStation Blog, 18 March 2020): 8-core Zen 2 CPU up to 3.5 GHz, RDNA 2-based GPU up
//    to 2.23 GHz (10.28 TFLOPS), 16 GB GDDR6 at 448 GB/s, 825 GB SSD at 5.5 GB/s raw, Ultra HD
//    Blu-ray up to 100 GB a disc, HDMI 2.1 (4K at 120 Hz).
//  - Mark Cerny, "The Road to PS5" (talk, 18 March 2020): typical 8 to 9 GB/s after Kraken
//    decompression; a PS4 hard disk reads 50 to 100 MB/s, about 20 s for 1 GB once seeks are counted.
//  - iFixit, "PlayStation 5 Teardown" (2020): 350 W power supply, 120 mm blower fan, liquid-metal
//    thermal interface, copper heat pipes into fin stacks, 512 MB DDR4 for the SSD controller.
//  - Launch model size 390 × 104 × 260 mm and 4.5 kg; fan 120 mm across and 45 mm thick
//    (Sony's teardown video, October 2020, as summarised on Wikipedia, "PlayStation 5").
//  - Power while gaming: about 200 W at the wall, measured by several reviewers playing
//    Marvel's Spider-Man: Miles Morales in 2020 (reported range 195 to 210 W).
import { THREE, M, box, tube, clamp } from './kit.js';

export const TAU = Math.PI * 2;

export const SPEC = {
  cpuCores: 8, cpuGHz: 3.5, gpuGHz: 2.23, tflops: 10.28, ramGB: 16, ramBandwidth: 448,
  ssdGB: 825, ssdRaw: 5.5, ssdTypical: 8.5, discGB: 100, psuW: 350, playW: 200, fanMM: 120,
  size: [390, 104, 260], kg: 4.5,
};
// Megapixels in a frame: width × height.
export const RES = { 1080: { name: '1080p', w: 1920, h: 1080 }, 1440: { name: '1440p', w: 2560, h: 1440 }, 2160: { name: '4K', w: 3840, h: 2160 } };
export const mp = (r) => (RES[r].w * RES[r].h) / 1e6;

// ---------------------------------------------------------------- boards and stage helpers
export const COL = { data: '#8ef0ff', warm: '#ffb547', hot: '#ff7a59', violet: '#c49bff', good: '#7be08c', bad: '#ff5a8a', gold: '#ffd166', soft: 'rgba(255,255,255,.6)', dim: 'rgba(255,255,255,.35)', grid: 'rgba(255,255,255,.12)' };
export const HEX = { data: 0x8ef0ff, warm: 0xffb547, hot: 0xff7a59, violet: 0xc49bff, good: 0x7be08c, bad: 0xff5a8a, gold: 0xffd166, copper: 0xd08a4a };
export function panelBg(g, w, h, a = 0.9) { g.clearRect(0, 0, w, h); g.fillStyle = `rgba(10,12,18,${a})`; rrect(g, 0, 0, w, h, 18); g.fill(); }
export function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function text(g, s, x, y, { font = '22px sans-serif', col = 'rgba(255,255,255,.85)', align = 'left' } = {}) { g.font = font; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left'; }
// A flat panel in the scene that shows a canvas you can redraw every frame.
export function board(root, w, h, pxW, pxH, draw, pos) {
  const c = document.createElement('canvas'); c.width = pxW; c.height = pxH;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const redraw = (...a) => { draw(g, pxW, pxH, ...a); tex.needsUpdate = true; };
  redraw();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  if (pos) m.position.set(...pos);
  root.add(m);
  return { tex, redraw, canvas: c, g, mesh: m };
}
export const inReel = () => document.body.classList.contains('gb-reel');
// On a phone-width stage, hide minor labels and nudge the picture down, clear of the readout.
// On a wide stage, nudge it by `wide` (fractions of the view), for the same reason.
export function fitNarrow(stage, minor = [], y0 = -0.12, wide = [0.08, -0.05]) {
  const narrow = stage.host.clientWidth < 560, reel = inReel();
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const [x, y] = reel ? [0, 0] : narrow ? [0, y0] : wide;
  if (!stage.shift || stage.shift[0] !== x || stage.shift[1] !== y) stage.setShift(x, y);
  return narrow;
}
// On a phone the readout covers a third of the stage, so keep its headline and the first rows.
export function slim(stage, html, rows = 1) {
  if (stage.host.clientWidth >= 560 || inReel()) return html;
  const t = document.createElement('template'); t.innerHTML = html;
  let n = 0;
  [...t.content.childNodes].forEach((el) => {
    if (el.nodeType !== 1) { el.remove(); return; }
    if (el.classList.contains('big') || el.classList.contains('keep')) return;
    if (el.classList.contains('row') && n < rows) { n++; return; }
    el.remove();
  });
  return t.innerHTML;
}
// The tall (9:16) video frame is much narrower than a desktop stage, so chapters stack their boards
// above the model there and use their own camera view.
export const isTall = (stage) => inReel() && stage.host.clientWidth < stage.host.clientHeight * 0.8;
export function tallView(stage, v) { if (isTall(stage) && stage.home && stage.home.pos !== v.pos) stage.setView(v.pos, v.target, 1.2); }
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// A thin cylinder you can re-aim every frame (rays, links, pointers).
const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function ray(color, r = 0.02, opacity = 1) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), M.glow(color, { transparent: opacity < 1, opacity }));
  m.aim = (a, b) => {
    _d.subVectors(b, a); const L = _d.length();
    m.visible = L > 1e-4; if (!m.visible) return;
    m.position.copy(a).addScaledVector(_d, 0.5); m.scale.set(1, L, 1);
    m.quaternion.setFromUnitVectors(UP, _d.normalize());
  };
  return m;
}
// A vertical cylinder (axis along Y) from y0 to y1.
export function vcyl(r, y0, y1, mat, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.abs(y1 - y0), seg), mat);
  m.position.y = (y0 + y1) / 2; m.castShadow = true; m.receiveShadow = true; return m;
}
// A point moving along straight segments. at(u) with u from 0 to 1.
export function pathOf(pts) {
  const P = pts.map((p) => new THREE.Vector3(...p)), seg = [];
  let L = 0; for (let i = 0; i < P.length - 1; i++) { const d = P[i].distanceTo(P[i + 1]); seg.push([L, d]); L += d; }
  return { length: L, at(u, out = new THREE.Vector3()) {
    const x = clamp(u, 0, 1) * L;
    for (let i = 0; i < seg.length; i++) { const [s0, d] = seg[i]; if (x <= s0 + d || i === seg.length - 1) return out.copy(P[i]).lerp(P[i + 1], d ? clamp((x - s0) / d, 0, 1) : 0); }
    return out.copy(P[0]);
  } };
}

// ---------------------------------------------------------------- a blower fan
// A centrifugal ("squirrel cage") fan: air goes in along the axle and is thrown out sideways.
// Axis along Y. size is the wheel's diameter.
export function makeBlower(size = 1.2, thick = 0.45) {
  const g = new THREE.Group(), R = size / 2;
  const ringG = new THREE.CylinderGeometry(R + 0.03, R + 0.03, thick, 48, 1, true);
  const housing = new THREE.Mesh(ringG, M.plastic(0x20242c, { side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
  g.add(housing);
  const spin = new THREE.Group(); g.add(spin);
  spin.add(vcyl(R * 0.36, -thick * 0.42, thick * 0.42, M.plastic(0x2b3038)));
  const plate = vcyl(R * 0.93, -0.01, 0.01, M.plastic(0x30353f)); spin.add(plate);
  const bm = M.plastic(0x4a5261), N = 26;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, p = new THREE.Group(); p.rotation.y = a;
    const b = box(R * 0.3, thick * 0.84, 0.016, bm); b.position.x = R * 0.76; b.rotation.y = 0.6; p.add(b);
    spin.add(p);
  }
  g.spin = spin; g.housing = housing;
  return g;
}

// ---------------------------------------------------------------- a generic console
// Units: 1 = 10 cm. The box lies flat, 3.9 long (X), 1.04 high (Y) and 2.6 deep (Z): the size of
// the launch PlayStation 5. Front is +Z, the back (ports, exhaust) is -Z. The inside is a plain,
// readable arrangement of the same parts a teardown finds, not a copy of any maker's layout:
//   left:   a 120 mm blower at the front that pushes air back through a fin stack and out;
//   middle: the main board with the system-on-chip, eight memory chips round it and the SSD's
//           flash chips; heat pipes carry the chip's heat sideways into the fins;
//   right:  the power supply at the back, the disc drive at the front.
export const LAYOUT = {
  soc: [0.05, 0.27, -0.45], fan: [-1.25, 0.4, 0.6], fins: [-1.25, 0.5, -0.65], ssd: [0.05, 0.24, 0.86],
  psu: [1.3, 0.4, -0.65], drive: [1.3, 0.25, 0.58], hdmi: [0.3, 0.3, -1.3],
};
export function makeConsole() {
  const g = new THREE.Group(), P = {};
  const shellMat = M.plastic(0xe6e9ef, { transparent: true, opacity: 1 });
  const dark = M.plastic(0x15181d);

  P.bottom = box(3.9, 0.06, 2.6, M.plastic(0x1c2027)); P.bottom.position.y = 0.03; g.add(P.bottom);

  const top = new THREE.Group();
  const lid = box(3.9, 0.06, 2.6, shellMat); lid.position.y = 1.01; top.add(lid);
  [[0, 1.285, 3.9, 0.03], [0, -1.285, 3.9, 0.03]].forEach(([x, z, w, d]) => { const wl = box(w, 0.92, d, shellMat); wl.position.set(x, 0.52, z); top.add(wl); });
  [[-1.935, 0], [1.935, 0]].forEach(([x]) => { const wl = box(0.03, 0.92, 2.6, shellMat); wl.position.set(x, 0.52, 0); top.add(wl); });
  // Front: a disc slot and two plain ports. Back: exhaust slats and the sockets.
  const slot = box(1.0, 0.03, 0.012, dark); slot.position.set(1.3, 0.42, 1.302); top.add(slot);
  [0.2, 0.42].forEach((x) => { const u = box(0.13, 0.05, 0.012, dark); u.position.set(x, 0.3, 1.302); top.add(u); });
  for (let i = 0; i < 9; i++) { const v = box(1.15, 0.04, 0.012, dark); v.position.set(-1.25, 0.2 + i * 0.075, -1.302); top.add(v); }
  for (let i = 0; i < 5; i++) { const v = box(0.9, 0.04, 0.012, dark); v.position.set(1.3, 0.25 + i * 0.075, -1.302); top.add(v); }
  [[0.3, 0.16], [0.02, 0.1], [-0.2, 0.13]].forEach(([x, w]) => { const u = box(w, 0.06, 0.012, dark); u.position.set(x, 0.3, -1.302); top.add(u); });
  // Side intake slats, where the blower's air comes in.
  for (let i = 0; i < 6; i++) { const v = box(0.012, 0.04, 1.0, dark); v.position.set(-1.952, 0.25 + i * 0.09, 0.6); top.add(v); }
  g.add(top); P.top = top; P.shellMat = shellMat;

  // Main board with its chips.
  const brd = new THREE.Group();
  const pcb = box(1.25, 0.03, 2.3, M.matte(0x1c5a3c)); pcb.position.set(0.075, 0.2, 0); brd.add(pcb);
  const [sx, , sz] = LAYOUT.soc;
  const sub = box(0.52, 0.02, 0.52, M.matte(0x2f7d55)); sub.position.set(sx, 0.225, sz); brd.add(sub);
  P.socMat = M.metal(0x8d96a6, { roughness: 0.35, emissive: new THREE.Color(0xff5a2a), emissiveIntensity: 0 });
  P.soc = box(0.34, 0.05, 0.34, P.socMat); P.soc.position.set(sx, 0.26, sz); brd.add(P.soc);
  P.liquid = box(0.28, 0.008, 0.28, M.metal(0xe9eef5, { roughness: 0.08 })); P.liquid.position.set(sx, 0.289, sz); brd.add(P.liquid);
  P.ramMat = M.plastic(0x2a3040, { emissive: new THREE.Color(HEX.violet), emissiveIntensity: 0 });
  P.ram = [];
  [[-0.2, 0.42, 0], [0, 0.42, 0], [0.2, 0.42, 0], [-0.2, -0.42, 0], [0, -0.42, 0], [0.2, -0.42, 0], [-0.42, 0, 1], [0.42, 0, 1]].forEach(([dx, dz, rot]) => {
    const c = box(0.14, 0.035, 0.2, P.ramMat); c.position.set(sx + dx, 0.232, sz + dz); if (rot) c.rotation.y = Math.PI / 2; brd.add(c); P.ram.push(c);
  });
  P.ssdMat = M.plastic(0x1b2a4d, { emissive: new THREE.Color(HEX.data), emissiveIntensity: 0 });
  P.ssd = [];
  const ctl = box(0.2, 0.035, 0.2, M.plastic(0x14171c)); ctl.position.set(sx, 0.232, 0.42); brd.add(ctl);
  [-0.25, 0, 0.25].forEach((dx) => [0.74, 1.0].forEach((z) => { const c = box(0.17, 0.035, 0.22, P.ssdMat); c.position.set(sx + dx, 0.232, z); brd.add(c); P.ssd.push(c); }));
  g.add(brd); P.board = brd;

  // Heatsink: a copper plate on the chip, heat pipes, and a stack of thin fins in the air stream.
  const sink = new THREE.Group();
  P.copper = M.metal(HEX.copper, { roughness: 0.3, emissive: new THREE.Color(0xff3b1a), emissiveIntensity: 0 });
  const base = box(0.56, 0.05, 0.56, P.copper); base.position.set(sx, 0.32, sz); sink.add(base);
  P.pipes = [];
  [[-0.18, 0.34, -0.25], [-0.06, 0.52, -0.5], [0.06, 0.66, -0.8], [0.18, 0.4, -1.05]].forEach(([dz, y, zf]) => {
    const p = tube([[sx + 0.25, 0.37, sz + dz], [sx - 0.25, 0.37, sz + dz], [-0.5, (0.37 + y) / 2, (sz + dz + zf) / 2], [-0.72, y, zf], [-1.82, y, zf]], 0.035, P.copper, false, 80);
    sink.add(p); P.pipes.push(p);
  });
  P.finMat = M.metal(0xc3c9d3, { roughness: 0.4, emissive: new THREE.Color(0xff5a2a), emissiveIntensity: 0 });
  const finG = new THREE.BoxGeometry(0.018, 0.68, 1.1);
  for (let i = 0; i < 22; i++) { const f = new THREE.Mesh(finG, P.finMat); f.castShadow = true; f.position.set(-1.83 + i * 0.055, 0.5, -0.65); sink.add(f); }
  g.add(sink); P.sink = sink;

  P.fan = makeBlower(1.2, 0.45); P.fan.position.set(...LAYOUT.fan); g.add(P.fan);

  const psu = new THREE.Group();
  const pb = box(1.0, 0.6, 1.05, M.metal(0x5d6470, { roughness: 0.55 })); psu.add(pb);
  for (let i = 0; i < 6; i++) { const v = box(0.7, 0.012, 0.03, dark); v.position.set(0, 0.302, -0.36 + i * 0.14); psu.add(v); }
  psu.position.set(...LAYOUT.psu); g.add(psu); P.psu = psu;

  const drive = new THREE.Group();
  const db = box(1.05, 0.3, 1.2, M.metal(0x3c424d, { roughness: 0.5 })); drive.add(db);
  P.disc = new THREE.Group();
  const d1 = vcyl(0.5, -0.006, 0.006, M.metal(0xbcc8ff, { roughness: 0.12 }), 48); P.disc.add(d1);
  const d2 = vcyl(0.09, -0.008, 0.008, M.plastic(0x15181d)); P.disc.add(d2);
  const mark = box(0.3, 0.004, 0.02, M.plastic(0x6f7ab0)); mark.position.set(0.28, 0.008, 0); P.disc.add(mark);
  P.disc.position.y = 0.165; drive.add(P.disc);
  drive.position.set(...LAYOUT.drive); g.add(drive); P.drive = drive;

  g.parts = P;
  // k = 0: a solid shell. k = 1: a ghost you can see through.
  g.setShell = (k) => { shellMat.opacity = 1 - 0.88 * clamp(k, 0, 1); shellMat.depthWrite = k < 0.05; };
  return g;
}

// ---------------------------------------------------------------- a generic gamepad
// About 16 cm wide (1 unit = 10 cm): two grips, two thumb sticks, a plain cross pad, four plain
// round buttons and two triggers. No symbols, light bar or touch pad.
export function makeController(col = 0xe6e9ef) {
  const g = new THREE.Group(), P = {};
  const bodyMat = M.plastic(col, { transparent: true, opacity: 1 }), dark = M.plastic(0x1b1e24);
  const body = box(1.5, 0.3, 0.62, bodyMat); body.position.y = 0.15; g.add(body);
  [-1, 1].forEach((k) => {
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.5, 8, 16), bodyMat); grip.castShadow = true;
    grip.rotation.x = Math.PI / 2 - 0.25; grip.rotation.z = -k * 0.22; grip.position.set(k * 0.66, 0.08, 0.42); g.add(grip);
  });
  P.sticks = [-1, 1].map((k) => {
    const st = new THREE.Group();
    const shaft = vcyl(0.045, 0, 0.14, dark, 16), cap = vcyl(0.105, 0.14, 0.18, dark, 24); st.add(shaft, cap);
    st.position.set(k * 0.3, 0.3, 0.16); g.add(st); return st;
  });
  const padH = box(0.3, 0.03, 0.1, dark), padV = box(0.1, 0.03, 0.3, dark);
  padH.position.set(-0.52, 0.31, -0.1); padV.position.set(-0.52, 0.31, -0.1); g.add(padH, padV);
  [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]].forEach(([dx, dz]) => { const b = vcyl(0.048, 0.3, 0.33, dark, 20); b.position.x = 0.52 + dx; b.position.z = -0.1 + dz; g.add(b); });
  P.triggers = [-1, 1].map((k) => { const t = box(0.3, 0.12, 0.16, dark); t.position.set(k * 0.52, 0.2, -0.36); g.add(t); return t; });
  P.bodyMat = bodyMat;
  g.parts = P;
  return g;
}
