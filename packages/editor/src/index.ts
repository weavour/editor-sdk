export { createSDK } from './core.js';
export { EditorError } from './errors.js';
export type { EditorErrorCode } from './errors.js';
export type * from './types.js';
import { createSDK } from './core.js';
export const mount = createSDK().mount;
