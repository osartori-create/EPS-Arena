// src/js/ui/prof/live.js
import { initLiveEngine, getConfigData, getEscaladeData, getStudentsMap, getLocalMapping } from '../../core/live-engine.js';
import { renderEscaladeLive } from '../../modules/escalade/escalade-live.js';
import { renderCOLive } from '../../modules/co/co-live.js';
import { renderMultiLive } from '../../modules/multi/multi-live.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentClasse = "";

// Fonction pour rendre la TV directement dans ce module (100% fiable)
async function renderTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // Forcer les dimensions et l'affichage
    container.style.display = 'block';
    container.style.height = '600px';
    container.style.width = '100%';
    container.style.background = '#1e293b';
    container.style.overflow = 'hidden';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Identifier les équipes
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });

    // 2. Calculer les scores
    for (const m of Object.values(montees || {})) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    }

    // 3. Trier
    equipes.sort((a, b) => b.score - a.score);

    // 4. Générer le HTML (simple et robuste)
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);
    let html = `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 600px;">`;

    // Bandeaux de montagne
    html += `<div style="position: absolute; bottom: 0; width: 100%; height: 150px; background: #334155;"></div>`;
    html += `<div style="position: absolute; bottom: 150px; width: 100%; height: 150px; background: #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 300px; width: 100%; height: 150px; background: #64748b;"></div>`;
    html += `<div style="position: absolute; bottom: 450px; width: 100%; height: 150px; background: #94a3b8;"></div>`;

    // Grimpeurs
    html += `<div style="position: absolute; bottom: 20px; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end;">`;

    for (const eq of equipes) {
        const bottomPercent = Math.max((eq.score / maxScore) * 75, 5);
        html += `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-${bottomPercent}%); transition: transform 0.5s ease;">
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
        </div>`;
    }

    html += `</div></div>`;

    container.innerHTML = html;
}

// Exposer globalement pour être appelé par layout.js
window.renderEscaladeTV = renderTV;

export function initLiveUI() {
    initLiveEngine();

    // Écoute des mises à jour de données
    window.addEventListener('live-data-updated', (e) => {
        const { type, data } = e.detail;
        const currentActivite = getConfigData().activite || 'multi';

        if (type === 'escalade' && currentActivite === 'escalade') {
            renderEscaladeLive(data);
            // Mettre à jour la TV si elle est ouverte
            if (document.getElementById('tvGlobe')) {
                renderTV();
            }
        } else if (type === 'co' && currentActivite === 'co') {
            renderCOLive(data);
        } else if (type === 'multi' && currentActivite === 'multi') {
            renderMultiLive(data);
        }
    });

    // Écoute des changements de config
    window.addEventListener('live-config-updated', () => {
        document.getElementById('live-content').innerHTML = '<p class="text-slate-500 text-center">En attente des données...</p>';
        // Forcer le rendu TV
        if (document.getElementById('tvGlobe')) {
            renderTV();
        }
    });
}

// Fonction d'export CSV (complète et fonctionnelle)
window.exportResultsLive = function() {
    if (!currentClasse) {
        // On récupère la classe actuelle depuis le sélecteur
        currentClasse = document.getElementById('selectClasse').value;
    }
    if (!currentClasse) return alert("Sélectionnez une classe.");

    const studentsMap = getStudentsMap();
    const localMap = getLocalMapping();

    let csv = "\uFEFFNom;Type;Valeur\n";

    // Lecture des lignes du Live pour générer le CSV
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