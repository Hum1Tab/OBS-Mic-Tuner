import { PHASES } from '../app/analysis.mjs';
export function fixture(multiplier = 1, noiseLevel = .0003) {
  let seed = 9031;
  const amplitudes = [0, .015, .045, .16];
  const raw = PHASES.map((p, phase) => Float32Array.from({ length: p.seconds*48000 }, (_, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const t = i / 48000, noise = (seed / 4294967296 * 2 - 1) * noiseLevel;
    return multiplier * (noise + amplitudes[phase] * (.6 + .4 * Math.sin(t*7)**2) * (Math.sin(t*2*Math.PI*173) + .2*Math.sin(t*2*Math.PI*519)));
  }));
  const vads = raw.map((p, i) => Array(p.length/480).fill(i ? .98 : 0));
  return { raw, vads };
}
