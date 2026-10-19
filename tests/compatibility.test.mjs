import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const sdk = readFileSync(new URL('../packages/editor/dist/legacy.js', import.meta.url), 'utf8');
function setup(overrides = {}) {
  const listeners = new Map();
  const timers = new Map();
  const frames = [];
  class HTMLElement {
    children = [];
    appendChild(frame) { this.children.push(frame); frame.container = this; }
  }
  const container = new HTMLElement();
  const window = {
    location: { origin: 'https://customer.example' },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); }
  };
  const document = {
    currentScript: { src: 'https://editor.example/editor.js' },
    querySelector(selector) { return selector === '#editor' ? container : null; },
    createElement() {
      const frame = {
        style: {}, listeners: new Map(), messages: [],
        addEventListener(type, listener) { this.listeners.set(type, listener); },
        removeEventListener(type) { this.listeners.delete(type); },
        remove() { this.container.children = this.container.children.filter(child => child !== this); }
      };
      frame.contentWindow = { postMessage(message, origin) { frame.messages.push({ message, origin }); } };
      frames.push(frame);
      return frame;
    }
  };
  runInNewContext(sdk, {
    window, document, HTMLElement, URL, structuredClone, crypto, AbortController, ...overrides,
    setTimeout(callback) { const id = Symbol(); timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  return { window, container, frames, listeners, timers };
}

test('SDK merge-tag validation and precedence preserve exact tokens and support clearing overrides', () => {
  const tag = { id: 'name', label: 'Name', token: '[[NAME]]', kind: 'text' };
  const { window, frames, listeners } = setup();
  assert.throws(() => window.Weavour.mount('#editor', { editorKey: 'ek', userId: 'u', mergeTags: [tag, tag] }), /invalid_merge_tags/);
  const instance = window.Weavour.mount('#editor', { editorKey: 'ek', userId: 'u', editorConfig: { mergeTags: [{ ...tag, token: '%NAME%' }] }, mergeTags: [tag] });
  const frame = frames[0]; frame.listeners.get('load')();
  assert.equal(frame.messages[0].message.config.mergeTags[0].token, '[[NAME]]');
  listeners.get('message')({ origin: 'https://editor.example', source: frame.contentWindow, data: { type: 'weavour:ready', version: 1 } });
  instance.updateConfig({ locale: 'fr' }); assert.equal(frame.messages.at(-1).message.config.mergeTags[0].token, '[[NAME]]');
  instance.updateConfig({ mergeTags: undefined }); assert.equal(frame.messages.at(-1).message.config.mergeTags, undefined);
  assert.throws(() => instance.updateConfig({ mergeTags: [{ ...tag, token: '<unsafe>' }] }), /invalid_merge_tags/);
  instance.destroy();
});


test('mount passes declarative config after load and trusts only its frame and origin', () => {
  const { window, frames, listeners, timers } = setup();
  let ready = 0;
  window.Weavour.mount('#editor', {
    editorKey: 'ek_123', userId: 'user_456', organizationId: 'org_789', locale: 'fr',
    onReady() { ready++; }
  });
  const frame = frames[0];
  const url = new URL(frame.src);
  assert.equal(url.pathname, '/editor');
  assert.equal(url.searchParams.get('parentOrigin'), 'https://customer.example');
  assert.equal(url.searchParams.has('userId'), false);
  assert.equal(frame.messages.length, 0);
  frame.listeners.get('load')();
  assert.equal(frame.messages[0].origin, 'https://editor.example');
  assert.equal(frame.messages[0].message.config.editorKey, 'ek_123');
  assert.equal(frame.messages[0].message.config.organizationId, 'org_789');
  assert.equal(frame.messages[0].message.config.onReady, undefined);
  const receive = listeners.get('message');
  const data = { type: 'weavour:ready', version: 1 };
  receive({ origin: 'https://wrong.example', source: frame.contentWindow, data });
  receive({ origin: 'https://editor.example', source: {}, data });
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data: { ...data, version: 2 } });
  assert.equal(ready, 0);
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data });
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data });
  assert.equal(ready, 1);
  assert.equal(timers.size, 0);
});


