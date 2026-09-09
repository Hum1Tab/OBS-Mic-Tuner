// Independent mono numerical model of standard dynamics equations. See VALIDATION.md.
export const db = x => 20 * Math.log10(Math.max(Math.abs(x), 1e-9));
export const amp = x => 10 ** (x / 20);
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const round = x => Math.round(x * 10) / 10;
export function percentile(xs, p) {
  if (!xs.length) return -180;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))];
}
export function peakOf(pcm) { let peak = 0; for (const x of pcm) peak = Math.max(peak, Math.abs(x)); return db(peak); }
export function framesOf(pcm, rate = 48000) {
  const size = Math.round(rate * .02), frames = [];
  for (let start = 0; start + size <= pcm.length; start += size) {
    let sum = 0, peak = 0, clipped = 0;
    for (let i = start; i < start + size; i++) { const x = pcm[i]; sum += x*x; peak = Math.max(peak, Math.abs(x)); clipped += Math.abs(x) >= .999 ? 1 : 0; }
    frames.push({ start, rms: db(Math.sqrt(sum / size)), peak: db(peak), clipped });
  }
  return frames;
}
export function compressor(pcm, rate, settings) {
  const { threshold, ratio, attack, release, gain = 0 } = settings;
  const rise = Math.exp(-1000 / (rate * attack)), fall = Math.exp(-1000 / (rate * release));
  const out = new Float32Array(pcm.length), reduction = new Float32Array(pcm.length);
  let envelope = 0;
  const slope = 1 - 1 / ratio, makeup = amp(gain);
  for (let i = 0; i < pcm.length; i++) {
    const x = pcm[i], level = Math.abs(x);
    envelope += (level - envelope) * (1 - (level > envelope ? rise : fall));
    const gr = Math.max(0, (db(envelope) - threshold) * slope);
    reduction[i] = gr; out[i] = x * amp(-gr) * makeup;
  }
  return { pcm: out, reduction };
}
export function expander(pcm, rate, settings) {
  if (!settings.enabled) return { pcm: pcm.slice(), reduction: new Float32Array(pcm.length) };
  const rms = 2 ** (-100 / rate), rise = Math.exp(-1000 / (rate * settings.attack)), fall = Math.exp(-1000 / (rate * settings.release));
  const out = new Float32Array(pcm.length), reduction = new Float32Array(pcm.length);
  let energy = 0, gainDB = 0;
  for (let i = 0; i < pcm.length; i++) {
    const x = pcm[i]; energy += (x*x - energy) * (1 - rms);
    const target = -clamp((settings.threshold - db(Math.sqrt(Math.max(0, energy)))) * (settings.ratio - 1), 0, 60);
    gainDB += (target - gainDB) * (1 - (target > gainDB ? rise : fall));
    reduction[i] = -gainDB; out[i] = x * amp(gainDB);
  }
  return { pcm: out, reduction };
}
export function limiter(pcm, rate, settings = { threshold: -3, release: 60 }) {
  // OBS 32.2.2's attack parameter is 0.001 milliseconds, not 1 ms.
  return compressor(pcm, rate, { ...settings, attack: .001, ratio: Infinity, gain: 0 });
}
export function scale(pcm, gain) { const mul = amp(gain); return pcm.map(x => x * mul); }
export function selectedLevels(pcm, mask, rate = 48000) { return framesOf(pcm, rate).filter((f, i) => mask[i]).map(f => f.rms); }
export function selectedReduction(reduction, mask, rate = 48000) {
  const size = Math.round(rate * .02), result = [];
  for (let f = 0; f < mask.length; f++) if (mask[f]) {
    let sum = 0; for (let i = f * size; i < Math.min(reduction.length, (f+1) * size); i++) sum += reduction[i];
    result.push(sum / size);
  }
  return result;
}
export function wav(pcm, rate = 48000) {
  const buffer = new ArrayBuffer(44 + pcm.length * 2), view = new DataView(buffer);
  const write = (s, at) => [...s].forEach((c, i) => view.setUint8(at+i, c.charCodeAt(0)));
  write('RIFF', 0); view.setUint32(4, 36 + pcm.length*2, true); write('WAVEfmt ', 8);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate*2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write('data', 36); view.setUint32(40, pcm.length*2, true);
  pcm.forEach((x, i) => view.setInt16(44+i*2, Math.round(clamp(x, -1, 1) * (x < 0 ? 32768 : 32767)), true));
  return buffer;
}
