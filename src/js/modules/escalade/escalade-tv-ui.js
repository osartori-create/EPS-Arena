import { getConfigData, getEscaladeData, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // 1. FORCER LES DIMENSIONS (En pixels, fiable à 100%)
    container.style.display = 'block';
    container.style.height = '600px';
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
        return;
    }

    // 2. Créer les équipes
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });

    // 3. Calculer les scores
    const monteesList = Object.values(montees || {});
    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    }

    // 4. Trier par score décroissant
    equipes.sort((a, b) => b.score - a.score);

    // 5. Construire le podium avec des positions TOP en PIXELS
    let html = `<div style="position: absolute; top: 0; left: 0; right: 0; height: 100%;">`;

    // Bande de fond simple
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 100px; background: #334155; border-radius: 0 0 16px 16px;"></div>`;

    // 6. Disposition en colonne verticale (top: 50px, 200px, 350px...)
    const positions = [50, 180, 310, 440, 570]; // on espace de 130px en 130px

    for (let i = 0; i < equipes.length; i++) {
        const eq = equipes[i];
        const topPos = positions[i] || 50 + (i * 130);

        // Générer les photos des membres (triées par points)
        let photosHtml = '';
        const membresGroupes = {};
        monteesList.forEach(m => {
            if (m.groupe === eq.lettre) {
                if (!membresGroupes[m.role]) membresGroupes[m.role] = 0;
                membresGroupes[m.role] += (m.points || 0);
            }
        });

        const rolesTries = Object.keys(membresGroupes).sort((a, b) => membresGroupes[b] - membresGroupes[a]);

        for (const role of rolesTries) {
            if (membresGroupes[role] > 0) {
                const index = parseInt(role) - 1;
                const eleveId = localMapping[eq.lettre] ? localMapping[eq.lettre][index] : null;
                if (eleveId) {
                    try {
                        const url = await getPhotoUrl(eleveId);
                        if (url) {
                            photosHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${url}'); background-size: cover; border: 2px solid #3b82f6; margin-bottom: 5px;"></div>`;
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        }

        // Générer le bloc équipe
        html += `
        <div style="position: absolute; top: ${topPos}px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; transition: top 0.5s ease;">
            <div style="font-size: 50px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 28px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            <div style="display: flex; flex-direction: column; align-items: center; margin-top: 10px; gap: 5px;">
                ${photosHtml}
            </div>
        </div>`;
    }

    html += `</div>`;

    container.innerHTML = html;
}

window.renderEscaladeTV = renderEscaladeTV;