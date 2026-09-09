import test from 'node:test';
import assert from 'node:assert/strict';
import { compressor, expander, limiter, amp, db, peakOf, wav } from '../app/dsp.mjs';
const settings = { threshold: -21, ratio: 2.5, attack: 6, release: 100, gain: 8 };
test('audit transient counterexample is modeled rather than mistaken for static compression', () => {
  const pcm = new Float32Array(48000); pcm[12000] = amp(-3);
  const r = compressor(pcm, 48000, settings);
  assert.ok(Math.abs(db(r.pcm[12000]) - 5) < .001);
  assert.ok(peakOf(limiter(r.pcm, 48000).pcm) <= -2.999);
});
test('sustained constant amplitude reaches analytic ratio and gain', () => {
  const r = compressor(new Float32Array(48000).fill(amp(-9)), 48000, settings);
  assert.ok(Math.abs(db(r.pcm.at(-1)) - (-21 + 12/2.5 + 8)) < .001);
});
test('release preserves gain reduction after a loud section', () => {
  const pcm = new Float32Array(48000).fill(amp(-3)); pcm.fill(amp(-35), 24000);
  const r = compressor(pcm, 48000, { ...settings, gain: 0 });
  assert.ok(r.reduction[24001] > 5); assert.ok(r.reduction.at(-1) < .01);
});
test('expander reaches analytic downward expansion and bypass is exact', () => {
  const pcm = new Float32Array(96000).fill(amp(-50));
  const s = { enabled: true, threshold: -40, ratio: 2, attack: 5, release: 120 };
  assert.ok(Math.abs(db(expander(pcm, 48000, s).pcm.at(-1)) + 60) < .01);
  assert.deepEqual(expander(pcm, 48000, { ...s, enabled: false }).pcm, pcm);
});
test('silence stays finite and silent throughout dynamics', () => {
  const pcm = new Float32Array(48000);
  for (const p of [compressor(pcm, 48000, settings).pcm, limiter(pcm, 48000).pcm, expander(pcm, 48000, { enabled: true, threshold: -40, ratio: 2, attack: 5, release: 120 }).pcm]) assert.ok(p.every(x => x === 0));
});
test('limiter bounds first-sample impulses at multiple sample rates', () => {
  for (const rate of [44100,48000,96000]) {
    const pcm = new Float32Array(rate).fill(.001); pcm[0] = 3; pcm[1234] = -5;
    assert.ok(peakOf(limiter(pcm, rate).pcm) < -2.99);
  }
});
test('PCM WAV has valid lengths, rate and integer full-scale encoding', () => {
  const b = wav(new Float32Array([-1, 0, 1])), v = new DataView(b);
  assert.equal(v.getUint32(24, true), 48000); assert.equal(v.getUint32(40, true), 6);
  assert.equal(b.byteLength, 50); assert.equal(v.getInt16(44,true), -32768); assert.equal(v.getInt16(48,true), 32767);
});
