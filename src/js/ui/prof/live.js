import { initLiveEngine, getConfigData, getStudentsMap, getLocalMapping } from '../../core/live-engine.js';
import { renderEscaladeLive } from '../../modules/escalade/escalade-live.js';
import { renderCOLive } from '../../modules/co/co-live.js';
import { renderMultiLive } from '../../modules/multi/multi-live.js';
import { renderEscaladeTV } from '../../modules/escalade/escalade-tv-ui.js';

let currentClasse = ""; // Pour l'export

export function initLiveUI() {
    initLiveEngine();

    // Écoute des mises à jour de données
    window.addEventListener('live-data-updated', (e) => {
        const { type, data } = e.detail;

        // Affichage selon le type de données (sans se soucier de la config actuelle)
        if (type === 'escalade') {
            renderEscaladeLive(data);
            renderEscaladeTV(); // On affiche toujours la TV si des données escalade arrivent
        } else if (type === 'co') {
            renderCOLive(data);
        } else if (type === 'multi') {
            renderMultiLive(data);
        }
    });

    // Écoute des changements de config
    window.addEventListener('live-config-updated', () => {
        document.getElementById('live-content').innerHTML = '<p class="text-slate-500 text-center">En attente des données...</p>';
        renderEscaladeTV(); // On force le rendu TV à chaque changement de config
    });

    // Forcer le premier rendu après 500ms (le temps que la config se charge)
    setTimeout(() => {
        renderEscaladeTV();
    }, 500);
}

// Export CSV (inchangé)
window.exportResultsLive = function() {
    // ... (code existant)
};