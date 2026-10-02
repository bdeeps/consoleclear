// Chapter 2: one frame, from thumb to screen, inside a fixed time budget.
//
// What is exact: the budgets (1000 ms ÷ frame rate: 33.3, 16.7, 8.3 ms), the pixel counts
// (1920×1080, 2560×1440, 3840×2160), and the rule that a frame which misses the screen's refresh
// has to wait for the next one, so 60 fps falls straight to 30 fps (double-buffered v-sync).
//
// What is a teaching model: the cost of each step. Real games differ widely, so we use a simple,
// honest rule: GPU time grows in step with the number of pixels shaded, and heavier effects cost
// more per pixel. The constants are set so the model behaves like well-known PS5 games, which
// offer a 4K mode at 30 fps with ray tracing or a lower-resolution mode at 60 fps
// (for example Marvel's Spider-Man: Miles Morales, 2020). Real engines also overlap these steps
// across CPU cores; we show them one after another so the budget is easy to read.
import { THREE, M, box, tube, approach, clamp } from '../kit.js';
import { board, panelBg, text, rrect, COL, HEX, RES, mp, makeController, pathOf, fitNarrow, slim, isTall, tallView } from '../console.js';

const FX = { low: { name: 'Low', k: 0.7 }, high: { name: 'High', k: 1 }, rt: { name: 'Ray tracing', k: 1.7 } };
const GPU_FIXED = 0.6, GPU_PER_MP = 1.15;        // ms, and ms per million pixels at "High"
const TALL = { pos: [0.9, 7.4, 7.2], target: [0, 3.0, 0.5] };
const SLOW = 40;                                 // the model runs 40 times slower than life
const MIN_MP = 1.0;                              // dynamic resolution will not go below this

export function frameModel(s) {
  const B = 1000 / s.fps;
  const input = 0.2, logic = 1.5 + 2.5 * s.crowd, draws = 1 + 1.5 * s.crowd, cpu = input + logic + draws;
  const k = FX[s.fx].k, full = mp(s.res);
  let mpr = full;
  if (s.dyn) mpr = clamp((0.94 * B - cpu - GPU_FIXED) / (GPU_PER_MP * k), MIN_MP, full);
  const gpu = GPU_FIXED + GPU_PER_MP * mpr * k, T = cpu + gpu;
  const waits = Math.max(1, Math.ceil(T / B - 1e-6));
  return { B, input, logic, draws, cpu, gpu, T, mpr, full, hr: Math.round(Math.sqrt((mpr * 1e6 * 9) / 16) / 10) * 10, fpsOut: s.fps / waits, waits };
}

