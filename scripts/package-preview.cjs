const fs=require('node:fs'), path=require('node:path');
const root=path.join(__dirname,'..'), version=require('../package.json').version;
const output=path.join(root,'dist',`OBS-Mic-Tuner-${version}`);
fs.mkdirSync(path.join(output,'licenses'),{recursive:true});
const exe=`OBS-Mic-Tuner-${version}-Windows.exe`;
for (const [from,to] of [[`dist/${exe}`,exe],['README.md','README.md'],['VALIDATION.md','VALIDATION.md'],['THIRD-PARTY-NOTICES.md','THIRD-PARTY-NOTICES.md'],['app/vendor/LICENSE-rnnoise.txt','licenses/LICENSE-rnnoise.txt'],['app/vendor/LICENSE-rnnoise-wasm.txt','licenses/LICENSE-rnnoise-wasm.txt'],['dist/win-unpacked/LICENSE.electron.txt','licenses/LICENSE.electron.txt'],['dist/win-unpacked/LICENSES.chromium.html','licenses/LICENSES.chromium.html']]) fs.copyFileSync(path.join(root,from),path.join(output,to));
console.log(output);
fs.copyFileSync(path.join(root,'DESIGN.md'),path.join(output,'DESIGN.md'));

