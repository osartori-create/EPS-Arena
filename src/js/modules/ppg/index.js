// src/js/modules/ppg/index.js
import { registerModule } from '../registry.js';

function initProf(classe) {
    import('./ppg-interface.js').then(m => m.initPPGInterface());
}

function initKiosk(classe, code) {
    // Batch 2
    import('./ppg-kiosk.js').then(m => m.initPPGKiosk(classe));
}

function transmettre(classe) {
    // Rien à transmettre côté kiosk : la séance du jour est lue en direct.
    // (Le prof valide la séance, elle est déjà dans Firebase.)
    alert('✅ La séance PPG est déjà disponible côté kiosk. Aucune action de transmission n\'est nécessaire.');
}

function renderLive(classe) {
    // Batch 2
    return Promise.resolve();
}

function renderTV(classe) {
    // Batch 3
    return Promise.resolve();
}

registerModule({
    id: 'ppg',
    label: '🏋️ PPG / Échauffement',
    icon: '🏋️',
    initProf,
    initKiosk,
    generateTeams: () => {},
    transmettre,
    renderLive,
    renderTV,
    isDefault: false,
    cleanup: () => {
        console.log('[PPG] Nettoyage');
    }
});

export default {
    id: 'ppg',
    label: '🏋️ PPG / Échauffement',
    initProf,
    initKiosk,
    transmettre,
    renderLive,
    renderTV
};