test('destroy preserves host children, removes listeners and allows remounting', () => {
  const { window, container, listeners, timers } = setup();
  const hostChild = {};
  container.children.push(hostChild);
  const options = { editorKey: 'ek_123', userId: 'user_456' };
  const editor = window.Weavour.mount(container, options);
  assert.throws(() => window.Weavour.mount(container, options), /already has/);
  editor.destroy();
  editor.destroy();
  assert.deepEqual(container.children, [hostChild]);
  assert.equal(listeners.size, 0);
  assert.equal(timers.size, 0);
  window.Weavour.mount(container, options).destroy();
});


test('invalid configuration fails before mounting and load timeout cleans up', () => {
  const { window, container, timers, listeners } = setup();
  assert.throws(() => window.Weavour.mount('#missing', {}), /not found/);
  assert.throws(() => window.Weavour.mount(container, { editorKey: '', userId: 'u' }), /editorKey/);
  assert.throws(() => window.Weavour.mount(container, { editorKey: 'ek', userId: '' }), /userId/);
  assert.throws(() => window.Weavour.mount(container, { editorKey: 'ek', userId: 'u', organizationId: 123 }), /organizationId/);
  assert.throws(() => window.Weavour.mount(container, { editorKey: 'ek', userId: 'u', editorUrl: 'javascript:alert(1)' }), /Invalid editor URL/);
  let error;
  window.Weavour.mount(container, { editorKey: 'ek', userId: 'u', onError(value) { error = value; } });
  [...timers.values()][0]();
  assert.match(error.message, /timed out/);
  assert.equal(container.children.length, 0);
  assert.equal(listeners.size, 0);
});


test('test email callback runs once for a trusted request and returns sanitized failures', async () => {
  const { window, frames, listeners } = setup();
  let calls = 0;
  window.Weavour.mount('#editor', { editorKey: 'ek', userId: 'u', onTestEmail() { calls++; throw new Error('Private provider details'); } });
  const frame = frames[0]; frame.listeners.get('load')();
  const receive = listeners.get('message');
  const base = { origin: 'https://editor.example', source: frame.contentWindow };
  receive({ ...base, data: { type: 'weavour:ready', version: 1 } });
  const request = { type: 'weavour:test-email', version: 1, id: 'test-1', payload: { to: 'test@example.test', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' } };
  receive({ ...base, origin: 'https://wrong.example', data: request });
  receive({ ...base, data: request }); receive({ ...base, data: request });
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  assert.equal(frame.messages.at(-1).message.type, 'weavour:test-result');
  assert.equal(frame.messages.at(-1).message.ok, false);
  assert.equal(JSON.stringify(frame.messages.at(-1)).includes('Private provider'), false);
});


test('timer publishing uses host configuration, rejects foreign frames and returns correlated results', async () => {
  const requests = [];
  const { window, frames, listeners } = setup({ fetch: async (url, options) => {
    requests.push({ url, options }); return { ok: true, async json() { return { url: 'https://timers.weavour.com/fixture.gif' }; } };
  } });
  window.Weavour.mount('#editor', { editorKey: 'ek_123', userId: 'u1', organizationId: 'org1' });
  const frame = frames[0]; frame.listeners.get('load')();
  const receive = listeners.get('message');
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data: { type: 'weavour:ready', version: 1 } });
  const data = { type: 'weavour:timer-publish', version: 1, id: 'timer-1', settings: { deadline: 1798761599 } };
  receive({ origin: 'https://evil.example', source: frame.contentWindow, data });
  assert.equal(requests.length, 0);
  receive({ origin: 'https://editor.example', source: {}, data });
  assert.equal(requests.length, 0);
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data });
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.weavour.com/editors/ek_123/timers/versions');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.deepEqual(JSON.parse(requests[0].options.body), { settings: { deadline: 1798761599 }, userId: 'u1', organizationId: 'org1' });
  const result = frame.messages.at(-1);
  assert.equal(result.origin, 'https://editor.example');
  assert.equal(result.message.id, 'timer-1');
  assert.equal(result.message.type, 'weavour:timer-result');
});


