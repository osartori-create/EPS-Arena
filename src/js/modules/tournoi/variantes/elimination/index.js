// src/js/modules/tournoi/variantes/elimination/index.js

export * from './elimination-core.js';
export * from './elimination-kiosk.js';
export * from './elimination-prof.js';

// ✅ Exporter init pour le dispatcher (par défaut)
export { init as default } from './elimination-prof.js';