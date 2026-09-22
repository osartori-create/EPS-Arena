// src/js/modules/cross/index.js
// Enregistre le module Cross dans le registre central.
// L'interface prof est un onglet dédié (viewCross) piloté par ui/prof/layout.js,
// mais on l'enregistre pour que getModule('cross') reste cohérent avec les
// autres disciplines.
import { registerModule } from '../registry.js';
import { initCrossInterface } from './cross-interface.js';
import { transmettreCrossConfig } from './cross-transmit.js';

function initProf() {
    initCrossInterface();
}

async function transmettre() {
    return transmettreCrossConfig();
}

function cleanup() {
    // Cross ne pose pas de listener permanent au niveau module.
    console.log('[Cross] Nettoyage');
}

registerModule({
    id: 'cross',
    label: '🏃 Cross',
    icon: '🏃',
    initProf,
    initKiosk: () => {},
    generateTeams: () => {},
    transmettre,
    renderLive: () => {},
    renderTV: () => {},
    isDefault: false,
    cleanup
});

export { initProf, transmettre, cleanup };
export default { id: 'cross', label: '🏃 Cross', initProf, transmettre, cleanup };