test('SDK exports are correlated, reject actionable errors and clean up on destroy', async () => {
  const { window, frames, listeners } = setup();
  const instance = window.Weavour.mount('#editor', { editorKey: 'ek_123', userId: 'u1' });
  await assert.rejects(instance.exportHTML(), /not ready/);
  const frame = frames[0]; frame.listeners.get('load')();
  const receive = listeners.get('message');
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data: { type: 'weavour:ready', version: 1 } });
  const exported = instance.exportHTML(); const id = frame.messages.at(-1).message.id;
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data: { type: 'weavour:export-result', version: 1, id, error: 'Prepare current timer before export.' } });
  await assert.rejects(exported, /Prepare current timer/);
  const pending = instance.exportHTML(); instance.destroy();
  await assert.rejects(pending, /destroyed/);
});


test('template configuration defaults on, honors saved defaults and overrides, and updates live', () => {
  for (const [options, expected] of [[{}, true], [{ editorConfig: { enableTemplates: false } }, false], [{ enableTemplates: false }, false], [{ editorConfig: { enableTemplates: false }, enableTemplates: true }, true]]) {
    const { window, frames, container, listeners } = setup();
    const editor = window.Weavour.mount(container, { editorKey: 'ek', userId: 'u', ...options });
    const frame = frames[0]; frame.listeners.get('load')();
    assert.equal(frame.messages[0].message.config.enableTemplates, expected);
    editor.updateConfig({ enableTemplates: false });
    listeners.get('message')({ origin: 'https://editor.example', source: frame.contentWindow, data: { type: 'weavour:ready', version: 1 } });
    editor.updateConfig({ enableTemplates: true });
    assert.equal(frame.messages.at(-1).message.config.enableTemplates, true);
    editor.updateConfig({ enableTemplates: false });
    assert.equal(frame.messages.at(-1).message.config.enableTemplates, false);
    editor.updateConfig({ allowedBlocks: ['text'] });
    assert.deepEqual([...frame.messages.at(-1).message.config.allowedBlocks], ['text']);
    editor.updateConfig({ allowedBlocks: [] });
    assert.deepEqual([...frame.messages.at(-1).message.config.allowedBlocks], []);
    assert.throws(() => editor.updateConfig({ allowedBlocks: [null] }), /array/);
    assert.equal(frames.length, 1);
    assert.throws(() => editor.updateConfig({ enableTemplates: 'false' }), /boolean/);
    editor.destroy();
  }
  const { window, container } = setup();
  assert.throws(() => window.Weavour.mount(container, { editorKey: 'ek', userId: 'u', enableTemplates: 'false' }), /boolean/);
});


test('asset bridge keeps API scope in the host and never uploads file bytes', async () => {
  const requests = [];
  const { window, frames, listeners } = setup({ Blob, fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, async json() { return { id: 'job-1', state: 'pending', uploadUrl: 'https://89bea4e9c3f3a2fce798e3287479805e.r2.cloudflarestorage.com/uploads/raw/job-1?signature=fixture' }; } };
  } });
  window.Weavour.mount('#editor', { editorKey: 'ek_host', userId: 'host-user', organizationId: 'host-org' });
  const frame = frames[0]; frame.listeners.get('load')(); const receive = listeners.get('message');
  const base = { origin: 'https://editor.example', source: frame.contentWindow };
  receive({ ...base, data: { type: 'weavour:ready', version: 1 } });
  const message = { type: 'weavour:asset-request', version: 1, id: 'asset-request', path: 'asset-imports', method: 'POST', body: { name: 'test.png', size: 7, idempotencyKey: 'file-import', userId: 'spoofed' } };
  receive({ ...base, origin: 'https://evil.example', data: message }); assert.equal(requests.length, 0);
  receive({ ...base, data: message }); receive({ ...base, data: message }); await new Promise(setImmediate);
  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url); assert.equal(url.searchParams.get('userId'), 'host-user'); assert.equal(url.searchParams.get('organizationId'), 'host-org');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(frame.messages.at(-1).message.result.state, 'pending');
  receive({ ...base, data: { ...message, id: 'old-file-request', file: new Blob(['fixture']) } }); await new Promise(setImmediate);
  assert.equal(requests.length, 1);
  assert.equal(frame.messages.at(-1).message.error, 'iframe_upgrade_required');
});


test('organization-only mounts become personal mounts without mutating caller options', () => {
  const { window, frames } = setup();
  const options = { editorKey: 'ek_org', organizationId: 'org-only' };
  window.Weavour.mount('#editor', options);
  frames[0].listeners.get('load')();
  const config = frames[0].messages[0].message.config;
  assert.equal(config.userId, 'org-only'); assert.equal(config.organizationId, undefined);
  assert.equal(options.userId, undefined); assert.equal(options.organizationId, 'org-only');
});


