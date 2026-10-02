// Chapter 1: take a console apart.
// Part facts are the launch PlayStation 5's published specifications and iFixit's 2020 teardown
// (see SPEC in console.js for sources). The box drawn here is generic.
import { THREE, exploder, approach, clamp } from '../kit.js';
import { makeConsole, SPEC, HEX, fitNarrow, slim, inReel } from '../console.js';

const INFO = {
  all: null,
  soc: { name: 'System-on-chip', does: 'One slab of silicon holding the CPU, which runs the game’s rules, and the GPU, which draws the picture.', rows: [['CPU', '8 cores, up to 3.5 GHz'], ['GPU', '10.28 trillion sums a second'], ['Designed by', 'AMD with Sony']] },
  ram: { name: 'Memory: 16 GB', does: 'Eight fast memory chips hold the level you are in: models, textures and the game’s state. It empties when the power goes off.', rows: [['Type', 'GDDR6, shared by CPU and GPU'], ['Speed', '448 GB a second']] },
  ssd: { name: 'SSD: 825 GB', does: 'Flash chips soldered to the board keep games when the power is off. No moving parts, so any byte can be fetched at once.', rows: [['Read speed', '5.5 GB a second, raw'], ['After unpacking', 'typically 8 to 9 GB a second']] },
  drive: { name: 'Disc drive', does: 'Spins an Ultra HD Blu-ray disc and reads it with a blue laser. Games are copied from the disc to the SSD before you play.', rows: [['One disc holds', 'up to 100 GB'], ['Also plays', 'Blu-ray films and DVDs']] },
  psu: { name: 'Power supply', does: 'Turns mains electricity (230 V AC in India) into the steady 12 V DC that the chips need.', rows: [['Rated', '350 W'], ['Used while gaming', 'about 200 W']] },
  cool: { name: 'Heatsink and fan', does: 'Liquid metal carries the chip’s heat into copper, heat pipes carry it to thin fins, and a blower pushes air through them.', rows: [['Fan', '120 mm across, 45 mm thick'], ['Heat to remove', 'about 200 W']] },
};

