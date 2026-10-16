// src/js/modules/scan-camera/index.js
// Enregistre le module Scan Caméra dans le registre central.
// L'interface prof est un onglet dédié (viewScanCamera) piloté par
// ui/prof/layout.js (chargement dynamique de scan-camera-interface.js).
import { registerModule } from '../registry.js';

function initProf() {
    console.log(`[Scan Caméra] Interface prof disponible dans l'onglet 📷 Scan Caméra.`);
}

function initKiosk(classe, code) {
    console.log(`[Scan Caméra] Kiosk élève — à lancer via l'URL : eleve.html?mode=scan-camera&prof=XXX&session=YYY`);
}

function cleanup() {
    // Le kiosk et l'interface possèdent leurs propres mécanismes de nettoyage.
    console.log('[Scan Caméra] Nettoyage');
}

registerModule({
    id: 'scancamera',
    label: '📷 Scan Caméra',
    icon: '📷',
    initProf,
    initKiosk,
    generateTeams: () => {},
    transmettre: () => {},
    renderLive: () => {},
    renderTV: () => {},
    isDefault: false,
    cleanup
});

export { initProf, initKiosk, cleanup };
export default { id: 'scancamera', label: '📷 Scan Caméra', initProf, initKiosk, cleanup };
