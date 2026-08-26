import { getConfigData, getEscaladeData, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // FORCER la visibilité et la hauteur
    container.style.display = 'block';
    container.style.height = '600px';
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Créer les équipes
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });

    // 2. Calculer les scores et préparer les membres avec photos
    const monteesList = Object.values(montees || {});
    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) {
            equipe.score += (m.points || 0);
        }
    }

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

    // Grimpeurs + Têtes
    html += `<div style="position: absolute; bottom: 20px; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end;">`;

    for (const eq of equipes) {
        const bottomPercent = Math.max((eq.score / maxScore) * 75, 5);

        // Récupérer les photos des membres de cette équipe
        let photosHtml = '';
        const membres = monteesList.filter(m => m.groupe === eq.lettre);
        const membresGroupes = {}; // Regrouper par rôle pour éviter les doublons
        membres.forEach(m => {
            if (!membresGroupes[m.role]) membresGroupes[m.role] = 0;
            membresGroupes[m.role] += (m.points || 0);
        });

        for (const role in membresGroupes) {
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

        html += `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-${bottomPercent}%); transition: transform 0.5s ease;">
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            <div style="display: flex; flex-direction: column; align-items: center; margin-top: 10px; gap: 5px;">
                ${photosHtml}
            </div>
        </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

// Exposer pour appel global
window.renderEscaladeTV = renderEscaladeTV;