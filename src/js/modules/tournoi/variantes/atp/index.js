// src/js/modules/tournoi/variantes/atp/index.js
export * from './atp-core.js';
export { initProf, cleanup as cleanupProf } from './atp-prof.js';
export { init, cleanup as cleanupKiosk } from './atp-kiosk.js';
export { renderLive } from './atp-live.js';
export { renderTV } from './atp-tv.js';

// Point d'entrée par défaut pour le dispatcher (mode kiosk)
export { init as default } from './atp-kiosk.js';