// Chapter 6: getting 200 W of heat out of the box, and why the fan gets loud.
//
// Physics used here:
//  - Energy: nearly all the electrical power a console draws ends up as heat. A launch PS5 draws
//    about 200 W in a demanding game (reviewers' wall-socket measurements, 2020).
//  - Chip temperature = room temperature + power × thermal resistance (the standard heatsink
//    equation). The resistance has a fixed part (liquid metal, copper plate, heat pipes) and a
//    part from fins to air that falls as airflow rises, roughly as flow^-0.8 (turbulent forced
//    convection, Dittus-Boelter exponent; see Incropera, "Fundamentals of Heat and Mass Transfer").
//  - Air warms by ΔT = power ÷ (density × specific heat × volume flow), with air at 1.16 kg/m³ and
//    1005 J/kg·K.
//  - Fan laws: airflow rises in step with fan speed; sound level rises by about 50·log10(speed
//    ratio) decibels (ASHRAE Handbook, HVAC Systems and Equipment, fan laws).
// Assumed, typical values (Sony does not publish them): full-speed airflow 0.02 m³/s (about
// 42 cubic feet a minute, ordinary for a 120 mm blower), fixed resistance 0.10 K/W, fin resistance
// 0.14 K/W at full flow, 45 dB at full speed. The fan curve is a plain proportional one.
import { THREE, M, approach, clamp, lerp } from '../kit.js';
import { makeConsole, LAYOUT, board, panelBg, text, COL, HEX, pathOf, fitNarrow, slim, isTall, tallView } from '../console.js';

const VMAX = 0.02, RHO = 1.16, CP = 1005, R0 = 0.10, R1 = 0.14, DB_FULL = 45, T_LIMIT = 95;
const TALL = { pos: [-2.4, 7.0, 8.0], target: [0, 2.7, -0.5] };
export const fanFor = (T) => clamp(0.25 + ((T - 55) / 35) * 0.75, 0.25, 1);         // the fan curve
export const flowOf = (q, dust) => q * VMAX * (1 - 0.6 * dust);
export const rTh = (flow) => R0 + R1 / Math.pow(Math.max(0.05, flow / VMAX), 0.8);
export const noise = (q) => Math.max(20, DB_FULL + 50 * Math.log10(q));
// Where the temperature and fan settle for a given load.
export function settle(P, room, dust) {
  let T = room + P * 0.3;
  for (let i = 0; i < 60; i++) T = lerp(T, room + P * rTh(flowOf(fanFor(T), dust)), 0.5);
  const q = fanFor(T), flow = flowOf(q, dust);
  return { T, q, flow, out: room + P / (RHO * CP * flow), db: noise(q) };
}

