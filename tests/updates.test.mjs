import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { selectUpdate, createUpdateChecker, REPOSITORY } = createRequire(import.meta.url)('../updates.cjs');
const release = (version = '1.1.0') => ({ tag_name: `v${version}`, draft: false, prerelease: false, assets: [{name: `OBS-Mic-Tuner-${version}-Windows.exe`, state:'uploaded', size:100, browser_download_url:`https://github.com/${REPOSITORY}/releases/download/v${version}/OBS-Mic-Tuner-${version}-Windows.exe`}] });
test('updates require a newer stable version and a matching published Windows artifact', () => {
  assert.equal(selectUpdate(release(), '1.0.0').version, '1.1.0');
  assert.equal(selectUpdate(release('1.10.0'), '1.9.0').version, '1.10.0');
  for (const data of [release('1.0.0'),release('0.9.9'),{...release(),draft:true},{...release(),prerelease:true},{...release(),tag_name:'v2.0.0-beta.1'},{...release(),assets:[]}]) assert.equal(selectUpdate(data,'1.0.0'),null);
  const bad = release(); bad.assets[0].browser_download_url='https://evil.example/update.exe';
  assert.equal(selectUpdate(bad,'1.0.0'),null);
});
test('checks coalesce, recover after network failure, and keep a known update during outages', async () => {
  let clock=100000, calls=0, fails=true;
  const checker=createUpdateChecker({currentVersion:'1.0.0',now:()=>clock,fetchRelease:async()=>{calls++;if(fails)throw Error('offline');return {ok:true,json:async()=>release()};}});
  const results=await Promise.all([checker.check(),checker.check()]);
  assert.equal(calls,1); assert.equal(results[0].status,'unavailable');
  clock+=60001;fails=false;assert.equal((await checker.check()).status,'available');
  assert.equal(checker.available.version,'1.1.0');
  clock+=60001;fails=true;assert.equal((await checker.check()).status,'available');
});
