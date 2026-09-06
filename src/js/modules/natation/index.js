// src/js/modules/natation/index.js
import { registerModule } from '../registry.js';
import { initNatationInterface, transmettreNatationConfig, exportNatationConfig, importNatationConfig } from './natation-interface.js';
import { initNatationKiosk } from './natation-kiosk.js';
import { renderNatationLive } from './natation-live.js';
import { renderNatationTV } from './natation-tv.js';

function initProf(classe) {
    initNatationInterface();
}

function initKiosk(classe, code) {
    // Dans ce module, on n'utilise pas le code passé, on demandera le numéro dans le kiosk
    initNatationKiosk(classe);
}

async function transmettre(classe) {
    transmettreNatationConfig();
}

function renderLive(classe) {
    renderNatationLive();
}

function renderTV(classe) {
    renderNatationTV();
}

registerModule({
    id: 'natation',
    label: '🏊 Natation',
    icon: '🏊',
    initProf,
    initKiosk,
    generateTeams: () => {}, // pas nécessaire
    transmettre,
    renderLive,
    renderTV,
    isDefault: false
});

export {
    initNatationInterface,
    transmettreNatationConfig,
    exportNatationConfig,
    importNatationConfig,
    initNatationKiosk,
    renderNatationLive,
    renderNatationTV
};