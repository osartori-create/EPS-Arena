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
    container.style.alignItems = 'flex-end';
    container.style.paddingBottom = '20px';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();
    const currentClasse = getCurrentClasse();

    // LOG DE DIAGNOSTIC (F12)
    console.log("🛠️ DIAG TV -> Classe:", currentClasse);
    console.log("🛠️ DIAG TV -> Mapping local:", localMapping);

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px; width: 100%;">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Créer les équipes et calculer les scores
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
    const equipesAvecScore = equipes.filter(eq => eq.score > 0).sort((a, b) => b.score - a.score);

    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px; width: 100%;">En attente des performances...</p>';
        return;
    }

    // 3. Définir la hauteur maximale
    const maxScore = Math.max(...equipesAvecScore.map(eq => eq.score), 1);
    const maxHeight = 480;
    const minHeight = 50;

    let html = '';

    // 4. Boucle sur les équipes
    for (const eq of equipesAvecScore) {
        const height = Math.max((eq.score / maxScore) * maxHeight, minHeight);

        // 5. Récupérer les membres et leurs points
        const membresGroupes = {};
        monteesList.forEach(m => {
            if (m.groupe === eq.lettre) {
                if (!membresGroupes[m.role]) membresGroupes[m.role] = 0;
                membresGroupes[m.role] += (m.points || 0);
            }
        });

        const rolesTries = Object.keys(membresGroupes).sort((a, b) => membresGroupes[b] - membresGroupes[a]);

        // 6. Charger les photos avec la BONNE clé (TABLEAU PAR GROUPE)
        let photosHtml = '<div style="display: flex; flex-direction: column; align-items: center; gap: 5px; margin-top: 10px;">';
        for (const role of rolesTries) {
            const index = parseInt(role) - 1;
            
            // ✅ ON CHERCHE D'ABORD LA CLÉ DU GROUPE : "504_A"
            const mappingKey = `${currentClasse}_${eq.lettre}`;
            let eleveId = null;

            // Vérifier si le mapping contient bien un tableau pour ce groupe
            if (localMapping[mappingKey] && Array.isArray(localMapping[mappingKey])) {
                eleveId = localMapping[mappingKey][index];
            }
            // Fallback si le mapping est au format "504_A1" (ancienne méthode)
            else if (localMapping[`${currentClasse}_${eq.lettre}${role}`]) {
                eleveId = localMapping[`${currentClasse}_${eq.lettre}${role}`];
            }

            // LOG DE DIAGNOSTIC PAR ÉLÈVE
            console.log(`Recherche photo élève ${eq.lettre}${role} -> ID:`, eleveId);

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

        // 7. Construire la colonne
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