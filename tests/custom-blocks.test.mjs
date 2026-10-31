import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { runInNewContext } from 'node:vm';
import { createSDK, defineCustomBlock } from '../packages/editor/dist/index.js';
import { customBlockDefinitions, validateCustomBlockIcon, validateCustomValues, customBlockProps, validateCustomHTML, currentCustomSnapshot, customBlockFingerprint, emailDocument, documentSchemaVersion, transformCustomHTML, customDocumentAssetURLs } from '../packages/editor/dist/protocol.js';
const def = (render = props => `<p>${props.title}</p>`) => defineCustomBlock({ id: 'product', version: 1, label: 'Product', defaultProps: { title: 'Hello' }, controls: { title: { type: 'text', label: 'Title', required: true } }, render });
const attrs = () => ({ id: 'node', blockId: 'product', version: 1, label: 'Product', props: { title: 'Hello' }, snapshot: null });
function harness(definitions = [def()], options = {}) {
  const window = new Window({ url: 'https://host.example' });
  for (const key of ['window','document','HTMLElement','MessageEvent']) globalThis[key] = key === 'window' ? window : window[key];
  const container = document.createElement('div'); document.body.append(container);
  const instance = createSDK({ fetch: options.fetch, readiness: options.readiness }).mount(container, { editorKey: 'key', userId: 'user', customBlocks: definitions });
  const frame = container.querySelector('iframe'), sent = [];
  frame.contentWindow.postMessage = message => sent.push(message);
  const send = (data, overrides = {}) => window.dispatchEvent(new window.MessageEvent('message', { origin: 'https://weavour.com', source: frame.contentWindow, data: { version: 1, sessionId: sent[0]?.sessionId, ...data }, ...overrides }));
  frame.dispatchEvent(new window.Event('load'));
  assert.equal(sent[0].type, definitions.length ? 'weavour:probe-custom' : 'weavour:init');
  if (definitions.length) {
  send({ type: 'weavour:custom-capability', customBlocksV1: true, sessionId: 'old-session' });
  assert.equal(sent.length, 1);
  send({ type: 'weavour:custom-capability', customBlocksV1: true });
  }
  const config = sent.at(-1).config;
  send({ type: 'weavour:ready', capabilities: { customBlocksV1: options.customSupport !== false, applicationReady: true } }); send({ type: 'weavour:application-ready' });
  const request = (id, props = { title: 'Hello' }, generation = config.customRegistryGeneration) => send({ type: 'weavour:custom-render', id, nodeId: 'node-' + id, blockId: 'product', blockVersion: 1, registryGeneration: generation, propsGeneration: 1, props });
  return { window, instance, send, sent, request, config, cleanup: async () => { instance.destroy(); await window.happyDOM.abort(); } };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
test('custom SVG icons accept bounded static geometry and normalize paints to the theme', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#123456"><g transform="translate(1 1)"><rect x="2" y="2" width="18" height="18" rx="2"/><path d="M4 6h10" stroke-linecap="round"/><circle cx="10" cy="12" r="3" fill="black"/></g></svg>';
  const normalized = validateCustomBlockIcon(svg);
  assert.match(normalized, /stroke="currentColor"/); assert.match(normalized, /fill="currentColor"/);
  assert.match(normalized, /fill="none"/); assert.doesNotMatch(normalized, /#123456|black|xmlns/);
  assert.equal(validateCustomBlockIcon(normalized), normalized);
  assert.equal(customBlockDefinitions([{ ...def(), iconSvg: svg }]).registrations[0].iconSvg, normalized);
  assert.equal(customBlockDefinitions([def()]).registrations[0].iconSvg, undefined);
});
test('custom SVG icons reject active content, references, unbounded or non-geometry markup', () => {
  const wrap = inner => `<svg viewBox="0 0 24 24">${inner}</svg>`;
  for (const svg of [wrap('<script>alert(1)</script>'), wrap('<foreignObject><p>x</p></foreignObject>'), wrap('<image href="https://example.com/x"/>'), wrap('<use href="#x"/>'), wrap('<path d="M0 0h4" onload="alert(1)"/>'), wrap('<path d="M0 0h4" style="stroke:url(https://example.com)"/>'), wrap('<path d="M0 0h4" fill="url(#x)"/>'), wrap('<a href="javascript:alert(1)"><rect width="2" height="2"/></a>'), wrap('<svg viewBox="0 0 10 10"/>'), wrap('<text>Label</text>'), wrap('<g>'.repeat(13) + '</g>'.repeat(13)), wrap('<path d="M0 0h4"/>'.repeat(129)), '<svg viewBox="0 0 0 24"/>', '<svg/>', wrap('<circle r="Infinity"/>'), wrap('<path d="' + 'M0 0 '.repeat(4000) + '"/>'), wrap('<path d="M0 0h4"/>') + '<svg viewBox="0 0 24 24"/>']) {
    assert.throws(() => validateCustomBlockIcon(svg), /invalid_custom_icon_svg/, svg.slice(0, 200));
    assert.throws(() => customBlockDefinitions([{ ...def(), iconSvg: svg }]));
  }
});
test('SVG metadata crosses the bridge without callbacks and invalid replacements preserve the registry', async () => {
  const iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="black"><path d="M2 4h20v16H2z"/></svg>';
  const h = harness([{ ...def(), iconSvg }]);
  assert.equal(h.config.customBlocks[0].iconSvg, validateCustomBlockIcon(iconSvg));
  assert.equal(h.config.customBlocks[0].render, undefined);
  assert.throws(() => h.instance.updateConfig({ customBlocks: [{ ...def(), iconSvg: '<svg onload="bad()"/>' }] }));
  h.request('after-invalid-icon'); await turn();
  assert.equal(h.sent.at(-1).html, '<p>Hello</p>');
  await h.cleanup();
});
test('runtime definitions validate controls/defaults and JSON without coercion', () => {
  assert.equal(customBlockDefinitions([def()]).registrations[0].render, undefined);
  assert.throws(() => customBlockDefinitions([def(), def()]), /duplicate/);
  assert.throws(() => customBlockDefinitions([{ ...def(), version: 0 }]));
  for (const value of [NaN, undefined, () => {}, new Date(), JSON.parse('{"__proto__":{}}')]) assert.throws(() => customBlockProps({ bad: value }));
  assert.throws(() => validateCustomValues({ title: '' }, def().controls), /required/);
  assert.throws(() => customBlockProps({ value: 'é'.repeat(32768) }), /large/);
  assert.deepEqual(customBlockProps(runInNewContext('({ title: "Another window", nested: { count: 2 } })')), { title: 'Another window', nested: { count: 2 } });
  assert.throws(() => customBlockProps({ value: new (class Customer {})() }));
  assert.throws(() => customBlockDefinitions([{ ...def(), controls: { n: { type: 'number', label: 'Number', step: -1 } } }]));
});
test('schema 3 preserves unresolved nodes and gates old envelopes', () => {
  const content = { type: 'doc', content: [{ type: 'customBlock', attrs: attrs() }] };
  assert.equal(documentSchemaVersion(content), 3);
  assert.throws(() => emailDocument({ schemaVersion: 2, subject: '', preheader: '', content }));
  const saved = emailDocument({ schemaVersion: 3, subject: '', preheader: '', content });
  assert.deepEqual(saved.content.content[0].attrs, attrs());
  const a = attrs(); a.snapshot = { html: '<p>Hello</p>', policyVersion: 1, fingerprint: customBlockFingerprint(a.blockId, a.version, a.props) };
  assert.equal(currentCustomSnapshot(a).html, '<p>Hello</p>');
  a.props.title = 'new'; assert.equal(currentCustomSnapshot(a), null);
  a.snapshot.fingerprint = customBlockFingerprint(a.blockId, a.version, a.props); a.snapshot.html = '<img src="https://x.test/a" onerror="bad()">'; assert.equal(currentCustomSnapshot(a), null);
});
test('fragment policy retains tables/MSO and rejects active, global and CSS content', () => {
  const html = '<table role="presentation" cellpadding="0"><tbody><tr><td style="padding:12px"><a href="{{link}}"><span><!--[if mso]><i style="mso-font-width:400%" hidden>&#8202;</i><![endif]--></span>Hello {{name}}</a></td></tr></tbody></table>';
  assert.equal(validateCustomHTML(html), html);
  for (const bad of ['<script>alert(1)</script>', '<img src="https://x.test" onerror="bad()">', '<svg><a href="https://x.test">x</a></svg>', '<style>p{}</style>', '<html></html>', '<a href="java&#x73;cript:bad()">x</a>', '<p style="background:uRL(https://evil.test)">x</p>', '<!--[if mso]><script>x</script><![endif]-->', '<p style="background:u/**/rl(x)">x</p>', '<iframe></iframe>', `<p style='background-image:image-set("asset.png" 1x)'>x</p>`, `<p style='filter:progid:DXImageTransform.Microsoft.AlphaImageLoader(src="asset.png")'>x</p>`]) assert.throws(() => validateCustomHTML(bad), undefined, bad);
  const output = transformCustomHTML(html, value => value.replace('{{name}}', 'A & B'), value => value === '{{link}}' ? 'https://example.com' : value, value => value);
  assert.match(output, /A &amp; B/); assert.match(output, /\[if mso\]/);
  const key = 'o/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.png';
  assert.deepEqual(customDocumentAssetURLs({ type: 'doc', content: [{ type: 'customBlock', attrs: { snapshot: { html: `<img src="https:&#47;&#47;assets.weavour.com/${key}">` } } }] }), ['https://assets.weavour.com/' + key]);
});
test('host renderers receive detached props; callbacks and failures never cross the wire', async () => {
  const h = harness([def(props => { props.title = 'Mutated'; return '<p>OK</p>'; })]); await h.instance.ready;
  const props = { title: 'Hello' }; h.request('a', props); await turn();
  assert.equal(props.title, 'Hello'); assert.equal(h.sent.at(-1).html, '<p>OK</p>');
  assert.equal(JSON.stringify(h.config).includes('render'), false);
  h.instance.updateConfig({ customBlocks: [def(() => { throw new Error('SECRET'); })] });
  h.request('b', props, 2); await turn(); assert.equal(h.sent.at(-1).error, 'custom_render_failed'); assert.equal(JSON.stringify(h.sent).includes('SECRET'), false);
  await h.cleanup();
});
test('registry replacements, cancellation, malformed origins and destruction fence async replies', async () => {
  let finish;
  const h = harness([def(() => new Promise(resolve => { finish = resolve; }))], { readiness: 'configured' }); await h.instance.ready;
  h.request('slow'); await turn(); h.instance.updateConfig({ customBlocks: [] }); finish('<p>late</p>'); await turn();
  assert.equal(h.sent.some(m => m.id === 'slow' && m.type === 'weavour:custom-result'), false);
  h.instance.updateConfig({ customBlocks: [def()] });
  h.send({ type: 'weavour:custom-render', id: 'bad', nodeId: 'n', blockId: 'product', blockVersion: 1, registryGeneration: 3, propsGeneration: 1, props: { title: 'x' } }, { origin: 'https://evil.example' }); await turn();
  assert.equal(h.sent.some(m => m.id === 'bad'), false);
  h.send({ type: 'weavour:custom-render', id: 'old-session-render', nodeId: 'n', blockId: 'product', blockVersion: 1, registryGeneration: 3, propsGeneration: 1, props: { title: 'x' }, sessionId: 'old-session' }); await turn();
  assert.equal(h.sent.some(m => m.id === 'old-session-render'), false);
  assert.throws(() => h.instance.updateConfig({ customBlocks: [], enableAi: 'invalid' }));
  h.request('valid', { title: 'Valid' }, 3); await turn(); assert.equal(h.sent.at(-1).html, '<p>Valid</p>');
  await h.cleanup();
});
test('host render concurrency is bounded and canceled queued work never starts', async () => {
  const ends = []; let running = 0, peak = 0;
  const h = harness([def(() => { peak = Math.max(peak, ++running); return new Promise(resolve => ends.push(() => { running--; resolve('<p>OK</p>'); })); })]); await h.instance.ready;
  for (let i = 0; i < 8; i++) h.request(String(i)); await turn(); assert.equal(peak, 4); assert.equal(ends.length, 4);
  h.send({ type: 'weavour:custom-cancel', id: '0' });
  await turn(); assert.equal(ends.length, 4); assert.equal(peak, 4);
  h.send({ type: 'weavour:custom-cancel', id: '7' });
  ends.splice(0).forEach(end => end()); await turn(); await turn(); assert.equal(ends.length, 3); assert.equal(peak, 4);
  h.instance.destroy(); const length = h.sent.length; ends.forEach(end => end()); await turn(); assert.equal(h.sent.length, length); await h.cleanup();
});
test('renderer timeouts return structured errors and late promises cannot publish output', async t => {
  let resolve;
  const h = harness([def(() => new Promise(yes => { resolve = yes; }))]); await h.instance.ready;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  h.request('timeout'); await turn(); t.mock.timers.tick(5001);
  assert.equal(h.sent.at(-1).error, 'custom_render_timeout');
  const length = h.sent.length; resolve('<p>Late</p>'); await turn(); assert.equal(h.sent.length, length);
  t.mock.timers.reset(); await h.cleanup();
});

test('new SDK gates server documents when mounted against an older iframe', async () => {
  const h = harness([], { customSupport: false, fetch: async (_url, init) => {
    assert.equal(init.headers['X-Weavour-Document-Version'], '2');
    return Response.json({ template: { document: { schemaVersion: 3, content: { type: 'doc' } } } });
  } });
  await h.instance.ready;
  h.send({ type: 'weavour:template-request', id: 'old-reader', path: 'templates/id', method: 'GET' });
  await turn(); await turn();
  const result = h.sent.find(message => message.id === 'old-reader');
  assert.equal(result.error, 'unsupported_document_version'); assert.equal(result.result, undefined);
  h.send({ type: 'weavour:draft-request', id: 'old-draft-reader', path: 'drafts/11111111-1111-1111-1111-111111111111', method: 'GET' });
  await turn(); await turn();
  const draft = h.sent.find(message => message.id === 'old-draft-reader');
  assert.equal(draft.error, 'unsupported_document_version'); assert.equal(draft.result, undefined);
  await h.cleanup();
});
