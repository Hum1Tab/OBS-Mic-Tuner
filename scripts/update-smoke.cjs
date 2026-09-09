const { app, BrowserWindow, shell } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { REPOSITORY } = require('../updates.cjs');
let opened;
shell.openExternal = async url => { opened = url; };
const version = process.env.UPDATE_TEST_VERSION || '1.1.0';
const url = `https://github.com/${REPOSITORY}/releases/download/v${version}/OBS-Mic-Tuner-${version}-Windows.exe`;
global.fetch = async () => {
  if (version === 'offline') throw Error('offline');
  return { ok:true, json:async()=>({tag_name:`v${version}`,draft:false,prerelease:false,assets:[{name:`OBS-Mic-Tuner-${version}-Windows.exe`,state:'uploaded',size:100,url,browser_download_url:url}]}) };
};
app.setPath('userData',path.join(__dirname,'../test-output/update-profile'));
require(process.env.TUNER_PACKAGED_MAIN || '../main.cjs');
app.whenReady().then(async()=>{
  try {
    const win=BrowserWindow.getAllWindows()[0];
    await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
    const js=code=>win.webContents.executeJavaScript(code);
    await js("document.getElementById('help').click();document.getElementById('check-update').click()");
    for(let i=0;i<50;i++){if(await js("!document.getElementById('check-update').disabled"))break;await new Promise(r=>setTimeout(r,100));}
    const expected=version==='1.1.0';
    assert.equal(await js("document.getElementById('update').hidden"),!expected);
    assert.equal(await js("document.querySelector('.app-logo').naturalWidth > 0"),true);
    if(expected){await js("document.getElementById('help-dialog').close();document.getElementById('update').click()");await new Promise(r=>setTimeout(r,200));assert.equal(opened,url);fs.writeFileSync(path.join(__dirname,'../test-output/v1-update.png'),(await win.capturePage()).toPNG());}
    else assert.equal(opened,undefined);
    console.log(`PASS update UI: ${version}`);app.exit(0);
  }catch(e){console.error(e);app.exit(1);}
});
