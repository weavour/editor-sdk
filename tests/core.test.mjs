import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createSDK, EditorError } from '../packages/editor/dist/index.js';
import { validMessage, emailDocument } from '../packages/editor/dist/protocol.js';

function setup(settings = {}) {
  const window = new Window({ url: 'https://host.example' });
  for (const key of ['window', 'document', 'HTMLElement', 'MessageEvent']) globalThis[key] = key === 'window' ? window : window[key];
  const container = document.createElement('div'); document.body.append(container);
  const instance = createSDK(settings).mount(container, { editorKey: 'ek_test', userId: 'user' });
  const frame = container.querySelector('iframe');
  const sent = []; frame.contentWindow.postMessage = message => sent.push(message);
  frame.dispatchEvent(new window.Event('load'));
  const config = sent[0].config;
  const send = (data, overrides = {}) => window.dispatchEvent(new window.MessageEvent('message', { origin: 'https://weavour.com', source: frame.contentWindow, data: { version: 1, sessionId: config.sdkSessionId, ...data }, ...overrides }));
  return { instance, window, container, frame, sent, send, config };
}

test('SSR imports expose a mount function without requiring a browser', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['--input-type=module', '-e', "import {mount} from './packages/editor/dist/index.js'; import './packages/react/dist/index.js'; if(typeof mount!=='function') process.exit(1)"], { stdio: 'pipe' });
});

test('application readiness requires a trusted session and supports immediate export', async () => {
  const h = setup(); let resolved = false; h.instance.ready.then(() => { resolved = true; });
  h.send({ type: 'weavour:ready', capabilities: { applicationReady: true } });
  await Promise.resolve(); assert.equal(resolved, false);
  h.send({ type: 'weavour:application-ready', sessionId: 'old-session' });
  await Promise.resolve(); assert.equal(resolved, false);
  h.send({ type: 'weavour:application-ready' }); await h.instance.ready;
  const pending = h.instance.exportHTML(); const request = h.sent.at(-1);
  h.send({ type: 'weavour:export-result', id: request.id, result: { html: '<p>Hi</p>' } });
  assert.equal((await pending).html, '<p>Hi</p>'); h.instance.destroy(); h.window.happyDOM.abort();
});

test('old iframes fail with an actionable compatibility error', async () => {
  const h = setup(); h.send({ type: 'weavour:ready' });
  await assert.rejects(h.instance.ready, error => error instanceof EditorError && error.code === 'incompatible_editor');
  assert.equal(h.container.children.length, 0); h.window.happyDOM.abort();
});

test('reload cancels exports and suppresses late API replies from the prior session', async () => {
  let finish;
  const h = setup({ fetch: () => new Promise(resolve => { finish = resolve; }) });
  h.send({ type: 'weavour:application-ready' }); await h.instance.ready;
  const pending = h.instance.exportHTML();
  h.send({ type: 'weavour:template-request', id: 'api-1', method: 'GET', path: 'templates' });
  h.frame.dispatchEvent(new h.window.Event('load'));
  await assert.rejects(pending, error => error.code === 'reloaded');
  const count = h.sent.length;
  finish({ ok: true, json: async () => ({ templates: [] }) });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(h.sent.length, count);
  h.instance.destroy(); h.window.happyDOM.abort();
});

test('config rejects mount identity changes and preserves full persisted envelope', () => {
  const h = setup();
  assert.throws(() => h.instance.updateConfig({ organizationId: 'another' }), /mount-only/);
  h.instance.destroy();
  const doc = { schemaVersion: 1, content: { type: 'doc', content: [] }, subject: 'Hi {{name}}', preheader: 'Preview' };
  const instance = createSDK().mount(h.container, { editorKey: 'ek', userId: 'u', emailDocument: doc });
  assert.deepEqual(emailDocument(doc), doc);
  instance.destroy();
  assert.throws(() => createSDK().mount(h.container, { editorKey: 'ek', userId: 'u', emailDocument: doc, subject: 'Other' }), /not both/);
  assert.throws(() => createSDK().mount(h.container, { editorKey: 'ek', userId: 'u', document: {}, draftId: '11111111-1111-4111-8111-111111111111' }), /cannot be combined/);
  h.window.happyDOM.abort();
});

test('wire payloads reject excessive nesting, cycles and non-JSON values', () => {
  const cycle = {}; cycle.self = cycle;
  assert.equal(validMessage(cycle), false);
  assert.equal(validMessage({ type: 'bad', fn: () => {} }), false);
  assert.equal(validMessage({ type: 'big', data: 'x'.repeat(2_100_000) }), false);
  assert.equal(validMessage({ type: 'weavour:ready', version: 1 }), true);
});


test('audit preferences changed during initialization reach the application when ready', async () => {
  const h = setup();
  h.instance.updateConfig({ enableEmailAudit: false });
  h.instance.updateConfig({ enableEmailAudit: true });
  h.send({ type: 'weavour:ready', capabilities: { applicationReady: true } });
  h.send({ type: 'weavour:application-ready' });
  await h.instance.ready;
  assert.equal(h.sent.at(-1).type, 'weavour:update-config');
  assert.equal(h.sent.at(-1).config.enableEmailAudit, true);
  h.instance.destroy(); h.window.happyDOM.abort();
});
