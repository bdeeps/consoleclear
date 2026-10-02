// Chapter 3: how a GPU turns triangles into pixels.
//
// The picture on the screens in this chapter is not a mock-up. It is drawn by a small software
// renderer in this file that follows the same steps as a real GPU:
//   1. project every corner (vertex) from the 3D world onto the screen as seen from the camera;
//   2. join the corners into triangles;
//   3. rasterise: for each triangle, test which pixel centres fall inside it (edge functions),
//      keeping the nearest triangle at each pixel with a depth buffer;
//   4. shade: colour each pixel from the surface's own colour and how squarely it faces the light
//      (Lambert's cosine law);
//   5. ray trace: from each visible point, send one ray towards the light (blocked = in shadow) and,
//      for the shiny floor, one mirror ray (Möller-Trumbore ray-triangle test).
// Method: any graphics text, for example Marschner & Shirley, "Fundamentals of Computer Graphics";
// Pineda, "A Parallel Algorithm for Polygon Rasterization" (SIGGRAPH 1988); Möller & Trumbore (1997).
// Real-console numbers: 3840×2160 = 8,294,400 pixels; ×60 = 498 million pixels a second; the PS5's
// GPU is rated at 10.28 TFLOPS (Sony, March 2020), which is about 20,000 sums for every pixel of
// every frame at 4K and 60 fps.
import { THREE, M, box, sphere, clamp } from '../kit.js';
import { board, text, COL, HEX, ray, SPEC, fitNarrow, slim, inReel, isTall, tallView } from '../console.js';

const GRID = [16, 32, 48, 64, 80, 96];
const STEPS = ['Corners', 'Triangles', 'Rasterise', 'Shade', 'Ray trace'];
const E = [-4.2, 2.9, 0], PX = -1.4, PW = 3.2, PH = 1.8, PYC = 2.4;       // camera, and the screen plane it looks through
const C = [2.0, 2.35, 0], LIGHT = [0.6, 5.2, 3.2], FLOOR_Y = 0.9, FW = 4.2;
const OBJ = [1.0, 0.55, 0.25];
const TALL = { pos: [0.5, 6.8, 8.4], target: [-0.3, 4.7, -0.6] };

function hsl(h, s, l) { const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }

