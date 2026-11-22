/**
 * Claw machine sound design — procedural Web Audio, no samples.
 *
 * Signal path:
 *   ui / mech / jingle buses → master gain → glue compressor → limiter → mute → destination
 *   a short cabinet reverb is fed lightly from the mech and jingle buses.
 *
 * Rules the cues follow:
 * - one cue per visible event, each built from layers (transient, body, tail);
 * - the top stays soft: nothing over ~7 kHz, 2–6 kHz only for short mechanical edges;
 * - low levels: the cabinet hums, it never shouts.
 *
 * All sounds are deterministic (seeded jitter), so a render is reproducible.
 */

export type AudioOptions = {
  /** Pass an OfflineAudioContext to render cues for measurement. */
  context?: BaseAudioContext;
  volume?: number;
  muted?: boolean;
};

type BusName = 'ui' | 'mech' | 'jingle';

type ToneOptions = {
  freq: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  glide?: number;
  attack?: number;
  bus?: BusName;
  pan?: number;
  lp?: number;
  q?: number;
};

type BurstOptions = {
  dur: number;
  gain: number;
  freq: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
  attack?: number;
  bus?: BusName;
  pan?: number;
  hp?: number;
  lp?: number;
  kind?: 'white' | 'pink';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Small deterministic PRNG: same seed, same take. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createAudio(options: AudioOptions = {}) {
  let ctx: BaseAudioContext | null = options.context ?? null;
  let built = false;
  let muted = options.muted ?? false;
  const volume = clamp(options.volume ?? 0.9, 0, 1.5);

  let master: GainNode | null = null;
  let uiBus: GainNode | null = null;
  let mechBus: GainNode | null = null;
  let jingleBus: GainNode | null = null;
  let white: AudioBuffer | null = null;
  let pink: AudioBuffer | null = null;

  const rnd = mulberry32(0x51a7c0de);
  const jitter = (amount: number) => 1 + (rnd() * 2 - 1) * amount;

  /* ------------------------------------------------------------------ graph */

  function makeNoise(seconds: number, colour: 'white' | 'pink'): AudioBuffer {
    const c = ctx!;
    const length = Math.max(1, Math.floor(c.sampleRate * seconds));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = rnd() * 2 - 1;
      if (colour === 'white') {
        data[i] = w;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buffer;
  }

  /** A small, dark room: the inside of the cabinet, not a hall. Energy-normalised. */
  function makeImpulse(seconds: number): AudioBuffer {
    const c = ctx!;
    const length = Math.max(1, Math.floor(seconds * c.sampleRate));
    const buffer = c.createBuffer(2, length, c.sampleRate);
    let energy = 0;
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const n = rnd() * 2 - 1;
        lp += (n - lp) * 0.32;
        data[i] = lp * Math.pow(1 - i / length, 2.6) * 0.6;
        energy += data[i] * data[i];
      }
    }
    const norm = 1 / Math.sqrt(Math.max(1e-9, energy));
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] *= norm;
    }
    return buffer;
  }

  function build() {
    const c = ctx!;

    const mix = c.createGain();
    mix.gain.value = volume;

    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -15;
    glue.knee.value = 10;
    glue.ratio.value = 2.2;
    glue.attack.value = 0.008;
    glue.release.value = 0.22;

    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.06;

    const out = c.createGain();
    out.gain.value = muted ? 0 : 1;

    mix.connect(glue);
    glue.connect(limiter);
    limiter.connect(out);
    out.connect(c.destination);
    master = out;

    uiBus = c.createGain();
    uiBus.gain.value = 0.62;
    mechBus = c.createGain();
    mechBus.gain.value = 0.8;
    jingleBus = c.createGain();
    jingleBus.gain.value = 0.55;
    uiBus.connect(mix);
    mechBus.connect(mix);
    jingleBus.connect(mix);

    // A whisper of cabinet reverb: only the mechanical and musical cues touch it.
    const convolver = c.createConvolver();
    convolver.buffer = makeImpulse(0.6);
    const wet = c.createGain();
    wet.gain.value = 0.45;
    convolver.connect(wet);
    wet.connect(mix);
    const sends: Array<[GainNode, number]> = [
      [uiBus, 0.03],
      [mechBus, 0.05],
      [jingleBus, 0.1],
    ];
    for (const [source, amount] of sends) {
      const send = c.createGain();
      send.gain.value = amount;
      source.connect(send);
      send.connect(convolver);
    }

    built = true;
  }

  function ensure(): BaseAudioContext {
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: 'interactive' });
    }
    if (!built) build();
    if (ctx instanceof AudioContext && ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  /** Cue entry point: null when muted so nothing is scheduled. */
  function ready(): BaseAudioContext | null {
    if (muted) return null;
    return ensure();
  }

  const bus = (name: BusName): GainNode =>
    (name === 'ui' ? uiBus : name === 'mech' ? mechBus : jingleBus)!;

  function place(node: AudioNode, name: BusName, pan: number) {
    const c = ctx!;
    if (Math.abs(pan) < 0.01) {
      node.connect(bus(name));
      return;
    }
    const panner = c.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    node.connect(panner);
    panner.connect(bus(name));
  }

  /* --------------------------------------------------------------- utilities */

  function noiseSource(when: number, dur: number, kind: 'white' | 'pink' = 'white'): AudioBufferSourceNode {
    const c = ctx!;
    if (!white) white = makeNoise(2, 'white');
    if (!pink) pink = makeNoise(2, 'pink');
    const buffer = kind === 'pink' ? pink : white;
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start(when, rnd() * buffer.duration);
    source.stop(when + dur + 0.03);
    return source;
  }

  function tone(when: number, o: ToneOptions) {
    const c = ctx!;
    const dur = Math.max(0.02, o.dur);
    const attack = Math.min(o.attack ?? 0.002, dur * 0.8);
    const osc = c.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, when);
    if (o.glide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(18, o.glide), when + dur);
    }
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, o.gain), when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    let node: AudioNode = osc;
    if (o.lp) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lp;
      lp.Q.value = o.q ?? 0.7;
      node.connect(lp);
      node = lp;
    }
    node.connect(gain);
    place(gain, o.bus ?? 'mech', o.pan ?? 0);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  function burst(when: number, o: BurstOptions) {
    const c = ctx!;
    const dur = Math.max(0.005, o.dur);
    const attack = Math.min(o.attack ?? 0.001, dur * 0.7);
    const source = noiseSource(when, dur, o.kind ?? 'white');
    const filter = c.createBiquadFilter();
    filter.type = o.type ?? 'bandpass';
    filter.frequency.setValueAtTime(o.freq, when);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), when + dur);
    filter.Q.value = o.q ?? 1;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, o.gain), when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    let node: AudioNode = source;
    node.connect(filter);
    node = filter;
    if (o.hp) {
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = o.hp;
      node.connect(hp);
      node = hp;
    }
    if (o.lp) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lp;
      node.connect(lp);
      node = lp;
    }
    node.connect(gain);
    place(gain, o.bus ?? 'mech', o.pan ?? 0);
  }

  /** Held level with soft edges (motors, slides). */
  function hold(gain: GainNode, when: number, peak: number, dur: number, attack = 0.03, release = 0.12) {
    const level = Math.max(0.0002, peak);
    const releaseStart = when + Math.max(attack, dur - release);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + attack);
    gain.gain.setValueAtTime(level, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  }

  /** Dull weight: a pitched drop with a soft top and a small contact noise. */
  function thump(when: number, o: { freq?: number; gain: number; dur?: number; bus?: BusName; pan?: number }) {
    const base = o.freq ?? 72;
    const dur = o.dur ?? 0.26;
    tone(when, {
      freq: base * 1.85,
      glide: base * 0.78,
      dur,
      gain: o.gain,
      type: 'sine',
      attack: 0.004,
      lp: Math.max(180, base * 3.4),
      bus: o.bus ?? 'mech',
      pan: o.pan ?? 0,
    });
    burst(when, {
      dur: Math.min(0.02, dur * 0.2),
      gain: o.gain * 0.35,
      freq: 620,
      q: 0.9,
      attack: 0.0006,
      lp: 1800,
      bus: o.bus ?? 'mech',
      pan: o.pan ?? 0,
    });
  }

  /** Inharmonic metal: short sine modes plus a noise edge. */
  function metal(
    when: number,
    o: { base: number; gain: number; decay?: number; bus?: BusName; pan?: number; edge?: number }
  ) {
    const ratios = [1, 2.41, 3.93, 6.07];
    const amps = [1, 0.6, 0.36, 0.18];
    const decay = o.decay ?? 0.14;
    ratios.forEach((ratio, index) => {
      tone(when, {
        freq: o.base * ratio * jitter(0.01),
        dur: decay * (1 + index * 0.38),
        gain: o.gain * amps[index] * 0.5,
        type: 'sine',
        attack: 0.001,
        bus: o.bus ?? 'mech',
        pan: o.pan ?? 0,
      });
    });
    burst(when, {
      dur: 0.018,
      gain: o.gain * (o.edge ?? 0.55),
      freq: Math.min(6800, o.base * 2.4),
      q: 2.2,
      attack: 0.0005,
      lp: 7000,
      bus: o.bus ?? 'mech',
      pan: o.pan ?? 0,
    });
    thump(when, { freq: o.base * 0.3, gain: o.gain * 0.7, dur: 0.16, bus: o.bus ?? 'mech', pan: o.pan ?? 0 });
  }

  /** Cabinet reverb send for the musical cues. */
  function bell(when: number, freq: number, gain: number, dur: number, bus: BusName = 'jingle') {
    tone(when, { freq, dur, gain, type: 'sine', attack: 0.004, lp: 5200, bus });
    tone(when, { freq: freq * 2, dur: dur * 0.55, gain: gain * 0.28, type: 'sine', attack: 0.003, lp: 6000, bus });
    tone(when, { freq: freq * 2.76, dur: dur * 0.35, gain: gain * 0.12, type: 'sine', attack: 0.002, bus });
  }

  /* -------------------------------------------------------------------- cues */

  /** 1. Stick gate: one micro click each time the lever crosses a notch. */
  function stickTick(direction = 1, step = 0) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.004;
    const dir = direction >= 0 ? 1 : -1;
    const pitch = jitter(0.02) * (2850 + (step % 8) * 70 + dir * 90);
    burst(t, { dur: 0.01, gain: 0.13, freq: pitch, q: 1.5, attack: 0.0003, bus: 'ui', pan: dir * 0.14 });
    burst(t + 0.001, { dur: 0.018, gain: 0.05, freq: 1250, q: 3.5, attack: 0.0005, bus: 'ui', pan: dir * 0.1 });
    tone(t, { freq: 300 * jitter(0.03), glide: 235, dur: 0.022, gain: 0.032, type: 'sine', attack: 0.001, bus: 'ui', pan: dir * 0.1 });
  }

  /** Feeds the gate feel from raw stick coordinates; the audio owns the hysteresis. */
  let lastSector = -1;
  let lastRing = 0;
  let lastTickAt = -1;
  function stick(x: number, y: number) {
    const magnitude = Math.hypot(x, y);
    if (magnitude < 0.12) {
      lastSector = -1;
      lastRing = 0;
      return;
    }
    const sector = Math.round(((Math.atan2(y, x) + Math.PI) / (Math.PI / 4))) % 8;
    const ring = Math.min(3, Math.floor((magnitude - 0.12) / 0.29));
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if ((sector !== lastSector || ring !== lastRing) && now - lastTickAt > 48) {
      lastSector = sector;
      lastRing = ring;
      lastTickAt = now;
      stickTick(sector % 2 === 0 ? 1 : -1, sector);
    }
  }

  /** 2. Button: a full plastic click, then the quieter release of the cap. */
  function button() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.004;
    burst(t, { dur: 0.007, gain: 0.4, freq: 2100, q: 0.9, attack: 0.0003, bus: 'ui' });
    burst(t + 0.001, { dur: 0.006, gain: 0.07, freq: 3400, q: 2, attack: 0.0003, bus: 'ui' });
    burst(t + 0.002, { dur: 0.04, gain: 0.1, freq: 640, q: 4.5, attack: 0.0008, bus: 'ui' });
    tone(t, { freq: 152, glide: 96, dur: 0.06, gain: 0.145, type: 'sine', attack: 0.001, bus: 'ui' });
    tone(t, { freq: 520 * jitter(0.01), dur: 0.05, gain: 0.06, type: 'triangle', attack: 0.001, bus: 'ui' });
    tone(t, { freq: 1180 * jitter(0.01), dur: 0.035, gain: 0.034, type: 'triangle', attack: 0.001, bus: 'ui' });
    // the cap coming back up
    burst(t + 0.105, { dur: 0.01, gain: 0.07, freq: 2500, q: 2, attack: 0.0004, bus: 'ui' });
    tone(t + 0.105, { freq: 900, glide: 720, dur: 0.045, gain: 0.031, type: 'triangle', attack: 0.001, bus: 'ui' });
  }

  /** 3. Gantry motor: low electrical hum with a soft gear whir, short. */
  function motor(dur = 0.9) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.005;
    const d = Math.max(0.25, dur);
    const drive = 0.048 * jitter(0.05);

    tone(t, { freq: 49 * jitter(0.004), dur: d, gain: drive, type: 'sawtooth', attack: 0.035, lp: 210, q: 0.8, bus: 'mech' });
    tone(t, { freq: 49 * 2.02, dur: d, gain: drive * 0.42, type: 'sawtooth', attack: 0.045, lp: 330, q: 0.9, bus: 'mech' });
    tone(t, { freq: 98.6, dur: d, gain: drive * 0.4, type: 'triangle', attack: 0.05, lp: 430, bus: 'mech' });
    tone(t, { freq: 197, dur: d, gain: drive * 0.22, type: 'sawtooth', attack: 0.06, lp: 620, q: 1.2, bus: 'mech' });

    // whir, amplitude-modulated by the gear tooth rate
    const source = noiseSource(t, d);
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 760 * jitter(0.03);
    band.Q.value = 2.6;
    const whir = c.createGain();
    whir.gain.setValueAtTime(0.0001, t);
    whir.gain.exponentialRampToValueAtTime(0.042, t + 0.06);
    whir.gain.setValueAtTime(0.042, t + d - 0.1);
    whir.gain.exponentialRampToValueAtTime(0.0001, t + d);
    source.connect(band).connect(whir);
    place(whir, 'mech', 0.06);

    const am = c.createOscillator();
    am.frequency.value = 33;
    const amDepth = c.createGain();
    amDepth.gain.value = 0.017;
    am.connect(amDepth).connect(whir.gain);
    am.start(t);
    am.stop(t + d);

    // bearing engaging and letting go
    burst(t, { dur: 0.02, gain: 0.065, freq: 1100, q: 1.6, attack: 0.0008, bus: 'mech' });
    thump(t, { freq: 90, gain: 0.07, dur: 0.13, bus: 'mech' });
    burst(t + d - 0.01, { dur: 0.016, gain: 0.035, freq: 900, q: 1.8, attack: 0.0008, bus: 'mech' });
  }

  /** 4. Drop: cable paying out, reel ratchet, servo descending, end stop. */
  function drop(dur = 1.0) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.12; // the button leads, the gantry follows
    const d = Math.max(0.5, dur);

    tone(t, { freq: 210 * jitter(0.01), glide: 118, dur: d * 0.92, gain: 0.047, type: 'sawtooth', attack: 0.07, lp: 620, q: 1.1, bus: 'mech' });
    tone(t, { freq: 104, glide: 62, dur: d * 0.92, gain: 0.03, type: 'triangle', attack: 0.09, lp: 320, bus: 'mech' });

    // the cable running over the pulley
    const source = noiseSource(t, d * 0.95);
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(2300, t);
    band.frequency.exponentialRampToValueAtTime(1350, t + d * 0.9);
    band.Q.value = 0.9;
    const slide = c.createGain();
    hold(slide, t, 0.075, d * 0.95, 0.08, 0.15);
    source.connect(band).connect(slide);
    place(slide, 'mech', 0.05);

    const flutter = c.createOscillator();
    flutter.frequency.value = 11.5;
    const flutterDepth = c.createGain();
    flutterDepth.gain.value = 0.018;
    flutter.connect(flutterDepth).connect(slide.gain);
    flutter.start(t);
    flutter.stop(t + d);

    // reel teeth: sparse, so it reads as a ratchet and not a buzz
    for (let i = 0; i < 6; i++) {
      const at = t + 0.09 + i * 0.108;
      burst(at, { dur: 0.01, gain: 0.034 * (1 - i * 0.06), freq: 2600 - i * 60, q: 4, attack: 0.0004, bus: 'mech', pan: i % 2 ? 0.08 : -0.08 });
    }

    // gantry reaching the bottom of its travel
    const end = t + d * 0.96;
    thump(end, { freq: 72, gain: 0.14, dur: 0.2, bus: 'mech' });
    metal(end, { base: 260, gain: 0.05, decay: 0.08, bus: 'mech' });
    burst(end, { dur: 0.03, gain: 0.05, freq: 1400, q: 1.2, attack: 0.001, bus: 'mech' });
  }

  /** 5. Claw close: grip servo, then two metal prongs biting. */
  function clawClose(won = false) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.005;

    burst(t, { dur: 0.3, gain: 0.035, freq: 950, q: 1.3, attack: 0.04, bus: 'mech' });
    tone(t, { freq: 255, glide: 188, dur: 0.32, gain: 0.03, type: 'sawtooth', attack: 0.05, lp: 720, q: 1, bus: 'mech' });

    const hit = t + 0.26;
    metal(hit, { base: 390, gain: 0.17, decay: 0.13, bus: 'mech', edge: 0.85 });
    burst(hit, { dur: 0.006, gain: 0.13, freq: 3400, q: 0.8, attack: 0.0003, bus: 'mech' });
    burst(hit + 0.002, { dur: 0.004, gain: 0.06, freq: 4300, q: 1.4, attack: 0.0002, bus: 'mech' });
    thump(hit, { freq: 105, gain: 0.105, dur: 0.17, bus: 'mech' });
    metal(hit + 0.055, { base: 300, gain: 0.075, decay: 0.1, bus: 'mech', pan: 0.16 });

    if (won) grabSuccess(hit + 0.13);
  }

  /** 6. Grab success: two soft bell notes, a confirmation and nothing more. */
  function grabSuccess(at?: number) {
    const c = ready();
    if (!c) return;
    const t = at ?? c.currentTime + 0.005;
    const notes = [880, 1318.5];
    notes.forEach((freq, index) => {
      const when = t + index * 0.085;
      bell(when, freq * jitter(0.004), 0.125, 0.34);
      tone(when, { freq: freq * 0.5, dur: 0.26, gain: 0.028, type: 'sine', attack: 0.006, lp: 900, bus: 'jingle' });
    });
    burst(t, { dur: 0.06, gain: 0.014, freq: 4200, q: 1.5, attack: 0.012, bus: 'jingle' });
  }

  /** 7. Release / fall: gripper opens, the prize slips, a dull landing in the chute. */
  function release(hasPrize = true) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.005;

    burst(t, { dur: 0.008, gain: 0.11, freq: 2200, q: 1, attack: 0.0003, bus: 'mech' });
    metal(t, { base: 520, gain: 0.085, decay: 0.07, bus: 'mech' });
    tone(t + 0.018, { freq: 1400, glide: 900, dur: 0.09, gain: 0.02, type: 'triangle', attack: 0.001, bus: 'mech' });

    if (!hasPrize) return;

    // the capsule sliding out of the prongs
    burst(t + 0.03, { dur: 0.16, gain: 0.04, freq: 1250, to: 780, q: 0.9, attack: 0.02, bus: 'mech' });
    // 0.52 m of free fall, then the chute: dull, no ring
    const land = t + 0.31;
    thump(land, { freq: 64, gain: 0.34, dur: 0.3, bus: 'mech' });
    burst(land, { dur: 0.11, gain: 0.075, freq: 430, q: 0.7, attack: 0.002, lp: 900, bus: 'mech' });
    [0.06, 0.11, 0.17].forEach((offset, index) => {
      burst(land + offset, { dur: 0.02, gain: 0.024, freq: 1750 + index * 260, q: 3, attack: 0.0006, bus: 'mech' });
    });
  }

  /** 9. The prize card sliding in: soft air, no hiss. */
  function cardOpen() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.005;

    const source = noiseSource(t, 0.38, 'pink');
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(340, t);
    band.frequency.exponentialRampToValueAtTime(1750, t + 0.15);
    band.frequency.exponentialRampToValueAtTime(560, t + 0.34);
    band.Q.value = 0.6;
    const air = c.createGain();
    air.gain.setValueAtTime(0.0001, t);
    air.gain.exponentialRampToValueAtTime(0.32, t + 0.16);
    air.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    const top = c.createBiquadFilter();
    top.type = 'lowpass';
    top.frequency.value = 3600;
    source.connect(band).connect(top).connect(air);
    place(air, 'ui', -0.08);

    const flutter = c.createOscillator();
    flutter.frequency.value = 14;
    const depth = c.createGain();
    depth.gain.value = 0.008;
    flutter.connect(depth).connect(air.gain);
    flutter.start(t);
    flutter.stop(t + 0.38);
  }

  /** 8. Deliver: drawer latch and slide, end stop, then the prize jingle. */
  function deliver(isNew = true, complete = false) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.02; // the prize lands, the drawer answers; the card air runs underneath

    burst(t, { dur: 0.012, gain: 0.1, freq: 1700, q: 1.2, attack: 0.0005, bus: 'mech' });
    metal(t, { base: 430, gain: 0.075, decay: 0.06, bus: 'mech' });
    burst(t + 0.02, { dur: 0.2, gain: 0.06, freq: 520, to: 880, q: 0.85, attack: 0.02, lp: 2600, bus: 'mech' });
    thump(t + 0.23, { freq: 106, gain: 0.14, dur: 0.2, bus: 'mech' });
    metal(t + 0.23, { base: 250, gain: 0.055, decay: 0.1, bus: 'mech' });

    if (complete) {
      fanfare(t + 0.42);
      return;
    }
    const notes = isNew ? [1046.5, 1318.5, 1568] : [1046.5, 1318.5];
    notes.forEach((freq, index) => {
      bell(t + 0.44 + index * 0.09, freq, 0.078, 0.3);
    });
  }

  /** 10. Six of six: a small fanfare, warm and short (also called by deliver). */
  function fanfare(at: number) {
    const notes = [783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((freq, index) => {
      const when = at + index * 0.105;
      const dur = 1.1 - index * 0.12;
      tone(when, { freq, dur, gain: 0.13, type: 'sawtooth', attack: 0.02, lp: 2300, q: 0.9, bus: 'jingle' });
      tone(when, { freq, dur: dur * 0.85, gain: 0.085, type: 'triangle', attack: 0.012, lp: 3400, bus: 'jingle' });
      bell(when, freq * 2, 0.03, 0.28);
    });
    // a warm fifth under the last note
    tone(at + 0.42, { freq: 1174.66, dur: 0.95, gain: 0.04, type: 'sine', attack: 0.03, lp: 2400, bus: 'jingle' });
    tone(at + 0.42, { freq: 783.99, dur: 0.95, gain: 0.042, type: 'sine', attack: 0.03, lp: 1600, bus: 'jingle' });
  }

  /** 11. Fail / timeout: neutral, a mechanism settling. Never punitive. */
  function fail() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.005;
    thump(t, { freq: 92, gain: 0.075, dur: 0.18, bus: 'mech' });
    tone(t + 0.03, { freq: 392, glide: 349.23, dur: 0.55, gain: 0.038, type: 'triangle', attack: 0.012, lp: 1600, bus: 'ui' });
    tone(t + 0.03, { freq: 196, dur: 0.42, gain: 0.014, type: 'sine', attack: 0.02, lp: 900, bus: 'ui' });
    burst(t + 0.12, { dur: 0.2, gain: 0.012, freq: 620, q: 0.7, attack: 0.06, bus: 'ui' });
  }

  return {
    unlock() {
      ensure();
    },
    stick,
    stickTick,
    button,
    motor,
    drop,
    clawClose,
    grabSuccess,
    release,
    cardOpen,
    deliver,
    collectionComplete() {
      const c = ready();
      if (!c) return;
      fanfare(c.currentTime + 0.005);
    },
    fail,
    toggle() {
      muted = !muted;
      const c = ensure();
      if (master) {
        const now = c.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.1);
      }
      return muted;
    },
    get muted() {
      return muted;
    },

    /* legacy aliases, kept so older call sites do not break */
    servo(dur = 0.8) {
      motor(dur);
    },
    clack() {
      clawClose(false);
    },
    clink() {
      release(false);
    },
    win() {
      grabSuccess();
    },
  };
}