export default {
  id: 'anatomy',
  short: 'Inside the box',
  title: 'Inside a games console',
  subtitle: 'A computer built for one job: one chip, fast memory, fast storage and a lot of cooling.',
  view: { pos: [5.6, 6.4, 7.6], target: [0, 2.3, 0] },
  learn: `<p>A games console is a <b>computer</b> built to do one thing well: draw a new picture of a game world many times a second. Our worked example is the <b>PlayStation 5</b>, but an Xbox or a Nintendo Switch has the same kinds of parts.</p>
    <p>The heart is a <b>system-on-chip</b>. One piece of silicon holds the <b>CPU</b> (eight cores that run the game’s rules) and the <b>GPU</b> (the part that draws). Round it sit <b>16 GB of memory</b> chips. Further along the board is the <b>SSD</b>: flash chips that keep your games when the power is off.</p>
    <p>A <b>disc drive</b> reads Ultra HD Blu-ray discs. A <b>350 W power supply</b> feeds everything. And a surprising share of the box is <b>cooling</b>: a copper plate, heat pipes, a wall of fins and a 120 mm fan. Nearly all the electricity a console uses turns into heat that must be carried away.</p>
    <p>If you know what is inside a desktop PC from <a href="https://glassbox.how/computerclear/">ComputerClear</a>, this will look familiar. A console is the same idea, with every part chosen in advance and packed tight.</p>
    <p>In India the PS5 went on sale on <b>2 February 2021</b>, almost three months after its first launch, at Rs 49,990, or Rs 39,990 without a disc drive. Consoles are imported, so duty and tax are part of the price, and during shortages unofficial “grey market” imports have often sold for more, without an Indian warranty. Most players in India game on phones, and many first meet a console at a gaming café.</p>
    <p><small>ConsoleClear is an independent explainer. “PlayStation” is a trademark of Sony Interactive Entertainment, which has no connection with it.</small></p>
    <p class="tip"><b>Try it:</b> take the console apart, then pick a part to see what it does. Tap a part in the model to pick it too.</p>`,
  terms: [
    { t: 'System-on-chip', d: 'One chip that holds the CPU, the GPU and more. Also called an SoC.' },
    { t: 'CPU', d: 'The processor that runs the game’s rules: input, physics, enemies, sound.' },
    { t: 'GPU', d: 'The processor that draws the picture, working on millions of pixels at once.' },
    { t: 'SSD', d: 'Solid-state drive: storage made of flash memory chips, with no moving parts.' },
    { t: 'Heatsink', d: 'Metal fins that spread a chip’s heat into moving air.' },
    { t: 'Power supply', d: 'The box that turns mains AC into the low-voltage DC the chips run on.' },
  ],
  defaults: { explode: 0, part: 'all', xray: false },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'part', type: 'seg', label: 'Look at', options: [{ v: 'all', label: 'All' }, { v: 'soc', label: 'Chip' }, { v: 'ram', label: 'Memory' }, { v: 'ssd', label: 'SSD' }, { v: 'drive', label: 'Disc' }, { v: 'psu', label: 'Power' }, { v: 'cool', label: 'Cooling' }] },
    { key: 'xray', type: 'toggle', label: 'See-through shell' },
  ],
  quiz: [
    { q: 'What sits on the system-on-chip?', options: ['Only the memory', 'The CPU and the GPU together', 'The disc drive', 'The power supply'], answer: 1, why: 'One piece of silicon holds both processors, so they can share memory and talk quickly.' },
    { q: 'Why is so much of a console taken up by a heatsink and fan?', options: ['To make it look bigger', 'Because the SSD gets very hot', 'Because about 200 W of electricity turns into heat inside it', 'To keep dust out'], answer: 2, why: 'Almost all the power the chips use ends up as heat. It has to be carried out or the chips would overheat in seconds.' },
    { q: 'Which part keeps your games when the console is unplugged?', options: ['The 16 GB of memory', 'The SSD', 'The GPU', 'The heat pipes'], answer: 1, why: 'Flash memory in the SSD holds data without power. The 16 GB of working memory forgets everything when the power goes off.' },
  ],
  reel: [
    { ms: 5600, caption: 'A games console is a computer built for one job: drawing a game world 60 times a second.', set: { part: 'all', xray: false }, anim: { explode: [0, 1] }, view: { pos: [5.9, 7.0, 8.4], target: [0, 2.3, 0] }, spin: 0.5 },
    { ms: 5200, caption: 'One chip holds an 8-core CPU and the GPU. Round it: 16 GB of memory and a very fast SSD.', set: { part: 'soc', explode: 1, xray: true }, view: { pos: [2.6, 5.6, 4.6], target: [0.1, 1.2, 0] }, spin: 0.4 },
  ],

  build({ stage, s: S }) {
    const c = makeConsole(), P = c.parts, K = 1.7;
    c.scale.setScalar(K); stage.root.add(c);
    const setExplode = exploder([
      { obj: P.top, off: [0, 2.15, 0] },
      { obj: P.sink, off: [0, 1.0, -0.15] },
      { obj: P.fan, off: [-0.45, 0.5, 0.35] },
      { obj: P.psu, off: [0.5, 0.7, -0.3] },
      { obj: P.drive, off: [0.45, 0.15, 0.6] },
    ]);
    const tag = (id, objs) => objs.forEach((o) => o.traverse((m) => { if (m.isMesh) { m.userData.id = id; stage.pickables.push(m); } }));
    tag('soc', [P.soc, P.liquid]); tag('ram', P.ram); tag('ssd', P.ssd); tag('drive', [P.drive]); tag('psu', [P.psu]); tag('cool', [P.sink, P.fan]);

    const L = (id, html, obj, pos) => { const l = stage.label(html, pos, obj); l.userData.id = id; return l; };
    const labels = [
      L('soc', 'System-on-chip: CPU + GPU', P.board, [0.05, 0.5, -0.45]),
      L('ram', '16 GB memory', P.board, [0.6, 0.36, -0.05]),
      L('ssd', 'SSD flash chips', P.board, [0.05, 0.42, 1.0]),
      L('cool', 'Heat pipes and fins', P.sink, [-1.25, 1.0, -0.9]),
      L('cool', '120 mm fan', P.fan, [0, 0.42, 0]),
      L('psu', 'Power supply: 350 W', P.psu, [0, 0.5, 0]),
      L('drive', 'Disc drive', P.drive, [0, 0.36, 0.3]),
    ];
    const shellLbl = stage.label('Shell', [1.5, 1.15, 1.0], P.top);
    const hlBox = new THREE.Box3(), tmp = new THREE.Box3();
    const hl = new THREE.Box3Helper(hlBox, HEX.gold); hl.material.depthTest = false; hl.material.transparent = true; hl.renderOrder = 11; stage.root.add(hl);
    const hlTarget = { soc: [P.soc], ram: P.ram, ssd: P.ssd, drive: [P.drive], psu: [P.psu], cool: [P.sink, P.fan] };
    let see = 0, t = 0, spin = 0, glow = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        const narrow = fitNarrow(stage, [labels[1], labels[4], shellLbl], -0.1, [0.08, -0.1]);
        setExplode(s.explode);
        see = approach(see, s.xray || s.explode > 0.04 ? 1 : 0, 6, dt);
        c.setShell(s.explode > 0.04 && !s.xray ? 0.45 * see : see);
        const open = see > 0.5;
        labels.forEach((l, i) => { l.visible = open && !(narrow && (i === 1 || i === 4)) && (!narrow || s.part === 'all' || l.userData.id === s.part); l.element.classList.toggle('hot', l.userData.id === s.part); });
        shellLbl.visible = s.explode > 0.5 && !narrow;
        spin += dt * 9; P.fan.spin.rotation.y = spin; P.disc.rotation.y = spin * 0.7;
        // The chosen part glows gently.
        glow = 0.5 + 0.5 * Math.sin(t * 4);
        P.socMat.emissiveIntensity = s.part === 'soc' ? 0.25 + 0.35 * glow : 0;
        P.ramMat.emissiveIntensity = s.part === 'ram' ? 0.3 + 0.5 * glow : 0;
        P.ssdMat.emissiveIntensity = s.part === 'ssd' ? 0.3 + 0.5 * glow : 0;
        P.copper.emissiveIntensity = s.part === 'cool' ? 0.15 + 0.2 * glow : 0;
        const id = s.part;
        hl.visible = id !== 'all' && open && !inReel();
        if (hl.visible) {
          hlBox.makeEmpty(); hlTarget[id].forEach((o) => hlBox.union(tmp.setFromObject(o)));
          hl.material.opacity = 0.55 + 0.45 * glow;
        }
      },
      pick(o) { if (o.userData.id) S.part = S.part === o.userData.id ? 'all' : o.userData.id; },
      readout(s) { return slim(stage, this.full(s), 1); },
      full(s) {
        const info = INFO[s.part];
        if (info) return `<div class="big">${info.name}</div><small class="keep" style="display:block;max-width:330px">${info.does}</small>${info.rows.map(([a, b]) => `<div class="row"><span>${a}</span><b>${b}</b></div>`).join('')}`;
        return `<div class="big">${clamp(s.explode, 0, 1) > 0.5 ? 'Seven main parts' : 'One box, about 4.5 kg'}</div>
          <div class="row"><span>Size</span><b>${SPEC.size[0]} × ${SPEC.size[2]} × ${SPEC.size[1]} mm</b></div>
          <div class="row"><span>Processor</span><b>${SPEC.cpuCores} cores + GPU on one chip</b></div>
          <div class="row"><span>Memory and storage</span><b>${SPEC.ramGB} GB, ${SPEC.ssdGB} GB SSD</b></div>
          <small>Figures for the launch PlayStation 5 (2020).</small>`;
      },
    };
  },
};
