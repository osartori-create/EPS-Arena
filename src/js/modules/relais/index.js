// src/js/modules/relais/index.js
import { registerModule } from '../registry.js';

function initProf(classe) {
    import('./relais-interface.js').then(m => m.initRelaisInterface());
}

function initKiosk(classe, code) {
    import('./relais-kiosk.js').then(m => m.initRelaisKiosk(classe, code));
}

async function generateTeams(classe) {
    const m = await import('./relais-interface.js');
    if (m.relaisGenererGroupes) m.relaisGenererGroupes();
}

async function transmettre(classe) {
    const m = await import('./relais-interface.js');
    if (m.transmettreRelaisConfig) await m.transmettreRelaisConfig();
}

function renderLive(classe) {
    return import('./relais-live.js').then(m => m.renderRelaisLive());
}

function renderTV(classe) {
    return import('./relais-tv.js').then(m => m.renderRelaisTV());
}

registerModule({
    id: 'relais',
    label: '🏁 Relais',
    icon: '🏁',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV,
    isDefault: false,
    cleanup: () => {
        console.log('[Relais] Nettoyage');
    }
});

export default {
    id: 'relais',
    label: '🏁 Relais',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV
};