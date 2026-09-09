const $ = id => document.getElementById(id);
let current = 'measure', preview = [], live = [], currentSide = 'before';
const canvasIds = ['live-wave', 'preview-wave'];
function draw(id, values = [], playhead = null) {
  const canvas = $(id), rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d'); ctx.scale(ratio,ratio); const w=rect.width,h=rect.height;
  ctx.clearRect(0,0,w,h); ctx.strokeStyle='#dce7ef'; ctx.lineWidth=1;
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);ctx.stroke();}
  for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(w*i/8,0);ctx.lineTo(w*i/8,h);ctx.stroke();}
  ctx.strokeStyle='#2385a6';ctx.lineWidth=2;ctx.lineCap='round';
  if(values.length){values.forEach((v,i)=>{const x=(i+.5)*w/values.length,extent=Math.max(1,v*h*.43);ctx.beginPath();ctx.moveTo(x,h/2-extent);ctx.lineTo(x,h/2+extent);ctx.stroke();});}
  else{ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();}
  if(playhead!==null){ctx.strokeStyle='#344b66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*playhead,0);ctx.lineTo(w*playhead,h);ctx.stroke();}
}
function envelope(pcm) {
  const bins=180, out=[];
  for(let i=0;i<bins;i++){let m=0;for(let j=Math.floor(i*pcm.length/bins);j<Math.floor((i+1)*pcm.length/bins);j++)m=Math.max(m,Math.abs(pcm[j]));out.push(m);}
  return out;
}
export function showPage(page) {
  if(page!=='measure' && $('result').hidden)return;
  current=page;
  for(const name of ['measure','listen','export']){$(`page-${name}`).hidden=name!==page;const nav=$(`nav-${name}`);nav.classList.toggle('selected',name===page);if(name===page)nav.setAttribute('aria-current','page');else nav.removeAttribute('aria-current');}

  if(page!=='listen')$('audio').pause();
  window.scrollTo(0,0); requestAnimationFrame(redraw);
}
export function refreshUI({state,stage,phase,hasResult,hasAudio}) {
  const busy=['preparing','recording','analyzing','closing'].includes(state);
  $('nav-measure').disabled=busy;
  for(const id of ['nav-listen','nav-export','to-export','back-listen'])$(id).disabled=busy||!hasResult;
  $('remeasure').disabled=busy;
  for(const id of ['play','seek'])$(id).disabled=busy||!hasAudio;
  $('phase-title').textContent=phase?.title||'測定完了';$('phase-count').textContent=stage<4?`${stage+1} / 4`:'4 / 4';
  $('phase-prompt').textContent=phase?.prompt||'「聴き比べる」で録音を確認できます。';
  $('scope-state').textContent={idle:stage===4?'測定が完了しました':'録音待ち',preparing:'録音の準備中',recording:'録音中',analyzing:'解析中',closing:'録音を終了しています'}[state];
  if(state==='idle')$('remaining').textContent=phase?`${phase.seconds}秒`:'完了';
}
export function setLive(pcm,remaining) {
  let peak=0;for(const x of pcm)peak=Math.max(peak,Math.abs(x));live.push(Math.min(1,peak*3));if(live.length>120)live.shift();
  $('remaining').textContent=`${Math.max(0,Math.ceil(remaining))}秒`;draw('live-wave',live);
}
export function clearLive(){live=[];draw('live-wave');}
export function clearVisuals(){live=[];preview=[];draw('live-wave');draw('preview-wave');$('play-time').textContent='0:00';$('seek').value=0;}
export function setPreview(raw,processed) {
  preview=raw.map((p,i)=>[envelope(p),envelope(processed[i])]);
  const max=Math.max(.00001,...preview.flat(2));preview=preview.map(pair=>pair.map(wave=>wave.map(x=>x/max)));
  currentSide='before';redraw();
}
export function updatePreviewSide(side){currentSide=side;redraw();}
function time(n){return `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;}
function redraw(){draw('live-wave',live);const a=$('audio');draw('preview-wave',preview[Number($('sample').value)]?.[currentSide==='before'?0:1]||[],Number.isFinite(a.duration)?a.currentTime/a.duration:0);}
for(const page of ['measure','listen','export'])$(`nav-${page}`).onclick=()=>showPage(page);
$('to-export').onclick=()=>showPage('export');$('back-listen').onclick=()=>showPage('listen');
$('help').onclick=()=>$('help-dialog').showModal();
$('remeasure').onclick=()=>$('reset').click();
$('play').onclick=()=>{const a=$('audio');if(a.paused)a.play().catch(()=>{});else a.pause();};
$('seek').oninput=()=>{$('audio').currentTime=Number($('seek').value);redraw();};
const audio=$('audio');
audio.addEventListener('loadedmetadata',()=>{if(Number.isFinite(audio.duration)){$('duration').textContent=time(audio.duration);$('seek').max=audio.duration;}redraw();});
audio.addEventListener('timeupdate',()=>{$('play-time').textContent=time(audio.currentTime);$('seek').value=audio.currentTime;redraw();});
for(const event of ['play','pause','ended'])audio.addEventListener(event,()=>{$('play').textContent=audio.paused?'▶':'Ⅱ';$('play').setAttribute('aria-label',audio.paused?'音声を再生':'一時停止');});
document.addEventListener('keydown',e=>{if(current==='listen'&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)&&!$('help-dialog').open){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();$(e.key==='ArrowLeft'?'before':'after').click();}}});
const resize=new ResizeObserver(redraw);canvasIds.forEach(id=>resize.observe($(id)));
requestAnimationFrame(redraw);