export default {
  id: 'heat',
  short: 'Heat and noise',
  title: 'Heat, and why the fan gets loud',
  subtitle: 'A hard-working console turns about 200 W into heat. All of it has to leave the box.',
  view: { pos: [-3.6, 6.2, 8.4], target: [0.4, 2.3, -0.6] },
  learn: `<p>Electricity goes into the chips, sums come out, and almost every watt ends up as <b>heat</b>. A PlayStation 5 running a demanding game draws about <b>200 W</b>: as much as three or four ceiling fans, released inside a box the size of a thick book.</p>
    <p>The heat takes a relay. First, a thin layer of <b>liquid metal</b> fills the microscopic gaps between the chip and a copper plate. Then <b>heat pipes</b> take over: sealed copper tubes with a little liquid inside. It boils at the hot end, rushes to the cool end, turns back to liquid and gives up its heat, then creeps back along a wick. A heat pipe moves heat far better than solid copper.</p>
    <p>The pipes feed a stack of thin <b>fins</b>, and a <b>fan</b> pushes room air through them. The air leaves about 10 °C warmer, carrying the heat out of the back.</p>
    <p>A sensor watches the chip. The hotter it gets, the faster the fan spins: that is the <b>fan curve</b>. Noise rises steeply with speed, so a hot room, a heavy game or dusty vents all end the same way: a louder console. If cooling still cannot keep up, the console slows itself or shuts down to protect the chip.</p>
    <p>For how moving air carries heat away, see <a href="https://glassbox.how/fanclear/">FanClear</a> and <a href="https://glassbox.how/heatclear/">HeatClear</a>.</p>
    <p class="tip"><b>Try it:</b> set the room to a 40 °C summer afternoon, then clog the vents with dust and watch the fan run out of room.</p>`,
  terms: [
    { t: 'Watt', d: 'A unit of power: one joule of energy every second.' },
    { t: 'Thermal interface', d: 'The layer between a chip and its heatsink that fills tiny air gaps. Here it is liquid metal.' },
    { t: 'Heat pipe', d: 'A sealed tube that moves heat by boiling a liquid at one end and condensing it at the other.' },
    { t: 'Fan curve', d: 'The rule that sets fan speed from chip temperature.' },
    { t: 'Decibel', d: 'A unit of loudness. Ten decibels more sounds roughly twice as loud.' },
    { t: 'Thermal throttling', d: 'A chip slowing itself down so that it makes less heat.' },
  ],
  defaults: { power: 200, room: 28, dust: 0 },
  controls: [
    { key: 'power', type: 'range', label: 'How hard the console works', min: 50, max: 230, step: 5, ends: ['home menu', 'heaviest game'], fmt: (v) => Math.round(v) + ' W' },
    { key: 'room', type: 'range', label: 'Room temperature', min: 18, max: 42, step: 1, fmt: (v) => Math.round(v) + ' °C' },
    { key: 'dust', type: 'range', label: 'Dust in the vents', min: 0, max: 1, step: 0.01, ends: ['clean', 'clogged'], fmt: (v) => Math.round(v * 100) + '%' },
  ],
  quiz: [
    { q: 'Where does most of the 200 W a console draws end up?', options: ['As light from the TV', 'As heat inside the console', 'Stored in the SSD', 'Sent to the controller'], answer: 1, why: 'Computing does not use energy up. Almost all the electrical power becomes heat, which the fan has to carry out.' },
    { q: 'How does a heat pipe move heat so well?', options: ['It is filled with ice', 'A liquid boils at the hot end and condenses at the cool end', 'It has a tiny fan inside', 'It is made of plastic'], answer: 1, why: 'Boiling soaks up a lot of heat and condensing gives it back, so vapour carries heat along the tube very quickly.' },
    { q: 'Why is a console louder in a hot room?', options: ['Hot air carries sound better', 'The chip runs hotter, so the fan curve spins the fan faster', 'The speakers turn up', 'The disc spins faster'], answer: 1, why: 'Warmer air cools less well. The chip heats up, the fan speeds up to compensate, and noise climbs steeply with speed.' },
  ],
  reel: [
    { ms: 5800, caption: 'Almost all of 200 watts becomes heat. Heat pipes carry it to the fins, and the harder the chip works, the louder the fan.', set: { room: 28, dust: 0 }, anim: { power: [50, 230] }, view: { pos: [-5.9, 8.6, 11.4], target: [-0.2, 2.5, -0.8] }, spin: 0.3 },
  ],

  build({ stage }) {
    const c = makeConsole(), P = c.parts, K = 1.7;
    c.scale.setScalar(K); c.setShell(1); stage.root.add(c);
    const w = (p) => [p[0] * K, p[1] * K, p[2] * K];

    // Air: in through the sides to the blower, round it, back through the fins and out.
    const NA = 240, air = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, toneMapped: false }), NA);
    air.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NA * 3), 3); air.frustumCulled = false; stage.root.add(air);
    const seeds = Array.from({ length: NA }, (_, i) => ({ u: (i * 0.6180339) % 1, a: ((i * 0.37) % 1) * Math.PI * 2, y: 0.2 + ((i * 0.713) % 1) * 0.55, x: -1.8 + ((i * 0.529) % 1) * 1.1, side: i % 3 }));
    const o3 = new THREE.Object3D(), cool = new THREE.Color(0x7fc4ff), warm = new THREE.Color(0xff6a3a), cc = new THREE.Color();
    const [fx, , fz] = LAYOUT.fan;
    // Heat moving along the pipes from the chip to the fins.
    const [sx, , sz] = LAYOUT.soc;
    const pipes = [[-0.18, 0.34, -0.25], [-0.06, 0.52, -0.5], [0.06, 0.66, -0.8], [0.18, 0.4, -1.05]].map(([dz, y, zf]) => pathOf([[sx + 0.2, 0.37, sz + dz], [sx - 0.25, 0.37, sz + dz], [-0.5, (0.37 + y) / 2, (sz + dz + zf) / 2], [-0.72, y, zf], [-1.8, y, zf]].map(w)));
    const NH = 40, hot = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), M.glow(0xffc24a), NH); hot.frustumCulled = false; stage.root.add(hot);
    const v = new THREE.Vector3();

    let st = null;
    const chart = board(stage.root, 5.6, 2.5, 1008, 450, (g, W, H) => {
      panelBg(g, W, H, 0.92); if (!st) return;
      const over = st.T > T_LIMIT;
      text(g, `Chip ${Math.round(st.T)} °C`, 28, 52, { font: 'bold 38px sans-serif', col: over ? COL.bad : '#eef2fa' });
      text(g, `Fan ${Math.round(st.q * 100)}%   ${Math.round(st.db)} dB`, W - 28, 52, { font: 'bold 34px sans-serif', col: COL.data, align: 'right' });
      const x0 = 84, y0 = 380, pw = W - 130, ph = 280, X = (T) => x0 + ((T - 40) / 70) * pw, Y = (q) => y0 - q * ph;
      g.strokeStyle = COL.grid; g.lineWidth = 2; g.strokeRect(x0, y0 - ph, pw, ph);
      g.fillStyle = 'rgba(255,90,138,.16)'; g.fillRect(X(T_LIMIT), y0 - ph, X(110) - X(T_LIMIT), ph);
      for (let T = 40; T <= 110; T += 10) text(g, T + '°', X(T), y0 + 34, { font: '22px sans-serif', col: COL.soft, align: 'center' });
      [0.25, 0.5, 0.75, 1].forEach((q) => text(g, Math.round(q * 100) + '%', x0 - 10, Y(q) + 8, { font: '22px sans-serif', col: COL.soft, align: 'right' }));
      g.strokeStyle = COL.data; g.lineWidth = 5; g.beginPath(); for (let T = 40; T <= 110; T += 1) { const y = Y(fanFor(T)); if (T === 40) g.moveTo(X(T), y); else g.lineTo(X(T), y); } g.stroke();
      g.fillStyle = over ? COL.bad : COL.gold; g.beginPath(); g.arc(X(clamp(st.T, 40, 110)), Y(st.q), 13, 0, 7); g.fill();
      text(g, 'Fan curve: fan speed against chip temperature', x0, y0 + 64, { font: '22px sans-serif', col: COL.soft });
      text(g, 'too hot', X(102.5), y0 - ph + 30, { font: '22px sans-serif', col: COL.bad, align: 'center' });
    }, [2.6, 4.6, -2.6]);
    if (isTall(stage)) { chart.mesh.position.set(0, 5.7, -2.8); chart.mesh.scale.setScalar(1.15); }

    const labels = [
      stage.label('', w([sx, 0.75, sz]), stage.root, 'hot'),
      stage.label('Heat pipes', w([-0.45, 1.0, -0.75]), stage.root),
      stage.label('Fins', w([-1.25, 1.12, -0.9]), stage.root),
      stage.label('Fan', w([fx, 0.95, fz]), stage.root),
      stage.label('Cool air in', w([-2.75, 0.75, 0.75]), stage.root),
      stage.label('', w([-1.25, 0.95, -2.05]), stage.root, 'hot'),
    ];

    let T = 45, q = 0.3, spin = 0, t = 0, tick = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        fitNarrow(stage, [labels[1], labels[2], labels[3]], -0.1, [0.06, -0.06]); tallView(stage, TALL);
        // The chip warms towards room + power × resistance; the fan follows its curve.
        q = approach(q, fanFor(T), 1.2, dt);
        const flow = flowOf(q, s.dust);
        T = approach(T, s.room + s.power * rTh(flow), 0.9, dt);
        const out = s.room + s.power / (RHO * CP * flow), k = clamp((T - s.room) / 70, 0, 1);
        st = { T, q, db: noise(q), out, flow };
        spin += dt * (4 + q * 34); P.fan.spin.rotation.y = spin;
        P.socMat.emissiveIntensity = 0.3 + 1.6 * k; P.copper.emissiveIntensity = 0.1 + 0.9 * k; P.finMat.emissiveIntensity = 0.25 * k;
        P.disc.rotation.y += dt * 3;
        const speed = 0.12 + 0.6 * (flow / VMAX), wk = clamp((out - s.room) / 22, 0, 1);
        for (let i = 0; i < NA; i++) {
          const p = seeds[i], u = (p.u + t * speed * 0.5) % 1;
          let x, y = p.y, z, heat = 0;
          if (u < 0.3) { const a = u / 0.3, ex = p.side === 0 ? fx - 0.9 - (1 - a) * 0.9 : fx + 0.42 * Math.cos(p.a), ey = p.side === 1 ? 1.5 - a * 1.1 : p.side === 2 ? 0.45 : p.y, ez = p.side === 0 ? fz + (p.y - 0.45) : fz + 0.42 * Math.sin(p.a) + (p.side === 2 ? (1 - a) * 1.3 : 0); x = lerp(ex, fx + 0.42 * Math.cos(p.a), a * a); y = lerp(ey, p.y, a); z = lerp(ez, fz + 0.42 * Math.sin(p.a), a * a); }
          else if (u < 0.5) { const a = (u - 0.3) / 0.2, ang = p.a + a * 3.6, r = 0.42 + 0.12 * a; x = lerp(fx + r * Math.cos(ang), p.x, a * a); z = lerp(fz + r * Math.sin(ang), -0.1, a * a); }
          else { const a = (u - 0.5) / 0.5; x = p.x; z = -0.1 - a * 2.5; heat = clamp(a * 2.2, 0, 1) * wk; y = p.y + Math.max(0, a - 0.5) * 0.35; }
          o3.position.set(x * K, y * K, z * K); o3.scale.setScalar(u > 0.94 ? (1 - u) / 0.06 : 1); o3.updateMatrix(); air.setMatrixAt(i, o3.matrix);
          air.setColorAt(i, cc.copy(cool).lerp(warm, heat));
        }
        air.instanceMatrix.needsUpdate = true; air.instanceColor.needsUpdate = true;
        for (let i = 0; i < NH; i++) {
          const u = ((i / NH) * 10 + t * (0.25 + s.power / 500)) % 1, on = i / NH < s.power / 230;
          pipes[i % 4].at(u, v); o3.position.copy(v); o3.scale.setScalar(on ? 0.5 + 0.6 * (1 - u) : 0.001); o3.updateMatrix(); hot.setMatrixAt(i, o3.matrix);
        }
        hot.instanceMatrix.needsUpdate = true;
        tick += dt; if (tick > 0.1) { tick = 0; chart.redraw(); labels[0].element.textContent = `Chip: ${Math.round(s.power)} W of heat`; labels[5].element.textContent = `Warm air out: ${Math.round(out)} °C`; }
      },
      readout(s) { return slim(stage, this.full(s), 2); },
      full(s) {
        if (!st) return '';
        const over = st.T > T_LIMIT, e = settle(s.power, s.room, s.dust);
        return `<div class="big">${over ? 'Too hot: the console must slow down' : `Chip at ${Math.round(st.T)} °C`}</div>
          <div class="row"><span>Fan speed</span><b>${Math.round(st.q * 100)}%</b></div>
          <div class="row"><span>Fan noise</span><b>about ${Math.round(st.db)} dB</b></div>
          <div class="row"><span>Air through the fins</span><b>${(st.flow * 1000).toFixed(0)} litres a second</b></div>
          <div class="row"><span>Air leaves at</span><b>${Math.round(st.out)} °C (${Math.round(st.out - s.room)} °C warmer)</b></div>
          <div class="row"><span>${e.T > T_LIMIT ? 'Unchecked, it would reach' : 'Will settle at'}</span><b class="${e.T > T_LIMIT ? 'no' : 'ok'}">${Math.round(e.T)} °C</b></div>`;
      },
    };
  },
};
