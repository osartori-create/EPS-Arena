// src/js/modules/tournoi/variantes/elimination/index.js
export * from './elimination-core.js';
export * from './elimination-kiosk.js';
export * from './elimination-prof.js';

// ✅ Export explicite de init (kiosk) pour le dispatcher
export { init as default } from './elimination-kiosk.js';