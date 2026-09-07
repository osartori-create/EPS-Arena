// src/js/ui/prof/live.js
import { getStudentsMap, getLocalMapping } from '../../core/live-engine.js';
import { exportIDoceo } from '../../services/export-idocéo.js';
import { exporterVersIDoceo } from '../../services/export-service.js';

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
    if (!activeClasse) {
        alert("Sélectionnez une classe.");
        return;
    }

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    if (eleves.length === 0) {
        alert("Aucun élève dans cette classe.");
        return;
    }

    // Récupérer les données du Live (passages CO)
    const sessionData = window.lastLiveSnap || {};
    
    // 1. Construire les données
    const donnees = eleves.map(e => {
        // Ignorer les absents/inaptes
        if (e.code === 'ABS' || e.code === 'INAPTE') {
            return {
                nom: `${e.prenom} ${e.nom}`.trim(),
                score: '',
                objectif: '',
                note: '',
                temps: '',
                tempsSec: 999999 // Pour le tri
            };
        }

        const code = e.code || e.id;
        let score = 0;
        let objectif = 0;
        let tempsSec = 0;

        // Récupérer les passages de l'élève
        const passages = sessionData[code] || {};
        Object.values(passages).forEach(circ => {
            score += circ.pts || 0;
            objectif += circ.total || 0;
            if (circ.time && circ.time > tempsSec) tempsSec = circ.time;
        });

        let note = "";
        if (objectif > 0) {
            note = ((score / objectif) * 20).toFixed(1).replace('.', ',');
        }

        let temps = "";
        if (tempsSec > 0) {
            const min = Math.floor(tempsSec / 60);
            const sec = tempsSec % 60;
            temps = `${min}:${sec < 10 ? '0' : ''}${sec}`;
        }

        return {
            nom: `${e.prenom} ${e.nom}`.trim(),
            score: score,
            objectif: objectif,
            note: note,
            temps: temps,
            tempsSec: tempsSec
        };
    });

    // 2. Trier : Score desc, puis Temps asc (les absents à la fin)
    donnees.sort((a, b) => {
        if (a.score === "" && b.score === "") return 0;
        if (a.score === "") return 1;
        if (b.score === "") return -1;
        if (b.score !== a.score) return b.score - a.score;
        return a.tempsSec - b.tempsSec;
    });

    // 3. Définir les colonnes (avec ! devant toutes les colonnes)
    const colonnes = [
        { nom: '!groupe', cle: 'rang' },
        { nom: '!Nom', cle: 'nom' },
        { nom: '!Score', cle: 'score' },
        { nom: '!Objectif', cle: 'objectif' },
        { nom: '!Note /20', cle: 'note' },
        { nom: '!Temps', cle: 'temps' }
    ];

    // 4. Ajouter le rang à chaque ligne
    donnees.forEach((ligne, index) => {
        ligne.rang = ligne.score !== "" ? (index + 1) : "";
    });

    // 5. Exporter via le service centralisé
    exporterVersIDoceo('CO', activeClasse, colonnes, donnees);
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