// src/js/modules/demi-fond/variantes/enchainement/index.js
// Export standardisé du sous-module "Enchaînement" (séries à durées variables).

export { initEnchainementInterface } from './enchainement-interface.js';
export { initEnchainementKiosk, cleanupEnchainementKiosk } from './enchainement-kiosk.js';
export { renderEnchainementLive } from './enchainement-live.js';
export { renderEnchainementTV } from './enchainement-tv.js';
export { chargerObservations, calculerBilan, rendreBilanHTML } from './enchainement-bilan.js';