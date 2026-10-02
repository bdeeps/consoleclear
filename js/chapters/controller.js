// Chapter 5: inside the controller. Sticks and drift, the adaptive trigger, haptics, and lag.
//
// Sticks. A classic thumb stick turns two potentiometers: a metal wiper slides along a resistive
// track and the voltage it picks off tells the console the angle. iFixit's 2021 study of the
// DualSense found Alps RKJXV-type modules whose data sheet gives an operating life of 2,000,000
// cycles; at about 80 stick turns a minute that is 417 hours of play. Wear is concentrated where
// the stick rests, at the centre. Our model: the worn centre adds an offset and noise that grow
// with wear, and the console ignores readings inside a dead zone of ±8% (a typical default).
// The size of the offset is illustrative; it is set so drift appears around the rated life.
// A Hall-effect stick reads a magnet's field with a chip, so nothing rubs and nothing wears.
//
// Adaptive trigger (iFixit and other 2020 teardowns): a small DC motor turns a worm, the worm turns
// a gear, and an arm on the gear presses on the back of the trigger. Forces are shown as a share
// of the maximum, because Sony does not publish them in newtons.
//
// Haptics: older pads shake with an eccentric rotating mass (an off-centre weight on a motor),
// which must spin up and can only buzz. The DualSense uses voice-coil actuators (Sony, 2020): a
// coil and a sprung magnet, the same motor as a loudspeaker, which follows any waveform.
//
// Lag: Bluetooth controller link about 9 ms (Gamepadla's published DualSense measurement); a game
// typically needs about 3 frames from reading the pad to finishing the picture; a TV in game mode
// adds about 10 ms and far more out of it (typical RTINGS-style measurements). All "about".
import { THREE, M, box, torus, spring, approach, clamp, lerp } from '../kit.js';
import { board, panelBg, text, rrect, COL, HEX, vcyl, makeController, pathOf, fitNarrow, slim, TAU, isTall, tallView } from '../console.js';

const DEAD = 0.08, LIFE = 2e6, TURNS_PER_MIN = 80;
const FEEL = {
  rain: { name: 'Raindrops', f: (t) => { const p = (t * 7) % 1; return p < 0.12 ? Math.sin(p * 26) * (1 - p / 0.12) * 0.7 : 0; }, env: (t) => ((t * 7) % 1 < 0.12 ? 0.7 : 0) },
  engine: { name: 'Engine', f: (t) => (0.35 + 0.25 * Math.sin(t * 2.2)) * Math.sin(t * 60), env: (t) => 0.35 + 0.25 * Math.sin(t * 2.2) },
  blast: { name: 'Explosion', f: (t) => { const p = t % 1.6; return Math.exp(-p * 3.2) * Math.sin(p * 44); }, env: (t) => Math.exp(-(t % 1.6) * 3.2) },
};
const TALL = { pos: [1.0, 4.7, 6.3], target: [0.2, 2.9, 0.2] };
const LAG = { pad: 9, frames: 3, tvGame: 10, tvSlow: 80 };

export function stickReading(push, wear, sensor, t = 0) {
  if (sensor === 'hall') return push;
  const centre = Math.exp(-((push / 0.3) ** 2));
  return clamp(push + wear * centre * (0.17 + 0.05 * Math.sin(t * 23) * Math.sin(t * 7.1)), -1, 1);
}
// How hard the trigger pushes back, as a share of the maximum (0 to 1).
export function triggerForce(pull, resist) {
  const wall = 1 - 0.75 * resist, springF = 0.22 * pull;
  return { wall, touching: resist > 0.02 && pull >= wall - 1e-6, force: springF + (resist > 0.02 && pull >= wall ? 0.78 * resist : 0) };
}