test('template bridge pins identity to the mount, omits cookies and rejects foreign frame requests', async () => {
  const calls = [];
  const { window, frames, listeners } = setup({ fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ templates: [] }) }; } });
  const instance = window.Weavour.mount('#editor', { editorKey: 'ek_templates', userId: 'alice', organizationId: 'org' });
  const frame = frames[0]; frame.listeners.get('load')();
  const receive = listeners.get('message');
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data: { type: 'weavour:ready', version: 1 } });
  const data = { type: 'weavour:template-request', version: 1, id: 'request', path: 'templates', method: 'GET', query: { userId: 'bob', organizationId: 'other', offset: 30 } };
  receive({ origin: 'https://evil.example', source: frame.contentWindow, data });
  receive({ origin: 'https://editor.example', source: {}, data });
  assert.equal(calls.length, 0);
  receive({ origin: 'https://editor.example', source: frame.contentWindow, data });
  await new Promise(resolve => setImmediate(resolve));
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/editors/ek_templates/templates'); assert.equal(url.searchParams.get('userId'), 'alice'); assert.equal(url.searchParams.get('organizationId'), 'org');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(frame.messages.at(-1).message.type, 'weavour:template-result');
  instance.destroy();
});


test('SDK template preview requests are correlated separately from send-ready export and cleaned up on destroy', async () => {
  const { window, frames, listeners } = setup();
  const instance = window.Weavour.mount('#editor', { editorKey: 'ek_preview', userId: 'user' });
  const frame = frames[0]; frame.listeners.get('load')();
  const receive = listeners.get('message');
  const event = data => ({ origin: 'https://editor.example', source: frame.contentWindow, data: { version: 1, ...data } });
  receive(event({ type: 'weavour:ready' }));
  const preview = instance.previewTemplate();
  const message = frame.messages.at(-1).message;
  assert.equal(message.previewOnly, true);
  receive(event({ type: 'weavour:export-result', id: message.id, result: { schemaVersion: 1, previewHtml: '<p>Preview</p>' } }));
  assert.equal((await preview).previewHtml, '<p>Preview</p>');
  const pending = instance.previewTemplate(); instance.destroy();
  await assert.rejects(pending, /destroyed/);
});


test('draft bridge pins scope, whitelists paths and methods, and surfaces retry metadata', async () => {
  const calls = [], statuses = [], draftChanges = [];
  const {window,frames,listeners} = setup({fetch:async(url,options)=>{calls.push({url:String(url),options});return {ok:false,status:429,headers:{get(){return '7';}},json:async()=>({error:'draft_rate_limit'})};}});
  const instance=window.Weavour.mount('#editor',{editorKey:'ek_drafts',userId:'alice',organizationId:'org',onSaveStatusChange:s=>statuses.push(s),onDraftChange:s=>draftChanges.push(s)});
  const frame=frames[0];frame.listeners.get('load')();const receive=listeners.get('message');const event=data=>({origin:'https://editor.example',source:frame.contentWindow,data:{version:1,...data}});receive(event({type:'weavour:ready'}));
  const request={type:'weavour:draft-request',id:'request-1',path:'drafts',method:'POST',body:{name:'X'},query:{userId:'attacker',organizationId:'attacker',tenantId:'attacker',cursor:'cursor'}};
  receive({...event(request),origin:'https://evil.example'});receive(event({...request,path:'drafts/../../templates'}));receive(event({...request,method:'DELETE'}));assert.equal(calls.length,0);
  receive(event(request));await new Promise(resolve=>setImmediate(resolve));const url=new URL(calls[0].url);assert.equal(url.searchParams.get('userId'),'alice');assert.equal(url.searchParams.get('organizationId'),'org');assert.equal(url.searchParams.has('tenantId'),false);assert.equal(calls[0].options.credentials,'omit');
  assert.equal(frame.messages.at(-1).message.status,429);assert.equal(frame.messages.at(-1).message.retryAfter,7);
  receive(event({type:'weavour:draft-status',status:'saved',draftId:'11111111-1111-4111-8111-111111111111',revision:2}));assert.equal(statuses[0].revision,2);assert.equal(draftChanges.length,1);
  const pending=instance.flushAutosave();receive(event({type:'weavour:autosave-ready'}));const message=frame.messages.at(-1).message;receive(event({type:'weavour:flush-result',id:message.id,result:{draft:{id:'saved'}}}));assert.equal((await pending).draft.id,'saved');
  const dying=instance.flushAutosave();instance.destroy();await assert.rejects(dying,/destroyed/);
});


