/**
 * Renders every claw-machine cue with an OfflineAudioContext in Chromium,
 * writes one 24-bit WAV per cue to artifacts/sfx/ and prints duration, peak
 * and RMS. Also concatenates a suite (cues in time order, gaps between them)
 * for listen.py.
 *
 *   node scripts/audio-check.mjs
 */
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.resolve('artifacts/sfx');
const SR = 48000;

const CUES = [
  { name: '01-stick-tick', seconds: 0.25, call: 'a.stickTick(1, 2)' },
  { name: '02-button-press', seconds: 0.4, call: 'a.button()' },
  { name: '03-motor-gantry', seconds: 1.15, call: 'a.motor(0.9)' },
  { name: '04-drop', seconds: 1.3, call: 'a.drop(1.0)' },
  { name: '05-claw-close', seconds: 0.7, call: 'a.clawClose(false)' },
  { name: '06-grab-success', seconds: 0.55, call: 'a.grabSuccess()' },
  { name: '07-release-fall', seconds: 0.7, call: 'a.release(true)' },
  { name: '08-deliver', seconds: 1.2, call: 'a.deliver(true, false)' },
  { name: '09-card-open', seconds: 0.45, call: 'a.cardOpen()' },
  { name: '10-collection-complete', seconds: 1.4, call: 'a.collectionComplete()' },
  { name: '11-fail-timeout', seconds: 0.8, call: 'a.fail()' },
];

const source = await readFile('src/ui/audio.ts', 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const js = outputText.replace(/\bexport\s+(?=function|class|const|let|var)/g, '');

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: false,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto('about:blank');
await page.evaluate((code) => {
  window.__createAudio = new Function(`${code}\nreturn createAudio;`)();
}, js);

const results = [];
for (const cue of CUES) {
  const out = await page.evaluate(
    async ({ seconds, call }) => {
      const rate = 48000;
      const warm = 0.5; // let the compressor settle, as a live context does
      const ctx = new OfflineAudioContext(2, Math.ceil(rate * (seconds + warm)), rate);
      const a = window.__createAudio({ context: ctx });
      // Chrome's DynamicsCompressor starts at full reduction in an offline
      // graph and only releases once it hears signal. A short quiet motor
      // primes it, exactly as the live context is primed by the first cue;
      // the prime is trimmed off before measuring.
      a.motor(0.4);
      const suspended = ctx.suspend(warm);
      const rendering = ctx.startRendering();
      await suspended;
      // eslint-disable-next-line no-new-func
      new Function('a', call)(a);
      ctx.resume();
      const full = await rendering;

      const skip = Math.round(warm * rate);
      const length = full.length - skip;
      const channels = Array.from({ length: full.numberOfChannels }, (_, i) => full.getChannelData(i));
      let peak = 0;
      let peakAt = 0;
      let sum = 0;
      let count = 0;
      let last = 0;
      for (const data of channels) {
        for (let i = skip; i < full.length; i++) {
          const v = data[i];
          const mag = Math.abs(v);
          if (mag > peak) {
            peak = mag;
            peakAt = (i - skip) / rate;
          }
          sum += v * v;
          count++;
          if (mag > 0.001 && i > last) last = i;
        }
      }
      const rms = Math.sqrt(sum / Math.max(1, count));
      const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

      // 24-bit PCM WAV
      const bytesPerSample = 3;
      const dataBytes = length * channels.length * bytesPerSample;
      const view = new DataView(new ArrayBuffer(44 + dataBytes));
      const ascii = (offset, text) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
      };
      ascii(0, 'RIFF');
      view.setUint32(4, 36 + dataBytes, true);
      ascii(8, 'WAVE');
      ascii(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, channels.length, true);
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * channels.length * bytesPerSample, true);
      view.setUint16(32, channels.length * bytesPerSample, true);
      view.setUint16(34, 24, true);
      ascii(36, 'data');
      view.setUint32(40, dataBytes, true);
      let offset = 44;
      for (let i = skip; i < full.length; i++) {
        for (const data of channels) {
          const v = Math.max(-1, Math.min(1, data[i]));
          const int = Math.round(v < 0 ? v * 0x800000 : v * 0x7fffff);
          view.setUint8(offset++, int & 255);
          view.setUint8(offset++, (int >> 8) & 255);
          view.setUint8(offset++, (int >> 16) & 255);
        }
      }
      const bytes = new Uint8Array(view.buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return {
        wav: btoa(binary),
        peak: db(peak),
        rms: db(rms),
        peakAt,
        audible: (last - skip) / rate,
        duration: length / rate,
      };
    },
    { seconds: cue.seconds, call: cue.call }
  );

  const file = path.join(OUT, `${cue.name}.wav`);
  await writeFile(file, Buffer.from(out.wav, 'base64'));
  results.push({ ...cue, ...out, file });
  console.log(
    `${cue.name.padEnd(24)} dur ${out.duration.toFixed(2)}s  audible ${out.audible.toFixed(2)}s  peak ${out.peak.toFixed(1)} dBFS @ ${out.peakAt.toFixed(3)}s  rms ${out.rms.toFixed(1)} dBFS`
  );
}

