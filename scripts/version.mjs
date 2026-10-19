import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version ?? '')) {
  throw new Error('Usage: npm run version:sdk -- <version>, for example 0.1.1 (without v).');
}
for (const name of ['editor', 'react']) {
  const path = `packages/${name}/package.json`;
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.version = version;
  if (name === 'react') manifest.dependencies['@weavour/editor'] = version;
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
}
for (const cwd of ['.', 'examples/react', 'examples/next']) {
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd, stdio: 'inherit' });
}
console.log(`Both packages are now ${version}. Update CHANGELOG.md, verify, commit, then tag v${version}. No commit or tag was created.`);
