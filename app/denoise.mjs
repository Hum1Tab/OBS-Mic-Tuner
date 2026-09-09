import { Rnnoise } from './vendor/rnnoise.js';
let engine;
export async function prepareNoise(raw) {
  engine ||= await Rnnoise.load();
  const denoised = [], vads = [];
  for (const pcm of raw) {
    const state = engine.createDenoiseState(), size = engine.frameSize;
    const vad = [], out = new Float32Array(pcm.length + size), frame = new Float32Array(size);
    try {
      for (let start = 0; start < out.length; start += size) {
        frame.fill(0);
        for (let j = 0; j < size && start+j < pcm.length; j++) frame[j] = pcm[start+j] * 32768;
        const probability = state.processFrame(frame);
        if (start < pcm.length) vad.push(probability);
        for (let j = 0; j < size && start+j < out.length; j++) out[start+j] = frame[j] / 32768;
      }
    } finally { state.destroy(); }
    denoised.push(out.slice(size)); vads.push(vad);
  }
  return { denoised, vads };
}
