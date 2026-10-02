// Chapter 4: why an SSD loads a game so much faster than a hard disk.
//
// Hard disk model (the 2.5-inch, 5,400 rpm laptop drive of a PlayStation 4):
//   time = bytes ÷ sequential rate + pieces × (average seek + average wait for the platter)
//   - sequential rate 100 MB/s: the top of the 50 to 100 MB/s range Mark Cerny gave for the PS4's
//     drive ("The Road to PS5", 18 March 2020);
//   - average seek 12 ms: a typical data-sheet figure for 2.5-inch 5,400 rpm drives;
//   - average rotational wait = half a turn = 0.5 × 60 ÷ 5400 s = 5.6 ms (pure arithmetic).
//   With 570 pieces per gigabyte this gives 20 s for 1 GB, the figure Cerny quoted for a PS4.
// SSD model: time = bytes ÷ rate (a flash read has no seek worth counting: about 0.1 ms).
//     NVMe drives also serve many requests at once, so scattered files cost them almost nothing.
//   - SATA SSD: about 0.55 GB/s, the practical limit of the 6 Gbit/s SATA III link;
//   - PS5 SSD: 5.5 GB/s raw (Sony's specification, March 2020);
//   - with the PS5's Kraken decompression chip: 8 to 9 GB/s of game data, typically (Cerny). We use 8.5.
import { THREE, M, box, approach, clamp, lerp } from '../kit.js';
import { board, panelBg, text, rrect, COL, HEX, vcyl, rng, fitNarrow, slim, isTall, tallView } from '../console.js';

const HDD = { rate: 0.1, seek: 0.012, rot: (0.5 * 60) / 5400 };       // GB/s, s, s
const SSD = { sata: { name: 'SATA SSD', rate: 0.55 }, raw: { name: 'PS5 SSD, raw', rate: 5.5 }, kraken: { name: 'PS5 SSD + unpacking chip', rate: 8.5 } };
const TALL = { pos: [0.4, 7.2, 6.8], target: [0, 2.4, 0.1] };
const N = 24;                                                           // chunks drawn

export function loadTimes(s) {
  const pieces = s.size * s.pieces, read = s.size / HDD.rate, seeking = pieces * (HDD.seek + HDD.rot);
  return { hdd: read + seeking, read, seeking, pieces, ssd: s.size / SSD[s.ssd].rate };
}
const secs = (t) => (t < 1 ? t.toFixed(2) + ' s' : t < 10 ? t.toFixed(1) + ' s' : Math.round(t) + ' s');

