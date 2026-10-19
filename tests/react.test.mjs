import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const window = new Window({ url: 'https://host.example' });
for (const key of ['window', 'document', 'HTMLElement', 'MessageEvent', 'Node']) globalThis[key] = key === 'window' ? window : window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement: h, StrictMode, act, createRef } = await import('react');
const { createRoot } = await import('react-dom/client');
const { WeavourEditor } = await import('../packages/react/dist/index.js');

function ready(frame) {
  const sent = []; frame.contentWindow.postMessage = message => sent.push(message);
  frame.dispatchEvent(new window.Event('load'));
  const sessionId = sent[0].config.sdkSessionId;
  const send = data => window.dispatchEvent(new window.MessageEvent('message', { origin: 'https://weavour.com', source: frame.contentWindow, data: { version: 1, sessionId, ...data } }));
  send({ type: 'weavour:application-ready' });
  return { sent, send };
}

test('React Strict Mode cleans up, updates config/callbacks without remounting and exposes methods', async () => {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); const ref = createRef(); const errors = []; const changes = [];
  const base = { editorKey: 'ek', userId: 'u', ref, style: { height: 700 }, 'aria-label': 'Email editor', onError: error => errors.push(error) };
  await act(async () => root.render(h(StrictMode, {}, h(WeavourEditor, { ...base, onChange: () => changes.push('old') }))));
  assert.equal(host.querySelectorAll('iframe').length, 1);
  const frame = host.querySelector('iframe'); const bridge = ready(frame); await ref.current.ready;
  await act(async () => root.render(h(StrictMode, {}, h(WeavourEditor, { ...base, theme: { mode: 'dark' }, locale: 'fr', onChange: () => changes.push('latest') }))));
  assert.equal(host.querySelector('iframe'), frame);
  assert.equal(bridge.sent.at(-1).config.locale, 'fr');
  bridge.send({ type: 'weavour:document-change', document: { type: 'doc' } });
  assert.deepEqual(changes, ['latest']);
  const pending = ref.current.exportHTML(); const request = bridge.sent.at(-1);
  bridge.send({ type: 'weavour:export-result', id: request.id, result: { html: 'exported' } });
  assert.equal((await pending).html, 'exported');
  await act(async () => root.render(h(WeavourEditor, { ...base, userId: 'another' })));
  // Removing StrictMode explicitly replaces this tree; subsequent prop changes preserve that new session.
  const second = host.querySelector('iframe');
  await act(async () => root.render(h(WeavourEditor, { ...base, userId: 'third' })));
  assert.equal(host.querySelector('iframe'), second);
  assert.equal(errors.at(-1).code, 'invalid_config');
  await act(async () => root.unmount()); assert.equal(host.querySelectorAll('iframe').length, 0);
  await window.happyDOM.abort();
});