// The little game on the TV. tg is game time in ms.
function drawGame(g, w, h, tg, fx) {
  const t = tg / 1000, hz = h * 0.72;
  const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#1b2a5c'); sky.addColorStop(1, fx === 'low' ? '#4a5aa0' : '#f08a5d');
  g.fillStyle = sky; g.fillRect(0, 0, w, hz);
  g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(w * 0.78, hz * 0.62, h * 0.09, 0, 7); g.fill();
  const scene = (flip) => {
    // far hills, then buildings, scrolling at different speeds
    g.fillStyle = flip ? 'rgba(40,50,95,.5)' : '#28325f';
    g.beginPath(); g.moveTo(0, hz);
    for (let x = 0; x <= w; x += w / 48) g.lineTo(x, hz - h * (0.12 + 0.07 * Math.sin((x / w) * 9 + t * 0.35) + 0.04 * Math.sin((x / w) * 23 + t * 0.7)));
    g.lineTo(w, hz); g.fill();
    const bw = w / 7, off = (t * w * 0.22) % bw;
    for (let i = -1; i < 8; i++) {
      const id = Math.floor((t * w * 0.22) / bw) + i, hh = h * (0.16 + 0.22 * (((id * 7919) % 13 + 13) % 13) / 13), x = i * bw - off;
      g.fillStyle = '#10142a'; g.fillRect(x + bw * 0.1, hz - hh, bw * 0.8, hh);
      if (fx !== 'low') { g.fillStyle = '#ffd166'; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (((id * 31 + r * 7 + c * 13) % 5 + 5) % 5 < 2 && hz - hh + (r + 0.5) * h * 0.055 < hz - h * 0.02) g.fillRect(x + bw * (0.2 + c * 0.22), hz - hh + (r + 0.35) * h * 0.055, bw * 0.1, h * 0.025); }
    }
    // the hero: a ball that bounces along
    const bx = w * 0.32, hop = Math.abs(Math.sin(t * 4.2)), by = hz - h * 0.07 - hop * h * 0.2, br = h * 0.07;
    g.fillStyle = '#8ef0ff'; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill();
    g.strokeStyle = '#07080c'; g.lineWidth = br * 0.22; g.beginPath(); g.moveTo(bx - br * Math.cos(t * 6), by - br * Math.sin(t * 6)); g.lineTo(bx + br * Math.cos(t * 6), by + br * Math.sin(t * 6)); g.stroke();
    return { bx, hop, br };
  };
  const a = scene(false);
  g.fillStyle = fx === 'rt' ? '#1c2136' : '#2b3048'; g.fillRect(0, hz, w, h - hz);
  if (fx === 'rt') {                               // a wet street: the whole scene mirrored in it
    g.save(); g.beginPath(); g.rect(0, hz, w, h - hz); g.clip(); g.translate(0, 2 * hz); g.scale(1, -1); g.globalAlpha = 0.45; scene(true); g.restore();
  }
  if (fx !== 'low') { g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(a.bx, hz + h * 0.012, a.br * (1.2 - 0.5 * a.hop), a.br * 0.22, 0, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = h * 0.012; g.setLineDash([w * 0.05, w * 0.05]); g.lineDashOffset = t * w * 0.6;
  g.beginPath(); g.moveTo(0, hz + (h - hz) * 0.6); g.lineTo(w, hz + (h - hz) * 0.6); g.stroke(); g.setLineDash([]);
}

export default {
  id: 'frame',
  short: 'One frame',
  title: 'One frame in 16.7 milliseconds',
  subtitle: 'Read the controller, run the game, draw the picture, send it to the TV. Then do it again.',
  view: { pos: [1.4, 6.8, 10.2], target: [-0.1, 2.3, 0.9] },
  learn: `<p>A game is not a film that was made earlier. Every picture is worked out fresh, just before you see it. Each picture is called a <b>frame</b>, and the console runs the same loop for every one.</p>
    <p><b>1. Read the controller.</b> Where are the sticks, which buttons are down? <b>2. Run the game.</b> The <b>CPU</b> moves the player, runs physics and decides what enemies do. <b>3. Send draw calls.</b> The CPU hands the GPU a list: draw this model here, with this texture. <b>4. Draw.</b> The <b>GPU</b> turns that list into millions of coloured pixels and stores them in the <b>frame buffer</b>. <b>5. Send it out</b> down the HDMI cable when the TV asks for its next picture.</p>
    <p>A TV refreshes at fixed moments. At <b>60 frames a second</b> it wants a new picture every <b>16.7 ms</b>; at 120, every <b>8.3 ms</b>. That is the <b>frame budget</b>. If the frame is not finished in time, the TV shows the old picture again and the game stutters. Miss every time and 60 fps becomes 30.</p>
    <p>So games bargain. Fewer pixels or simpler effects make the GPU faster. <b>Dynamic resolution</b> does the bargaining live: when a scene gets heavy, the game quietly draws fewer pixels, then <b>upscales</b> the picture to fill the screen.</p>
    <p class="tip"><b>Try it:</b> switch effects to ray tracing at 4K and watch the frame miss its deadline. Then turn on dynamic resolution, or ask for 120 fps and see what has to give.</p>`,
  terms: [
    { t: 'Frame', d: 'One complete picture. A game draws 30, 60 or 120 of them every second.' },
    { t: 'Frame budget', d: 'The time allowed for one frame: 1,000 ms divided by the frame rate.' },
    { t: 'Draw call', d: 'An order from the CPU to the GPU: draw this object, here, like this.' },
    { t: 'Frame buffer', d: 'The block of memory that holds the finished picture, one colour per pixel.' },
    { t: 'V-sync', d: 'Waiting for the screen’s refresh before swapping pictures, so you never see half of one.' },
    { t: 'Dynamic resolution', d: 'Drawing fewer pixels when a scene is heavy, so the frame still arrives on time.' },
  ],
  defaults: { res: 2160, fx: 'high', fps: 60, crowd: 0.5, dyn: false },
  controls: [
    { key: 'res', type: 'seg', label: 'Resolution', options: [{ v: 1080, label: '1080p' }, { v: 1440, label: '1440p' }, { v: 2160, label: '4K' }], fmt: (v) => mp(v).toFixed(1) + ' million pixels' },
    { key: 'fx', type: 'seg', label: 'Effects', options: [{ v: 'low', label: 'Low' }, { v: 'high', label: 'High' }, { v: 'rt', label: 'Ray tracing' }] },
    { key: 'fps', type: 'seg', label: 'Target frame rate', options: [{ v: 30, label: '30' }, { v: 60, label: '60' }, { v: 120, label: '120' }], fmt: (v) => (1000 / v).toFixed(1) + ' ms each' },
    { key: 'crowd', type: 'range', label: 'How busy the scene is', min: 0, max: 1, step: 0.01, ends: ['empty street', 'huge battle'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'dyn', type: 'toggle', label: 'Dynamic resolution', hint: 'Draw fewer pixels when needed, then upscale.' },
  ],
  quiz: [
    { q: 'At 60 frames a second, how long does the console have to make each frame?', options: ['About 1.7 ms', 'About 16.7 ms', 'About 60 ms', 'About 167 ms'], answer: 1, why: '1,000 ms ÷ 60 = 16.7 ms. At 120 fps the budget halves to 8.3 ms.' },
    { q: 'A game aiming for 60 fps takes 20 ms on every frame. With v-sync, what do you see?', options: ['50 fps', '60 fps, a bit blurry', '30 fps', 'Nothing at all'], answer: 2, why: 'Each frame misses one refresh and is shown at the next, 33.3 ms after the last. That is 30 fps.' },
    { q: 'Why does lowering the resolution make frames faster?', options: ['The TV works less hard', 'The GPU has fewer pixels to shade', 'The controller sends less data', 'The disc spins faster'], answer: 1, why: '4K has 8.3 million pixels and 1080p has 2.1 million. The GPU’s work grows with the number of pixels it colours in.' },
  ],
  reel: [
    { ms: 5600, caption: 'Read the controller, run the game, draw the picture: the console does all of it in 16.7 milliseconds.', set: { res: 2160, fx: 'high', fps: 60, crowd: 0.5, dyn: false }, view: { pos: [1.9, 8.2, 13.0], target: [-0.1, 2.3, 0.9] }, spin: 0.25 },
    { ms: 5600, caption: 'Ask for too much and the frame misses its deadline. 60 frames a second drops to 30.', set: { res: 2160, fps: 60, crowd: 0.5, dyn: false }, anim: { fx: ['high', 'rt'] }, view: { pos: [0.5, 7.6, 12.5], target: [0, 2.3, 0.9] }, spin: 0.15 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const tall = isTall(stage);
    // The main board with the system-on-chip: a CPU half and a GPU half.
    const pcb = box(6.2, 0.12, 3.3, M.matte(0x1c5a3c)); pcb.position.set(0, 0.06, 0.6); root.add(pcb);
    const cpuPad = box(2.3, 0.1, 2.1, M.plastic(0x232a38)); cpuPad.position.set(-1.6, 0.17, 0.75); root.add(cpuPad);
    const gpuPad = box(2.9, 0.1, 2.1, M.plastic(0x232a38)); gpuPad.position.set(1.25, 0.17, 0.75); root.add(gpuPad);
    const coreMats = [], cores = [];
    for (let i = 0; i < 8; i++) {
      const m = M.plastic(0x2c4a66, { emissive: new THREE.Color(HEX.data), emissiveIntensity: 0 });
      const c = box(0.42, 0.08, 0.78, m); c.position.set(-2.4 + (i % 4) * 0.53, 0.26, 0.3 + Math.floor(i / 4) * 0.9); root.add(c); coreMats.push(m); cores.push(c);
    }
    const GX = 14, GZ = 9, NT = GX * GZ;
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.07, 0.17), new THREE.MeshBasicMaterial({ toneMapped: false }), NT);
    const o3 = new THREE.Object3D(), cOff = new THREE.Color(0x3a2a26), cOn = new THREE.Color(HEX.hot), cc = new THREE.Color();
    for (let i = 0; i < NT; i++) { o3.position.set(-0.03 + (i % GX) * 0.197, 0.255, -0.12 + Math.floor(i / GX) * 0.217); o3.updateMatrix(); tiles.setMatrixAt(i, o3.matrix); tiles.setColorAt(i, cOff); }
    root.add(tiles);
    const fbMat = M.plastic(0x2a3040, { emissive: new THREE.Color(HEX.violet), emissiveIntensity: 0 });
    for (let i = 0; i < 4; i++) { const c = box(0.5, 0.1, 0.34, fbMat); c.position.set(0.35 + i * 0.6, 0.17, -0.7); root.add(c); }

    const pad = makeController(); pad.scale.setScalar(1.5); pad.position.set(...(tall ? [-1.2, 0.05, 3.5] : [-4.1, 0.05, 1.5])); pad.rotation.y = tall ? 0.25 : 0.5; root.add(pad);

    // The TV, an HDMI cable, and the budget bar above it.
    const tvW = 5.6, tvH = tvW * 9 / 16, tvY = 3.2, tvZ = -2.5, tvX = tall ? 0 : 1.3;
    const bezel = box(tvW + 0.16, tvH + 0.16, 0.1, M.plastic(0x101216)); bezel.position.set(tvX, tvY, tvZ - 0.06); root.add(bezel);
    const foot = box(1.6, 0.08, 0.7, M.plastic(0x101216)); foot.position.set(tvX, 0.04, tvZ); root.add(foot);
    const neck = box(0.2, tvY - tvH / 2, 0.1, M.plastic(0x101216)); neck.position.set(tvX, (tvY - tvH / 2) / 2, tvZ - 0.08); root.add(neck);
    const off = document.createElement('canvas'), og = off.getContext('2d');
    let hud = { fps: 60, missed: false, note: '' };
    const tv = board(root, tvW, tvH, 960, 540, (g, w, h) => {
      g.imageSmoothingEnabled = true; g.drawImage(off, 0, 0, w, h);
      g.fillStyle = 'rgba(7,8,12,.7)'; rrect(g, w - 330, 16, 314, 54, 12); g.fill();
      text(g, `${Math.round(hud.fps)} fps`, w - 316, 54, { font: 'bold 32px sans-serif', col: hud.missed ? COL.bad : COL.good });
      text(g, hud.note, w - 206, 52, { font: '22px sans-serif', col: COL.soft });
    }, [tvX, tvY, tvZ]);
    const cable = tube([[1.25, 0.2, -1.05], [1.25, 0.25, -1.7], [1.25, 0.8, -2.35], [1.25, tvY - tvH / 2 + 0.1, tvZ - 0.02]], 0.05, M.plastic(0x15181d), false, 60); root.add(cable);

    let fm = null, prog = 0;
    const bar = board(root, 7.0, 1.51, 1160, 250, (g, w, h) => {
      panelBg(g, w, h, 0.92);
      if (!fm) return;
      const x0 = 28, bw = w - 56, scale = bw / Math.max(2.25 * fm.B, fm.T * 1.08), y = 96, bh = 64;
      const late = fm.T > fm.B;
      text(g, `One frame takes ${fm.T.toFixed(1)} ms`, x0, 46, { font: 'bold 36px sans-serif', col: '#eef2fa' });
      text(g, late ? `over the ${fm.B.toFixed(1)} ms budget` : `inside the ${fm.B.toFixed(1)} ms budget`, w - 28, 46, { font: 'bold 30px sans-serif', col: late ? COL.bad : COL.good, align: 'right' });
      g.fillStyle = 'rgba(255,255,255,.07)'; rrect(g, x0, y, bw, bh, 10); g.fill();
      let x = x0;
      [[fm.input, COL.gold, 'Read pad'], [fm.logic, COL.data, 'Game logic'], [fm.draws, COL.violet, 'Draw calls'], [fm.gpu, COL.hot, 'GPU draws']].forEach(([ms, col, name]) => {
        const sw = ms * scale; g.fillStyle = col; g.fillRect(x, y, Math.max(2, sw - 2), bh);
        if (sw > 120) text(g, name, x + 10, y + 41, { font: 'bold 24px sans-serif', col: '#07080c' });
        x += sw;
      });
      for (let k = 1; k <= 2; k++) {
        const bx = x0 + fm.B * k * scale; if (bx > x0 + bw) break;
        g.fillStyle = k === 1 ? '#ffffff' : 'rgba(255,255,255,.4)'; g.fillRect(bx - 2, y - 14, 4, bh + 28);
        text(g, k === 1 ? `${fm.B.toFixed(1)} ms: the TV refreshes` : 'next refresh', bx, y + bh + 44, { font: '24px sans-serif', col: k === 1 ? '#fff' : COL.soft, align: bx > w * 0.72 ? 'right' : 'center' });
      }
      const cx = x0 + Math.min(prog, 1) * fm.T * scale; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx, y - 4); g.lineTo(cx - 10, y - 20); g.lineTo(cx + 10, y - 20); g.fill();
      text(g, 'CPU', x0, y + bh + 44, { font: '24px sans-serif', col: COL.data });
      text(g, 'GPU', x0 + 70, y + bh + 44, { font: '24px sans-serif', col: COL.hot });
    }, [-0.5, 0.7, 4.1]);
    bar.mesh.rotation.x = -0.85;
    if (tall) { bar.mesh.position.set(0, tvY + tvH / 2 + 0.8, tvZ); bar.mesh.rotation.x = 0; bar.mesh.scale.setScalar(0.82); }

    // The frame's journey.
    const pIn = pathOf(tall ? [[-1.2, 0.55, 3.5], [-2.0, 1.3, 2.2], [-2.4, 0.5, 0.3]] : [[-4.0, 0.55, 1.5], [-3.3, 1.2, 1.0], [-2.4, 0.5, 0.3]]);
    const pCpu = pathOf([[-2.4, 0.5, 0.3], [-0.8, 0.5, 0.3], [-0.8, 0.5, 1.2], [-2.4, 0.5, 1.2]]);
    const pDraw = pathOf([[-2.4, 0.5, 1.2], [-1.2, 0.9, 0.8], [0.1, 0.5, 0.75]]);
    const pOut = pathOf([[1.25, 0.45, -0.7], [1.25, 0.4, -1.7], [1.25, 0.95, -2.3], [1.25, tvY - tvH / 2, tvZ + 0.05]]);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), M.glow(HEX.gold)); root.add(dot);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), M.glow(0xffffff)); root.add(flash);
    const v = new THREE.Vector3();

    const labels = [
      stage.label('Controller', [-4.1, 0.95, 1.5], root),
      stage.label('CPU: runs the game', [-2.3, 0.75, -0.5], root),
      stage.label('GPU: draws the pixels', [2.9, 0.6, 1.3], root),
      stage.label('Frame buffer in memory', [3.3, 1.0, -1.0], root),
      stage.label('HDMI', [1.75, 1.0, -2.2], root),
    ];
    const stepLbl = stage.label('', [0, 1.5, 0], root, 'hot');

    let simT = 0, prodStart = 0, nextV = 0, T = 0, lastB = 0, shownFps = 60, sinceShow = 0, lastShowT = 0, pulse = 1, ready = false, key = '';
    const paint = (s, tg) => {
      const k = Math.sqrt(fm.mpr / mp(2160));
      off.width = Math.max(96, Math.round(960 * k)); off.height = Math.round(off.width * 9 / 16);
      drawGame(og, off.width, off.height, tg * 0.9, s.fx);
      tv.redraw();
    };
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        fitNarrow(stage, [labels[3], labels[4]], -0.1, [0.04, -0.06]); tallView(stage, TALL);
        const now = frameModel(s), k2 = `${s.res}|${s.fx}|${s.fps}|${s.dyn}`;
        if (!fm || now.B !== lastB) { lastB = now.B; nextV = simT + now.B; }
        if (!fm) { fm = now; T = now.T; paint(s, 0); }
        if (k2 !== key) { key = k2; hud.note = now.mpr < now.full - 0.01 ? `${now.hr}p upscaled` : RES[s.res].name; }
        simT += (dt * 1000) / SLOW;
        // Each time the TV refreshes: show the new frame if it is finished, or repeat the old one.
        let guard = 0;
        while (simT >= nextV && guard++ < 8) {
          if (prodStart + T <= nextV + 1e-6) {
            shownFps = 1000 / Math.max(now.B, nextV - lastShowT); lastShowT = nextV;
            fm = now; hud.fps = fm.fpsOut; hud.missed = fm.T > fm.B;
            paint(s, prodStart); pulse = 0;
            prodStart = nextV; T = now.T;
          }
          nextV += now.B;
        }
        prog = (simT - prodStart) / T; ready = prog >= 1;
        const ms = clamp(prog, 0, 1) * T, f = { ...now, T };
        // Where is the frame now?
        let step = '';
        if (ms < f.input) { pIn.at(ms / f.input, v); step = '1 Read the controller'; dot.material.color.setHex(HEX.gold); }
        else if (ms < f.input + f.logic) { pCpu.at((ms - f.input) / f.logic, v); step = '2 Game logic and physics'; dot.material.color.setHex(HEX.data); }
        else if (ms < f.cpu) { pDraw.at((ms - f.input - f.logic) / f.draws, v); step = '3 Send draw calls'; dot.material.color.setHex(HEX.violet); }
        else if (!ready) { const g = (ms - f.cpu) / Math.max(0.001, T - f.cpu), i = Math.min(NT - 1, Math.floor(g * NT)); v.set(-0.03 + (i % GX) * 0.197, 0.5, -0.12 + Math.floor(i / GX) * 0.217); step = '4 The GPU draws the pixels'; dot.material.color.setHex(HEX.hot); }
        else { v.set(1.25, 0.5 + 0.05 * Math.sin(simT * 0.6), -0.7); step = '5 Finished: waiting for the TV'; dot.material.color.setHex(HEX.good); }
        dot.position.copy(v);
        stepLbl.position.set(v.x, v.y + 0.55, v.z); stepLbl.element.textContent = step;
        const busyCpu = ms >= f.input && ms < f.cpu;
        coreMats.forEach((m, i) => { m.emissiveIntensity = busyCpu && Math.sin(simT * (0.9 + i * 0.37) + i * 2.1) > -0.2 ? 0.9 : 0.05; });
        const gk = ready ? 1 : ms < f.cpu ? 0 : (ms - f.cpu) / Math.max(0.001, T - f.cpu);
        for (let i = 0; i < NT; i++) tiles.setColorAt(i, cc.copy(cOff).lerp(cOn, i / NT < gk ? 1 : 0));
        tiles.instanceColor.needsUpdate = true;
        fbMat.emissiveIntensity = ready ? 0.9 : 0.1;
        // The finished picture racing down the cable.
        pulse = Math.min(1, pulse + dt * 3.2); pOut.at(pulse, v); flash.position.copy(v); flash.visible = pulse < 1;
        sinceShow += dt; if (sinceShow > 0.05) { sinceShow = 0; bar.redraw(); }
      },
      readout(s) { return slim(stage, this.full(s), 1); },
      full(s) {
        const m = frameModel(s), ok = m.T <= m.B;
        const head = ok ? `<div class="big">${s.fps} fps: on time</div>` : `<div class="big">Too slow: ${Math.round(m.fpsOut)} fps</div>`;
        return `${head}<div class="row"><span>This frame takes</span><b class="${ok ? 'ok' : 'no'}">${m.T.toFixed(1)} ms</b></div>
          <div class="row"><span>Budget at ${s.fps} fps</span><b>${m.B.toFixed(1)} ms</b></div>
          <div class="row"><span>Of which</span><b>CPU ${m.cpu.toFixed(1)} + GPU ${m.gpu.toFixed(1)} ms</b></div>
          <div class="row"><span>Pixels drawn</span><b>${m.mpr.toFixed(1)} million${m.mpr < m.full - 0.01 ? `, shown as ${RES[s.res].name}` : ''}</b></div>
          <small>Shown ${SLOW} times slower than life. Step costs are a simple model.</small>`;
      },
    };
  },
};