/* ---------------------------------------------------------------- suite ---- */

function readWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = buffer.subarray(offset + 8, offset + 8 + size);
    if (id === 'fmt ') {
      fmt = {
        format: body.readUInt16LE(0),
        channels: body.readUInt16LE(2),
        sampleRate: body.readUInt32LE(4),
        bits: body.readUInt16LE(14),
      };
    } else if (id === 'data') {
      data = body;
    }
    offset += 8 + size + (size & 1);
  }
  return { ...fmt, pcm: data };
}

function wavFromPcm(pcm, { channels, sampleRate, bits }) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bits) / 8, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const gapSeconds = 0.55;
const pieces = [];
const suiteStarts = [];
let cursor = 0;
for (const result of results) {
  const wav = readWav(await readFile(result.file));
  const silence = Buffer.alloc(Math.round(gapSeconds * SR) * wav.channels * (wav.bits / 8));
  if (cursor > 0) {
    pieces.push(silence);
    cursor += gapSeconds;
  }
  suiteStarts.push({ name: result.name, at: cursor });
  pieces.push(wav.pcm);
  cursor += wav.pcm.length / (wav.channels * (wav.bits / 8)) / SR;
}
const suitePcm = Buffer.concat(pieces);
const suiteFile = path.join(OUT, '_suite.wav');
await writeFile(suiteFile, wavFromPcm(suitePcm, { channels: 2, sampleRate: SR, bits: 24 }));

let suitePeak = 0;
let suiteSum = 0;
let suiteCount = 0;
for (let i = 0; i < suitePcm.length; i += 3) {
  const int = suitePcm[i] | (suitePcm[i + 1] << 8) | (suitePcm[i + 2] << 16);
  const v = (int & 0x800000 ? int - 0x1000000 : int) / 0x800000;
  suitePeak = Math.max(suitePeak, Math.abs(v));
  suiteSum += v * v;
  suiteCount++;
}
const suiteDb = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
console.log(
  `\nsuite ${cursor.toFixed(2)}s  peak ${suiteDb(suitePeak).toFixed(1)} dBFS  rms ${suiteDb(Math.sqrt(suiteSum / suiteCount)).toFixed(1)} dBFS`
);
console.log('cue starts (s): ' + suiteStarts.map((s) => `${s.name}@${s.at.toFixed(2)}`).join(', '));

const over = results.filter((r) => r.peak > -1);
if (over.length) {
  console.error(`\nPEAK OVER -1 dBFS: ${over.map((r) => `${r.name} ${r.peak.toFixed(1)}`).join(', ')}`);
  await browser.close();
  process.exit(1);
}
if (logs.length) console.log('\npage log:\n' + logs.slice(0, 12).join('\n'));
await browser.close();
console.log('\nall cues under -1 dBFS');
