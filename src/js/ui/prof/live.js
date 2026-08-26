// src/js/ui/prof/live.js
import { initLiveEngine, getConfigData } from '../../core/live-engine.js';
import { renderEscaladeLive } from '../../modules/escalade/escalade-live.js';
import { renderCOLive } from '../../modules/co/co-live.js';
import { renderMultiLive } from '../../modules/multi/multi-live.js';
import { renderEscaladeTV } from '../../modules/escalade/escalade-tv-ui.js';

export function initLiveUI() {
    initLiveEngine();

    // Écoute des mises à jour de données
    window.addEventListener('live-data-updated', (e) => {
        const { type, data } = e.detail;
        
        // On vérifie l'activité actuellement configurée pour le Prof
        const currentActivite = getConfigData().activite || 'multi';

        // On n'affiche que les données de l'activité active, on ignore les autres
        if (type === 'escalade' && currentActivite === 'escalade') {
            renderEscaladeLive(data);
        } else if (type === 'co' && currentActivite === 'co') {
            renderCOLive(data);
        } else if (type === 'multi' && currentActivite === 'multi') {
            renderMultiLive(data);
        }
        // 🆕 Mise à jour du grand globe (TV) si on est en escalade
        if (type === 'escalade' && currentActivite === 'escalade') {
            renderEscaladeTV();
    });

    // Écoute des changements de config (pour changer de rendu ou vider)
    window.addEventListener('live-config-updated', () => {
        // On vide le contenu pour repartir sur une base propre
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