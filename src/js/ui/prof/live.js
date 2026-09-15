// src/js/ui/prof/live.js
import { getStudentsMap, getLocalMapping } from '../../core/live-engine.js';
import { exportIDoceo } from '../../services/export-idocéo.js';
import { exporterVersIDoceo } from '../../services/export-service.js';
import { colonnesIdentite, col, exporterVersIDoceo as exporterService } from '../../services/export-service.js';

let currentClasse = "";

export function renderLive(discipline) {
    const container = document.getElementById('live-content');
    if (!container) return;

    const activeClasse = document.getElementById('selectClasse').value;
    currentClasse = activeClasse;

    container.innerHTML = '<p class="text-slate-500 text-center">Chargement du Live...</p>';

    // Détruit l'ancien écouteur si besoin
    if (window.currentLiveUnsub) {
        window.currentLiveUnsub();
        window.currentLiveUnsub = null;
    }

    // ROUTAGE SPÉCIFIQUE PAR DISCIPLINE
    switch (discipline) {
        case 'badminton':
            import('../../modules/badminton/badminton-live.js')
                .then(module => {
                    if (module.renderBadmintonLive) {
                        module.renderBadmintonLive();
                    } else {
                        container.innerHTML = '<p class="text-red-400">Erreur : module badminton non trouvé.</p>';
                    }
                })
                .catch(err => console.error("Erreur Live Badminton :", err));
            break;

        case 'escalade':
            import('../../modules/escalade/escalade-live.js')
                .then(module => {
                    const data = window.lastLiveData || {};
                    if (module.renderEscaladeLive) {
                        module.renderEscaladeLive(data);
                    }
                })
                .catch(err => console.error("Erreur Live Escalade :", err));
            break;

        case 'co':
            import('../../modules/co/co-live.js')
                .then(module => {
                    const data = window.lastLiveData || {};
                    if (module.renderCOLive) {
                        module.renderCOLive(data);
                    }
                })
                .catch(err => console.error("Erreur Live CO :", err));
            break;

        case 'orientshow':
            import('../../modules/orientshow/orientshow-live.js')
                .then(module => {
                    if (module.renderOrientShowLive) {
                        module.renderOrientShowLive();
                    }
                })
                .catch(err => console.error("Erreur Live OrientShow :", err));
            break;

        case 'multi':
            import('../../modules/multi/multi-live.js')
                .then(module => {
                    const data = window.lastLiveData || {};
                    if (module.renderMultiLive) {
                        module.renderMultiLive(data);
                    }
                })
                .catch(err => console.error("Erreur Live Multi :", err));
            break;

        default:
            container.innerHTML = '<p class="text-red-400">Aucun module Live pour cette discipline.</p>';
    }
}

// ============================================================
// EXPORT iDoceo (CO) - via service centralisé
// ============================================================
window.exportCOiDoceo = function() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert('Sélectionnez une classe.');

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    if (eleves.length === 0) return alert('Aucun élève dans cette classe.');

    const sessionData = window.lastLiveSnap || {};

    const lignes = eleves
        .filter(e => e.code !== 'ABS' && e.code !== 'INAPTE')
        .map(e => {
            const code = e.code || e.id;
            let score = 0, objectif = 0, tempsSec = 0;

            const passages = sessionData[code] || {};
            Object.values(passages).forEach(circ => {
                score += circ.pts || 0;
                objectif += circ.total || 0;
                if (circ.time && circ.time > tempsSec) tempsSec = circ.time;
            });

            const note = objectif > 0 ? ((score / objectif) * 20).toFixed(1).replace('.', ',') : '';
            const temps = tempsSec > 0
                ? `${Math.floor(tempsSec / 60)}:${String(tempsSec % 60).padStart(2, '0')}`
                : '';

            return {
                nom: e.nom || '',
                prenom: e.prenom || '',
                donnees: { score, objectif, note, temps }
            };
        });

    // Tri par score décroissant pour que le classement soit lisible
    lignes.sort((a, b) => (b.donnees.score || 0) - (a.donnees.score || 0));

    const colonnesDonnees = [
        col('Score', 'score'),
        col('Objectif', 'objectif'),
        col('Note /20', 'note'),
        col('Temps total', 'temps')
    ];

    const donnees = lignes.map(l => ({ nom: l.nom, prenom: l.prenom, ...l.donnees }));
    exporterService('CO', activeClasse, [...colonnesIdentite(), ...colonnesDonnees], donnees);
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