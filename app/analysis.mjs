import { clamp, round, percentile, peakOf, framesOf, compressor, expander, limiter, scale, selectedLevels, selectedReduction } from './dsp.mjs';
export { db, percentile } from './dsp.mjs';
export const PHASES = [
  { key: 'noise', title: '静かに待つ', seconds: 5, prompt: '話さずに静かに待ってください。キーボードや机に触れず、普段の環境音を測ります。' },
  { key: 'quiet', title: '小さな声で話す', seconds: 7, prompt: 'ささやき声ではなく、配信中の小さめの声で。「こんばんは。少し静かな声で話しています。言葉の最後まで、聞こえていますか。」' },
  { key: 'speech', title: '普段の声で話す', seconds: 12, prompt: '普段の声で、繰り返し話してください。「こんにちは。今日はこのマイクで配信します。皆さんに聞き取りやすい声で、お話ししていきます。」' },
  { key: 'loud', title: '大きめの声で話す', seconds: 5, prompt: '無理のない範囲で、配信中の大きめの声で。「やったー！ ありがとうございます！ 今日も楽しんでいきましょう！」' }
];
const fail = message => { throw new Error(message); };
const median = xs => percentile(xs, .5);
function activity(frames, vad, threshold) {
  const detected = frames.map((f, i) => f.start >= 12000 && Math.max(vad[i*2] || 0, vad[i*2+1] || 0) >= threshold);
  return detected.map((_, i) => i >= 13 && detected.slice(Math.max(0, i-8), i+4).some(Boolean));
}
export function validateCapture(raw, vads, rate = 48000) {
  if (rate !== 48000) fail('解析には48 kHzの音声が必要です。入力デバイスを選び直してください。');
  if (raw.length !== 4 || raw.some((p, i) => !(p instanceof Float32Array) || p.length !== PHASES[i].seconds * rate)) fail('測定データが不足しています。最初から測り直してください。');
  if (raw.some(p => p.some(x => !Number.isFinite(x)))) fail('音声データに異常があります。測り直してください。');
  if (vads.length !== 4 || vads.some((v, i) => v.length !== raw[i].length / 480 || v.some(x => !Number.isFinite(x) || x < 0 || x > 1))) fail('発話検出に失敗しました。測り直してください。');
  const frames = raw.map(p => framesOf(p, rate));
  if (frames.flat().some(f => f.clipped >= 3)) fail('入力に音割れの兆候があります。機器またはWindowsの入力音量を下げて、最初から測り直してください。');
  const noise = percentile(frames[0].slice(25).map(f => f.rms), .8);
  const masks = frames.map((f, i) => i ? activity(f, vads[i], i === 1 ? .35 : .55) : f.map((_, n) => n >= 25));
  if (vads[0].slice(50).filter(v => v > .65).length > 25) fail('無言の区間で声らしい音を検出しました。周囲の声・テレビ・音楽を止めて再測定してください。');
  if (percentile(frames[0].slice(25).map(f => f.rms), .95) - median(frames[0].slice(25).map(f => f.rms)) > 12) fail('環境音の測定中に大きな変化がありました。机やキーボードに触れずに再測定してください。');
  for (let i = 1; i < 4; i++) if (masks[i].filter(Boolean).length * .02 < (i === 2 ? 2.5 : 1)) fail(`「${PHASES[i].title}」の発話が不足しています。原稿を読み、最初から測り直してください。`);
  const voiceLevels = selectedLevels(raw[2], masks[2]);
  if (percentile(voiceLevels, .9) - percentile(voiceLevels, .1) < 1.2) fail('普段の声の区間に音量変化がほとんどありません。原稿を自然に読み上げて再測定してください。');
  const voice = median(voiceLevels);
  if (voice - noise < 10) fail('声と環境音の差が小さすぎます。マイクを近づけるか環境音を減らして再測定してください。');
  const quiet = median(selectedLevels(raw[1], masks[1])), loud = percentile(selectedLevels(raw[3], masks[3]), .8);
  const warnings = [];
  if (quiet > voice - 2) warnings.push('小声と普段の声が近い音量でした。小声の保護を重視するなら、小さめの声で再測定してください。');
  if (loud < voice + 3) warnings.push('大声と普段の声が近い音量でした。配信中の最大声量でも確認してください。');
  if (voice - noise < 18) warnings.push('環境音が多めです。ノイズ抑制の有無を聴き比べ、声が変わりすぎないか確認してください。');
  if (Math.max(...raw.map(peakOf)) > -1) warnings.push('入力ピークが0 dBFSに近いため、機器側の入力音量を少し下げることをおすすめします。');
  return { frames, masks, noise, voice, quiet, loud, warnings };
}
export function suggestSuppression(noise, voice) { return noise + (-20 - voice) > -48; }
export function tune(raw, vads, options = {}) {
  const mode = options.mode === 'steady' ? 'steady' : 'natural', quality = validateCapture(raw, vads), { masks } = quality;
  const denoise = options.denoise === true, input = denoise ? options.denoised : raw;
  if (!input || input.length !== 4 || input.some((p, i) => p.length !== raw[i].length || p.some(x => !Number.isFinite(x)))) fail('ノイズ抑制の処理データに異常があります。再解析してください。');
  const normal = median(selectedLevels(input[2], masks[2]));
  if (normal < -65) fail('加工後の声が小さすぎます。ノイズ抑制をオフにするか、入力音量を調整して再測定してください。');
  let best;
  const ratios = mode === 'steady' ? [2.5, 4, 6] : [1.5, 2, 3];
  for (const ratio of ratios) for (const offset of [3, 7]) for (const attack of [3, 6]) {
    const settings = { ratio, threshold: round(clamp(normal + offset, -60, 0)), attack, release: mode === 'steady' ? 140 : 100, gain: 0 };
    const processed = input.map(p => compressor(p, 48000, settings));
    const voice = median(selectedLevels(processed[2].pcm, masks[2])), loud = percentile(selectedLevels(processed[3].pcm, masks[3]), .8);
    const normalGR = percentile(selectedReduction(processed[2].reduction, masks[2]), .9), loudGR = percentile(selectedReduction(processed[3].reduction, masks[3]), .9);
    const maxPeak = Math.max(...processed.map(p => peakOf(p.pcm)));
    const gain = Math.floor(clamp(Math.min(-20 - voice, 3 - maxPeak), -24, 18) * 10) / 10;
    const score = Math.abs(voice + gain + 20) * 3 + Math.abs((loud - voice) - (mode === 'steady' ? 5 : 8)) + Math.max(0, normalGR - (mode === 'steady' ? 5 : 3)) * 2 + Math.max(0, loudGR - 10) * 3;
    if (!best || score < best.score) best = { score, settings: { ...settings, gain }, processed, normalGR, loudGR };
  }
  const compressed = best.processed.map(p => scale(p.pcm, best.settings.gain));
  const noiseAfter = percentile(selectedLevels(compressed[0], masks[0]), .8), quietFloor = percentile(selectedLevels(compressed[1], masks[1]), .1);
  const low = Math.max(-60, noiseAfter + 4), high = Math.min(0, quietFloor - 6);
  const exp = { enabled: low <= high && noiseAfter > -65, threshold: round(low <= high ? low : clamp(high, -60, 0)), ratio: 2, attack: 5, release: 120 };
  let expanded = compressed.map(p => expander(p, 48000, exp));
  let tailGR = percentile(selectedReduction(expanded[1].reduction, masks[1]), .9);
  if (tailGR > 2) { exp.enabled = false; expanded = compressed.map(p => expander(p, 48000, exp)); tailGR = 0; }
  const limited = expanded.map(p => limiter(p.pcm, 48000)), output = limited.map(p => p.pcm);
  const outVoice = median(selectedLevels(output[2], masks[2])), outNoise = percentile(selectedLevels(output[0], masks[0]), .8);
  const limiterGR = Math.max(...limited.map((p, i) => percentile(selectedReduction(p.reduction, masks[i]), .99)));
  const warnings = [...quality.warnings];
  if (!exp.enabled && noiseAfter > -65) warnings.push('小声を残せるしきい値を確保できないため、エキスパンダーを無効にしました。');
  if (Math.abs(outVoice + 20) > 3) warnings.push('ピークの余裕を優先したため、声量目標には届いていません。機器側の入力音量やマイク位置を調整してください。');
  if (limiterGR > 3) warnings.push('大きな声でリミッターが強く働きます。大声の試聴で不自然な音量変化がないか確認してください。');
  if (denoise) warnings.push('RNNoiseの試聴は同梱モデルでの結果です。OBSとのモデル差があるため、適用後にOBSでも録音して確認してください。');
  const suppressionSuggested = suggestSuppression(quality.noise, quality.voice);
  if (!denoise && suppressionSuggested) warnings.push('声量をそろえると環境音が気になりやすい条件です。「RNNoiseを試す」で声の変化を比較できます。');
  const rawMatch = outVoice - quality.voice;
  const maxPlayback = Math.max(...raw.map(p => peakOf(p) + rawMatch), ...output.map(peakOf));
  const common = Math.min(0, -3 - maxPlayback);
  const playbackRaw = raw.map(p => scale(p, rawMatch + common)), playbackOutput = output.map(p => scale(p, common));
  const filters = [
    { name: 'ノイズ抑制', enabled: denoise, note: denoise ? '方式はRNNoise。OBS適用後に声と語尾を再確認してください。' : '無効。必要なら試聴画面でRNNoiseを選び、後段も再計算します。', values: { '方式': 'RNNoise' } },
    { name: 'コンプレッサー', enabled: true, note: '複数候補を実波形に適用し、声量差と圧縮量から選択。', values: { '比率': `${best.settings.ratio}:1`, 'しきい値': `${best.settings.threshold} dB`, 'アタック': `${best.settings.attack} ms`, 'リリース': `${best.settings.release} ms`, '出力ゲイン': `${best.settings.gain} dB`, 'サイドチェイン': 'なし' } },
    { name: 'エキスパンダー', enabled: exp.enabled, note: exp.enabled ? '前段処理後の環境音と小声から設定。試聴で語尾を確認。' : '小声を保護するため、追加しないか無効にしてください。', values: { 'プリセット': 'エキスパンダー', '比率': `${exp.ratio}:1`, 'しきい値': `${exp.threshold} dB`, 'アタック': `${exp.attack} ms`, 'リリース': `${exp.release} ms`, '出力ゲイン': '0 dB', '検出': 'RMS' } },
    { name: 'リミッター', enabled: true, note: '最後に配置。測定に含まれない大きな音もOBSで確認してください。', values: { 'しきい値': '-3 dB', 'リリース': '60 ms' } }
  ];
  return { version: '1.0.1', reference: 'OBS Studio 32.2.2 / mono / 48 kHz', mode, denoise, noise: round(quality.noise), voice: round(quality.voice), peak: round(Math.max(...raw.map(peakOf))), outputVoice: round(outVoice), outputNoise: round(outNoise), outputPeak: round(Math.max(...output.map(peakOf))), limiterGR: round(limiterGR), tailGR: round(tailGR), suppressionSuggested, warnings, filters, settings: { compressor: best.settings, expander: exp }, playbackRaw, playbackOutput, matching: { raw: round(rawMatch + common), processed: round(common), method: '発話区間RMS一致（LUFS一致ではありません）' } };
}
export function report(r, device = '') {
  return `OBS Mic Tuner ${r.version}\n${new Date().toLocaleString('ja-JP')}\n入力: ${device}\n仕上がり: ${r.mode === 'steady' ? '声量を安定' : '自然な声'}\n計算モデル: ${r.reference}\n\n入力 環境音 ${r.noise} / 声 ${r.voice} / ピーク ${r.peak} dBFS\n加工後（モデル） 環境音 ${r.outputNoise} / 声 ${r.outputVoice} / ピーク ${r.outputPeak} dBFS\n\nOBSのフィルタに上から順番に設定。既存フィルタとの重複を避けてください。\n\n` + r.filters.map((f, i) => `${i+1}. ${f.name} [${f.enabled ? '有効' : '無効・追加不要'}]\n${Object.entries(f.values).map(([k,v]) => `${k}: ${v}`).join('\n')}\n${f.note}`).join('\n\n') + '\n\n' + r.warnings.join('\n') + '\n\n試聴用の音量補正はOBS設定には含みません。音質や語尾はOBSでテスト録音して確認してください。OBS Project非公式の独立ツールです。';
}



