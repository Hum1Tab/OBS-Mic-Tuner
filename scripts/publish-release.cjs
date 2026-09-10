const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const REPOSITORY='Hum1Tab/OBS-Mic-Tuner-Releases';
const visibility=execFileSync('gh',['repo','view',REPOSITORY,'--json','visibility','--jq','.visibility'],{encoding:'utf8'}).trim();
if(visibility!=='PRIVATE')throw Error('Binary distribution repository must be private');
const version=require('../package.json').version;
const exe=path.resolve(`dist/OBS-Mic-Tuner-${version}-Windows.exe`);
const zip=path.resolve(`dist/OBS-Mic-Tuner-${version}-Windows.zip`);
if(!fs.existsSync(exe)) throw Error('Build the Windows executable first');
if(!fs.existsSync(zip)) throw Error('Package the ZIP with licenses first');
const tag=`v${version}`;
const gh=(...args)=>execFileSync('gh',args,{stdio:'inherit'});
// Upload to a draft first, so installed apps never see a partially uploaded release.
gh('release','create',tag,'--repo',REPOSITORY,'--title',`OBS Mic Tuner ${tag}`,'--notes-file','RELEASE-NOTES.md','--draft');
gh('release','upload',tag,exe,zip,'--repo',REPOSITORY);
gh('release','edit',tag,'--repo',REPOSITORY,'--draft=false','--latest');

