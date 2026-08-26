import { getConfigData, getEscaladeData, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // Dimensions forcées et fiables
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

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Créer les équipes et calculer leurs scores
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

    // 2. On garde UNIQUEMENT les équipes qui ont des points (> 0)
    const equipesAvecScore = equipes.filter(eq => eq.score > 0);

    // 3. On trie par score décroissant
    equipesAvecScore.sort((a, b) => b.score - a.score);

    // 4. Trouver le score maximum pour définir la hauteur des grimpeurs
    const maxScore = Math.max(...equipesAvecScore.map(eq => eq.score), 1);

    // 5. Si aucune équipe n'a de score, on affiche un message
    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px; width: 100%;">En attente des performances des élèves...</p>';
        return;
    }

    // 6. Vider et reconstruire le conteneur
    container.innerHTML = '';

    // 7. Boucle sur chaque équipe pour construire leur "bloc" (côte à côte)
    for (const eq of equipesAvecScore) {
        // Hauteur du bloc en pixels (proportionnelle au score)
        const height = Math.max((eq.score / maxScore) * 400, 80); // 400px max, 80px min

        // 8. Récupérer et trier les membres de cette équipe par points
        const membresGroupes = {};
        monteesList.forEach(m => {
            if (m.groupe === eq.lettre) {
                if (!membresGroupes[m.role]) membresGroupes[m.role] = 0;
                membresGroupes[m.role] += (m.points || 0);
            }
        });
        const rolesTries = Object.keys(membresGroupes).sort((a, b) => membresGroupes[b] - membresGroupes[a]);

        // 9. Construire les photos (de manière asynchrone)
        let photosHtml = '<div style="display: flex; flex-direction: column; gap: 5px; align-items: center; margin-top: 10px;">';
        for (const role of rolesTries) {
            const index = parseInt(role) - 1;
            const eleveId = localMapping[eq.lettre] ? localMapping[eq.lettre][index] : null;
            if (eleveId) {
                try {
                    const url = await getPhotoUrl(eleveId);
                    if (url) {
                        photosHtml += `<div style="width: 45px; height: 45px; border-radius: 50%; background-image: url('${url}'); background-size: cover; border: 3px solid #3b82f6;"></div>`;
                    }
                } catch (e) { /* ignorer les erreurs de photos */ }
            }
        }
        photosHtml += '</div>';

        // 10. Construire le bloc équipe
        const blocEquipe = document.createElement('div');
        blocEquipe.style.display = 'flex';
        blocEquipe.style.flexDirection = 'column';
        blocEquipe.style.alignItems = 'center';
        blocEquipe.style.justifyContent = 'flex-end';
        blocEquipe.style.height = height + 'px';
        blocEquipe.style.transition = 'height 0.5s ease';
        
        blocEquipe.innerHTML = `
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 26px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            ${photosHtml}
        `;

        // 11. Ajouter le bloc au conteneur principal
        container.appendChild(blocEquipe);
    }
}

// Exposer pour appel global
window.renderEscaladeTV = renderEscaladeTV;