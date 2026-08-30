// src/js/ui/prof/live.js
import { getConfigData } from '../../core/live-engine.js';
import { getStudentsMap, getLocalMapping } from '../../core/live-engine.js'; // Pour exports

let currentClasse = "";

// Fonction principale appelée par le sous-onglet "Live" (via activities.js)
export function renderLive(discipline) {
    const container = document.getElementById('live-content');
    if (!container) return;

    const activeClasse = document.getElementById('selectClasse').value;
    currentClasse = activeClasse;

    // On vide le conteneur avant chargement pour éviter les résidus
    container.innerHTML = '<p class="text-slate-500 text-center">Chargement du Live...</p>';

    // Réinitialiser l'ancien écouteur si un module précédent tournait (via un flag global)
    if (window.currentLiveUnsub) {
        window.currentLiveUnsub();
        window.currentLiveUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';

    // ROUTAGE DYNAMIQUE (on utilise le nom de la discipline pour charger le bon module)
    import(`../../modules/${discipline}/${discipline}-live.js`)
        .then(module => {
            if (typeof module.renderLive === 'function') {
                module.renderLive(); // Les modules ont leur propre écouteur interne
            } else if (typeof module.renderDefault === 'function') {
                module.renderDefault(container);
            } else {
                container.innerHTML = '<p class="text-red-400">Module Live non trouvé pour cette discipline.</p>';
            }
        })
        .catch(err => {
            console.error("Erreur chargement Live :", err);
            // Fallback pour les activités n'ayant pas encore de module dédié (Multi, etc.)
            if (discipline === 'multi' || discipline === 'sprint' || discipline === 'poursuite') {
                container.innerHTML = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">⏱️ Résultats ${discipline}</h3><div class="space-y-2">En attente des données élèves...</div>`;
            } else {
                container.innerHTML = '<p class="text-red-400">Erreur : module Live non chargé. Vérifiez la console.</p>';
            }
        });
}

// --- ANCIENNES FONCTIONS D'EXPORT CONSERVÉES ---

window.exportCOiDoceo = function() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe.");
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    if (eleves.length === 0) return alert("Aucun élève.");
    const sessionData = window.lastLiveSnap || {}; 
    const results = {};
    eleves.forEach(e => {
        const code = e.code;
        if (!code || code === 'ABS' || code === 'INAPTE') return;
        let score = 0;
        let max = 0;
        let temps = 0;
        Object.values(sessionData[code] || {}).forEach(circ => {
            score += circ.pts || 0;
            max += circ.total || 0;
            if (circ.time && circ.time > temps) temps = circ.time;
        });
        results[code] = { points: score, objectif: max, time: temps };
    });
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

// (Import nécessaire pour l'export)
import { exportIDoceo } from '../../services/export-idocéo.js';