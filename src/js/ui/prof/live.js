// src/js/ui/prof/live.js
import { initLiveEngine, getConfigData, getStudentsMap, getLocalMapping } from '../../core/live-engine.js';
import { renderEscaladeLive } from '../../modules/escalade/escalade-live.js';
import { renderCOLive } from '../../modules/co/co-live.js';
import { renderMultiLive } from '../../modules/multi/multi-live.js';
import { renderEscaladeTV } from '../../modules/escalade/escalade-tv-ui.js';
import { renderOrientShowLive } from '../../modules/orientshow/orientshow-live.js';
// ✅ IMPORT STATIQUE DU MODULE BADMINTON
import { renderBadmintonLive } from '../../modules/badminton/badminton-live.js';
import { exportIDoceo } from '../../services/export-idocéo.js';

let currentClasse = "";

export function initLiveUI() {
    initLiveEngine();

    window.addEventListener('live-data-updated', (e) => {
        const { type, data } = e.detail;
        const currentActivite = getConfigData().activite || 'multi';

        if (type === 'escalade' && currentActivite === 'escalade') {
            renderEscaladeLive(data);
            if (isTVVisible()) renderEscaladeTV();
        } else if (type === 'co' && currentActivite === 'co') {
            renderCOLive(data);
        } else if (type === 'multi' && currentActivite === 'multi') {
            renderMultiLive(data);
        } else if (type === 'orientshow' && currentActivite === 'orientshow') {
            renderOrientShowLive();
        } else if (type === 'badminton' && currentActivite === 'badminton') {
            // On appelle le module qui gère son propre écouteur Firebase
            renderBadmintonLive();
        }
    });

    // ✅ CRUCIAL : Ceci permet d'afficher le Live Badminton dès que la config est chargée
    // ou lorsque l'on clique sur l'onglet Live.
    window.addEventListener('live-config-updated', () => {
        const currentActivite = getConfigData().activite || 'multi';
        
        if (currentActivite === 'badminton') {
            // On lance le rendu Badminton directement
            renderBadmintonLive();
        } else {
            document.getElementById('live-content').innerHTML = '<p class="text-slate-500 text-center">En attente des données...</p>';
            if (isTVVisible() && currentActivite === 'escalade') renderEscaladeTV();
        }
    });
}

function isTVVisible() {
    const tvView = document.getElementById('viewTV');
    return tvView && !tvView.classList.contains('hidden');
}

// Export du CSV Badminton (pour le bouton HTML)
window.exportBadmintonImpactCSV = function() {
    // On délègue simplement au module Badminton qui a accès à toutes les données
    import('../../modules/badminton/badminton-live.js').then(module => {
        if (module.exportBadmintonImpactCSV) {
            module.exportBadmintonImpactCSV();
        } else {
            alert("Fonction d'export Badminton non trouvée dans le module.");
        }
    });
};

window.exportCOiDoceo = function() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    // 1. Récupérer les élèves (avec leurs codes d'équipe)
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    if (eleves.length === 0) return alert("Aucun élève.");

    // 2. Récupérer les données de la CO depuis Firebase (ou depuis votre état local)
    const sessionData = window.lastLiveSnap || {}; 
    
    // On prépare un objet "results" pour le module d'export
    const results = {};
    eleves.forEach(e => {
        const code = e.code; // Ex: "A1"
        if (!code || code === 'ABS' || code === 'INAPTE') return;

        let score = 0;
        let max = 0;
        let temps = 0;

        // On parcourt les circuits validés pour cet élève
        Object.values(sessionData[code] || {}).forEach(circ => {
            score += circ.pts || 0;
            max += circ.total || 0;
            if (circ.time && circ.time > temps) temps = circ.time;
        });

        results[code] = { points: score, objectif: max, time: temps };
    });

    // 3. Appeler le module d'export
    exportIDoceo({
        students: eleves,
        results: results,
        className: activeClasse,
        activityName: "CO"
    });
};

window.exportResultsLive = function() {
    if (!currentClasse) {
        currentClasse = document.getElementById('selectClasse').value;
    }
    if (!currentClasse) return alert("Sélectionnez une classe.");

    const studentsMap = getStudentsMap();
    const localMap = getLocalMapping();

    let csv = "\uFEFFNom;Type;Valeur\n";

    const rows = document.querySelectorAll('#live-content .bg-slate-800');
    rows.forEach(row => {
        const nameSpan = row.querySelector('.text-white');
        const valueSpan = row.querySelector('span:last-child');
        const name = nameSpan ? nameSpan.innerText : '';
        const value = valueSpan ? valueSpan.innerText : '';
        csv += `${name};Performance;${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Live_${currentClasse}.csv`;
    a.click();
};