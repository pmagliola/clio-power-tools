// Chrome MV3 has native browser API — no polyfill needed.
// ExtPay uses `import * as browser` so we export named properties
// matching the webextension-polyfill namespace shape.
const b = globalThis.browser ?? globalThis.chrome;
export const storage = b?.storage;
export const runtime = b?.runtime;
export const windows = b?.windows;
export const tabs = b?.tabs;
export const management = b?.management;
export default b;
