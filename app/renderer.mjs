import { PHASES, report } from './analysis.mjs';
import { peakOf, wav } from './dsp.mjs';
import { refreshUI, showPage, setLive, clearLive, clearVisuals, setPreview, updatePreviewSide } from './workspace-ui.mjs';
const $ = id => document.getElementById(id);
let raw = [], stage = 0, state = 'idle', stream, context, worklet, worker, result;
let token = 0, analysisId = 0, timer, watchdog, audioUrls = [], side = 'before', recordingDevice = '', selectedId = '', trackInfo = '';
const errors = e => ({ NotAllowedError: 'マイクが許可されていません。Windowsのプライバシー設定でマイクへのアクセスを許可してください。', NotFoundError: 'マイクが見つかりません。接続を確認してください。', NotReadableError: 'マイクを開けません。他のアプリの占有や接続を確認してください。', OverconstrainedError: '選択したマイクでは必要な入力設定を使用できません。別のデバイスを選んでください。' })[e.name] || e.message;
function el(tag, text, cls) { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; }
for (const [i,p] of PHASES.entries()) { const li = el('li', ''); li.id = `step${i}`; li.append(el('b', p.title), el('span', `${p.seconds}秒`)); $('steps').append(li); }
function controls() {
  const busy = ['preparing', 'recording', 'analyzing', 'closing'].includes(state);
  $('start').disabled = busy; $('start').hidden = stage === 4;
  $('device').disabled = busy || stage > 0; $('refresh').disabled = busy || stage > 0;
  $('cancel').hidden = !busy; $('reset').hidden = busy || (!stage && !result);
  for (const id of ['mode', 'denoise', 'sample', 'before', 'after', 'delete']) $(id).disabled = busy || !result || !audioUrls.length;
  for (const id of ['copy', 'save']) $(id).disabled = busy || !result;
  for (let i = 0; i < 4; i++) { $(`step${i}`).classList.toggle('active', i === stage); $(`step${i}`).classList.toggle('complete', i < stage); }
  refreshUI({ state, stage, phase: PHASES[stage], hasResult: !!result, hasAudio: !!audioUrls.length });
}
async function devices() {
  const current = $('device').value;
  const available = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
  $('device').replaceChildren(new Option('既定のマイク', ''));
  for (const [i,d] of available.entries()) if (d.deviceId !== 'default') $('device').add(new Option(d.label || `マイク ${i+1}`, d.deviceId));
  if ([...$('device').options].some(o => o.value === current)) $('device').value = current;
}
function clearAudio() {
  clearVisuals();
  $('audio').pause(); $('audio').removeAttribute('src'); $('audio').load();
  audioUrls.flat().forEach(url => URL.revokeObjectURL(url)); audioUrls = []; $('playback').hidden = true;
  if (result) { result.playbackRaw = []; result.playbackOutput = []; }
}
function clearWorker() { worker?.terminate(); worker = null; clearTimeout(timer); analysisId++; }
async function release() {
  clearInterval(watchdog); clearTimeout(timer);
  stream?.getTracks().forEach(t => { t.onended = null; t.stop(); }); stream = null;
  if (worklet) { worklet.port.onmessage = null; worklet.port.postMessage({ type: 'stop' }); worklet.disconnect(); worklet = null; }
  const closing = context; context = null; if (closing && closing.state !== 'closed') await closing.close();
  $('privacy').textContent = ''; $('level').textContent = '— dBFS'; $('meter').value = -60;
}
async function reset(message = '') {
  token++; state = 'closing'; controls(); clearWorker(); clearAudio(); raw = []; result = null;
  await release(); stage = 0; state = 'idle'; selectedId = ''; recordingDevice = ''; trackInfo = '';
  $('result').hidden = true; $('empty').hidden = false; $('result-tag').textContent = '測定待ち'; $('cue').textContent = message;
  $('start').textContent = '録音をはじめる'; $('progress').value = 0; controls();
  showPage('measure');
}
async function capture() {
  if (state !== 'idle' || stage >= 4) return;
  const attempt = ++token; state = 'preparing'; controls(); const phase = PHASES[stage];
  clearLive();
  $('cue').textContent = 'マイクを準備しています…';
  let pendingStream;
  try {
    pendingStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: (selectedId || $('device').value) ? { exact: selectedId || $('device').value } : undefined, channelCount: { ideal: 1 }, echoCancellation: { exact: false }, noiseSuppression: { exact: false }, autoGainControl: { exact: false } }, video: false });
    if (attempt !== token) { pendingStream.getTracks().forEach(t => t.stop()); return; }
    stream = pendingStream;
    const track = stream.getAudioTracks()[0], settings = track.getSettings();
    if (['echoCancellation', 'noiseSuppression', 'autoGainControl'].some(k => settings[k] === true)) throw new Error('入力に自動加工が有効なため測定を中止しました。機器設定を確認してください。');
    selectedId = settings.deviceId || selectedId; recordingDevice ||= track.label || '既定のマイク';
    const info = JSON.stringify({ deviceId: settings.deviceId, sampleRate: settings.sampleRate, channelCount: settings.channelCount });
    if (trackInfo && info !== trackInfo) throw new Error('測定途中で入力条件が変わりました。最初から測定してください。');
    trackInfo = info;
    track.onended = () => reset('マイクが切断されました。接続して最初から測定してください。');
    await devices(); if (attempt !== token) return;
    context = new AudioContext({ sampleRate: 48000 });
    if (context.sampleRate !== 48000) throw new Error('48 kHzの解析に対応していない入力です。別のデバイスを選んでください。');
    await context.audioWorklet.addModule('meter-worklet.js'); if (attempt !== token) return;
    const source = context.createMediaStreamSource(stream);
    worklet = new AudioWorkletNode(context, 'meter', { channelCount: 1, channelCountMode: 'explicit' });
    const mute = context.createGain(); mute.gain.value = 0; source.connect(worklet).connect(mute).connect(context.destination);
    await context.resume(); if (attempt !== token) return;

    const unknown = ['echoCancellation', 'noiseSuppression', 'autoGainControl'].some(k => settings[k] === undefined);

    let chunks = [], count = 0, last = performance.now();
    worklet.port.onmessage = async ({ data }) => {
      if (attempt !== token || state !== 'recording') return;
      last = performance.now(); chunks.push(data.pcm); count += data.pcm.length;
      const peak = peakOf(data.pcm); $('level').textContent = `${peak.toFixed(1)} dBFS`; $('meter').value = Math.max(-60, peak);
      $('progress').value = count / 48000;
      setLive(data.pcm, phase.seconds - count / 48000);
      if (data.done) {
        state = 'closing'; controls();
        const pcm = new Float32Array(count); let at = 0; for (const part of chunks) { pcm.set(part, at); at += part.length; } chunks = [];
        raw.push(pcm); await release(); if (attempt !== token) return;
        stage++; state = 'idle'; controls();
        if (stage === 4) await analyze(true);
        else { $('cue').textContent = '次の区間を録音してください。'; $('start').textContent = '次の区間を録音'; }
      }
    };
    $('privacy').textContent = 'マイク接続中';
    for (let remaining = 3; remaining > 0; remaining--) {
      $('cue').textContent = `${remaining}秒後に録音を開始します。`;
      $('remaining').textContent = `${remaining}`;
      await new Promise(resolve => setTimeout(resolve, 1000)); if (attempt !== token) return;
    }
    state = 'recording'; controls(); $('privacy').textContent = '録音中'; $('cue').textContent = `${phase.title}区間を録音しています。`;
    $('progress').max = phase.seconds; $('progress').value = 0;
    last = performance.now(); worklet.port.postMessage({ type: 'start', seconds: phase.seconds });
    watchdog = setInterval(() => { if (performance.now() - last > 5000) reset('マイクからの入力が止まりました。接続を確認して再測定してください。'); }, 1000);
  } catch (error) { if (attempt === token) await reset(errors(error)); else pendingStream?.getTracks().forEach(t => t.stop()); }
}
function ensureWorker() {
  if (worker) return;
  worker = new Worker('analysis-worker.mjs', { type: 'module' });
  worker.onerror = () => analysisFailed('解析を実行できませんでした。アプリを再起動して再測定してください。');
}
function analysisFailed(message) {
  clearTimeout(timer); state = 'idle'; $('result-tag').textContent = '再測定が必要'; $('cue').textContent = message;
  if (result) {
    $('mode').value = result.mode; $('denoise').value = result.denoise ? 'on' : 'off';
    $('result-tag').textContent = '前の設定を保持'; $('cue').textContent += ' 変更を適用せず、前の設定と試聴を保持しました。'; controls(); return;
  }
  result = null; clearAudio(); $('result').hidden = true; $('empty').hidden = false; controls();
}
async function analyze(first = false) {
  state = 'analyzing'; controls(); $('audio').pause(); $('cue').textContent = '解析中…'; $('result-tag').textContent = '解析中';
  ensureWorker(); const id = ++analysisId;
  worker.onmessage = ({ data }) => {
    if (data.id !== id || id !== analysisId) return; clearTimeout(timer);
    if (data.error) { analysisFailed(data.error); return; }
    clearAudio(); result = data.result; state = 'idle'; render(); controls();
    $('cue').textContent = '';
  };
  timer = setTimeout(() => { clearWorker(); analysisFailed('解析が時間内に完了しませんでした。最初から測り直してください。'); }, 120000);
  const payload = { id, options: { mode: $('mode').value, denoise: $('denoise').value === 'on' } };
  if (first) { payload.raw = raw; worker.postMessage(payload, raw.map(p => p.buffer)); raw = []; }
  else worker.postMessage(payload);
}
function selectAudio(resume = false, position = 0) {
  if (!audioUrls.length) return;
  const audio = $('audio'), url = audioUrls[Number($('sample').value)][side === 'before' ? 0 : 1];
  audio.pause(); audio.src = url;
  audio.onloadedmetadata = () => { audio.currentTime = Math.min(position, Math.max(0, audio.duration - .05)); if (resume) audio.play().catch(() => {}); };
  $('before').setAttribute('aria-pressed', String(side === 'before')); $('after').setAttribute('aria-pressed', String(side === 'after'));
  updatePreviewSide(side);
}
function render() {
  $('empty').hidden = true; $('result').hidden = false; $('result-tag').textContent = ''; $('stats').replaceChildren();
  for (const [label, value] of [['加工後の声 / dBFS', result.outputVoice], ['加工後の環境音 / dBFS', result.outputNoise], ['加工後ピーク / dBFS', result.outputPeak]]) { const cell = el('div', label, 'stat'); cell.append(el('b', value)); $('stats').append(cell); }
  $('warnings').replaceChildren(...result.warnings.map(w => el('div', w, 'warning'))); $('filters').replaceChildren();
  result.filters.forEach((f, i) => {
    const card = el('article', '', 'filter'), title = el('h3', `${String(i+1).padStart(2,'0')}  ${f.name}`); title.append(el('small', f.enabled ? '有効' : '無効・追加不要')); card.append(title);
    card.classList.toggle('inactive', !f.enabled);
    const values = el('div', '', 'values'); for (const [k,v] of Object.entries(f.values)) { const row = el('div', '', 'value'); row.append(el('span', k), el('strong', v)); values.append(row); }
    card.append(values); if (!f.enabled) card.append(el('p', f.note)); $('filters').append(card);
  });
  audioUrls = result.playbackRaw.map((pcm, i) => [pcm, result.playbackOutput[i]].map(p => URL.createObjectURL(new Blob([wav(p)], { type: 'audio/wav' }))));
  setPreview(result.playbackRaw, result.playbackOutput);
  result.playbackRaw = []; result.playbackOutput = []; $('playback').hidden = false; side = 'before'; selectAudio();
  showPage('listen');
}
$('start').onclick = capture; $('cancel').onclick = () => reset('中止しました。録音データは削除しました。'); $('reset').onclick = () => reset();
$('refresh').onclick = async () => {
  if (state !== 'idle' || stage) return;
  state = 'preparing'; controls(); const attempt = ++token;
  try { const mic = await navigator.mediaDevices.getUserMedia({ audio: true }); mic.getTracks().forEach(t => t.stop()); if (attempt !== token) return; await devices(); }
  catch (e) { if (attempt === token) $('cue').textContent = errors(e); }
  finally { if (attempt === token) { state = 'idle'; controls(); } }
};
for (const id of ['mode', 'denoise']) $(id).onchange = () => analyze();
$('sample').onchange = () => selectAudio();
for (const id of ['before','after']) $(id).onclick = () => { const resume = !$('audio').paused, position = $('audio').currentTime; side = id; selectAudio(resume, position); };
$('delete').onclick = () => { clearAudio(); clearWorker(); raw = []; controls(); $('cue').textContent = '録音・試聴データを削除しました。表示中の設定はコピー・保存できます。'; };
$('copy').onclick = async () => { try { await window.desktop.copyText(report(result, recordingDevice)); $('cue').textContent = '設定をコピーしました。'; } catch { $('cue').textContent = 'コピーできませんでした。テキストで保存をお試しください。'; } };
$('save').onclick = async () => { try { const saved = await window.desktop.saveText(report(result, recordingDevice)); $('cue').textContent = saved ? '設定を保存しました。' : '保存をキャンセルしました。'; } catch { $('cue').textContent = '保存できませんでした。保存先の空き容量や権限を確認してください。'; } };
navigator.mediaDevices.addEventListener('devicechange', () => { if (state === 'idle' && !stage) devices().catch(() => {}); });
devices().catch(e => { $('cue').textContent = errors(e); }); controls();
