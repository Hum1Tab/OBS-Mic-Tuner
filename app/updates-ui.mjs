const button = document.getElementById('update');
const check = document.getElementById('check-update');
const message = document.getElementById('update-message');
let checking = false;
async function checkUpdate(manual = false) {
  if (checking) return;
  checking = true; check.disabled = true;
  if (manual) message.textContent = '確認中…';
  try {
    const result = await window.desktop.checkUpdate();
    button.hidden = result.status !== 'available';
    if (!button.hidden) button.textContent = `v${result.version} に更新`;
    if (manual) message.textContent = { available: '新しいバージョンをダウンロードできます。', current: '最新版です。', unavailable: '更新を確認できませんでした。時間をおいて再試行してください。' }[result.status];
  } catch { if (manual) message.textContent = '更新を確認できませんでした。'; }
  finally { checking = false; check.disabled = false; }
}
check.onclick = () => checkUpdate(true);
button.onclick = async () => {
  button.disabled = true;
  try { if (!await window.desktop.openUpdate()) throw new Error(); }
  catch { document.getElementById('cue').textContent = 'ダウンロードを開けませんでした。時間をおいて再試行してください。'; }
  finally { button.disabled = false; }
};
checkUpdate();
setInterval(checkUpdate, 6 * 60 * 60 * 1000);
window.addEventListener('online', () => checkUpdate());
