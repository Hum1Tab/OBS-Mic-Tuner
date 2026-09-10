// Full UI integration with local TTS as a fake microphone; never records the user's mic.
const { app, BrowserWindow, clipboard, dialog } = require('electron');
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const out = path.join(__dirname, '../test-output'); fs.mkdirSync(out, { recursive: true });
app.setPath('userData', path.join(out,'smoke-profile'));
const fixturePath = path.join(out, 'fixture.wav'), reportPath = path.join(out, 'saved-settings.txt');
const ttsPath = path.join(out, 'tts.wav');
if (!fs.existsSync(ttsPath)) throw new Error('Run npm run test:fixture first.');
const bytes = fs.readFileSync(ttsPath); let rate, data, channels, bits;
for (let at = 12; at + 8 <= bytes.length;) {
  const name = bytes.toString('ascii', at, at+4), length = bytes.readUInt32LE(at+4);
  if (name === 'fmt ') { assert.equal(bytes.readUInt16LE(at+8), 1); channels = bytes.readUInt16LE(at+10); rate = bytes.readUInt32LE(at+12); bits = bytes.readUInt16LE(at+22); }
  if (name === 'data') data = bytes.subarray(at+8, at+8+length);
  at += 8 + length + (length % 2);
}
assert.equal(bits, 16); const mono = Array.from({ length: data.length / (2*channels) }, (_, i) => data.readInt16LE(i*channels*2) / 32768);
const peak = mono.reduce((n,x) => Math.max(n, Math.abs(x)), 0);
function writeFixture(phase) {
  const sampleRate = 48000, count = sampleRate*30, wav = Buffer.alloc(44+count*2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(sampleRate,24); wav.writeUInt32LE(sampleRate*2,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(count*2,40);
  let seed = 7;
  for (let i=0;i<count;i++) {
    const pos = (i*rate/sampleRate) % (mono.length-1), at = Math.floor(pos), x = (mono[at]*(1-(pos-at)) + mono[at+1]*(pos-at))/peak;
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    const value = (phase === 0 ? 0 : x * [0,.06,.18,.55][phase]) + (seed/4294967296*2-1)*.0003;
    wav.writeInt16LE(Math.round(value*32767),44+i*2);
  }
  fs.writeFileSync(fixturePath,wav);
}
writeFixture(0);
app.commandLine.appendSwitch('use-fake-device-for-media-stream'); app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); app.commandLine.appendSwitch('use-file-for-fake-audio-capture', fixturePath);
require(process.env.TUNER_PACKAGED_MAIN || '../main.cjs');
const delay = ms => new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.on('console-message', (_, details) => { if (details.level === 'error' || details.level === 3) console.error(details.message); });
    await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
    const js = code => win.webContents.executeJavaScript(code);
    const click = id => js(`document.getElementById('${id}').click()`);
    async function until(expression, seconds=60) {
      const end = Date.now()+seconds*1000;
      while (Date.now()<end) { if (await js(expression)) return; await delay(250); }
      throw new Error('Timeout: '+expression+' / '+await js("document.getElementById('cue').textContent"));
    }
    await delay(200);
    fs.writeFileSync(path.join(out,'v1-measure.png'),(await win.capturePage()).toPNG());
    assert.equal(await js("document.getElementById('nav-listen').disabled"),true);
    await click('help'); assert.equal(await js("document.getElementById('help-dialog').open"),true);
    await js("document.getElementById('help-dialog').close()");
    for (let phase=0;phase<4;phase++) {
      writeFixture(phase); await click('start');
      if(phase===0){await until("document.getElementById('privacy').textContent.includes('録音中')",8);await delay(400);fs.writeFileSync(path.join(out,'v1-recording.png'),(await win.capturePage()).toPNG());}
      await until(phase===3 ? "!document.getElementById('result').hidden && !document.getElementById('copy').disabled" : `document.getElementById('step${phase}').classList.contains('complete') && !document.getElementById('start').disabled`);
      console.log(`Captured phase ${phase+1}/4`);
    }
    assert.equal(await js("document.querySelectorAll('.filter').length"),4);
    await until("Number.isFinite(document.getElementById('audio').duration)",5);
    assert.equal(await js("document.getElementById('audio').duration"),12);
    assert.equal(await js("document.getElementById('page-listen').hidden"),false);
    await js("document.getElementById('audio').muted=true");await click('play');
    await until("document.getElementById('audio').currentTime > .2",5);
    await click('after'); await delay(300);
    assert.equal(await js("document.getElementById('after').getAttribute('aria-pressed')"),'true');
    assert.equal(await js("document.getElementById('audio').paused"),false);
    await click('play');
    await js("document.getElementById('seek').value=3;document.getElementById('seek').dispatchEvent(new Event('input'))");
    assert.ok(Math.abs(await js("document.getElementById('audio').currentTime")-3)<.1);
    await js("document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
    assert.equal(await js("document.getElementById('before').getAttribute('aria-pressed')"),'true');
    await click('to-export');assert.equal(await js("document.getElementById('page-export').hidden"),false);
    await click('copy'); await delay(200); assert.match(await clipboard.readText(), /OBS Mic Tuner 1.0.1/);
    dialog.showSaveDialog = async () => ({ canceled:false, filePath: reportPath });
    await click('save'); await until("document.getElementById('cue').textContent.includes('設定を保存しました')",5);
    assert.match(fs.readFileSync(reportPath,'utf8'),/計算モデル/);
    await click('back-listen');
    await js("document.getElementById('denoise').value='on'; document.getElementById('denoise').dispatchEvent(new Event('change'))");
    await until("!document.getElementById('copy').disabled",60);
    assert.equal(await js("document.getElementById('denoise').value"),'on');
    await click('copy'); await delay(200); assert.match(await clipboard.readText(),/ノイズ抑制 \[有効\]/);
    await js("document.getElementById('mode').value='steady'; document.getElementById('mode').dispatchEvent(new Event('change'))");
    await until("!document.getElementById('copy').disabled",60);
    await click('copy'); await delay(200); assert.match(await clipboard.readText(),/仕上がり: 声量を安定/);
    fs.writeFileSync(path.join(out,'v1-listen.png'),(await win.capturePage()).toPNG());
    await click('to-export');await delay(200);
    fs.writeFileSync(path.join(out,'v1-export.png'),(await win.capturePage()).toPNG());
    win.setSize(900,720);await delay(300);
    assert.equal(await js("document.documentElement.scrollWidth <= window.innerWidth"),true);
    fs.writeFileSync(path.join(out,'v1-compact.png'),(await win.capturePage()).toPNG());
    for(const page of ['measure','listen']){
      await click(`nav-${page}`);await delay(200);
      assert.equal(await js("document.documentElement.scrollWidth <= window.innerWidth"),true);
      fs.writeFileSync(path.join(out,`v1-${page}-compact.png`),(await win.capturePage()).toPNG());
    }
    win.setSize(1220,960);await click('back-listen');
    await click('delete'); assert.equal(await js("document.getElementById('playback').hidden"),true);
    assert.equal(await js("document.getElementById('denoise').disabled"),true);
    await click('reset'); writeFixture(0); await click('start'); await delay(500); await click('cancel');
    await until("!document.getElementById('start').disabled",5); await delay(3500);
    assert.equal(await js("document.getElementById('privacy').textContent.includes('録音中')"),false);
    await js("window.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); }; true");
    await click('start'); await until("!document.getElementById('start').disabled",5);
    assert.match(await js("document.getElementById('cue').textContent"),/許可/);
    await js("navigator.mediaDevices.getUserMedia = async (...args) => { const stream = await window.originalGetUserMedia(...args); window.lastTestStream=stream; return stream; }; true");
    await click('start'); await until("!!window.lastTestStream",5);
    await js("window.lastTestStream.getAudioTracks()[0].dispatchEvent(new Event('ended'))");
    await until("!document.getElementById('start').disabled",5);
    assert.match(await js("document.getElementById('cue').textContent"),/切断/);
    assert.equal(await js("window.lastTestStream.getTracks().every(t=>t.readyState==='ended')"),true);
    console.log('PASS: four real capture phases + RNNoise VAD + tuning + WAV playback + A/B + copy/save + denoise retune + mode retune + deletion + cancellation + denied permission + disconnected track');
    app.exit(0);
  } catch (e) { console.error(e); app.exit(1); }
});



