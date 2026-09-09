import test from 'node:test';
import assert from 'node:assert/strict';
import { tune, validateCapture, suggestSuppression, report } from '../app/analysis.mjs';
import { peakOf, framesOf, percentile } from '../app/dsp.mjs';
import { fixture } from './fixtures.mjs';
test('input gain does not change suppression decision', () => {
  for (let shift = -20; shift <= 20; shift++) assert.equal(suggestSuppression(-65 + shift, -35 + shift), false);
  assert.equal(suggestSuppression(-50, -35), true);
});
test('full waveform tuning: output headroom, soft voice protection, matched A/B and valid report', () => {
  const { raw, vads } = fixture(), r = tune(raw, vads);
  assert.equal(r.filters.length, 4); assert.equal(r.filters[0].enabled, false);
  assert.ok(r.outputPeak <= -2.99); assert.ok(r.tailGR <= 2);
  assert.ok(Math.abs(r.outputVoice + 20) < 1);
  const median = pcm => percentile(framesOf(pcm).slice(25).map(f => f.rms), .5);
  assert.ok(Math.abs(median(r.playbackRaw[2]) - median(r.playbackOutput[2])) < .1);
  assert.ok([...r.playbackRaw, ...r.playbackOutput].every(p => peakOf(p) <= -2.99));
  assert.match(report(r, 'test microphone'), /試聴用の音量補正はOBS設定には含みません/);
});
test('scaled input gives comparable final signal and same suppression recommendation', () => {
  const a = fixture(), b = fixture(2);
  const r1 = tune(a.raw, a.vads), r2 = tune(b.raw, b.vads);
  assert.equal(r1.suppressionSuggested, r2.suppressionSuggested);
  assert.ok(Math.abs(r1.outputVoice - r2.outputVoice) < .2);
  assert.ok(Math.abs(r1.outputNoise - r2.outputNoise) < .3);
});
test('reject missing phases, NaN, invalid VAD, non-speech, clipping and contaminated noise', () => {
  const { raw, vads } = fixture();
  assert.throws(() => validateCapture(raw.slice(1), vads), /不足/);
  const invalid = raw.map(p => p.slice()); invalid[2][0] = NaN;
  assert.throws(() => validateCapture(invalid, vads), /異常/);
  assert.throws(() => validateCapture(raw, []), /発話検出/);
  assert.throws(() => validateCapture(raw, vads.map(v => v.map(() => 0))), /発話が不足/);
  const clipped = raw.map(p => p.slice()); clipped[3].fill(1, 100, 150);
  assert.throws(() => validateCapture(clipped, vads), /音割れ/);
  assert.throws(() => validateCapture(raw, vads.map((v,i) => i ? v : v.map(() => .99))), /無言/);
});
test('disable expander when noise and soft speech cannot be separated', () => {
  const { raw, vads } = fixture(1, .012);
  const r = tune(raw, vads);
  assert.equal(r.settings.expander.enabled, false);
  assert.ok(r.warnings.some(w => w.includes('エキスパンダーを無効')));
});
test('denoising re-evaluates downstream settings using processed PCM', () => {
  const { raw, vads } = fixture(1, .002);
  const denoised = raw.map((p,i) => p.map(x => x * (i === 0 ? .05 : .8)));
  const r = tune(raw, vads, { denoise: true, denoised });
  assert.equal(r.filters[0].enabled, true);
  assert.ok(r.outputNoise < -55);
  assert.ok(r.warnings.some(w => w.includes('モデル差')));
});
