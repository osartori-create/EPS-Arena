import { getConfigData, getEscaladeData, getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // 1. Conteneur : hauteur fixe (600px)
    container.style.height = '600px';
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';
    
    // 2. Disposition horizontale
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.justifyContent = 'space-around';
    container.style.alignItems = 'flex-start';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();
    const currentClasse = getCurrentClasse();

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
        return;
    }

    // 3. Créer les équipes DANS L'ORDRE ALPHABÉTIQUE
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });
    equipes.sort((a, b) => a.lettre.localeCompare(b.lettre));

    // 4. Calcul des scores
    const monteesList = Object.values(montees || {});
    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += Number(m.points) || 0;
    }

    // 5. Garder uniquement les groupes avec des points
    const equipesAvecScore = equipes.filter(eq => eq.score > 0);
    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente des performances...</p>';
        return;
    }

    // 6. Score maximum pour définir la hauteur (le meilleur est tout en haut)
    const maxScore = Math.max(...equipesAvecScore.map(eq => eq.score), 1);

    // Paramètres : topMax = 20px (tout en haut), topMin = 420px (visible en bas)
    const topMax = 20;
    const topMin = 420;

    let html = '';

    // 7. Boucle sur les équipes
    for (const eq of equipesAvecScore) {
        const topPos = topMin - ((eq.score / maxScore) * (topMin - topMax));

        const membresGroupes = {};
        monteesList.forEach(m => {
            if (m.groupe === eq.lettre) {
                if (!membresGroupes[m.role]) membresGroupes[m.role] = 0;
                membresGroupes[m.role] += Number(m.points) || 0;
            }
        });

        const rolesTries = Object.keys(membresGroupes).sort((a, b) => membresGroupes[b] - membresGroupes[a]);

        let photosHtml = '<div style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px;">';
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

        html += `
        <div style="display: flex; flex-direction: column; align-items: center; position: relative; top: ${topPos}px; transition: top 0.5s ease;">
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            ${photosHtml}
        </div>`;
    }

    container.innerHTML = html;
}

window.renderEscaladeTV = renderEscaladeTV;