export default {
  id: 'loading',
  short: 'Loading',
  title: 'Loading: hard disk against SSD',
  subtitle: 'A spinning disk has to move an arm and wait. Flash memory just answers.',
  view: { pos: [0.3, 6.3, 8.7], target: [0, 2.3, -0.2] },
  learn: `<p>Before you can play, the level has to get from storage into <b>memory</b>: gigabytes of models, textures and sound. For years that meant a <b>hard disk</b>, and a long loading screen.</p>
    <p>A hard disk stores data as magnetic marks on a spinning <b>platter</b>. To read a file, an arm swings a tiny <b>head</b> to the right track (a <b>seek</b>, about 12 ms), then waits for the right spot to spin round (about 6 ms more). Game data is rarely in one neat run, so the head hops thousands of times. Those waits add up to most of the loading time.</p>
    <p>An <b>SSD</b> has no moving parts. Data sits in <b>flash memory</b> cells, and any cell can be read at once: no arm, no waiting. The PS5’s SSD reads <b>5.5 GB every second</b>. Game files are also stored squashed, and a special <b>decompression</b> chip unpacks them on the way in, so the game receives 8 to 9 GB a second.</p>
    <p>The result: a level that took a PlayStation 4 twenty seconds or more arrives in a fraction of a second. Designers no longer need long corridors and lift rides to hide the loading.</p>
    <p>A game can arrive on a <b>disc</b> (up to 100 GB) or as a <b>download</b>. Either way it is copied to the SSD first, because a disc drive reads far too slowly to play from. Big games take tens of gigabytes, some more than 100, and patches add more. <b>Online play</b> brings a delay no SSD can fix: your moves travel to a server and back. That round trip, the <b>ping</b>, is often 20 to 100 ms. Games hide it by predicting where everyone will be, and correcting when the guess was wrong.</p>
    <p>The memory ladder inside any computer is in <a href="https://glassbox.how/computerclear/">ComputerClear</a>.</p>
    <p class="tip"><b>Try it:</b> start the race. Then drag the scatter down to zero and see how much of the hard disk’s time was just the arm moving.</p>`,
  terms: [
    { t: 'Hard disk', d: 'Storage that keeps data as magnetic marks on a spinning platter, read by a head on a moving arm.' },
    { t: 'Seek', d: 'Moving a hard disk’s head to the track where the data is. It takes about 12 thousandths of a second.' },
    { t: 'Flash memory', d: 'Chips that hold data as trapped electric charge. They keep it without power and have no moving parts.' },
    { t: 'NVMe', d: 'The fast way an SSD talks to the processor, built for flash rather than for spinning disks.' },
    { t: 'Ping', d: 'The time for a message to reach a game server and come back, in milliseconds.' },
    { t: 'Compression', d: 'Storing data in fewer bytes by removing repetition. It must be unpacked before use.' },
  ],
  defaults: { size: 2, pieces: 570, ssd: 'kraken', speed: 5 },
  controls: [
    { key: 'size', type: 'range', label: 'Size of the level', min: 0.5, max: 10, step: 0.5, fmt: (v) => v.toFixed(1) + ' GB' },
    { key: 'pieces', type: 'range', label: 'How scattered the files are', min: 0, max: 1500, step: 10, ends: ['one neat run', 'all over the disk'], fmt: (v) => Math.round(v) + ' pieces per GB' },
    { key: 'ssd', type: 'seg', label: 'Which SSD', options: [{ v: 'sata', label: 'SATA' }, { v: 'raw', label: 'PS5 raw' }, { v: 'kraken', label: 'PS5 + unpack' }], fmt: (v) => SSD[v].rate + ' GB/s' },
    { key: 'speed', type: 'seg', label: 'Race clock', options: [{ v: 1, label: 'Real time' }, { v: 5, label: '5× faster' }, { v: 20, label: '20× faster' }] },
    { type: 'buttons', label: 'Race', items: [{ label: 'Start the race', act: (s, inst) => inst.start() }] },
  ],
  quiz: [
    { q: 'What slows a hard disk most when loading a game?', options: ['The platter is too small', 'Moving the arm and waiting for the platter, thousands of times', 'The cable is too long', 'The disk gets too hot'], answer: 1, why: 'Every hop costs about 18 ms of seeking and waiting. A few thousand hops is most of a loading screen.' },
    { q: 'Why can an SSD skip the waiting?', options: ['It spins much faster', 'It has no moving parts: any flash cell can be read directly', 'It is closer to the TV', 'It uses a laser'], answer: 1, why: 'There is no head to move and no platter to wait for. The controller just asks the right cells for their data.' },
    { q: 'Why are game files kept compressed on the SSD?', options: ['To make them load slower', 'They take less space, and less data has to be read', 'To stop copying', 'Compressed files look better'], answer: 1, why: 'Fewer bytes to store and to read. A dedicated chip unpacks them faster than the SSD can supply them.' },
  ],
  reel: [
    { ms: 5800, caption: 'A hard disk swings an arm and waits for the platter. An SSD has no moving parts: 2 GB loads in a quarter of a second.', set: { size: 2, pieces: 570, ssd: 'kraken', speed: 5 }, act: (s, inst) => inst.start(), view: { pos: [0.4, 8.1, 12.9], target: [0, 2.4, -0.4] }, spin: 0.3 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const tall = isTall(stage), hd = new THREE.Group(), sd = new THREE.Group(); root.add(hd, sd);
    if (tall) { hd.position.set(2.7, 0, 2.5); sd.position.set(-2.7, 0, -1.8); }
    // ---------------------------------------------------------------- the hard disk (lid off)
    const hx = -2.7, pc = [hx - 0.25, 0.42, -0.4];
    const tray = box(3.6, 0.3, 4.6, M.metal(0x4b525e, { roughness: 0.6 })); tray.position.set(hx, 0.15, 0.1); hd.add(tray);
    const plat = new THREE.Group(); plat.position.set(...pc); hd.add(plat);
    plat.add(vcyl(1.5, -0.03, 0.03, M.metal(0xcfd6e2, { roughness: 0.12 }), 64));
    plat.add(vcyl(0.34, -0.03, 0.1, M.metal(0x8f97a5), 32));
    const R = rng(7), chunksH = [];
    for (let i = 0; i < N; i++) {
      const m = M.glow(0x54607a), c = box(0.34, 0.012, 0.1, m), g = new THREE.Group();
      const neat = 1.38 - (i / (N - 1)) * 0.82, wild = 0.56 + R() * 0.82, th = R() * Math.PI * 2;
      c.position.y = 0.038; g.add(c); plat.add(g); chunksH.push({ g, c, m, neat, wild, th, thNeat: (i / N) * Math.PI * 5 });
    }
    const pivot = [hx + 1.2, 0.5, 1.75], D = Math.hypot(pc[0] - pivot[0], pc[2] - pivot[2]), LA = 2.05;
    const th0 = Math.atan2(-(pc[2] - pivot[2]), pc[0] - pivot[0]);
    const arm = new THREE.Group(); arm.position.set(...pivot); hd.add(arm);
    const armB = box(LA, 0.05, 0.16, M.metal(0xaab2c0)); armB.position.x = LA / 2; arm.add(armB);
    const head = box(0.14, 0.05, 0.14, M.glow(HEX.gold)); head.position.set(LA, -0.04, 0); arm.add(head);
    const post = vcyl(0.16, 0.3, 0.62, M.metal(0x7c8493)); post.position.x = pivot[0]; post.position.z = pivot[2]; hd.add(post);
    const voice = box(0.9, 0.16, 0.6, M.metal(0x30343c)); voice.position.set(pivot[0] + 0.25, 0.38, pivot[2] + 0.35); hd.add(voice);

    // ---------------------------------------------------------------- the SSD
    const sx = 2.7;
    const pcb = box(3.4, 0.08, 1.9, M.matte(0x1c5a3c)); pcb.position.set(sx, 0.34, 0.3); sd.add(pcb);
    [[-1.5, -0.5], [1.5, -0.5], [-1.5, 1.1], [1.5, 1.1]].forEach(([x, z]) => { const p = vcyl(0.06, 0, 0.3, M.metal(0x8f97a5), 12); p.position.x = sx + x; p.position.z = z; sd.add(p); });
    const ctl = box(0.6, 0.08, 0.6, M.plastic(0x14171c)); ctl.position.set(sx - 1.2, 0.42, 0.3); sd.add(ctl);
    const cells = [];
    for (let k = 0; k < 6; k++) {
      const cx = sx - 0.45 + (k % 3) * 0.75, cz = -0.12 + Math.floor(k / 3) * 0.84;
      const chip = box(0.62, 0.07, 0.66, M.plastic(0x1b2238)); chip.position.set(cx, 0.415, cz); sd.add(chip);
      for (let j = 0; j < 4; j++) { const m = M.glow(0x54607a), c = box(0.22, 0.02, 0.24, m); c.position.set(cx - 0.14 + (j % 2) * 0.28, 0.46, cz - 0.15 + Math.floor(j / 2) * 0.3); sd.add(c); cells.push(m); }
    }
    // Shuffle the order the flash cells answer in: there is no "next door" on an SSD.
    const order = cells.map((_, i) => i).sort((a, b) => ((a * 7 + 3) % N) - ((b * 7 + 3) % N));

    // ---------------------------------------------------------------- the scoreboard
    let st = { t: 0, tm: null, s: null };
    const sb = board(root, 7.0, 2.4, 1216, 416, (g, w, h) => {
      panelBg(g, w, h, 0.92);
      const { t, tm, s } = st; if (!tm) return;
      text(g, `Loading a ${s.size.toFixed(1)} GB level`, 32, 56, { font: 'bold 38px sans-serif', col: '#eef2fa' });
      text(g, `race clock ${secs(t)}`, w - 32, 56, { font: '30px sans-serif', col: COL.soft, align: 'right' });
      const row = (y, name, col, total, extra) => {
        const k = clamp(t / total, 0, 1), done = k >= 1;
        text(g, name, 32, y + 40, { font: 'bold 30px sans-serif', col });
        g.fillStyle = 'rgba(255,255,255,.08)'; rrect(g, 250, y + 6, 660, 46, 12); g.fill();
        if (k > 0.004) { g.fillStyle = col; rrect(g, 250, y + 6, Math.max(24, 660 * k), 46, 12); g.fill(); }
        text(g, done ? `done in ${secs(total)}` : `${(k * s.size).toFixed(2)} GB`, w - 32, y + 40, { font: 'bold 30px sans-serif', col: done ? COL.good : '#eef2fa', align: 'right' });
        text(g, extra, 250, y + 86, { font: '24px sans-serif', col: COL.soft });
      };
      row(92, 'Hard disk', COL.warm, tm.hdd, `${Math.round(tm.pieces).toLocaleString('en')} hops of the arm: ${secs(tm.seeking)} spent seeking and waiting`);
      row(222, 'SSD', COL.data, tm.ssd, `${SSD[s.ssd].name}: ${SSD[s.ssd].rate} GB a second, nothing moves`);
      text(g, `The SSD is ${Math.round(tm.hdd / tm.ssd).toLocaleString('en')} times faster`, w / 2, 388, { font: 'bold 34px sans-serif', col: COL.gold, align: 'center' });
    }, [0.55, 3.05, -2.2]);
    sb.mesh.rotation.x = -0.12;
    if (tall) { sb.mesh.position.set(0, 4.3, -3.6); sb.mesh.rotation.x = -0.3; }

    const labels = [
      stage.label('Hard disk: platter spins at 5,400 rpm', [hx, 1.0, -2.1], root),
      stage.label('Arm and read head', [pivot[0] + 0.5, 1.0, pivot[2] + 0.4], root, 'hot'),
      stage.label('SSD: flash memory chips', [sx + 0.3, 0.95, -0.7], root),
      stage.label('Controller chip', [sx - 1.2, 0.85, 0.95], root),
    ];

    let t = 0, hold = 0, armR = 1.38, platA = 0, key = '', wob = 0;
    const api = {
      start() { t = 0; hold = 0; },
      update(dt, s) {
        dt = Math.max(0, dt);
        fitNarrow(stage, [labels[3]], -0.1, [0.08, -0.06]); tallView(stage, TALL);
        const tm = loadTimes(s), k2 = `${s.size}|${s.pieces}|${s.ssd}`;
        if (k2 !== key) { key = k2; t = 0; hold = 0; }
        const racing = t < tm.hdd;
        if (racing) t = Math.min(tm.hdd, t + dt * s.speed); else { hold += dt; if (hold > 4) { t = 0; hold = 0; } }
        // Hard disk: the head goes to each piece in turn.
        const kh = clamp(t / tm.hdd, 0, 1), cur = Math.min(N - 1, Math.floor(kh * N)), sc = clamp(s.pieces / 1500, 0, 1);
        platA += dt * 7; plat.rotation.y = platA;
        chunksH.forEach((c, i) => {
          const r = lerp(c.neat, c.wild, sc), th = lerp(c.thNeat, c.th, sc);
          c.g.rotation.y = th; c.c.position.x = r;
          c.m.color.setHex(i < cur || kh >= 1 ? HEX.warm : i === cur && racing ? 0xffffff : 0x54607a);
        });
        const target = lerp(chunksH[cur].neat, chunksH[cur].wild, sc);
        armR = approach(armR, target, 14, dt);
        wob = racing && sc > 0.05 ? 0.012 * Math.sin(platA * 9) * sc : 0;
        const phi = Math.acos(clamp((D * D + LA * LA - armR * armR) / (2 * D * LA), -1, 1));
        arm.rotation.y = th0 - phi + wob;
        // SSD: cells answer in any order, many at once.
        const ks = clamp(t / tm.ssd, 0, 1), lit = Math.floor(ks * N + 1e-6);
        order.forEach((ci, i) => cells[ci].color.setHex(i < lit ? HEX.data : 0x54607a));
        st = { t, tm, s: { ...s } }; sb.redraw();
      },
      readout(s) { return slim(stage, this.full(s), 2); },
      full(s) {
        const tm = loadTimes(s);
        return `<div class="big">${secs(tm.hdd)} against ${secs(tm.ssd)}</div>
          <div class="row"><span>Hard disk: reading</span><b>${secs(tm.read)}</b></div>
          <div class="row"><span>Hard disk: seeking and waiting</span><b class="${tm.seeking > tm.read ? 'no' : ''}">${secs(tm.seeking)}</b></div>
          <div class="row"><span>Each hop of the arm</span><b>${((HDD.seek + HDD.rot) * 1000).toFixed(1)} ms</b></div>
          <div class="row"><span>SSD is faster by</span><b>${Math.round(tm.hdd / tm.ssd).toLocaleString('en')} times</b></div>`;
      },
    };
    return api;
  },
};
