import { getConfigData, getEscaladeData, getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // ✅ ON PASSE EN COLONNE VERTICALE (de haut en bas) !
    container.style.display = 'flex';
    container.style.flexDirection = 'column'; // Pour un classement vertical
    container.style.height = '100vh'; // Responsive : prend toute la hauteur de l'écran
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';
    container.style.padding = '20px';
    container.style.boxSizing = 'border-box';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping();
    const currentClasse = getCurrentClasse();

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
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

    // 2. Garder les groupes avec un score, et les trier du meilleur au pire
    const equipesAvecScore = equipes.filter(eq => eq.score > 0).sort((a, b) => b.score - a.score);

    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente des performances...</p>';
        return;
    }

    // 3. Calculer la somme totale des points pour définir le pourcentage de hauteur
    const totalPoints = equipesAvecScore.reduce((sum, eq) => sum + eq.score, 0);

    let html = '';
    let accumulateur = 0; // Pour gérer le remplissage vertical

    // 4. Boucle sur les équipes (déjà triées par score : meilleur en premier)
    for (let i = 0; i < equipesAvecScore.length; i++) {
        const eq = equipesAvecScore[i];

        // ✅ CALCUL DE LA HAUTEUR PROPORTIONNELLE : (score / total) * 100 %
        // Cela garantit que le meilleur prend une grande place en haut, le pire tout en bas
        const heightPercent = (eq.score / totalPoints) * 100;

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
                photosHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 2px solid #3b82f6;"></div>`;
            } else {
                photosHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 18px;">👤</div>`;
            }
        }
        photosHtml += '</div>';

        // 5. Construction du bloc pour CHAQUE équipe
        html += `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: ${heightPercent}%; background: #1e293b; border-bottom: 2px solid #334155; padding: 10px;">
            <div style="font-size: 50px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 28px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            ${photosHtml}
        </div>`;
    }

    container.innerHTML = html;
}

window.renderEscaladeTV = renderEscaladeTV;