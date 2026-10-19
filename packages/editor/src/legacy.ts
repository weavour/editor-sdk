import { createSDK } from './core.js';
const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src;
window.Weavour = createSDK({ scriptUrl, readiness: 'configured' });