export default {
  id: 'controller',
  short: 'The controller',
  title: 'The controller in your hands',
  subtitle: 'Sticks that wear out, a trigger that pushes back, motors you can feel, and a radio link.',
  view: { pos: [2.2, 4.4, 8.4], target: [0.3, 2.7, -0.3] },
  learn: `<p>A controller is a bundle of <b>sensors</b> that turn your hands into numbers, and a few <b>motors</b> that send feeling back.</p>
    <p><b>Sticks.</b> Under each thumb stick are two <b>potentiometers</b>, one for left-right and one for up-down. A springy metal <b>wiper</b> slides along a strip of resistive carbon, and the voltage it picks up tells the console the angle. But rubbing wears the strip, most of all at the centre where the stick rests. Then the stick reports a small push when nobody is touching it. That is <b>stick drift</b>. A <b>Hall-effect</b> stick reads a tiny magnet instead, so nothing rubs.</p>
    <p><b>Adaptive triggers.</b> Behind each trigger, a small motor turns a <b>worm gear</b> that swings an arm against the trigger. The game decides how hard it pushes back: a bowstring that tightens, a brake pedal that fights.</p>
    <p><b>Haptics.</b> Old controllers spin an off-centre weight: it can only buzz. Newer ones use a <b>voice coil</b>, the same motor as in a loudspeaker (see <a href="https://glassbox.how/speakerclear/">SpeakerClear</a>), which can play raindrops, footsteps or an engine.</p>
    <p><b>The link.</b> The controller talks to the console by Bluetooth radio (see <a href="https://glassbox.how/bluetoothclear/">BluetoothClear</a>), which needs no line of sight, unlike the infrared light of a TV remote (see <a href="https://glassbox.how/remoteclear/">RemoteClear</a>). From thumb to screen takes a few frames: that delay is <b>input lag</b>. A TV adds its own, which is why TVs have a <b>game mode</b> (see <a href="https://glassbox.how/tvclear/">TVClear</a>).</p>
    <p class="tip"><b>Try it:</b> leave the stick centred and wear the track out until the character walks off by itself. Then switch to the Hall-effect sensor.</p>`,
  terms: [
    { t: 'Potentiometer', d: 'A resistor with a sliding contact. Its output voltage tells you where the slider is.' },
    { t: 'Stick drift', d: 'A worn stick reporting movement when no one is touching it.' },
    { t: 'Dead zone', d: 'A small range round the centre that the game ignores, to hide tiny errors.' },
    { t: 'Hall-effect sensor', d: 'A chip that measures a magnetic field. It can read a stick’s angle without touching it.' },
    { t: 'Worm gear', d: 'A screw that turns a gear wheel. It lets a small, fast motor make a large, slow force.' },
    { t: 'Voice coil', d: 'A coil in a magnet’s field that moves when current flows. It drives speakers and modern haptics.' },
    { t: 'Input lag', d: 'The delay between pressing a button and seeing the result on screen.' },
  ],
  defaults: { focus: 'stick', push: 0, wear: 0.2, sensor: 'pot', pull: 0.3, resist: 0.6, feel: 'rain', gameMode: true },
  controls: [
    { key: 'focus', type: 'seg', label: 'Look at', options: [{ v: 'stick', label: 'Stick' }, { v: 'trigger', label: 'Trigger' }, { v: 'haptic', label: 'Haptics' }, { v: 'lag', label: 'Lag' }] },
    { key: 'push', type: 'range', label: 'Stick: push it', min: -1, max: 1, step: 0.01, ends: ['left', 'right'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'wear', type: 'range', label: 'Stick: wear on the track', min: 0, max: 1, step: 0.01, ends: ['new', 'worn out'], fmt: (v) => `${Math.round((v * 2 * LIFE) / (TURNS_PER_MIN * 60))} hours of play` },
    { key: 'sensor', type: 'seg', label: 'Stick: sensor', options: [{ v: 'pot', label: 'Potentiometer' }, { v: 'hall', label: 'Hall effect' }] },
    { key: 'pull', type: 'range', label: 'Trigger: squeeze it', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'resist', type: 'range', label: 'Trigger: motor push-back', min: 0, max: 1, step: 0.01, ends: ['off', 'strong'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'feel', type: 'seg', label: 'Haptics: what the game plays', options: Object.entries(FEEL).map(([v, f]) => ({ v, label: f.name })) },
    { key: 'gameMode', type: 'toggle', label: 'Lag: TV game mode' },
  ],
  onChange(s, key) {
    if (['push', 'wear', 'sensor'].includes(key)) s.focus = 'stick';
    if (['pull', 'resist'].includes(key)) s.focus = 'trigger';
    if (key === 'feel') s.focus = 'haptic';
    if (key === 'gameMode') s.focus = 'lag';
  },
  quiz: [
    { q: 'What causes stick drift in a potentiometer stick?', options: ['The battery running low', 'The wiper wearing the resistive track, mostly at the centre', 'Bluetooth interference', 'The game being too hard'], answer: 1, why: 'Rubbing wears the carbon strip where the stick rests, so the “centre” voltage shifts and the console thinks you are pushing.' },
    { q: 'Why does a Hall-effect stick not wear out the same way?', options: ['It has a bigger spring', 'It reads a magnet’s field, so nothing rubs', 'It is made of steel', 'It only works with wires'], answer: 1, why: 'A chip senses the magnet across a small gap. With no sliding contact, there is no track to wear.' },
    { q: 'How does an adaptive trigger push back on your finger?', options: ['With compressed air', 'A motor turns a worm gear that swings an arm against the trigger', 'With a stronger spring only', 'With magnets in the button'], answer: 1, why: 'The game sets the motor’s push, so the same trigger can feel loose, stiff, or like it hits a wall.' },
  ],
  reel: [
    { ms: 5400, caption: 'A thumb stick is a slider on a carbon track. Wear the track and the stick reports a push that is not there: drift.', set: { focus: 'stick', push: 0, sensor: 'pot' }, anim: { wear: [0, 0.9] }, view: { pos: [3.4, 4.9, 11.3], target: [0, 2.7, -0.3] }, spin: 0.25 },
    { ms: 5200, caption: 'Behind the trigger, a motor and a worm gear swing an arm that pushes back on your finger.', set: { focus: 'trigger', resist: 0.8 }, anim: { pull: [0, 1] }, view: { pos: [1.9, 4.4, 11.5], target: [0.6, 2.6, -0.3] }, spin: 0.25 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const tall = isTall(stage);
    const G = { stick: new THREE.Group(), trigger: new THREE.Group(), haptic: new THREE.Group(), lag: new THREE.Group() };
    Object.values(G).forEach((g) => root.add(g));
    const dark = M.plastic(0x1b1e24), steel = M.metal(0xaab2c0);
    const lbl = (html, pos, parent, cls) => stage.label(html, pos, parent, cls);

    // ================================================================ 1. the stick
    {
      const g = G.stick;
      const base = box(2.6, 0.3, 2.9, M.plastic(0x242933)); base.position.set(0, 0.15, 0.3); g.add(base);
      const tilt = new THREE.Group(); tilt.position.set(0, 1.25, 0); g.add(tilt);
      tilt.add(vcyl(0.12, -0.25, 1.35, dark, 20));
      const cap = vcyl(0.55, 1.35, 1.52, dark, 32); tilt.add(cap);
      tilt.add(vcyl(0.42, 1.52, 1.56, M.plastic(0x30353f), 32));
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 16), steel); axle.rotation.x = Math.PI / 2; axle.position.z = 0.85; tilt.add(axle);
      [-0.5, 0.5].forEach((x) => { const p = box(0.12, 1.25, 0.5, M.plastic(0x30353f)); p.position.set(x, 0.62, -0.1); g.add(p); });
      g.tilt = tilt;
      // potentiometer: a carbon arc and a wiper that turns with the stick
      const pot = new THREE.Group(); pot.position.set(0, 1.25, 1.55); g.add(pot);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 40), M.plastic(0x3a2f24)); body.rotation.x = Math.PI / 2; body.position.z = -0.08; pot.add(body);
      const track = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 40, Math.PI * 0.8), M.matte(0x16171a)); track.rotation.z = Math.PI * 0.1; pot.add(track);
      const worn = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 8, 12, 0.5), new THREE.MeshBasicMaterial({ color: 0xc9b79a, transparent: true, opacity: 0 })); worn.rotation.z = Math.PI / 2 - 0.25; worn.position.z = 0.012; pot.add(worn);
      const wiper = new THREE.Group(); pot.add(wiper);
      const wb = box(0.07, 0.66, 0.05, M.metal(HEX.gold)); wb.position.set(0, 0.33, 0.07); wiper.add(wb);
      const wt = box(0.16, 0.08, 0.09, M.glow(HEX.gold)); wt.position.set(0, 0.62, 0.05); wiper.add(wt);
      [[-0.55, 0x9aa3b2], [0, HEX.gold], [0.55, 0x9aa3b2]].forEach(([x, c]) => { const pin = box(0.1, 0.45, 0.05, M.metal(c)); pin.position.set(x, -0.95, -0.05); pot.add(pin); });
      g.pot = pot; g.wiper = wiper; g.worn = worn;
      // Hall-effect: a magnet on the axle, and a sensor chip that never touches it
      const hall = new THREE.Group(); hall.position.set(0, 1.25, 1.55); g.add(hall);
      const mag = new THREE.Group(); hall.add(mag);
      const n = box(0.3, 0.6, 0.18, M.plastic(0xe0453a)), sPole = box(0.3, 0.6, 0.18, M.plastic(0x3a6fe0)); n.position.x = -0.15; sPole.position.x = 0.15; mag.add(n, sPole);
      const hp = box(1.3, 1.3, 0.06, M.matte(0x1c5a3c)); hp.position.z = 0.55; hall.add(hp);
      const chip = box(0.36, 0.36, 0.1, M.plastic(0x101216)); chip.position.z = 0.48; hall.add(chip);
      g.hall = hall; g.mag = mag;
      g.lbls = {
        track: lbl('Carbon track', [-0.75, 0.75, 0.1], pot), wiper: lbl('Wiper turns with the stick', [0.2, 1.0, 0.1], pot, 'hot'),
        mag: lbl('Magnet turns with the stick', [0, 0.6, 0], hall, 'hot'), chip: lbl('Hall sensor: no contact', [0, -0.5, 0.6], hall),
      };
    }
    let rd = { v: 0, push: 0, sensor: 'pot', walk: 0 };
    const stickB = board(G.stick, 5.0, 1.9, 1000, 380, (g, w, h) => {
      panelBg(g, w, h, 0.92);
      const drift = Math.abs(rd.v) > DEAD && Math.abs(rd.push) < 0.02;
      text(g, 'What the console reads', 30, 50, { font: 'bold 34px sans-serif', col: '#eef2fa' });
      text(g, `${rd.v >= 0 ? '+' : ''}${Math.round(rd.v * 100)}%`, w - 30, 50, { font: 'bold 34px sans-serif', col: drift ? COL.bad : COL.data, align: 'right' });
      const x0 = 60, bw = w - 120, y = 96, X = (v) => x0 + (v + 1) / 2 * bw;
      g.fillStyle = 'rgba(255,255,255,.08)'; rrect(g, x0, y, bw, 40, 10); g.fill();
      g.fillStyle = 'rgba(123,224,140,.28)'; g.fillRect(X(-DEAD), y, X(DEAD) - X(-DEAD), 40);
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(X(0) - 1, y - 8, 2, 56);
      g.fillStyle = drift ? COL.bad : COL.data; g.beginPath(); g.arc(X(rd.v), y + 20, 15, 0, 7); g.fill();
      text(g, 'dead zone: ignored', X(0), y + 76, { font: '22px sans-serif', col: COL.good, align: 'center' });
      text(g, 'left', x0, y + 76, { font: '22px sans-serif', col: COL.soft }); text(g, 'right', x0 + bw, y + 76, { font: '22px sans-serif', col: COL.soft, align: 'right' });
      // the character
      const gy = 300; g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0, gy + 34, bw, 3);
      const cx = x0 + (((rd.walk % 1) + 1) % 1) * bw;
      g.fillStyle = drift ? COL.bad : COL.gold; g.beginPath(); g.arc(cx, gy, 13, 0, 7); g.fill(); g.fillRect(cx - 9, gy + 12, 18, 22);
      text(g, drift ? 'Hands off, but the character walks: drift' : Math.abs(rd.v) > DEAD ? 'You push, the character walks' : 'Hands off: the character stands still', w / 2, gy - 34, { font: 'bold 26px sans-serif', col: drift ? COL.bad : COL.soft, align: 'center' });
    }, tall ? [0, 4.6, -0.8] : [1.6, 4.3, -0.8]);

    // ================================================================ 2. the trigger
    {
      const g = G.trigger; g.position.x = -0.7;
      const wall = box(4.6, 3.6, 0.1, M.clear(0xcfe8ff, 0.1)); wall.position.set(1.2, 1.9, -0.75); g.add(wall);
      const lever = new THREE.Group(); lever.position.set(-0.6, 3.3, 0); g.add(lever);
      const lv = box(0.42, 2.0, 0.9, M.plastic(0xe6e9ef)); lv.position.set(0, -1.0, 0); lever.add(lv);
      const lip = box(0.5, 0.42, 0.9, M.plastic(0xe6e9ef)); lip.position.set(-0.28, -1.86, 0); lever.add(lip);
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.2, 20), steel); hinge.rotation.x = Math.PI / 2; lever.add(hinge);
      g.lever = lever;
      const sp = spring(0, 1, 0.14, 0.03, 7, steel); const spG = new THREE.Group(); spG.add(sp); spG.position.set(1.7, 2.6, -0.4); spG.rotation.y = Math.PI; g.add(spG); g.spG = spG;
      const stopW = box(0.16, 0.6, 0.5, dark); stopW.position.set(1.78, 2.6, -0.4); g.add(stopW);
      // gear with an arm, worm and motor
      const gear = new THREE.Group(); gear.position.set(1.55, 1.35, 0.15); g.add(gear);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 40), M.plastic(0xd9dde6)); wheel.rotation.x = Math.PI / 2; gear.add(wheel);
      for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU, t = box(0.13, 0.1, 0.3, M.plastic(0xd9dde6)); t.position.set(0.66 * Math.cos(a), 0.66 * Math.sin(a), 0); t.rotation.z = a; gear.add(t); }
      const armM = M.plastic(0xffb547, { emissive: new THREE.Color(HEX.warm), emissiveIntensity: 0 });
      const ar = box(1.45, 0.2, 0.34, armM); ar.position.set(-0.72, 0, 0.32); gear.add(ar);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 20), armM); tip.rotation.x = Math.PI / 2; tip.position.set(-1.45, 0, 0.32); gear.add(tip);
      g.gear = gear; g.armM = armM;
      const worm = new THREE.Group(); worm.position.set(1.55, 0.5, 0.15); g.add(worm);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 16), steel); core.rotation.z = Math.PI / 2; worm.add(core);
      worm.add(spring(-0.7, 0.7, 0.16, 0.045, 7, M.metal(0xd8dde6)));
      g.worm = worm;
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.3, 32), M.metal(0x6c7482, { roughness: 0.5 })); motor.rotation.z = Math.PI / 2; motor.position.set(3.0, 0.5, 0.15); g.add(motor);
      const fl = box(4.6, 0.12, 1.7, M.plastic(0x242933)); fl.position.set(1.2, 0.04, 0); g.add(fl);
      g.finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 14), M.plastic(0xd9a07c)); g.finger.rotation.z = Math.PI / 2 - 0.2; g.add(g.finger);
      lbl('Trigger', [-0.1, 0.35, 0], lever);
      lbl('Motor', [3.0, 1.15, 0.15], g); lbl('Worm', [1.9, 0.05, 0.6], g);
      lbl('Gear and arm', [1.9, 2.25, 0.4], g, 'hot'); lbl('Return spring', [1.2, 3.1, -0.4], g);
    }
    let tr = { pull: 0, resist: 0 };
    const trigB = board(G.trigger, 4.4, 2.3, 880, 460, (g, w, h) => {
      panelBg(g, w, h, 0.92);
      const f = triggerForce(tr.pull, tr.resist);
      text(g, 'Force on your finger', 28, 48, { font: 'bold 32px sans-serif', col: '#eef2fa' });
      text(g, `${Math.round(f.force * 100)}%`, w - 28, 48, { font: 'bold 34px sans-serif', col: f.touching ? COL.warm : COL.data, align: 'right' });
      const x0 = 70, y0 = 380, pw = w - 110, ph = 280, X = (p) => x0 + p * pw, Y = (v) => y0 - v * ph;
      g.strokeStyle = COL.grid; g.lineWidth = 2; g.strokeRect(x0, y0 - ph, pw, ph);
      g.strokeStyle = COL.data; g.lineWidth = 5; g.beginPath();
      for (let i = 0; i <= 200; i++) { const p = i / 200, v = triggerForce(p, tr.resist).force; if (i) g.lineTo(X(p), Y(v)); else g.moveTo(X(p), Y(v)); }
      g.stroke();
      g.fillStyle = COL.gold; g.beginPath(); g.arc(X(tr.pull), Y(f.force), 12, 0, 7); g.fill();
      text(g, 'how far you squeeze →', x0 + pw, y0 + 40, { font: '22px sans-serif', col: COL.soft, align: 'right' });
      text(g, f.touching ? 'pushing against the motor' : tr.resist > 0.02 ? 'only the spring so far' : 'motor off: only the spring', x0 + 14, y0 - ph + 34, { font: '24px sans-serif', col: f.touching ? COL.warm : COL.soft });
    }, tall ? [1.0, 5.0, -0.6] : [1.9, 4.75, -0.6]);

    // ================================================================ 3. haptics
    {
      const g = G.haptic;
      const fl = box(7.2, 0.12, 2.2, M.plastic(0x242933)); fl.position.set(0, 0.06, 0); g.add(fl);
      // old: a motor with an off-centre weight
      const erm = new THREE.Group(); erm.position.set(-2.1, 1.0, 0); g.add(erm);
      const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32), M.metal(0x6c7482, { roughness: 0.5 })); mb.rotation.z = Math.PI / 2; mb.position.x = -0.5; erm.add(mb);
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 12), steel); sh.rotation.z = Math.PI / 2; sh.position.x = 0.6; erm.add(sh);
      const wgt = new THREE.Group(); wgt.position.x = 0.85; erm.add(wgt);
      const half = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 24, 1, false, 0, Math.PI), M.metal(0xc9a24a)); half.rotation.z = Math.PI / 2; wgt.add(half);
      [-0.9, 0.3].forEach((x) => { const f = box(0.2, 0.55, 1.0, dark); f.position.set(x, -0.7, 0); erm.add(f); });
      g.erm = erm; g.wgt = wgt;
      // new: a voice coil. The coil is fixed, the magnet rides on springs.
      const vca = new THREE.Group(); vca.position.set(2.1, 1.0, 0); g.add(vca);
      const shell = box(2.6, 1.1, 1.3, M.clear(0xcfe8ff, 0.14)); vca.add(shell);
      for (let i = 0; i < 7; i++) { const c = torus(0.42, 0.045, M.metal(HEX.copper), 32); c.rotation.y = Math.PI / 2; c.position.x = -0.3 + i * 0.1; vca.add(c); }
      const mass = new THREE.Group(); vca.add(mass);
      const m1 = box(0.45, 0.5, 0.5, M.plastic(0xe0453a)), m2 = box(0.45, 0.5, 0.5, M.plastic(0x3a6fe0)); m1.position.x = -0.225; m2.position.x = 0.225; mass.add(m1, m2);
      const s1 = new THREE.Group(), s2 = new THREE.Group(); s1.add(spring(0, 1, 0.16, 0.025, 5, steel)); s2.add(spring(0, 1, 0.16, 0.025, 5, steel));
      s1.position.x = -1.3; s2.position.x = 1.3; s2.rotation.y = Math.PI; vca.add(s1, s2);
      [-1.3, 1.3].forEach((x) => { const e = box(0.08, 1.1, 1.3, dark); e.position.x = x; vca.add(e); });
      g.vca = vca; g.mass = mass; g.s1 = s1; g.s2 = s2;
      lbl('Old rumble: a spinning off-centre weight', [-0.2, 1.05, 0], erm);
      lbl('Voice coil: a magnet on springs inside a coil', [0, 1.0, 0], vca, 'hot');
    }
    const HN = 300, hist = { sig: new Float32Array(HN), erm: new Float32Array(HN), i: 0 };
    let feelName = 'Raindrops';
    const hapB = board(G.haptic, 7.0, 2.5, 1120, 400, (g, w, h) => {
      panelBg(g, w, h, 0.92);
      text(g, `The game plays: ${feelName}`, 28, 46, { font: 'bold 32px sans-serif', col: '#eef2fa' });
      text(g, 'slowed down', w - 28, 46, { font: '24px sans-serif', col: COL.soft, align: 'right' });
      const trace = (arr, y, col, name) => {
        text(g, name, 28, y - 52, { font: '24px sans-serif', col });
        g.strokeStyle = COL.grid; g.lineWidth = 1; g.beginPath(); g.moveTo(28, y); g.lineTo(w - 28, y); g.stroke();
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath();
        for (let k = 0; k < HN; k++) { const v = arr[(hist.i + k) % HN], x = 28 + (k / (HN - 1)) * (w - 56); if (k) g.lineTo(x, y - v * 62); else g.moveTo(x, y - v * 62); }
        g.stroke();
      };
      trace(hist.erm, 172, COL.warm, 'Old rumble motor: slow to start, can only buzz');
      trace(hist.sig, 328, COL.data, 'Voice coil: follows the shape of the signal');
    }, [0, 3.7, -0.6]);

    // ================================================================ 4. lag
    const pad = makeController(); pad.scale.setScalar(1.6); pad.position.set(-2.6, 0.1, 1.7); pad.rotation.y = 0.5; G.lag.add(pad);
    {
      const g = G.lag;
      const con = box(2.9, 0.75, 1.9, M.plastic(0xe6e9ef)); con.position.set(0, 0.38, 0.2); g.add(con);
      const tvb = box(3.3, 1.95, 0.1, M.plastic(0x101216)); tvb.position.set(2.7, 1.35, -0.6); tvb.rotation.y = -0.35; g.add(tvb);
      const scr = box(3.1, 1.75, 0.02, M.glow(0x16223c)); scr.position.set(2.68, 1.35, -0.54); scr.rotation.y = -0.35; g.add(scr); g.scr = scr;
      g.rings = [0, 1, 2].map(() => { const r = torus(0.3, 0.012, M.glow(HEX.data, { transparent: true }), 40); r.rotation.y = Math.PI / 2 - 0.5; g.add(r); return r; });
      g.dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), M.glow(HEX.gold)); g.add(g.dot);
      g.path = pathOf([[-2.6, 0.6, 1.6], [-1.4, 1.1, 0.9], [0, 0.85, 0.2], [1.6, 0.95, 0], [2.6, 1.3, -0.45]]);
      lbl('Bluetooth radio', [-1.6, 1.5, 0.9], g); lbl('Console', [0, 1.0, 0.2], g); lbl('TV', [2.7, 2.55, -0.6], g);
    }
    let lg = { game: true };
    const lagB = board(G.lag, 7.4, 2.4, 1184, 384, (g, w, h) => {
      panelBg(g, w, h, 0.92);
      const tv = lg.game ? LAG.tvGame : LAG.tvSlow, con = (LAG.frames * 1000) / 60, total = LAG.pad + con + tv;
      text(g, `Thumb to screen: about ${Math.round(total / 5) * 5} ms`, 28, 52, { font: 'bold 36px sans-serif', col: '#eef2fa' });
      text(g, `${(total / (1000 / 60)).toFixed(1)} frames at 60 fps`, w - 28, 52, { font: '28px sans-serif', col: COL.soft, align: 'right' });
      const x0 = 28, bw = w - 56, sc = bw / 150; let x = x0;
      [[LAG.pad, COL.data, 'Radio', `${LAG.pad} ms`], [con, COL.violet, 'Console: about 3 frames', `${Math.round(con)} ms`], [tv, lg.game ? COL.good : COL.bad, lg.game ? 'TV' : 'TV, game mode off', `${tv} ms`]].forEach(([ms, col, name, val]) => {
        const sw = ms * sc; g.fillStyle = col; rrect(g, x, 92, sw - 4, 70, 10); g.fill();
        text(g, val, x + sw / 2, 138, { font: 'bold 26px sans-serif', col: '#07080c', align: 'center' });
        text(g, name, clamp(x + sw / 2, 70, w - 150), 204, { font: '24px sans-serif', col, align: 'center' });
        x += sw;
      });
      text(g, 'At 60 fps one frame lasts 16.7 ms. Game mode skips the TV’s extra picture processing.', 28, 300, { font: '26px sans-serif', col: COL.soft });
      text(g, 'Typical figures; games and TVs vary a lot.', 28, 344, { font: '24px sans-serif', col: COL.dim });
    }, [0.4, 3.9, -0.9]);

    // a small whole controller, so you can see where each part lives
    const ctx = makeController(); ctx.scale.setScalar(1.15); ctx.rotation.set(0.5, 0, 0);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), M.glow(HEX.gold)); ctx.add(marker); root.add(ctx);
    const WHERE = tall ? { stick: [[0, 0.4, 2.7], [-0.3, 0.52, 0.16]], trigger: [[0.2, 0.4, 2.7], [0.52, 0.22, -0.4]], haptic: [[0, 0.4, 2.9], [-0.66, 0.1, 0.5]] } : { stick: [[-2.9, 0.5, 1.7], [-0.3, 0.52, 0.16]], trigger: [[-2.9, 0.5, 2.2], [0.52, 0.22, -0.4]], haptic: [[-2.9, 0.4, 2.6], [-0.66, 0.1, 0.5]] };

    let t = 0, ang = 0, armA = 0, walk = 0, ermW = 0, ermTh = 0, lagK = 0, tick = 0, wormA = 0, last = '';
    return {
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        const narrow = fitNarrow(stage, [], -0.1, [0.07, -0.06]); tallView(stage, TALL);
        Object.entries(G).forEach(([k, g]) => { g.visible = s.focus === k; });
        ctx.visible = !!WHERE[s.focus] && !narrow;
        if (ctx.visible) { const [p, m] = WHERE[s.focus]; ctx.position.set(...p); marker.position.set(...m); marker.scale.setScalar(1 + 0.5 * Math.sin(t * 6)); }
        if (s.focus === 'stick') {
          const g = G.stick, hall = s.sensor === 'hall';
          ang = approach(ang, s.push * 0.42, 12, dt);
          g.tilt.rotation.z = -ang; g.wiper.rotation.z = -ang * 1.6; g.mag.rotation.z = -ang * 1.6;
          g.pot.visible = !hall; g.hall.visible = hall;
          g.worn.material.opacity = 0.85 * s.wear;
          const v = stickReading(s.push, s.wear, s.sensor, t);
          if (Math.abs(v) > DEAD) walk += v * dt * 0.35;
          rd = { v, push: s.push, sensor: s.sensor, walk }; stickB.redraw();
        } else if (s.focus === 'trigger') {
          const g = G.trigger, f = triggerForce(s.pull, s.resist);
          const th = s.pull * 0.4; g.lever.rotation.z = th;
          g.spG.scale.x = 1.7 - (-0.6 + 0.21 + Math.tan(th) * 0.7);
          // The arm's round tip rests on the back face of the trigger. Find the arm angle that just
          // touches it (bisection), for the trigger angle where the game has put the "wall".
          const touch = (thL) => {
            const nx = Math.cos(thL), ny = Math.sin(thL); let lo = -0.3, hi = 1.3;
            for (let i = 0; i < 22; i++) { const a = (lo + hi) / 2, d = (1.55 - 1.45 * Math.cos(a) + 0.6) * nx + (1.35 + 1.45 * Math.sin(a) - 3.3) * ny - 0.21 - 0.17; if (d > 0) hi = a; else lo = a; }
            return (lo + hi) / 2;
          };
          const prev = armA; armA = approach(armA, s.resist > 0.02 ? touch(Math.max(f.wall * 0.4, th)) : 1.0, 12, dt);
          g.gear.rotation.z = -armA; wormA += (armA - prev) * 22; g.worm.rotation.x = wormA;
          const backX = -0.6 + Math.tan(th) * 1.75;
          g.armM.emissiveIntensity = f.touching ? 0.6 : 0;
          g.finger.position.set(backX - 0.75, 3.3 - 1.86 * Math.cos(th) + 0.1, 0.1);
          tr = { pull: s.pull, resist: s.resist }; trigB.redraw();
        } else if (s.focus === 'haptic') {
          const g = G.haptic, F = FEEL[s.feel], sig = F.f(t), env = F.env(t);
          ermW = approach(ermW, env, env > ermW ? 5 : 3, dt); ermTh += ermW * 40 * dt;
          g.wgt.rotation.x = ermTh; g.erm.position.y = 1.0 + 0.05 * ermW * ermW * Math.sin(ermTh);
          g.mass.position.x = sig * 0.42; g.s1.scale.x = 1.3 - 0.45 + sig * 0.42; g.s2.scale.x = 1.3 - 0.45 - sig * 0.42;
          tick += dt; while (tick > 1 / 150) { tick -= 1 / 150; hist.sig[hist.i] = sig; hist.erm[hist.i] = ermW * ermW * Math.sin(ermTh) * 1.6; hist.i = (hist.i + 1) % HN; }
          feelName = F.name; hapB.redraw();
        } else {
          const g = G.lag; lagK = (lagK + dt * 0.45) % 1.25;
          g.path.at(Math.min(1, lagK), g.dot.position);
          g.rings.forEach((r, i) => { const k = (t * 0.9 + i / 3) % 1; r.position.set(-2.3 + k * 1.8, 0.75 + k * 0.25, 1.45 - k * 0.9); r.scale.setScalar(0.6 + k * 1.6); r.material.opacity = 0.8 * (1 - k); });
          g.scr.material.color.setHex(lagK > 1 ? 0x8ef0ff : 0x16223c);
          const key = String(s.gameMode); if (key !== last) { last = key; lg = { game: s.gameMode }; lagB.redraw(); }
        }
      },
      readout(s) { return slim(stage, this.full(s), 2); },
      full(s) {
        if (s.focus === 'stick') {
          const v = stickReading(s.push, s.wear, s.sensor, 0.3), cycles = s.wear * 2 * LIFE, drift = Math.abs(v) > DEAD && Math.abs(s.push) < 0.02;
          return `<div class="big">${drift ? 'Stick drift' : s.sensor === 'hall' ? 'Hall-effect stick' : 'Potentiometer stick'}</div>
            <div class="row"><span>You push</span><b>${Math.round(s.push * 100)}%</b></div>
            <div class="row"><span>The console reads</span><b class="${drift ? 'no' : 'ok'}">${Math.round(v * 100)}%</b></div>
            <div class="row"><span>Dead zone</span><b>±${DEAD * 100}%</b></div>
            <div class="row"><span>Stick turns so far</span><b>${(cycles / 1e6).toFixed(1)} of a rated 2 million</b></div>
            <small>${s.sensor === 'hall' ? 'Nothing rubs, so wear does not change the reading.' : 'About 417 hours of play reaches the rated life (iFixit).'}</small>`;
        }
        if (s.focus === 'trigger') {
          const f = triggerForce(s.pull, s.resist);
          return `<div class="big">${f.touching ? 'Pushing against the motor' : 'A light, free pull'}</div>
            <div class="row"><span>Trigger squeezed</span><b>${Math.round(s.pull * 100)}%</b></div>
            <div class="row"><span>Arm meets it at</span><b>${s.resist > 0.02 ? Math.round(f.wall * 100) + '%' : 'never (motor off)'}</b></div>
            <div class="row"><span>Force on your finger</span><b>${Math.round(f.force * 100)}% of maximum</b></div>`;
        }
        if (s.focus === 'haptic') return `<div class="big">${FEEL[s.feel].name}</div>
            <div class="row"><span>Old rumble motor</span><b>one buzz, slow to start</b></div>
            <div class="row"><span>Voice coil</span><b>any shape, starts at once</b></div>`;
        const tv = s.gameMode ? LAG.tvGame : LAG.tvSlow, con = (LAG.frames * 1000) / 60;
        return `<div class="big">About ${Math.round((LAG.pad + con + tv) / 5) * 5} ms from thumb to screen</div>
          <div class="row"><span>Controller and Bluetooth</span><b>about ${LAG.pad} ms</b></div>
          <div class="row"><span>Console: ${LAG.frames} frames at 60 fps</span><b>${Math.round(con)} ms</b></div>
          <div class="row"><span>TV processing</span><b class="${s.gameMode ? 'ok' : 'no'}">about ${tv} ms</b></div>`;
      },
    };
  },
};
