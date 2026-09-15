// src/js/modules/cross/index.js
import { registerModule } from '../registry.js';

function initProf(classe) {
    import('./cross-interface.js').then(m => m.initCrossInterface());
}

function initKiosk(classe, code) {
    // Sera ajouté à l'étape 4 (kiosk podium)
}

async function transmettre(classe) {
    alert('Transmission cross : à venir (étape 3).');
}

function renderLive(classe) {
    // à venir
}

function renderTV(classe) {
    // à venir
}

registerModule({
    id: 'cross',
    label: '🏃 Cross',
    icon: '🏃',
    initProf,
    initKiosk,
    generateTeams: () => {},
    transmettre,
    renderLive,
    renderTV,
    isDefault: false,
    cleanup: () => { console.log('[Cross] Nettoyage'); }
});

export default { id: 'cross', label: '🏃 Cross', initProf, initKiosk, transmettre, renderLive, renderTV };