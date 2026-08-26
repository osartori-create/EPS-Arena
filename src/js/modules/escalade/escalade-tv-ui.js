// src/js/modules/escalade/escalade-tv-ui.js
import { getConfigData, getEscaladeData } from '../../core/live-engine.js';

export function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const config = getConfigData();
    const montees = getEscaladeData();

    // Si pas de config, afficher un message
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

    // 2. Calculer les scores totaux par équipe
    Object.values(montees || {}).forEach(m => {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    });

    // 3. Trier par score décroissant
    equipes.sort((a, b) => b.score - a.score);

    // 4. Trouver le score max pour les pourcentages
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);

    // 5. Générer le HTML (CSS simple en pourcentage)
    let html = `
    <div style="position: relative; width: 100%; height: 80vh; background: linear-gradient(to bottom, #1e293b, #0f172a); border-radius: 12px; overflow: hidden;">
        
        <!-- Fond de montagne (bandes) -->
        <div style="position: absolute; bottom: 0; width: 100%; height: 25%; background: #334155;"></div>
        <div style="position: absolute; bottom: 25%; width: 100%; height: 25%; background: #475569;"></div>
        <div style="position: absolute; bottom: 50%; width: 100%; height: 25%; background: #64748b;"></div>
        <div style="position: absolute; bottom: 75%; width: 100%; height: 25%; background: #94a3b8;"></div>

        <!-- Les grimpeurs -->
        <div style="position: absolute; bottom: 20px; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end;">
            ${equipes.map(eq => {
                // Pourcentage de montée = score / maxScore * 75% (pour laisser de la marge en haut)
                const bottomPercent = Math.max((eq.score / maxScore) * 75, 5);
                return `
                    <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-${bottomPercent}%); transition: transform 0.5s ease;">
                        <div style="font-size: 60px;">🧗</div>
                        <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
                        <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
                    </div>
                `;
            }).join('')}
        </div>
    </div>`;

    // 6. Appliquer le HTML
    container.innerHTML = html;
}

// Exposer pour appel direct
window.renderEscaladeTV = renderEscaladeTV;