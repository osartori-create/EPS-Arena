// src/js/modules/demi-fond/index.js
// Registre du module 1/2 Fond + point d'entrée

import { registerModule } from '../registry.js';

function initProf(classe) {
    import('./demifond-interface.js').then(m => m.initDemiFondInterface());
}

function initKiosk(classe, code) {
    import('./demifond-kiosk.js').then(m => m.initDemiFondKiosk(classe));
}

async function generateTeams(classe) {
    const sousModule = localStorage.getItem('eps_arena_demifond_sous_module') || '3x5min';
    if (sousModule === 'enchainement') {
        const m = await import('./variantes/enchainement/enchainement-interface.js');
        if (m.initEnchainementInterface) { window.enchainementGenererGroupes?.(); }
    } else {
        const m = await import('./variantes/trois-cinq-min/trois-cinq-min-interface.js');
        if (m.troisCinqMinGenererGroupes) m.troisCinqMinGenererGroupes();
    }
}

async function transmettre(classe) {
    const sousModule = localStorage.getItem('eps_arena_demifond_sous_module') || '3x5min';
    if (sousModule === 'enchainement') {
        if (window.enchainementTransmettre) await window.enchainementTransmettre();
    } else {
        const m = await import('./variantes/trois-cinq-min/trois-cinq-min-interface.js');
        if (m.transmettreTroisCinqMin) await m.transmettreTroisCinqMin();
    }
}

function renderLive(classe) {
    return import('./demifond-live.js').then(m => m.renderDemiFondLive());
}

function renderTV(classe) {
    return import('./demifond-tv.js').then(m => m.renderDemiFondTV());
}

registerModule({
    id: 'demi-fond',
    label: '🏃 1/2 Fond',
    icon: '🏃',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV,
    isDefault: false,
    cleanup: () => {
        console.log('[DemiFond] Nettoyage');
    }
});

export default {
    id: 'demi-fond',
    label: '🏃 1/2 Fond',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV
};