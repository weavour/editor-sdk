import { customBlockDefinitions, customBlockProps, validateCustomValues, validateCustomHTML, hasCustomBlocks, CUSTOM_BLOCK_LIMITS } from './custom-blocks.js';
import { parseMergeTags, resolveMergeTags, emailDocument, validMessage, resolveDisplayConditions, parseDisplayConditions, inspectDisplayConditions } from './protocol.js';
import { EditorError } from './errors.js';
import type { MountOptions, EditorConfig, EditorSDK, EditorInstance, EditorBlockId, DraftFlushResult, SDKOptions } from './types.js';
type Pending = { resolve(value: any): void; reject(error: Error): void; timeout: ReturnType<typeof setTimeout>; sent?: boolean };
const editorModes = ['edit', 'readonly', 'preview', 'previewDesktop', 'previewMobile'];
function validateMode(value: unknown) {
  if (value !== undefined && (typeof value !== 'string' || !editorModes.includes(value))) throw new TypeError('Invalid editor mode.');
}
const mounted = new WeakSet<object>();
export function createSDK(settings: SDKOptions = {}): EditorSDK {
  // Capture this while the classic script is executing, before mount is called.
  const scriptUrl = settings.scriptUrl;
  const fetch = settings.fetch ?? ((...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args));
  const defaultEditorUrl = scriptUrl ? new URL("/editor", scriptUrl).href : "https://weavour.com/editor";

  function mount(target: HTMLElement | string, options: MountOptions): EditorInstance {
    const container = typeof target === "string" ? document.querySelector(target) : target;
    if (!(container instanceof HTMLElement)) throw new TypeError("Editor container was not found.");
    if (mounted.has(container)) throw new Error("This container already has a Weavour editor.");
    if (!options || typeof options !== "object") throw new TypeError("Mount options are required.");
    if (options.demo !== undefined && typeof options.demo !== 'boolean') throw new TypeError('demo must be a boolean.');
    const demo = options.demo === true;
    let customRegistry = customBlockDefinitions(demo ? [] : options.customBlocks ?? options.editorConfig?.customBlocks ?? []);
    let registryGeneration = 1;
    const demoBlocks: EditorBlockId[] = ['text', 'heading', 'button', 'divider', 'list', 'space', 'menu', 'unsubscribe', 'section', 'columns'];
    if (demo) options = { ...options, editorKey: 'ek_public_demo', userId: 'demo', draftId: undefined,
      displayConditions: [], enableAutosave: false, enableAi: false, enableTemplates: false, enableOrganizationBlocks: false, enableTestEmail: false,
      allowedBlocks: demoBlocks.filter(block => !options.allowedBlocks || options.allowedBlocks.includes(block)) };
    validateMode(options.mode); validateMode(options.editorConfig?.mode);
    for (const blocks of [options.allowedBlocks, options.editorConfig?.allowedBlocks]) {
      if (blocks !== undefined && (!Array.isArray(blocks) || blocks.some(block => typeof block !== "string"))) throw new TypeError("allowedBlocks must be an array of block names.");
    }
    if (options.userId === undefined && options.organizationId !== undefined) {
      options = { ...options, userId: options.organizationId, organizationId: undefined };
    }
    for (const name of ["editorKey", "userId"] as const) {
      if (typeof options[name] !== "string" || !options[name].trim() || options[name].length > 200 || /[\u0000-\u001f\u007f]/.test(options[name])) {
        throw new TypeError(name + " must be a non-empty string.");
      }
    }
    if (options.organizationId !== undefined &&
        (typeof options.organizationId !== "string" || !options.organizationId.trim() || options.organizationId.length > 200 || /[\u0000-\u001f\u007f]/.test(options.organizationId))) {
      throw new TypeError("organizationId must be a non-empty string when supplied.");
    }
    if (options.enableAi !== undefined && typeof options.enableAi !== 'boolean') throw new TypeError('enableAi must be a boolean.');
    for (const value of [options.enableTemplates, options.editorConfig?.enableTemplates]) {
      if (value !== undefined && typeof value !== "boolean") throw new TypeError("enableTemplates must be a boolean.");
    }
    for (const value of [options.enableOrganizationBlocks, options.editorConfig?.enableOrganizationBlocks]) {
      if (value !== undefined && typeof value !== 'boolean') throw new TypeError('enableOrganizationBlocks must be a boolean.');
    }
    for (const value of [options.enableAnalytics, options.editorConfig?.enableAnalytics]) {
      if (value !== undefined && typeof value !== 'boolean') throw new TypeError('enableAnalytics must be a boolean.');
    }
    for (const value of [options.enableEmailAudit, options.editorConfig?.enableEmailAudit]) {
      if (value !== undefined && typeof value !== 'boolean') throw new TypeError('enableEmailAudit must be a boolean.');
    }
    for (const value of [options.enableTestEmail, options.editorConfig?.enableTestEmail]) {
      if (value !== undefined && typeof value !== 'boolean') throw new TypeError('enableTestEmail must be a boolean.');
    }
    for (const [name, limit] of [['subject', 200], ['preheader', 500]] as const) {
      if (options[name] !== undefined && (typeof options[name] !== 'string' || options[name].length > limit)) throw new TypeError(name + ' must be a string within its length limit.');
    }
    for (const value of [options.enableAutosave, options.editorConfig?.enableAutosave]) {
      if (value !== undefined && typeof value !== 'boolean') throw new TypeError('enableAutosave must be a boolean.');
    }
    if (options.draftId !== undefined && (typeof options.draftId !== 'string' || !/^[a-f0-9-]{36}$/.test(options.draftId))) throw new TypeError('Invalid draft ID.');
    if (options.draftId !== undefined && (options.enableAutosave ?? options.editorConfig?.enableAutosave) === false) throw new TypeError('draftId requires autosave.');
    if (options.emailDocument === undefined && options.document && (hasCustomBlocks(options.document) || inspectDisplayConditions(options.document).displayConditions.length)) throw new TypeError('Conditional content requires emailDocument.');
    if (options.emailDocument !== undefined) {
      const full = emailDocument(options.emailDocument);
      if (options.document !== undefined || options.subject !== undefined || options.preheader !== undefined) throw new TypeError('Use emailDocument or raw document/metadata, not both.');
      options = { ...options, document: full.content, subject: full.subject, preheader: full.preheader };
    }
    if (options.draftId !== undefined && (options.document !== undefined || options.subject !== undefined || options.preheader !== undefined)) {
      if (settings.readiness !== 'configured') throw new TypeError('draftId cannot be combined with initial content.');
      // Existing script integrations may pass a fallback email when resuming.
      // A saved draft always wins; a failed resume must not save that fallback.
      options = { ...options, document: undefined, subject: undefined, preheader: undefined };
    }
    const displayConditions = options.displayConditions ?? options.editorConfig?.displayConditions;
    if (displayConditions !== undefined) resolveDisplayConditions([], displayConditions);
    const mergeTags = options.mergeTags ?? options.editorConfig?.mergeTags;
    if (mergeTags !== undefined) resolveMergeTags([], mergeTags);
    const url = new URL(options.editorUrl || defaultEditorUrl);
    if (!["https:", "http:"].includes(url.protocol)) throw new TypeError("Invalid editor URL.");
    if (url.username || url.password || (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new TypeError('Editor URL must use HTTPS.');
    const origin = url.origin;
    url.searchParams.set("parentOrigin", window.location.origin);
    const config: Record<string, any> = structuredClone({
      demo,
      mode: options.mode ?? options.editorConfig?.mode,
      displayConditions: demo ? [] : displayConditions === undefined ? undefined : parseDisplayConditions(displayConditions),
      mergeTags: mergeTags === undefined ? undefined : parseMergeTags(mergeTags),
      editorKey: options.editorKey,
      draftId: options.draftId,
      enableAutosave: options.enableAutosave ?? options.editorConfig?.enableAutosave,
      enableOrganizationBlocks: options.enableOrganizationBlocks ?? options.editorConfig?.enableOrganizationBlocks,
      enableAnalytics: options.enableAnalytics ?? options.editorConfig?.enableAnalytics,
      enableEmailAudit: options.enableEmailAudit ?? options.editorConfig?.enableEmailAudit,
      enableTestEmail: options.enableTestEmail ?? options.editorConfig?.enableTestEmail,
      userId: options.userId,
      organizationId: options.organizationId,
      locale: options.locale || "en",
      theme: { ...options.editorConfig?.theme, ...options.theme },
      customBlocks: customRegistry.registrations, customRegistryGeneration: registryGeneration,
      capabilities: { analyticsV1: !demo, customBlocksV1: !demo, displayConditionsV1: !demo, organizationBlocks: !demo, testEmail: !demo && typeof options.onTestEmail === "function", changeCallback: !demo && (typeof options.onChange === "function" || typeof options.onDocumentChange === "function") },
      allowedBlocks: options.allowedBlocks ?? options.editorConfig?.allowedBlocks,
      enableTemplates: options.enableTemplates ?? options.editorConfig?.enableTemplates ?? true,
      document: options.document,
      subject: options.subject,
      preheader: options.preheader,
      enableAi: (options.enableAi ?? options.editorConfig?.enableAi) !== false,
    });
    if (!validMessage({ config })) throw new TypeError('Editor configuration exceeds wire limits.');
    const iframe = document.createElement("iframe");
    iframe.title = "Weavour email editor";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.visibility = "hidden";
    function post(message: Record<string, unknown>, targetOrigin = origin) {
      iframe.contentWindow!.postMessage({ ...message, sessionId: config.sdkSessionId }, targetOrigin);
    }
    let resolveReady!: () => void;
    let rejectReady!: (error: Error) => void;
    let readyPromise = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // Callback-only integrations must not produce unhandled promise rejections.
    void readyPromise.catch(() => {});
    let generation = 0;
    const instanceId = crypto.randomUUID();
    let destroyed = false;
    let ready = false;
    let modeChanged = false;
    let configured = false;
    let conditionSupport = false, customSupport = false;
    function assertCustomReader(value: unknown) {
      if (customSupport) return;
      const pending = [value]; let count = 0;
      while (pending.length) {
        const item = pending.pop();
        if (++count > 50000) throw new Error('invalid_document');
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        if (record.schemaVersion === 3 || record.documentSchemaVersion === 3 || record.type === 'customBlock') throw new Error('unsupported_document_version');
        pending.push(...Object.values(record));
      }
    }
    const customPending = new Map<string, () => void>();
    const customQueue: (() => void)[] = [];
    let customActive = 0;
    function cancelCustom() { for (const cancel of customPending.values()) cancel(); customPending.clear(); customQueue.length = 0; }
    let autosaveReady = false;
    let autosaveEnabled = config.enableAutosave ?? true;
    let timer: ReturnType<typeof setTimeout>;
    const testRequests = new Set<string>();
    const timerRequests = new Map<string, AbortController>();
    const assetRequests = new Map<string, AbortController>();
    const exports = new Map<string, Pending>();
    const analyticsRequests = new Map<string, AbortController>();
    const templateRequests = new Map<string, AbortController>();
    const aiRequests = new Map<string, AbortController>();
    const draftRequests = new Map<string, AbortController>();
    const flushes = new Map<string, Pending>();
    const localScript = scriptUrl && ['localhost', '127.0.0.1'].includes(new URL(scriptUrl).hostname);
    const apiOrigin = new URL(options.apiUrl || (localScript ? 'http://localhost:8787' : 'https://api.weavour.com')).origin;
    config.apiOrigin = apiOrigin;
    if (!apiOrigin.startsWith('https://') && !['localhost', '127.0.0.1'].includes(new URL(apiOrigin).hostname)) throw new TypeError('API URL must use HTTPS.');

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelCustom();
      rejectReady(new EditorError('destroyed', 'Editor destroyed.'));
      clearTimeout(timer);
      for (const controller of timerRequests.values()) controller.abort();
      timerRequests.clear();
      for (const controller of assetRequests.values()) controller.abort();
      assetRequests.clear();
      for (const controller of analyticsRequests.values()) controller.abort();
      analyticsRequests.clear();
      visibilityObserver?.disconnect(); document.removeEventListener("visibilitychange", analyticsVisibility);
      for (const controller of templateRequests.values()) controller.abort();
      templateRequests.clear();
      for (const controller of aiRequests.values()) controller.abort();
      aiRequests.clear();
      for (const operation of exports.values()) { clearTimeout(operation.timeout); operation.reject(new EditorError('destroyed', 'Editor destroyed.')); }
      exports.clear();
      for (const controller of draftRequests.values()) controller.abort();
      draftRequests.clear();
      for (const operation of flushes.values()) { clearTimeout(operation.timeout); operation.reject(new EditorError('destroyed', 'Editor destroyed.')); }
      flushes.clear();
      window.removeEventListener("message", receive);
      iframe.removeEventListener("load", initialize);
      iframe.remove();
      mounted.delete(container!);
    }

    function initialize() {
      if (destroyed) return;
      ready = false; configured = false; autosaveReady = false;
      if (generation > 0) {
        rejectReady(new EditorError('reloaded', 'Editor reloaded.'));
        readyPromise = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
        void readyPromise.catch(() => {});
      }
      cancelCustom(); customSupport = false;
      generation++;
      config.sdkSessionId = instanceId + ':' + generation;
      for (const requests of [timerRequests, assetRequests, templateRequests, aiRequests, draftRequests, analyticsRequests]) { for (const controller of requests.values()) controller.abort(); requests.clear(); }
      for (const operation of exports.values()) { clearTimeout(operation.timeout); operation.reject(new EditorError('reloaded', 'Editor reloaded.')); } exports.clear();
      testRequests.clear();
      for (const operation of flushes.values()) { clearTimeout(operation.timeout); operation.reject(new EditorError('reloaded', 'Editor reloaded.')); }
      flushes.clear();
      clearTimeout(timer);
      timer = setTimeout(() => {
        const error = new EditorError('timeout', "Editor readiness timed out."); rejectReady(error); destroy();
        options.onError?.(error);
      }, 15000);
      if (customRegistry.registrations.length || options.emailDocument?.schemaVersion === 3 || options.document && hasCustomBlocks(options.document)) {
        clearTimeout(timer);
        timer = setTimeout(() => { const error = new EditorError('incompatible_editor', 'Upgrade the hosted editor to use custom blocks.'); rejectReady(error); destroy(); options.onError?.(error); }, 5000);
        post({ type: 'weavour:probe-custom', version: 1 }, origin);
      } else post({ type: "weavour:init", version: 1, config }, origin);
    }

    let intersects = false;
    function analyticsVisibility() {
      config.analyticsVisible = intersects && document.visibilityState !== 'hidden';
      if (configured) post({ type: 'weavour:analytics-visibility', version: 1, visible: config.analyticsVisible }, origin);
    }
    const visibilityObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { intersects = entries.some(entry => entry.isIntersecting); analyticsVisibility(); });
    visibilityObserver?.observe(iframe);
    if (!visibilityObserver) intersects = true;
    document.addEventListener('visibilitychange', analyticsVisibility);
    analyticsVisibility();
    let lastDraftId: string | null = null;
    function receive(event: MessageEvent) {
      if (destroyed || event.origin !== origin || event.source !== iframe.contentWindow) return;
      const message = event.data;
      const receivingGeneration = generation;
      if (!validMessage(message) || message.version !== 1) return;
      if (message.type === 'weavour:custom-capability' && message.customBlocksV1 === true && message.sessionId === config.sdkSessionId && !configured) { customSupport = true; post({ type: 'weavour:init', version: 1, config }, origin); return; }
      if (['weavour:custom-render', 'weavour:custom-cancel'].includes(message.type) && message.sessionId !== config.sdkSessionId) return;
      if (settings.readiness !== 'configured' && message.type !== 'weavour:ready' && message.sessionId !== config.sdkSessionId) return;
      if (demo && !['weavour:ready', 'weavour:application-ready', 'weavour:focus-editor', 'weavour:config-error', 'weavour:config-update-error'].includes(message.type)) return;
      if (message.type === 'weavour:custom-cancel' && typeof message.id === 'string') { customPending.get(message.id)?.(); return; }
      if (message.type === 'weavour:custom-render' && configured && !demo && customSupport) {
        const fields = ['id', 'nodeId', 'blockId'];
        if (fields.some(key => typeof message[key] !== 'string' || !message[key] || message[key].length > 200) || !Number.isSafeInteger(message.blockVersion) || !Number.isSafeInteger(message.propsGeneration) || message.registryGeneration !== registryGeneration || customPending.has(message.id)) return;
        const ids = { id: message.id, nodeId: message.nodeId, blockId: message.blockId, blockVersion: message.blockVersion, propsGeneration: message.propsGeneration, registryGeneration };
        const respond = (value: Record<string, unknown>) => { if (!destroyed && receivingGeneration === generation && ids.registryGeneration === registryGeneration) post({ type: 'weavour:custom-result', version: 1, ...ids, ...value }); };
        const definition = customRegistry.registrations.find(def => def.id === ids.blockId && def.version === ids.blockVersion);
        if (!definition) { respond({ error: 'missing_custom_definition' }); return; }
        let props;
        try { props = validateCustomValues(message.props, definition.controls); } catch { respond({ error: 'invalid_custom_props' }); return; }
        if (customPending.size >= CUSTOM_BLOCK_LIMITS.queue) { respond({ error: 'custom_queue_full' }); return; }
        let settled = false;
        let launch: (() => void) | undefined;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const finish = (value?: Record<string, unknown>) => {
          if (settled) return; settled = true; clearTimeout(timeout); customPending.delete(ids.id);
          const queued = launch ? customQueue.indexOf(launch) : -1;
          if (queued >= 0) customQueue.splice(queued, 1);
          if (value) respond(value);
          queueMicrotask(() => { while (customActive < CUSTOM_BLOCK_LIMITS.concurrency && customQueue.length) customQueue.shift()!(); });
        };
        customPending.set(ids.id, () => finish());
        timeout = setTimeout(() => finish({ error: 'custom_render_timeout' }), CUSTOM_BLOCK_LIMITS.timeout);
        const callback = customRegistry.callbacks.get(ids.blockId + ':' + ids.blockVersion)!;
        launch = () => {
          if (settled) return; customActive++;
          // Cancellation stops waiting, but cannot stop customer JavaScript. Keep
          // its execution slot occupied until the callback actually settles.
          Promise.resolve().then(() => settled ? undefined : callback(customBlockProps(props))).then(html => {
            if (settled) return;
            try { finish({ html: validateCustomHTML(html) }); } catch { finish({ error: 'unsupported_custom_html' }); }
          }, () => finish({ error: 'custom_render_failed' })).finally(() => {
            customActive--;
            while (customActive < CUSTOM_BLOCK_LIMITS.concurrency && customQueue.length) customQueue.shift()!();
          });
        };
        customQueue.push(launch);
        while (customActive < CUSTOM_BLOCK_LIMITS.concurrency && customQueue.length) customQueue.shift()!();
        return;
      }
      if (message.type === 'weavour:autosave-config' && configured && typeof message.enableAutosave === 'boolean') {
        autosaveEnabled = message.enableAutosave;
        if (!autosaveEnabled) {
          autosaveReady = false;
          for (const [id, operation] of flushes) { clearTimeout(operation.timeout); operation.reject(new EditorError('autosave_disabled', 'Autosave is disabled.')); flushes.delete(id); }
        }
        return;
      }
      if (message.type === 'weavour:autosave-ready' && configured && autosaveEnabled) {
        autosaveReady = true;
        for (const [id, operation] of flushes) if (!operation.sent) { operation.sent = true; post({ type:'weavour:flush', version:1, id }, origin); }
      }
      if (message.type === 'weavour:draft-status' && configured && ['idle','unsaved','saving','saved','failed','conflict','read-only'].includes(message.status) && (message.draftId === null || typeof message.draftId === 'string' && /^[a-f0-9-]{36}$/.test(message.draftId))) {
        if (typeof options.onSaveStatusChange === 'function') options.onSaveStatusChange({ status: message.status, draftId: message.draftId, revision: message.revision ?? null });
        if (message.draftId !== lastDraftId) { lastDraftId = message.draftId; if (typeof options.onDraftChange === 'function') options.onDraftChange({ draftId: message.draftId, revision: message.revision ?? null }); }
      }
      if (message.type === 'weavour:flush-result' && typeof message.id === 'string' && flushes.has(message.id)) {
        const operation = flushes.get(message.id)!; flushes.delete(message.id); clearTimeout(operation.timeout);
        message.error ? operation.reject(new Error(message.error)) : operation.resolve(message.result);
      }
      if (message.type === 'weavour:draft-cancel' && typeof message.id === 'string') draftRequests.get(message.id)?.abort();
      if (message.type === 'weavour:draft-request' && configured && typeof message.id === 'string' && !draftRequests.has(message.id)) {
        const path = message.path;
        if (typeof path !== 'string' || !/^drafts(?:\/[a-f0-9-]{36}(?:\/versions(?:\/[1-9]\d*)?|\/restore)?)?$/.test(path) || draftRequests.size >= 8) return;
        const permitted = message.method === 'GET' && !path.endsWith('/restore') || message.method === 'POST' && (path === 'drafts' || /\/(?:versions|restore)$/.test(path)) || message.method === 'PATCH' && /^drafts\/[a-f0-9-]{36}$/.test(path);
        if (!permitted) return;
        if (!autosaveEnabled) { post({ type:'weavour:draft-result', version:1, id:message.id, error:'drafts_disabled', status:403 }, origin); return; }
        const controller = new AbortController(); draftRequests.set(message.id, controller);
        const timeout = setTimeout(() => controller.abort(), 20000);
        const endpoint = new URL(apiOrigin + '/editors/' + encodeURIComponent(config.editorKey) + '/' + path);
        endpoint.searchParams.set('userId', config.userId);
        if (config.organizationId !== undefined) endpoint.searchParams.set('organizationId', config.organizationId);
        if (message.query && typeof message.query.cursor === 'string') endpoint.searchParams.set('cursor', message.query.cursor);
        fetch(endpoint, { method: message.method, credentials:'omit', signal:controller.signal, headers: { 'X-Weavour-Document-Version': customSupport ? '3' : '2', ...(message.body === undefined ? {} : {'Content-Type':'application/json'}) }, ...(message.body === undefined ? {} : {body:JSON.stringify(message.body)}) })
          .then(async response => {
            const result = await response.json();
            if (response.ok) {
              try { assertCustomReader(result); }
              catch { if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:draft-result', version: 1, id: message.id, error: 'unsupported_document_version', status: 409 }, origin); return; }
            }
            if (!destroyed && receivingGeneration === generation) post({ type:'weavour:draft-result', version:1, id:message.id, ...(response.ok ? {result} : {error:result.error || 'drafts_unavailable',status:response.status,retryAfter:Number(response.headers.get('Retry-After')) || 0}) }, origin);
          }).catch(() => { if (!destroyed && receivingGeneration === generation) post({type:'weavour:draft-result',version:1,id:message.id,error:'drafts_unavailable',status:0},origin); })
          .finally(() => {clearTimeout(timeout);if (draftRequests.get(message.id) === controller) draftRequests.delete(message.id);});
      }
      if (message.type === 'weavour:document-change' && configured && message.document && typeof message.document === 'object' && typeof options.onChange === 'function') {
        options.onChange(message.document);
      }
      if (message.type === 'weavour:document-change' && configured && message.emailDocument && typeof options.onDocumentChange === 'function') {
        try { options.onDocumentChange(emailDocument(message.emailDocument)); } catch (error) { options.onError?.(new EditorError('invalid_config', 'Invalid document change payload.')); }
      }
      if (message.type === "weavour:focus-editor" && ready) iframe.scrollIntoView({ block: "center", behavior: "auto" });
      if (message.type === 'weavour:config-update-error') {
        if (typeof options.onError === 'function') options.onError(new EditorError('invalid_config', 'Invalid merge tags. The current editor configuration was preserved.'));
        return;
      }
      if (message.type === 'weavour:config-error') {
        destroy();
        if (typeof options.onError === 'function') options.onError(new EditorError('config_failed', 'Unable to load saved editor configuration.'));
        return;
      }
      if (message.type === 'weavour:ready' && (customRegistry.registrations.length || options.emailDocument?.schemaVersion === 3 || options.document && hasCustomBlocks(options.document)) && message.capabilities?.customBlocksV1 !== true) { const error = new EditorError('incompatible_editor', 'Upgrade the hosted editor to use custom blocks.'); rejectReady(error); destroy(); options.onError?.(error); return; }
      if (message.type === 'weavour:ready' && (config.displayConditions?.length || options.emailDocument?.schemaVersion === 2) && message.capabilities?.displayConditionsV1 !== true) {
        const error = new EditorError('incompatible_editor', 'Upgrade the hosted editor to use display conditions.');
        rejectReady(error); destroy(); options.onError?.(error); return;
      }
      if (message.type === 'weavour:ready') { customSupport = message.capabilities?.customBlocksV1 === true; configured = true; analyticsVisibility(); conditionSupport = message.capabilities?.displayConditionsV1 === true; }
      if (message.type === 'weavour:ready' && settings.readiness !== 'configured') {
        if (message.capabilities?.applicationReady !== true) {
          const error = new EditorError('incompatible_editor', 'This iframe does not support application readiness. Upgrade the hosted editor.');
          rejectReady(error); destroy(); options.onError?.(error);
        }
        return;
      }
      if ((message.type === 'weavour:application-ready' || message.type === 'weavour:ready' && settings.readiness === 'configured') && !ready) {
        autosaveEnabled = !demo && (typeof message.enableAutosave === 'boolean' ? message.enableAutosave : config.enableAutosave ?? true);
        configured = true; ready = true;
        iframe.style.visibility = 'visible';
        clearTimeout(timer);
        if (modeChanged || config.mode !== undefined || config.allowedBlocks !== undefined || config.enableEmailAudit !== undefined || config.enableOrganizationBlocks !== undefined || config.enableTestEmail !== undefined) post({ type: 'weavour:update-config', version: 1, config: { customBlocks: config.customBlocks, customRegistryGeneration: config.customRegistryGeneration, mode: config.mode, allowedBlocks: config.allowedBlocks, enableOrganizationBlocks: config.enableOrganizationBlocks, enableAnalytics: config.enableAnalytics, enableEmailAudit: config.enableEmailAudit, enableTestEmail: config.enableTestEmail } }, origin);
        resolveReady();
        if (typeof options.onReady === "function") options.onReady();
      }
      if (message.type === 'weavour:ai-request' && configured && typeof message.id === 'string' && !aiRequests.has(message.id)) {
        if (!/^ai\/(?:capabilities|quotes|operations(?:\/[a-f0-9-]{36}(?:\/(?:run|cancel|accept|image-preview))?)?)$/.test(message.path) || !['GET','POST'].includes(message.method) || aiRequests.size >= 8) return;
        if (!config.enableAi) {
          post({type:'weavour:ai-result',version:1,id:message.id,error:'ai_disabled'},origin); return;
        }
        const controller = new AbortController(); aiRequests.set(message.id, controller);
        const timeout = setTimeout(() => controller.abort(), message.path.endsWith('/run') ? 210000 : 42000);
        const endpoint = new URL(apiOrigin + '/editors/'+encodeURIComponent(config.editorKey)+'/' + message.path);
        { endpoint.searchParams.set('userId', config.userId);if (config.organizationId !== undefined) endpoint.searchParams.set('organizationId', config.organizationId); }
        fetch(endpoint.href, {method:message.method,credentials:'omit',signal:controller.signal,
          headers: message.body === undefined ? {} : {'Content-Type':'application/json'},
          ...(message.body === undefined ? {} : {body:JSON.stringify(message.body)})
        }).then(async response => {
          const result = await response.json(); if (!response.ok) throw new Error(result.error || 'ai_request_failed');
          if (!destroyed && receivingGeneration === generation) post({type:'weavour:ai-result',version:1,id:message.id,result},origin);
        }).catch(error => {
          const safe = ['ai_source_unavailable','ai_image_unavailable','ai_invalid_output','invalid_ai_request','ai_insufficient_credits','ai_disabled','ai_scope_disabled','ai_paid_access_required','ai_source_changed','ai_quote_expired','ai_customer_key_unavailable','ai_provider_outcome_uncertain'].includes(error.message) ? error.message : 'ai_request_failed';
          if (!destroyed && receivingGeneration === generation) post({type:'weavour:ai-result',version:1,id:message.id,error:safe},origin);
        }).finally(() => {clearTimeout(timeout);if (aiRequests.get(message.id) === controller) aiRequests.delete(message.id);});
      }
      if (message.type === 'weavour:analytics-request' && configured && typeof message.id === 'string' && message.id.length <= 100 && !analyticsRequests.has(message.id)) {
        if (demo || config.enableAnalytics === false || config.editorKey === 'ek_dashboard_preview' || config.mode?.startsWith('preview') || analyticsRequests.size >= 2) return;
        // A dedicated bridge: no path, method, identity or tenant chosen by iframe.
        const batch = message.batch;
        if (!batch || batch.version !== 1 || !Array.isArray(batch.observations) || !batch.observations.length || batch.observations.length > 8 || new TextEncoder().encode(JSON.stringify(batch)).length > 16384) return;
        const endpoint = new URL(apiOrigin + '/editors/' + encodeURIComponent(config.editorKey) + '/analytics/batches');
        endpoint.searchParams.set('userId', config.userId);
        if (config.organizationId !== undefined) endpoint.searchParams.set('organizationId', config.organizationId);
        const controller = new AbortController(); analyticsRequests.set(message.id, controller);
        const timeout = setTimeout(() => controller.abort(), 10000);
        fetch(endpoint.href, { method: 'POST', credentials: 'omit', signal: controller.signal, keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch) })
          .then(response => { if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:analytics-result', version: 1, id: message.id, ok: response.ok, conflict: response.status === 409 }, origin); })
          .catch(() => { if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:analytics-result', version: 1, id: message.id, ok: false }, origin); })
          .finally(() => { clearTimeout(timeout); analyticsRequests.delete(message.id); });
      }
      if (message.type === 'weavour:template-cancel' && typeof message.id === 'string') {
        templateRequests.get(message.id)?.abort();
      }
      if (message.type === 'weavour:template-request' && configured && typeof message.id === 'string' && !templateRequests.has(message.id)) {
        if (!/^(?:templates|organization-blocks)(?:\/[a-zA-Z0-9-]+)?$/.test(message.path) || !['GET', 'POST', 'PATCH', 'DELETE'].includes(message.method) || templateRequests.size >= 8) return;
        if (config.enableOrganizationBlocks === false && message.path.startsWith('organization-blocks')) {
          post({ type: 'weavour:template-result', version: 1, id: message.id, error: 'organization_blocks_disabled' }, origin); return;
        }
        if (config.enableTemplates === false && message.path.startsWith('templates')) {
          post({ type: 'weavour:template-result', version: 1, id: message.id, error: 'templates_disabled' }, origin); return;
        }
        const controller = new AbortController(); templateRequests.set(message.id, controller);
        const timeout = setTimeout(() => controller.abort(), 20000);
        const endpoint = new URL(apiOrigin + '/editors/' + encodeURIComponent(config.editorKey) + '/' + message.path);
        endpoint.searchParams.set('userId', config.userId);
        if (config.organizationId !== undefined) endpoint.searchParams.set('organizationId', config.organizationId);
        for (const key of ['search', 'offset', 'collection', 'tag']) if (message.query && message.query[key] !== undefined) endpoint.searchParams.set(key, String(message.query[key]));
        fetch(endpoint.href, { method: message.method, credentials: 'omit', signal: controller.signal,
          headers: { 'X-Weavour-Document-Version': customSupport ? '3' : '2', ...(message.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(message.body === undefined ? {} : { body: JSON.stringify(message.body) })
        }).then(async response => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'templates_unavailable');
          assertCustomReader(result);
          if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:template-result', version: 1, id: message.id, result }, origin);
        }).catch(error => {
          if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:template-result', version: 1, id: message.id, error: error.message || 'templates_unavailable' }, origin);
        }).finally(() => { clearTimeout(timeout); if (templateRequests.get(message.id) === controller) templateRequests.delete(message.id); });
      }
      if (message.type === 'weavour:asset-request' && configured && typeof message.id === 'string' && !assetRequests.has(message.id)) {
        const routes = /^(assets|asset-folders|asset-imports)(?:\/[a-zA-Z0-9-]+(?:\/(?:complete|input))?)?$/;
        if (!routes.test(message.path) || !['GET', 'POST', 'PATCH', 'DELETE'].includes(message.method) || assetRequests.size >= 16) return;
        const controller = new AbortController(); assetRequests.set(message.id, controller);
        let timeout = setTimeout(() => controller.abort(), 45000);
        const call = async (path: string, method: string, body: unknown, query: Record<string, unknown> | undefined) => {
          const endpoint = new URL(apiOrigin + '/editors/' + encodeURIComponent(config.editorKey) + '/' + path);
          endpoint.searchParams.set('userId', config.userId);
          if (config.organizationId !== undefined) endpoint.searchParams.set('organizationId', config.organizationId);
          for (const key of ['search', 'folderId', 'archived', 'offset', 'page', 'locale']) if (query && query[key] !== undefined) endpoint.searchParams.set(key, String(query[key]));
          const response = await fetch(endpoint.href, { method, credentials: 'omit', signal: controller.signal,
            headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
          const result = await response.json();
          if (!response.ok) { throw new Error(result.error || 'library_unavailable'); }
          return result;
        };
        Promise.resolve().then(async () => {
          if (message.file !== undefined) throw new Error('iframe_upgrade_required');
          return call(message.path, message.method, message.body, message.query);
        }).then(result => {
          if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:asset-result', version: 1, id: message.id, result }, origin);
        }).catch(failure => {
          if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:asset-result', version: 1, id: message.id, error: failure.message || 'library_unavailable' }, origin);
        }).finally(() => { clearTimeout(timeout); if (assetRequests.get(message.id) === controller) assetRequests.delete(message.id); });
      }
      if (message.type === "weavour:timer-publish" && configured && typeof message.id === "string" &&
          message.settings && typeof message.settings === "object" && !timerRequests.has(message.id)) {
        if (timerRequests.size >= 10) return;
        const controller = new AbortController();
        timerRequests.set(message.id, controller);
        const timeout = setTimeout(() => controller.abort(), 15000);
        fetch(apiOrigin + '/editors/' + encodeURIComponent(config.editorKey) + '/timers/versions', {
          method: 'POST', credentials: 'omit', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: message.settings, userId: config.userId, organizationId: config.organizationId })
        }).then(async response => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Timer publishing failed.');
          if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:timer-result', version: 1, id: message.id, result }, origin);
        }).catch(error => {
          if (!destroyed && receivingGeneration === generation) post({ type: 'weavour:timer-result', version: 1, id: message.id, error: error.message || 'Retry timer publishing.' }, origin);
        }).finally(() => { clearTimeout(timeout); if (timerRequests.get(message.id) === controller) timerRequests.delete(message.id); });
      }
      if (message.type === 'weavour:export-result' && typeof message.id === 'string' && exports.has(message.id)) {
        const operation = exports.get(message.id)!; exports.delete(message.id); clearTimeout(operation.timeout);
        message.error ? operation.reject(new Error(message.error)) : operation.resolve(message.result);
      }
      if (message.type === "weavour:test-email" && configured && typeof message.id === "string" &&
          message.payload && typeof message.payload === "object" &&
          ["to", "subject", "html", "text"].every(key => typeof message.payload[key] === "string") && !testRequests.has(message.id)) {
        testRequests.add(message.id);
        Promise.resolve().then(() => {
          if (typeof options.onTestEmail !== "function") throw new Error("Test email delivery is unavailable.");
          return options.onTestEmail(message.payload);
        }).then(() => {
          if (!destroyed && receivingGeneration === generation) post({ type: "weavour:test-result", version: 1, id: message.id, ok: true }, origin);
        }).catch(() => {
          if (!destroyed && receivingGeneration === generation) post({ type: "weavour:test-result", version: 1, id: message.id, ok: false }, origin);
        });
      }
    }

    window.addEventListener("message", receive);
    iframe.addEventListener("load", initialize);
    iframe.src = url.href;
    // Also covers a frame that never finishes loading.
    timer = setTimeout(() => {
      const error = new EditorError('timeout', "Editor loading timed out."); rejectReady(error); destroy();
      options.onError?.(error);
    }, 15000);
    container.appendChild(iframe);
    mounted.add(container);
    function updateConfig(next: EditorConfig) {
      if (destroyed) throw new EditorError('destroyed', "This editor has been destroyed.");
      for (const key of settings.readiness === 'configured' ? [] : ['editorKey', 'userId', 'organizationId', 'document', 'emailDocument', 'draftId']) if (next && Object.hasOwn(next, key)) throw new TypeError(key + ' is mount-only.');
      if (!next || typeof next !== "object") throw new TypeError("Configuration is required.");
      if (demo) next = { ...next, displayConditions: [], enableAutosave: false, enableAi: false, enableTemplates: false, enableOrganizationBlocks: false, enableTestEmail: false,
        allowedBlocks: demoBlocks.filter(block => !(next.allowedBlocks ?? config.allowedBlocks) || (next.allowedBlocks ?? config.allowedBlocks).includes(block)) };
      validateMode(next.mode);
      // Validate the complete patch before mutating any retained configuration.
      for (const key of ['enableAnalytics', 'enableAutosave', 'enableOrganizationBlocks', 'enableEmailAudit', 'enableTestEmail', 'enableAi', 'enableTemplates'] as const) {
        if (next[key] !== undefined && typeof next[key] !== 'boolean') throw new TypeError(key + ' must be a boolean.');
      }
      if (Object.hasOwn(next, 'mergeTags') && next.mergeTags !== undefined) resolveMergeTags([], next.mergeTags);
      if (next.allowedBlocks !== undefined && (!Array.isArray(next.allowedBlocks) || next.allowedBlocks.some(block => typeof block !== 'string'))) throw new TypeError('allowedBlocks must be an array of block names.');
      if (next.locale !== undefined && typeof next.locale !== 'string') throw new TypeError('locale must be a string.');
      const nextConditions = Object.hasOwn(next, 'displayConditions') ? next.displayConditions === undefined ? undefined : parseDisplayConditions(next.displayConditions) : config.displayConditions;
      if (ready && nextConditions?.length && !conditionSupport) throw new EditorError('incompatible_editor', 'Upgrade the hosted editor to use display conditions.');
      for (const key of ['enableAnalytics','enableAi','enableTemplates','enableAutosave','enableOrganizationBlocks','enableEmailAudit','enableTestEmail'] as const) if (next[key] !== undefined && typeof next[key] !== 'boolean') throw new TypeError(key + ' must be a boolean.');
      const replacement = next.customBlocks === undefined ? undefined : customBlockDefinitions(demo ? [] : next.customBlocks);
      if (replacement && ready && !customSupport) throw new EditorError('incompatible_editor', 'Upgrade the hosted editor to use custom blocks.');
      const wireNext = { ...next, ...(replacement ? { customBlocks: replacement.registrations } : { customBlocks: config.customBlocks }) };
      if (!validMessage({ config: { ...config, ...wireNext, displayConditions: nextConditions } })) throw new TypeError('Editor configuration exceeds wire limits.');
      if (replacement) { cancelCustom(); customRegistry = replacement; registryGeneration++; config.customBlocks = replacement.registrations; config.customRegistryGeneration = registryGeneration; }
      if (Object.hasOwn(next, 'mode')) { config.mode = next.mode; modeChanged = true; }
      if (Object.hasOwn(next, 'displayConditions')) config.displayConditions = nextConditions;
      if (Object.hasOwn(next, 'mergeTags')) {
        if (next.mergeTags !== undefined) resolveMergeTags([], next.mergeTags);
        config.mergeTags = next.mergeTags === undefined ? undefined : parseMergeTags(next.mergeTags);
      }
      if (next.enableAutosave !== undefined && typeof next.enableAutosave !== 'boolean') throw new TypeError('enableAutosave must be a boolean.');
      if (next.enableAutosave !== undefined) {
        config.enableAutosave = next.enableAutosave;
        if (!config.enableAutosave) {
          autosaveEnabled = false; autosaveReady = false;
          for (const [id, operation] of flushes) { clearTimeout(operation.timeout); operation.reject(new EditorError('autosave_disabled', 'Autosave is disabled.')); flushes.delete(id); }
        }
      }
      if (next.enableOrganizationBlocks !== undefined && typeof next.enableOrganizationBlocks !== 'boolean') throw new TypeError('enableOrganizationBlocks must be a boolean.');
      if (next.enableOrganizationBlocks !== undefined) config.enableOrganizationBlocks = next.enableOrganizationBlocks;
      if (next.enableAnalytics !== undefined) { if (typeof next.enableAnalytics !== 'boolean') throw new TypeError('enableAnalytics must be a boolean.'); config.enableAnalytics = next.enableAnalytics; if (!next.enableAnalytics) { for (const controller of analyticsRequests.values()) controller.abort(); analyticsRequests.clear(); } }
      if (next.enableEmailAudit !== undefined && typeof next.enableEmailAudit !== 'boolean') throw new TypeError('enableEmailAudit must be a boolean.');
      if (next.enableEmailAudit !== undefined) config.enableEmailAudit = next.enableEmailAudit;
      if (next.enableTestEmail !== undefined && typeof next.enableTestEmail !== 'boolean') throw new TypeError('enableTestEmail must be a boolean.');
      if (next.enableTestEmail !== undefined) config.enableTestEmail = next.enableTestEmail;
      if (next.enableAi !== undefined && typeof next.enableAi !== 'boolean') throw new TypeError('enableAi must be a boolean.');
      if (next.enableAi !== undefined) config.enableAi = next.enableAi;
      if (next.enableTemplates !== undefined && typeof next.enableTemplates !== "boolean") throw new TypeError("enableTemplates must be a boolean.");
      if (next.allowedBlocks !== undefined && (!Array.isArray(next.allowedBlocks) || next.allowedBlocks.some(block => typeof block !== "string"))) throw new TypeError("allowedBlocks must be an array of block names.");
      if (next.enableTemplates !== undefined) config.enableTemplates = next.enableTemplates;
      if (next.allowedBlocks !== undefined) config.allowedBlocks = [...next.allowedBlocks];
      if (next.theme) {
        const switchingMode = (next.theme.mode === "light" || next.theme.mode === "dark") && next.theme.mode !== (config.theme.mode || "light");
        if (switchingMode) {
          const { cornerRadius, density, fontFamily } = config.theme;
          config.theme = { cornerRadius, density, fontFamily };
        }
        config.theme = { ...config.theme, ...structuredClone(next.theme) };
      }
      if (next.locale) config.locale = next.locale;
      if (ready) post({ type: "weavour:update-config", version: 1, config: { customBlocks: config.customBlocks, customRegistryGeneration: config.customRegistryGeneration, mode: config.mode, displayConditions: config.displayConditions, mergeTags: config.mergeTags, theme: config.theme, locale: config.locale, enableAi: config.enableAi, enableTemplates: config.enableTemplates, enableAutosave: config.enableAutosave, enableOrganizationBlocks: config.enableOrganizationBlocks, enableAnalytics: config.enableAnalytics, enableEmailAudit: config.enableEmailAudit, enableTestEmail: config.enableTestEmail, allowedBlocks: config.allowedBlocks } }, origin);
    }
    function exportHTML(previewOnly = false): Promise<any> {
      if (demo) return Promise.reject(new EditorError('demo_restricted', 'Export is disabled in demo mode.'));
      if (destroyed || !ready) return Promise.reject(new EditorError('not_ready', 'Editor is not ready.'));
      return new Promise<any>((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeout = setTimeout(() => { exports.delete(id); reject(new EditorError('timeout', 'Export timed out.')); }, 20000);
        exports.set(id, { resolve, reject, timeout });
        post({ type: 'weavour:export', version: 1, id, ...(previewOnly ? { previewOnly: true } : {}) }, origin);
      });
    }
    function flushAutosave(): Promise<DraftFlushResult> {
      if (destroyed || !ready) return Promise.reject(new EditorError('not_ready', 'Editor is not ready.'));
      if (!autosaveEnabled) return Promise.reject(new EditorError('autosave_disabled', 'Autosave is disabled.'));
      return new Promise<any>((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeout = setTimeout(() => { flushes.delete(id); reject(new EditorError('timeout', 'Autosave flush timed out.')); }, 45000);
        flushes.set(id, {resolve,reject,timeout,sent:autosaveReady});
        if (autosaveReady) post({type:'weavour:flush',version:1,id},origin);
      });
    }
    return Object.freeze({ get ready() { return readyPromise; }, destroy, updateConfig, flushAutosave, exportHTML: () => exportHTML(), previewTemplate: () => exportHTML(true) });
  }


  return Object.freeze({ mount });
}
