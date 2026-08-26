// src/js/ui/prof/live.js
import { initLiveEngine, getConfigData } from '../../core/live-engine.js';
import { renderEscaladeLive } from '../../modules/escalade/escalade-live.js';
import { renderCOLive } from '../../modules/co/co-live.js';
import { renderMultiLive } from '../../modules/multi/multi-live.js';

export function initLiveUI() {
    initLiveEngine();

    // Écoute des mises à jour de données
    window.addEventListener('live-data-updated', (e) => {
        const { type, data } = e.detail;
        if (type === 'escalade') renderEscaladeLive(data);
        else if (type === 'co') renderCOLive(data);
        else if (type === 'multi') renderMultiLive(data);
    });

    // Écoute des changements de config (pour réafficher si besoin)
    window.addEventListener('live-config-updated', () => {
        const config = getConfigData();
        // On peut réinitialiser ou re-rendre selon l'activité active
        // Pour l'instant, on ne fait rien de spécial, mais on pourrait vider l'affichage
        document.getElementById('live-content').innerHTML = '<p class="text-slate-500 text-center">En attente des données...</p>';
    });
}

// Export CSV
window.exportResultsLive = function() {
    if (!currentClasse) return alert("Sélectionnez une classe.");

    const studentsMap = getStudentsMap();
    const localMap = getLocalMapping();

    let csv = "\uFEFFNom;Type;Valeur\n";

    // On lit le DOM pour exporter les données déjà affichées
    const rows = document.querySelectorAll('#live-content .bg-slate-800');
    rows.forEach(row => {
        const nameSpan = row.querySelector('.text-white');
        const valueSpan = row.querySelector('span:last-child');

        const name = nameSpan ? nameSpan.innerText : '';
        const value = valueSpan ? valueSpan.innerText : '';

        // On tente de retrouver le code depuis le nom (si mapping dispo)
        // Ceci est une simplification, le mieux est de stocker les données brutes en mémoire.
        // Pour l'instant on exporte ce qui est visible.
        csv += `${name};Performance;${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Live_${currentClasse}.csv`;
    a.click();
};