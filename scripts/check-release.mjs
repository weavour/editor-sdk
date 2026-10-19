import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const core = JSON.parse(readFileSync('packages/editor/package.json', 'utf8'));
const react = JSON.parse(readFileSync('packages/react/package.json', 'utf8'));
assert.equal(process.env.RELEASE_TAG, `v${core.version}`);
assert.equal(core.version, react.version);
assert.equal(react.dependencies['@weavour/editor'], core.version);
