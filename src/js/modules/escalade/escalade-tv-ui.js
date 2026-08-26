import { getConfigData, getEscaladeData, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // Conteneur principal (hauteur fixe pour iPad paysage)
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

    // 2. Filtrer les équipes sans score et trier par score décroissant
    const equipesAvecScore = equipes.filter(eq => eq.score > 0).sort((a, b) => b.score - a.score);

    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px; width: 100%;">En attente des performances des élèves...</p>';
        return;
    }

    // 3. Positions verticales (en pixels) pour créer l'effet "Podium / Montagne"
    // Le 1er est tout en haut, le 2e descend, etc.
    const positionsTop = [50, 200, 350, 500]; // Ajustez selon votre besoin
    let html = '<div style="position: absolute; top: 0; left: 0; right: 0; height: 100%;">';

    // 4. Boucle sur les équipes avec score
    for (let i = 0; i < equipesAvecScore.length; i++) {
        const eq = equipesAvecScore[i];
        const topPos = positionsTop[i] || (i * 150 + 50); // Fallback si plus de 4 équipes

        // Récupérer les membres et leurs points
        const membresGroupes = {};
        monteesList.forEach(m => {
            if (m.groupe === eq.lettre) {
                if (!membresGroupes[m.role]) membresGroupes[m.role] = 0;
                membresGroupes[m.role] += (m.points || 0);
            }
        });
        const rolesTries = Object.keys(membresGroupes).sort((a, b) => membresGroupes[b] - membresGroupes[a]);

        // Charger les photos des élèves (avec fallback)
        let photosHtml = '<div style="display: flex; flex-direction: column; align-items: center; gap: 5px; margin-top: 10px;">';
        for (const role of rolesTries) {
            const index = parseInt(role) - 1;
            const eleveId = localMapping[eq.lettre] ? localMapping[eq.lettre][index] : null;
            
            let photoUrl = null;
            if (eleveId) {
                try {
                    photoUrl = await getPhotoUrl(eleveId);
                } catch (e) { /* ignore */ }
            }
            
            // Si la photo est trouvée, on l'affiche. Sinon, on met une icône par défaut.
            if (photoUrl) {
                photosHtml += `<div style="width: 45px; height: 45px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 3px solid #3b82f6;"></div>`;
            } else {
                photosHtml += `<div style="width: 45px; height: 45px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>`;
            }
        }
        photosHtml += '</div>';

        // Assembler le bloc équipe (Grimpeur + Lettre + Score + Photos)
        html += `
        <div style="position: absolute; top: ${topPos}px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; transition: top 0.5s ease;">
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 26px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            ${photosHtml}
        </div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

window.renderEscaladeTV = renderEscaladeTV;