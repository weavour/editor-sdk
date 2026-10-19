import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const core = JSON.parse(readFileSync('packages/editor/package.json', 'utf8'));
const react = JSON.parse(readFileSync('packages/react/package.json', 'utf8'));
assert.equal(process.env.RELEASE_TAG, `v${core.version}`, `Release tag ${process.env.RELEASE_TAG} does not match package version ${core.version}. Run npm run version:sdk -- <version>, commit the manifests and lockfiles, then create the version tag on that commit. A tag alone does not bump package versions.`);
assert.equal(core.version, react.version);
assert.equal(react.dependencies['@weavour/editor'], core.version);
