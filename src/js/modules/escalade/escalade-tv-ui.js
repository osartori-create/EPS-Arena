import { getConfigData, getEscaladeData, getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // 1. Conteneur : hauteur fixe en pixels (responsive mais bornée)
    const containerHeight = 600; // Hauteur en pixels du cadre
    container.style.display = 'block';
    container.style.height = containerHeight + 'px';
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();
    const currentClasse = getCurrentClasse();

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
        return;
    }

    // 2. Créer les équipes DANS L'ORDRE ALPHABÉTIQUE (A, B, C...)
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });
    equipes.sort((a, b) => a.lettre.localeCompare(b.lettre));

    // 3. Calcul des scores
    const monteesList = Object.values(montees || {});
    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    }

    // 4. Garder uniquement les groupes avec des points
    const equipesAvecScore = equipes.filter(eq => eq.score > 0);
    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente des performances...</p>';
        return;
    }

    // 5. Score maximum pour définir la montée (gère les "maxScore" inattendus)
    const maxScore = Math.max(...equipesAvecScore.map(eq => eq.score), 1);

    // 6. Paramètres de montée : maximum 500px pour ne jamais sortir du cadre de 600px
    const maxRisePx = 500;
    const minRisePx = 20;

    // 7. Disposition horizontale (ordre alphabétique)
    const step = 100 / (equipesAvecScore.length + 1);

    let html = '';

    // 8. Boucle sur les équipes
    for (let i = 0; i < equipesAvecScore.length; i++) {
        const eq = equipesAvecScore[i];

        // Position horizontale centrée
        const leftPercent = step * (i + 1);

        // Montée en pixels (le meilleur est à 500px, le pire à 20px)
        const risePx = Math.max((eq.score / maxScore) * maxRisePx, minRisePx);

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

        // 9. Construction du bloc : ancré en bas, monté en pixels
        html += `
        <div style="position: absolute; bottom: 0; left: ${leftPercent}%; transform: translateX(-50%) translateY(-${risePx}px); transition: transform 0.5s ease; display: flex; flex-direction: column; align-items: center;">
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            ${photosHtml}
        </div>`;
    }

    container.innerHTML = html;
}

window.renderEscaladeTV = renderEscaladeTV;