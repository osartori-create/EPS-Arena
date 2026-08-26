import { getConfigData, getEscaladeData } from '../../core/live-engine.js';

export function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // FORCER l'affichage du panneau parent au cas où il serait caché
    const tvView = document.getElementById('viewTV');
    if (tvView && tvView.classList.contains('hidden')) {
        tvView.classList.remove('hidden');
    }

    const config = getConfigData();
    const montees = getEscaladeData();

    if (!config) {
        container.innerHTML = '<p class="text-slate-500 text-center mt-20">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Identifier les équipes (A, B, C...)
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });

    // 2. Calculer le total de points par équipe
    Object.values(montees || {}).forEach(m => {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    });

    // 3. Trier par score décroissant
    equipes.sort((a, b) => b.score - a.score);

    // 4. Construire la montagne (CSS INLINE - FIABLE À 100%)
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);
    const baseHeight = 500; // Hauteur fixe du globe

    let html = `<div style="width: 100%; height: ${baseHeight}px; position: relative; background: #1e293b; border-radius: 16px; overflow: hidden;">`;

    // Bandeaux de montagne (arrière-plan) - dimensions fixes en pourcentage
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 25%; background: #334155;"></div>`;
    html += `<div style="position: absolute; bottom: 25%; left: 0; right: 0; height: 25%; background: #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 50%; left: 0; right: 0; height: 25%; background: #64748b;"></div>`;
    html += `<div style="position: absolute; bottom: 75%; left: 0; right: 0; height: 25%; background: #94a3b8;"></div>`;

    // Grimpeurs (équipes) - basé sur des translations en pixels
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: 20px;">`;
    equipes.forEach(eq => {
        const height = Math.max((eq.score / maxScore) * (baseHeight - 100), 40); // Minimum 40px
        html += `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-${height}px); transition: transform 1s ease;">
            <div style="font-size: 70px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 40px; font-weight: 900; padding: 8px 20px; border-radius: 12px; margin-top: 10px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 32px; font-weight: 900; margin-top: 6px;">${eq.score.toFixed(0)} m</div>
        </div>`;
    });
    html += `</div></div>`;

    container.innerHTML = html;
}

// Exposer globalement pour pouvoir être appelé directement
window.renderEscaladeTV = renderEscaladeTV;