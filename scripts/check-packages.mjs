import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const temp = mkdtempSync(join(tmpdir(), 'weavour-pack-'));
try {
  const tarballs = [];
  for (const name of ['editor', 'react']) {
    const info = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--workspace', `@weavour/${name}`, '--pack-destination', temp], { encoding: 'utf8' }))[0];
    const files = info.files.map(file => file.path);
    assert(files.includes('LICENSE') && files.includes('README.md'));
    assert(files.includes('dist/index.js') && files.includes('dist/index.d.ts'));
    assert(files.every(file => file === 'package.json' || file === 'LICENSE' || file === 'README.md' || file.startsWith('dist/')));
    assert(!files.some(file => /\.map$|\.env|node_modules|worker|wrangler|iframe/.test(file)));
    const pkg = JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'));
    for (const entry of Object.values(pkg.exports)) for (const target of typeof entry === 'string' ? [entry] : Object.values(entry)) assert(files.includes(target.slice(2)), `Missing export ${target}`);
    if (name === 'react') assert(readFileSync('packages/react/dist/index.js', 'utf8').startsWith('"use client";'));
    tarballs.push(join(temp, info.filename));
    console.log(`${info.name}@${info.version}: ${files.length} reviewed package files`);
  }
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs, 'react@19', 'react-dom@19'], { cwd: temp, stdio: 'pipe' });
  execFileSync(process.execPath, ['--input-type=module', '-e', "import {mount} from '@weavour/editor'; import {parseMergeTags} from '@weavour/editor/protocol'; import {WeavourEditor} from '@weavour/react'; if(typeof mount!=='function'||!WeavourEditor||parseMergeTags([]).length) process.exit(1);"], { cwd: temp, stdio: 'pipe' });
  console.log('Packed packages install and import independently, including SSR.');
} finally { rmSync(temp, { recursive: true, force: true }); }
