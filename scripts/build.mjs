import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, cp, rm } from 'node:fs/promises';
const version = JSON.parse(await readFile('packages/editor/package.json', 'utf8')).version;
await rm('.types', { recursive: true, force: true });
execFileSync('npx', ['tsc'], { stdio: 'inherit' });
for (const name of ['editor', 'react']) {
  const root = `packages/${name}`;
  await mkdir(`${root}/dist`, { recursive: true });
  await build({ entryPoints: name === 'editor' ? [`${root}/src/index.ts`, `${root}/src/protocol.ts`] : [`${root}/src/index.tsx`], outdir: `${root}/dist`, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', external: ['react', 'react-dom', '@weavour/editor'], legalComments: 'eof' });
  await cp(`.types/${name}/src`, `${root}/dist`, { recursive: true });
  await cp('LICENSE', `${root}/LICENSE`);
}
for (const [entry, output] of [['classic', 'editor'], ['legacy', 'legacy']]) await build({ entryPoints: [`packages/editor/src/${entry}.ts`], outfile: `packages/editor/dist/${output}.js`, bundle: true, format: 'iife', target: 'es2022', banner: { js: `/*! Weavour embedding SDK v${version} | MIT | https://github.com/weavour/editor-sdk */` } });