test('autosave mount overrides and editorConfig defaults validate and respect resolved dashboard settings',async()=>{
  for(const [options,expected] of [[{},undefined],[{editorConfig:{enableAutosave:false}},false],[{enableAutosave:false},false],[{editorConfig:{enableAutosave:false},enableAutosave:true},true]]){
    const {window,frames,listeners}=setup();const instance=window.Weavour.mount('#editor',{editorKey:'ek_autosave',userId:'user',...options});const frame=frames[0];frame.listeners.get('load')();assert.equal(frame.messages[0].message.config.enableAutosave,expected);
    const receive=listeners.get('message');receive({origin:'https://editor.example',source:frame.contentWindow,data:{type:'weavour:ready',version:1,enableAutosave:false}});
    await assert.rejects(instance.flushAutosave(),/disabled/);instance.destroy();
  }
  const {window}=setup();assert.throws(()=>window.Weavour.mount('#editor',{editorKey:'ek',userId:'u',editorConfig:{enableAutosave:'false'}}),/boolean/);
});


test('demo stays restricted through live updates, forged service messages and export calls', async () => {
  const requests = [], changes = [], tests = [];
  const { window, frames, listeners } = setup({ fetch: (...args) => { requests.push(args); throw new Error('Demo must not fetch'); } });
  const instance = window.Weavour.mount('#editor', { demo: true, enableAutosave: true, enableAi: true, enableTemplates: true,
    allowedBlocks: ['text', 'image', 'timer', 'html'], onChange: value => changes.push(value), onTestEmail: value => tests.push(value) });
  const frame = frames[0]; frame.listeners.get('load')();
  const config = frame.messages[0].message.config;
  assert.equal(config.demo, true);
  assert.equal(config.enableAutosave, false); assert.equal(config.enableAi, false); assert.equal(config.enableTemplates, false);
  assert.deepEqual(Array.from(config.allowedBlocks), ['text']);
  assert.equal(config.capabilities.testEmail, false); assert.equal(config.capabilities.changeCallback, false);
  const receive = data => listeners.get('message')({ origin: 'https://editor.example', source: frame.contentWindow, data: { version: 1, ...data } });
  receive({ type: 'weavour:ready', enableAutosave: true });
  for (const type of ['asset-request', 'template-request', 'draft-request', 'ai-request', 'timer-publish', 'test-email', 'document-change'])
    receive({ type: `weavour:${type}`, id: 'demo-attempt', method: 'POST', path: 'assets', payload: { html: 'email' }, document: {}, emailDocument: {} });
  instance.updateConfig({ enableAutosave: true, enableAi: true, enableTemplates: true, allowedBlocks: ['image', 'text'], theme: { cornerRadius: 20 } });
  const updated = frame.messages.at(-1).message.config;
  assert.equal(updated.enableAutosave, false); assert.equal(updated.enableAi, false); assert.equal(updated.enableTemplates, false);
  assert.deepEqual(Array.from(updated.allowedBlocks), ['text']); assert.equal(updated.theme.cornerRadius, 20);
  await assert.rejects(instance.exportHTML(), /disabled in demo/);
  await assert.rejects(instance.previewTemplate(), /disabled in demo/);
  await assert.rejects(instance.flushAutosave(), /disabled/);
  assert.equal(requests.length, 0); assert.equal(changes.length, 0); assert.equal(tests.length, 0);
  instance.destroy();
});


test('legacy draft resume ignores fallback initial content without overwriting saved work', () => {
  const { window, frames } = setup();
  const instance = window.Weavour.mount('#editor', { editorKey: 'ek', userId: 'u', draftId: '11111111-1111-4111-8111-111111111111', document: { type: 'doc' }, subject: 'Fallback' });
  frames[0].listeners.get('load')();
  const config = frames[0].messages[0].message.config;
  assert.equal(config.document, undefined); assert.equal(config.subject, undefined);
  instance.destroy();
});
