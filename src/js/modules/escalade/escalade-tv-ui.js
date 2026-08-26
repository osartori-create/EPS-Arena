import { getConfigData, getEscaladeData, getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // Conteneur principal en affichage HORIZONTAL (Flexbox)
    container.style.display = 'flex';
    container.style.height = '600px';
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.justifyContent = 'space-around';
    container.style.alignItems = 'flex-end'; // Alignement en bas
    container.style.paddingBottom = '20px';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();
    const currentClasse = getCurrentClasse();

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px; width: 100%;">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Créer les équipes et calculer les scores (ordre alphabétique conservé)
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

    // 2. Garder uniquement les groupes avec un score > 0
    const equipesAvecScore = equipes.filter(eq => eq.score > 0);

    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px; width: 100%;">En attente des performances...</p>';
        return;
    }

    // 3. Déterminer le score maximum pour la hauteur
    const maxScore = Math.max(...equipesAvecScore.map(eq => eq.score), 1);

    // 4. Hauteur maximale en pixels (le meilleur groupe sera à cette hauteur)
    const maxHeight = 480;
    const minHeight = 80; // Un groupe qui a des points reste toujours visible

    let html = '';

    // 5. Boucle sur les équipes (dans l'ordre alphabétique A, B, C...)
    for (const eq of equipesAvecScore) {
        // Hauteur proportionnelle au score !
        const height = Math.max((eq.score / maxScore) * maxHeight, minHeight);

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
        let photosHtml = '<div style="display: flex; flex-direction: column; align-items: center; gap: 5px; margin-top: 10px;">';
        for (const role of rolesTries) {
            const index = parseInt(role) - 1;
            const mappingKey = `${currentClasse}_${eq.lettre}`;
            let eleveId = null;

            if (localMapping[mappingKey] && Array.isArray(localMapping[mappingKey])) {
                eleveId = localMapping[mappingKey][index];
            }
            else if (localMapping[`${currentClasse}_${eq.lettre}${role}`]) {
                eleveId = localMapping[`${currentClasse}_${eq.lettre}${role}`];
            }

            let photoUrl = null;
            if (eleveId) {
                try {
                    photoUrl = await getPhotoUrl(eleveId);
                } catch (e) { /* ignore */ }
            }

            if (photoUrl) {
                photosHtml += `<div style="width: 45px; height: 45px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 3px solid #3b82f6;"></div>`;
            } else {
                photosHtml += `<div style="width: 45px; height: 45px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>`;
            }
        }
        photosHtml += '</div>';

        // Construire la colonne (ordre alphabétique horizontal + hauteur proportionnelle)
        html += `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: ${height}px; transition: height 0.5s ease;">
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 26px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            ${photosHtml}
        </div>`;
    }

    container.innerHTML = html;
}

window.renderEscaladeTV = renderEscaladeTV;