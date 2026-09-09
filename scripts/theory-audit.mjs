// Current regression diagnostics; v0.1 findings are preserved in THEORY-REVIEW.md.
import { suggestSuppression } from '../app/analysis.mjs';
import { compressor, limiter, amp, peakOf } from '../app/dsp.mjs';
const input=new Float32Array(48000); input[12000]=amp(-3);
const processed=compressor(input,48000,{threshold:-21,ratio:2.5,attack:6,release:100,gain:8}).pcm;
console.log(JSON.stringify({suppressionSameAfterGainChange:suggestSuppression(-65,-35)===suggestSuppression(-50,-20),transientBeforeLimiter:peakOf(processed),transientAfterLimiter:peakOf(limiter(processed,48000).pcm)},null,2));
