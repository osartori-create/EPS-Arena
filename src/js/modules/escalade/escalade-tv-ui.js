import { getConfigData, getEscaladeData, getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // 1. Préparer le conteneur (comme dans eleve.html)
    container.style.display = 'block';
    container.style.height = '80vh'; // Hauteur responsive (80% de l'écran)
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';
    container.style.position = 'relative'; // Crucial pour le positionnement absolu

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();
    const currentClasse = getCurrentClasse();

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
        return;
    }

    // 2. Créer les équipes et calculer les scores
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });

    const monteesList = Object.values(montees || {});
    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    }

    // 3. Garder uniquement les groupes avec un score > 0
    const equipesAvecScore = equipes.filter(eq => eq.score > 0);
    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente des performances...</p>';
        return;
    }

    // 4. Trouver le score maximum (pour la hauteur) et trier
    const maxScore = Math.max(...equipesAvecScore.map(eq => eq.score), 1);
    equipesAvecScore.sort((a, b) => b.score - a.score);

    // 5. Construire le HTML (STRUCTURE IDENTIQUE À ELEVE.HTML)
    let html = `<div style="position: relative; width: 100%; height: 100%;">`;

    // Bandes de montagne
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 25%; background: #334155;"></div>`;
    html += `<div style="position: absolute; bottom: 25%; left: 0; right: 0; height: 25%; background: #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 50%; left: 0; right: 0; height: 25%; background: #64748b;"></div>`;
    html += `<div style="position: absolute; bottom: 75%; left: 0; right: 0; height: 25%; background: #94a3b8;"></div>`;

    // Conteneur des grimpeurs (alignés en bas et répartis)
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: 20px;">`;

    // 6. Boucle sur les équipes (triées par score)
    for (const eq of equipesAvecScore) {
        // Calcul de la hauteur (exactement comme eleve.html : maximum 75%, minimum 5%)
        const height = Math.max((eq.score / maxScore) * 75, 5);

        // Récupérer les membres et leurs points
        const membresGroupes = {};
        monteesList.forEach(m => {
            if (m.groupe === eq.lettre) {
                if (!membresGroupes[m.role]) membresGroupes[m.role] = 0;
                membresGroupes[m.role] += (m.points || 0);
            }
        });

        const rolesTries = Object.keys(membresGroupes).sort((a, b) => membresGroupes[b] - membresGroupes[a]);

        // Charger les photos
        let photosHtml = '<div style="display: flex; flex-direction: row; gap: 5px; margin-top: 10px;">';
        for (const role of rolesTries) {
            const index = parseInt(role) - 1;
            const mappingKey = `${currentClasse}_${eq.lettre}`;
            let eleveId = null;
            if (localMapping[mappingKey] && Array.isArray(localMapping[mappingKey])) {
                eleveId = localMapping[mappingKey][index];
            } else if (localMapping[`${currentClasse}_${eq.lettre}${role}`]) {
                eleveId = localMapping[`${currentClasse}_${eq.lettre}${role}`];
            }

            let photoUrl = null;
            if (eleveId) {
                try {
                    photoUrl = await getPhotoUrl(eleveId);
                } catch (e) { /* ignore */ }
            }

            if (photoUrl) {
                photosHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 2px solid #3b82f6;"></div>`;
            } else {
                photosHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 18px;">👤</div>`;
            }
        }
        photosHtml += '</div>';

        // Assembler le bloc (utilise translateY comme eleve.html)
        html += `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-${height}%); transition: transform 0.5s ease;">
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            ${photosHtml}
        </div>`;
    }

    html += `</div></div>`;
    
    container.innerHTML = html;
}

window.renderEscaladeTV = renderEscaladeTV;