export default {
  id: 'gpu',
  short: 'Triangles to pixels',
  title: 'The GPU: triangles into pixels',
  subtitle: 'A game world is made of triangles. The GPU works out what colour each pixel should be.',
  view: { pos: [1.4, 5.8, 8.9], target: [0, 3.5, -0.5] },
  learn: `<p>Everything in a 3D game, from a face to a mountain, is a skin of flat <b>triangles</b>. Each corner is a <b>vertex</b>: three numbers saying where it is in the world. A modern game scene has millions of them.</p>
    <p>The GPU’s first job is geometry. It works out where every vertex lands on the screen as seen from the game’s camera. Then it <b>rasterises</b>: for each triangle, it finds which <b>pixels</b> fall inside. Where triangles overlap, a <b>depth buffer</b> keeps the nearest one.</p>
    <p>Then comes <b>shading</b>. For every covered pixel a small program works out the colour: the surface’s texture, and how squarely it faces the light. This is most of the GPU’s work, which is why more pixels means more time.</p>
    <p><b>Ray tracing</b> adds what rasterising cannot see. From each point it fires a ray towards the light: if something is in the way, the point is in shadow. A ray bounced off a shiny floor finds what should be reflected there. Each ray must be tested against the scene, so it is costly.</p>
    <p><b>Upscaling</b> is the escape hatch: shade fewer pixels, then fill in the gaps cleverly. Console upscalers such as FSR and PSSR also reuse detail from earlier frames.</p>
    <p class="tip"><b>Try it:</b> step through the five stages, then drag the pixel count up and watch the jagged edges smooth out and the work grow.</p>`,
  terms: [
    { t: 'Vertex', d: 'A corner point of a triangle, stored as three numbers: x, y and z.' },
    { t: 'Rasterising', d: 'Working out which pixels each triangle covers on the screen.' },
    { t: 'Depth buffer', d: 'A note of how far away the nearest surface is at every pixel, so near things hide far things.' },
    { t: 'Shader', d: 'A small program the GPU runs for every vertex or pixel to work out position or colour.' },
    { t: 'Ray tracing', d: 'Following rays of light through the scene to get true shadows and reflections.' },
    { t: 'Upscaling', d: 'Drawing a picture with fewer pixels and then enlarging it to fill the screen.' },
  ],
  defaults: { step: 3, px: 3, up: false, spin: true },
  controls: [
    { key: 'step', type: 'seg', label: 'Stage', options: STEPS.map((label, v) => ({ v, label })) },
    { key: 'px', type: 'range', label: 'Pixels on the screen', min: 0, max: GRID.length - 1, step: 1, ends: ['16 × 9', '96 × 54'], fmt: (v) => { const w = GRID[Math.round(v)]; return `${w} × ${(w * 9) / 16} = ${(w * w * 9) / 16}`; } },
    { key: 'up', type: 'toggle', label: 'Upscale', hint: 'Shade a quarter of the pixels, then enlarge and smooth.' },
    { key: 'spin', type: 'toggle', label: 'Spin the model' },
  ],
  quiz: [
    { q: 'What are 3D game worlds built from?', options: ['Tiny cubes', 'Triangles', 'Photographs', 'Circles'], answer: 1, why: 'Triangles are the simplest flat shape, and three points always lie in one plane, so GPUs are built to draw them fast.' },
    { q: 'What does rasterising do?', options: ['Loads the game from disc', 'Finds which pixels each triangle covers', 'Reads the controller', 'Cools the chip'], answer: 1, why: 'It turns each triangle, already placed on the screen, into the set of pixels inside it.' },
    { q: 'Why is ray tracing slower than plain shading?', options: ['It uses more colours', 'Each ray must be tested against the scene’s triangles', 'It needs a bigger TV', 'It reads the disc more often'], answer: 1, why: 'A shadow or mirror ray has to find what it hits. That search is extra work for every pixel, every frame.' },
  ],
  reel: [
    { ms: 5600, caption: 'Game worlds are made of triangles. The GPU finds which pixels each one covers, then colours them in.', set: { px: 4, up: false, spin: true }, anim: { step: [0, 3] }, view: { pos: [1.8, 6.5, 11.7], target: [0, 3.5, -0.5] }, spin: 0.2 },
    { ms: 5400, caption: 'Ray tracing fires rays towards the light and off shiny floors: real shadows and reflections, at a high price.', set: { step: 4, px: 5, up: false, spin: true }, view: { pos: [-1.1, 6.0, 11.3], target: [0.2, 3.4, -0.5] }, spin: 0.2 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---------------------------------------------------------------- the 3D scene
    const icoG = new THREE.IcosahedronGeometry(1.3, 0).toNonIndexed();
    const objMat = M.plastic(0xff8c40, { flatShading: true, transparent: true });
    const obj = new THREE.Mesh(icoG, objMat); obj.castShadow = true; obj.position.set(...C); root.add(obj);
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(icoG), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); obj.add(wire);
    const pos = icoG.attributes.position, NTRI = pos.count / 3;
    const uniq = []; for (let i = 0; i < pos.count; i++) { const p = [pos.getX(i), pos.getY(i), pos.getZ(i)]; if (!uniq.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-3)) uniq.push(p); }
    const dots = uniq.map((p) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), M.glow(HEX.gold)); d.position.set(...p); obj.add(d); return d; });

    const fc = document.createElement('canvas'); fc.width = 420; fc.height = 440; const fg = fc.getContext('2d');
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) { fg.fillStyle = (x + z) % 2 ? '#aeb6c6' : '#5a6276'; fg.fillRect(x * 100, z * 100 - 20, 100, 100); }
    const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, 4.4), new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.35, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(FW / 2, FLOOR_Y, 0); floor.receiveShadow = true; root.add(floor);
    const slab = box(FW, FLOOR_Y - 0.02, 4.4, M.matte(0x1a1e28)); slab.position.set(FW / 2, (FLOOR_Y - 0.02) / 2, 0); root.add(slab);

    const lamp = sphere(0.16, M.glow(0xfff2c0)); lamp.position.set(...LIGHT); root.add(lamp);
    const cam = new THREE.Group();
    const cb = box(0.7, 0.45, 0.45, M.plastic(0x23262d)); cb.position.x = -0.35; cam.add(cb);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 24), M.plastic(0x101216)); lens.rotation.z = -Math.PI / 2; lens.position.x = 0.12; cam.add(lens);
    const pole = box(0.08, E[1], 0.08, M.plastic(0x23262d)); pole.position.set(-0.4, -E[1] / 2, 0); cam.add(pole);
    cam.position.set(...E); root.add(cam);
    const vE = new THREE.Vector3(...E), vL = new THREE.Vector3(...LIGHT);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
      const r = ray(0xffffff, 0.008, 0.28); root.add(r);
      const d = new THREE.Vector3(PX - E[0], PYC + a * PH / 2 - E[1], b * PW / 2).multiplyScalar(1.02); r.aim(vE, vE.clone().add(d));
    });

    // ---------------------------------------------------------------- the software renderer
    const DW = 960, DH = 540;
    const small = document.createElement('canvas'), sg = small.getContext('2d');
    let stats = { W: 0, H: 0, tests: 0, covered: 0, rays: 0 }, sample = null;
    const T = new Float64Array((NTRI + 2) * 12), NT = NTRI + 2;        // per triangle: p0, e1, e2, normal
    const scr = new Float64Array(NT * 9);                              // per triangle: 3 × (x, y, 1/depth) in pixels
    const setTri = (i, a, b, c) => {
      const o = i * 12; T[o] = a[0]; T[o + 1] = a[1]; T[o + 2] = a[2];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      T[o + 3] = e1[0]; T[o + 4] = e1[1]; T[o + 5] = e1[2]; T[o + 6] = e2[0]; T[o + 7] = e2[1]; T[o + 8] = e2[2];
      let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; const L = Math.hypot(nx, ny, nz) || 1;
      T[o + 9] = nx / L; T[o + 10] = ny / L; T[o + 11] = nz / L;
    };
    const F = [[0, FLOOR_Y, -2.2], [FW, FLOOR_Y, -2.2], [FW, FLOOR_Y, 2.2], [0, FLOOR_Y, 2.2]];
    setTri(NTRI, F[0], F[2], F[1]); setTri(NTRI + 1, F[0], F[3], F[2]);
    // Nearest hit of a ray among triangles [from, to), ignoring `skip`. Returns distance (or Infinity).
    let hitTri = -1;
    const trace = (ox, oy, oz, dx, dy, dz, skip, from, to, tmax = Infinity) => {
      let best = tmax; hitTri = -1;
      for (let i = from; i < to; i++) {
        if (i === skip) continue;
        const o = i * 12, e1x = T[o + 3], e1y = T[o + 4], e1z = T[o + 5], e2x = T[o + 6], e2y = T[o + 7], e2z = T[o + 8];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-9 && det < 1e-9) continue;
        const inv = 1 / det, tx = ox - T[o], ty = oy - T[o + 1], tz = oz - T[o + 2], u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 1e-4 && t < best) { best = t; hitTri = i; }
      }
      return best;
    };
    // Lambert: how squarely the surface at (hx,hy,hz) with normal of triangle i faces the light.
    const lambert = (i, hx, hy, hz, vx, vy, vz) => {
      const o = i * 12; let nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
      if (nx * vx + ny * vy + nz * vz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const lx = LIGHT[0] - hx, ly = LIGHT[1] - hy, lz = LIGHT[2] - hz, L = Math.hypot(lx, ly, lz);
      return Math.max(0, (nx * lx + ny * ly + nz * lz) / L);
    };
    const base = (i, hx, hz) => (i < NTRI ? OBJ : (Math.floor(hx) + Math.floor(hz + 12.4)) % 2 ? [0.72, 0.75, 0.82] : [0.3, 0.33, 0.42]);

    const v3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
    let zbuf = new Float64Array(0), idb = new Int16Array(0), img = null;
    const render = (step, W, H, time, markSample) => {
      // corners into the world
      obj.updateMatrix(); m4.copy(obj.matrix);
      const wv = [];
      for (let i = 0; i < pos.count; i++) { v3.fromBufferAttribute(pos, i).applyMatrix4(m4); wv.push([v3.x, v3.y, v3.z]); }
      for (let i = 0; i < NTRI; i++) setTri(i, wv[i * 3], wv[i * 3 + 1], wv[i * 3 + 2]);
      // 1. project every corner onto the screen plane
      const proj = (p, o) => { const d = p[0] - E[0], k = (PX - E[0]) / d; scr[o] = ((E[2] + (p[2] - E[2]) * k + PW / 2) / PW) * W; scr[o + 1] = ((PYC + PH / 2 - (E[1] + (p[1] - E[1]) * k)) / PH) * H; scr[o + 2] = 1 / d; };
      for (let i = 0; i < NTRI; i++) for (let k = 0; k < 3; k++) proj(wv[i * 3 + k], i * 9 + k * 3);
      [[F[0], F[2], F[1]], [F[0], F[3], F[2]]].forEach((t, j) => t.forEach((p, k) => proj(p, (NTRI + j) * 9 + k * 3)));
      stats = { W, H, tests: 0, covered: 0, rays: 0 };
      if (step < 2) return;
      // 3. rasterise with a depth buffer
      const N = W * H;
      if (zbuf.length !== N) { zbuf = new Float64Array(N); idb = new Int16Array(N); small.width = W; small.height = H; img = sg.createImageData(W, H); }
      zbuf.fill(0); idb.fill(-1);
      for (let i = 0; i < NT; i++) {
        const o = i * 9, x0 = scr[o], y0 = scr[o + 1], x1 = scr[o + 3], y1 = scr[o + 4], x2 = scr[o + 6], y2 = scr[o + 7];
        const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0); if (Math.abs(area) < 1e-9) continue;
        const ax = Math.max(0, Math.floor(Math.min(x0, x1, x2))), bx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
        const ay = Math.max(0, Math.floor(Math.min(y0, y1, y2))), by = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
        for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
          stats.tests++;
          const cx = x + 0.5, cy = y + 0.5;
          const w0 = ((x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)) / area, w1 = ((x0 - x2) * (cy - y2) - (y0 - y2) * (cx - x2)) / area, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const iz = w0 * scr[o + 2] + w1 * scr[o + 5] + w2 * scr[o + 8], q = y * W + x;
          if (iz > zbuf[q]) { zbuf[q] = iz; idb[q] = i; }
        }
      }
      // 4 and 5. colour every covered pixel
      const d = img.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const q = y * W + x, i = idb[q], p = q * 4;
        let r = 0.05, g = 0.06, b = 0.1;
        if (i >= 0) {
          stats.covered++;
          if (step === 2) [r, g, b] = i < NTRI ? hsl((i * 47) % 360, 0.7, 0.6) : hsl(210, 0.25, 0.3 + 0.12 * (i - NTRI));
          else {
            const dx = PX - E[0], dy = PYC + PH / 2 - ((y + 0.5) / H) * PH - E[1], dz = -PW / 2 + ((x + 0.5) / W) * PW - E[2];
            const o = i * 12, nx = T[o + 9], ny = T[o + 10], nz = T[o + 11];
            const t = (nx * (T[o] - E[0]) + ny * (T[o + 1] - E[1]) + nz * (T[o + 2] - E[2])) / (nx * dx + ny * dy + nz * dz);
            const hx = E[0] + dx * t, hy = E[1] + dy * t, hz = E[2] + dz * t;
            let lit = lambert(i, hx, hy, hz, dx, dy, dz), col = base(i, hx, hz), mr = 0, mg = 0, mb = 0, mk = 0;
            if (step === 4) {
              const lx = LIGHT[0] - hx, ly = LIGHT[1] - hy, lz = LIGHT[2] - hz;
              stats.rays++;
              if (trace(hx, hy, hz, lx, ly, lz, i, 0, NT, 1) < 1) lit *= 0.12;
              if (i >= NTRI) {                                        // the floor is a little shiny: one mirror ray
                stats.rays++;
                const tt = trace(hx, hy, hz, dx, -dy, dz, i, 0, NTRI);
                if (hitTri >= 0) { const j = hitTri, rx = hx + dx * tt, ry = hy - dy * tt, rz = hz + dz * tt, l2 = 0.25 + 0.85 * lambert(j, rx, ry, rz, dx, -dy, dz); mr = OBJ[0] * l2; mg = OBJ[1] * l2; mb = OBJ[2] * l2; mk = 0.45; }
              }
            }
            const k = 0.22 + 0.9 * lit;
            r = col[0] * k * (1 - mk) + mr * mk; g = col[1] * k * (1 - mk) + mg * mk; b = col[2] * k * (1 - mk) + mb * mk;
          }
        }
        d[p] = 255 * Math.pow(clamp(r, 0, 1), 0.8); d[p + 1] = 255 * Math.pow(clamp(g, 0, 1), 0.8); d[p + 2] = 255 * Math.pow(clamp(b, 0, 1), 0.8); d[p + 3] = 255;
      }
      sg.putImageData(img, 0, 0);
    };

    let cur = { step: 3, W: 48, H: 27, up: false };
    const draw = (g, w, h) => {
      const { step, W, H, up } = cur;
      g.fillStyle = '#0c0e16'; g.fillRect(0, 0, w, h);
      if (step >= 2) { g.imageSmoothingEnabled = up; g.imageSmoothingQuality = 'high'; g.drawImage(small, 0, 0, w, h); }
      const cw = w / W;
      if (cw >= 14 && !up) { g.strokeStyle = step < 2 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.22)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= W; x++) { g.moveTo(x * cw, 0); g.lineTo(x * cw, h); } for (let y = 0; y <= H; y++) { g.moveTo(0, y * cw); g.lineTo(w, y * cw); } g.stroke(); }
      if (step < 2) {
        const sx = w / stats.W, sy = h / stats.H;
        if (step === 1) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i < NT; i++) { const o = i * 9; g.moveTo(scr[o] * sx, scr[o + 1] * sy); g.lineTo(scr[o + 3] * sx, scr[o + 4] * sy); g.lineTo(scr[o + 6] * sx, scr[o + 7] * sy); g.closePath(); } g.stroke(); }
        g.fillStyle = COL.gold; for (let i = 0; i < NT; i++) for (let k = 0; k < 3; k++) { const o = i * 9 + k * 3; g.beginPath(); g.arc(scr[o] * sx, scr[o + 1] * sy, 7, 0, 7); g.fill(); }
      }
      if (sample && step === 4) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(sample.u * w - 12, sample.v * h - 12, 24, 24); }
      g.fillStyle = 'rgba(7,8,12,.72)'; g.fillRect(0, h - 54, w, 54);
      text(g, `${step + 1}. ${STEPS[step]}`, 20, h - 17, { font: 'bold 30px sans-serif', col: '#eef2fa' });
      text(g, up ? `${W} × ${H} shaded, enlarged ×2` : `${W} × ${H} pixels`, w - 20, h - 17, { font: '26px sans-serif', col: COL.soft, align: 'right' });
    };
    const tall = isTall(stage), BX = tall ? -0.35 : 1.5, BY = tall ? 7.4 : 5.75, BZ = -2.6, BS = tall ? 1.45 : 1;
    const big = board(root, 6.2, 6.2 * 9 / 16, DW, DH, draw, [BX, BY, BZ]);
    const frameB = box(6.4, 6.2 * 9 / 16 + 0.2, 0.08, M.plastic(0x101216)); frameB.position.set(BX, BY, BZ - 0.06); root.add(frameB);
    big.mesh.scale.setScalar(BS); frameB.scale.set(BS, BS, 1);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: big.tex, transparent: true, opacity: 0.93, toneMapped: false, side: THREE.DoubleSide }));
    win.rotation.y = -Math.PI / 2; win.position.set(PX, PYC, 0); root.add(win);

    // ---------------------------------------------------------------- a sample ray to follow
    const r1 = ray(HEX.data, 0.022), r2 = ray(HEX.gold, 0.022), r3 = ray(HEX.violet, 0.022); root.add(r1, r2, r3);
    const hitDot = sphere(0.07, M.glow(0xffffff)); root.add(hitDot);
    const a = new THREE.Vector3(), b = new THREE.Vector3();

    const labels = [
      stage.label('Camera', [E[0] - 0.3, E[1] + 0.55, 0], root),
      stage.label('The screen: a grid of pixels', [PX, PYC + PH / 2 + 0.3, 0], root, 'hot'),
      stage.label('Light', [LIGHT[0], LIGHT[1] + 0.4, LIGHT[2]], root),
      stage.label('A model made of 20 triangles', [C[0], C[1] + 1.75, 0], root),
      stage.label('The picture so far, enlarged', [BX, BY + 2.0, BZ], root),
    ];
    const rayLbl = stage.label('', [0, 0, 0], root, 'hot');

    let ang = 0.4, t = 0, last = '';
    return {
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        fitNarrow(stage, [labels[0], labels[2], labels[4]], -0.08, [0.03, -0.05]); tallView(stage, TALL);
        const step = clamp(Math.round(s.step), 0, 4), Wd = GRID[clamp(Math.round(s.px), 0, GRID.length - 1)], up = !!s.up && step >= 2;
        const W = up ? Wd / 2 : Wd, H = Math.round((W * 9) / 16);
        if (s.spin) ang += dt * 0.5;
        obj.rotation.set(0.25, ang, 0.1);
        objMat.opacity = step === 0 ? 0.08 : step === 1 ? 0.25 : 1; objMat.depthWrite = step >= 2;
        wire.visible = step >= 1; wire.material.opacity = step === 1 ? 0.95 : 0.25;
        dots.forEach((d) => { d.visible = step <= 1; });
        // Follow one pixel's rays in the ray-tracing stage.
        sample = null; r1.visible = r2.visible = r3.visible = hitDot.visible = rayLbl.visible = false;
        const key = `${step}|${W}|${up}|${ang.toFixed(3)}`;
        if (key !== last) { last = key; cur = { step, W, H, up }; render(step, W, H, t); }
        if (step === 4) {
          const u = 0.52 + 0.2 * Math.sin(t * 0.45), v = 0.62 + 0.24 * Math.sin(t * 0.31 + 1);
          const dx = PX - E[0], dy = PYC + PH / 2 - v * PH - E[1], dz = -PW / 2 + u * PW - E[2];
          const tt = trace(E[0], E[1], E[2], dx, dy, dz, -1, 0, NT), i = hitTri;
          if (i >= 0) {
            sample = { u, v };
            a.set(E[0] + dx * tt, E[1] + dy * tt, E[2] + dz * tt); r1.aim(vE, a); hitDot.position.copy(a); hitDot.visible = true;
            const lx = LIGHT[0] - a.x, ly = LIGHT[1] - a.y, lz = LIGHT[2] - a.z, ts = trace(a.x, a.y, a.z, lx, ly, lz, i, 0, NT, 1), blocked = ts < 1;
            b.set(a.x + lx * Math.min(1, ts), a.y + ly * Math.min(1, ts), a.z + lz * Math.min(1, ts)); r2.aim(a, b); r2.material.color.setHex(blocked ? HEX.bad : HEX.gold);
            rayLbl.visible = true; rayLbl.position.copy(a).lerp(b, 0.5); rayLbl.position.y += 0.25; rayLbl.element.textContent = blocked ? 'Ray to the light is blocked: shadow' : 'Ray reaches the light: lit';
            if (i >= NTRI) { const tr = trace(a.x, a.y, a.z, dx, -dy, dz, i, 0, NTRI); if (hitTri >= 0) { b.set(a.x + dx * tr, a.y - dy * tr, a.z + dz * tr); r3.aim(a, b); } }
          }
        }
        big.redraw();
        labels[3].visible = step <= 2 && stage.host.clientWidth >= 560;
        if (inReel()) rayLbl.visible = false;
      },
      readout(s) { return slim(stage, this.full(s), 1); },
      full(s) {
        const step = clamp(Math.round(s.step), 0, 4), { W, H, tests, covered, rays } = stats, n = (v) => v.toLocaleString('en');
        const perPixel = Math.round((SPEC.tflops * 1e12) / (3840 * 2160 * 60) / 1000) * 1000;
        const rows = step < 2
          ? `<div class="row"><span>Corners placed on screen</span><b>${NT * 3}</b></div><div class="row"><span>Triangles</span><b>${NT}</b></div>`
          : `<div class="row"><span>Inside-or-outside tests</span><b>${n(tests)}</b></div>
             <div class="row"><span>Pixels coloured</span><b>${n(covered)} of ${n(W * H)}</b></div>
             ${step === 4 ? `<div class="row"><span>Extra rays fired</span><b>${n(rays)}</b></div>` : ''}`;
        return `<div class="big">${step + 1}. ${STEPS[step]}</div>${rows}
          <div class="row"><span>Real 4K at 60 fps</span><b>498 million pixels a second</b></div>
          <div class="row"><span>GPU sums per pixel</span><b>about ${n(perPixel)}</b></div>`;
      },
    };
  },
};
