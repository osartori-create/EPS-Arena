// src/js/modules/escalade/escalade-tv-ui.js
import { getConfigData, getEscaladeData } from '../../core/live-engine.js';

export function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // FORCER LA VISIBILITÉ DU CONTENEUR ET DU PARENT
    container.style.display = 'block';
    container.style.height = '600px'; // Hauteur fixe en pixels
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b'; // Fond sombre visible
    container.style.overflow = 'hidden';
    container.style.position = 'relative';

    // Forcer aussi le parent (viewTV) à être visible
    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.classList.remove('hidden');
        tvView.style.display = 'block';
    }

    const config = getConfigData();
    const montees = getEscaladeData();

    if (!config) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
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
    Object.values(montees || {}).forEach(m => {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    });

    // 3. Trier
    equipes.sort((a, b) => b.score - a.score);

    // 4. Construire le HTML
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);
    let html = `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 600px;">`;

    // Bandes de montagne
    html += `<div style="position: absolute; bottom: 0; width: 100%; height: 150px; background: #334155;"></div>`;
    html += `<div style="position: absolute; bottom: 150px; width: 100%; height: 150px; background: #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 300px; width: 100%; height: 150px; background: #64748b;"></div>`;
    html += `<div style="position: absolute; bottom: 450px; width: 100%; height: 150px; background: #94a3b8;"></div>`;

    // Grimpeurs
    html += `<div style="position: absolute; bottom: 20px; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end;">`;
    equipes.forEach(eq => {
        const bottomPercent = Math.max((eq.score / maxScore) * 75, 5);
        html += `
            <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-${bottomPercent}%); transition: transform 0.5s ease;">
                <div style="font-size: 60px;">🧗</div>
                <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
                <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            </div>
        `;
    });
    html += `</div>`;

    container.innerHTML = html;
}

window.renderEscaladeTV = renderEscaladeTV;