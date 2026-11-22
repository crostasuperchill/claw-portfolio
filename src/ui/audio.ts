export function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return { ctx, master: master! };
  }

  function noise(dur: number, freq: number, gain: number) {
    const { ctx: c, master: m } = ensure();
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(m);
    src.start();
  }

  function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
    const { ctx: c, master: m } = ensure();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(m);
    o.start();
    o.stop(c.currentTime + dur);
  }

  return {
    unlock() {
      ensure();
    },
    servo(dur = 0.8) {
      tone(90, dur, 'sawtooth', 0.05, 140);
    },
    clack() {
      noise(0.05, 2200, 0.25);
    },
    clink() {
      noise(0.09, 3400, 0.2);
      tone(1200, 0.08, 'triangle', 0.05, 900);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'sine', 0.09), i * 90));
    },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
