const REPOSITORY = 'Hum1Tab/OBS-Mic-Tuner-Releases';
const API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
function versionParts(value) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match ? match.slice(1).map(BigInt) : null;
}
function selectUpdate(release, currentVersion) {
  const current = versionParts(currentVersion), next = versionParts(release?.tag_name);
  if (!current || !next || release.draft || release.prerelease) return null;
  const different = next.findIndex((n, i) => n !== current[i]);
  if (different < 0 || next[different] < current[different]) return null;
  const version = next.join('.');
  const name = `OBS-Mic-Tuner-${version}-Windows.exe`;
  const asset = release.assets?.find(a => a.name === name && a.state === 'uploaded' && a.size > 0);
  const expected = `https://github.com/${REPOSITORY}/releases/download/${release.tag_name}/${name}`;
  if (!asset || asset.browser_download_url !== expected) return null;
  return { version, url: expected };
}
function createUpdateChecker({ currentVersion, fetchRelease = fetch, now = Date.now }) {
  let pending, checkedAt = 0, cached, available;
  return {
    get available() { return available; },
    check() {
      if (pending) return pending;
      if (cached && now() - checkedAt < 60000) return Promise.resolve(cached);
      pending = (async () => {
        try {
          const response = await fetchRelease(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'OBS-Mic-Tuner' }, signal: AbortSignal.timeout(10000), redirect: 'error' });
          if (!response.ok) throw new Error('Release unavailable');
          available = selectUpdate(await response.json(), currentVersion);
          cached = available ? { status: 'available', version: available.version } : { status: 'current' };
        } catch { cached = available ? { status: 'available', version: available.version } : { status: 'unavailable' }; }
        checkedAt = now();
        return cached;
      })().finally(() => { pending = null; });
      return pending;
    }
  };
}
module.exports = { REPOSITORY, API, selectUpdate, createUpdateChecker };

