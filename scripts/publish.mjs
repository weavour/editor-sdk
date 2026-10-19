import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
for (const name of ['editor', 'react']) {
  const manifest = JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'));
  const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json', '--workspace', manifest.name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))[0];
  let published;
  try { published = execFileSync('npm', ['view', `${manifest.name}@${manifest.version}`, 'dist.integrity', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { if (!String(error.stderr).includes('E404')) throw error; }
  if (published) {
    assert.equal(JSON.parse(published), packed.integrity, `Published ${manifest.name}@${manifest.version} differs from this build. Bump the version.`);
    console.log(`${manifest.name}@${manifest.version} already published with matching integrity.`);
  } else {
    execFileSync('npm', ['publish', '--workspace', manifest.name, '--access', 'public', '--provenance'], { stdio: 'inherit' });
  }
}
