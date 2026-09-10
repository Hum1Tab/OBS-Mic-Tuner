const { app, BrowserWindow, session, ipcMain, clipboard, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const entry = pathToFileURL(path.join(__dirname, 'app/index.html')).href;
app.whenReady().then(() => {
  const checkedText = (event, text) => {
    if (event.senderFrame?.url !== entry || typeof text !== 'string' || text.length > 100000) throw new Error('Invalid request');
    return text;
  };
  ipcMain.handle('copy-text', (event, text) => clipboard.writeText(checkedText(event, text)));
  ipcMain.handle('save-text', async (event, text) => {
    const body = checkedText(event, text);
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), { defaultPath: 'OBS-Mic-Tuner-settings.txt', filters: [{ name: 'テキスト', extensions: ['txt'] }] });
    if (canceled || !filePath) return false;
    await fs.writeFile(filePath, '\ufeff' + body, 'utf8'); return true;
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(contents.getURL() === entry && permission === 'media' && details.mediaTypes?.every(t => t === 'audio'));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission) => contents?.getURL() === entry && permission === 'media');
  const win = new BrowserWindow({ width: 1220, height: 960, minWidth: 900, minHeight: 720, icon: path.join(__dirname, 'assets/icon.png'), backgroundColor: '#f4f7fa', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== entry) event.preventDefault(); });
  win.loadURL(entry);
});
app.on('window-all-closed', () => app.quit());

