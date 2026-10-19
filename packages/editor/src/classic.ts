import { createSDK } from './core.js';
import type { EditorSDK } from './types.js';
declare global { interface Window { Weavour?: EditorSDK } }
const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src;
window.Weavour = createSDK({ scriptUrl });
