import test from 'node:test';
import assert from 'node:assert/strict';
// The embedded WASM uses browser feature detection. This test supplies only that
// environment marker; processing still executes the actual bundled WASM.
globalThis.WorkerGlobalScope = class {};
const { prepareNoise } = await import('../app/denoise.mjs');
const { PHASES, validateCapture } = await import('../app/analysis.mjs');
test('actual RNNoise returns finite, aligned output and rejects digital silence', async () => {
  const silent = new Float32Array(48000*2);
  const tone = Float32Array.from({ length:48000*3 }, (_,i) => .05*Math.sin(2*Math.PI*180*i/48000));
  const { denoised, vads } = await prepareNoise([silent,tone]);
  assert.equal(denoised[0].length,silent.length); assert.equal(denoised[1].length,tone.length);
  assert.ok(denoised.every(p=>p.every(Number.isFinite)));
  assert.ok(vads[0].every(v=>v < .1));
});
test('capture validation rejects a steady tone even when RNNoise VAD accepts it', async () => {
  const raw = PHASES.map((p,phase) => Float32Array.from({ length:p.seconds*48000 }, (_,i) => [0,.018,.05,.15][phase]*Math.sin(2*Math.PI*180*i/48000)));
  const { vads } = await prepareNoise(raw);
  assert.throws(()=>validateCapture(raw,vads), /音量変化|発話が不足/);
});
test('RNNoise state is discarded between independent recordings', async () => {
  const samples = Float32Array.from({ length:48000 }, (_,i)=>.1*Math.sin(i*.1));
  const { denoised } = await prepareNoise([samples,samples]);
  assert.deepEqual(denoised[0],denoised[1]);
});
