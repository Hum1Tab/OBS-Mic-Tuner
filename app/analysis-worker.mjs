import { prepareNoise } from './denoise.mjs';
import { tune } from './analysis.mjs';
let raw, noise;
self.onmessage = async ({ data }) => {
  const { id, options } = data;
  try {
    if (data.raw) { raw = data.raw; noise = await prepareNoise(raw); }
    if (!raw || !noise) throw new Error('録音データがありません。再測定してください。');
    const result = tune(raw, noise.vads, { ...options, denoised: noise.denoised });
    self.postMessage({ id, result }, [...result.playbackRaw, ...result.playbackOutput].map(p => p.buffer));
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
