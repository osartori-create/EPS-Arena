import { getConfigData, getEscaladeData, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // FORCER une hauteur fixe correspondant à un iPad en paysage
    container.style.display = 'block';
    container.style.height = '55vh';  // 55% de la hauteur de l'écran (format paysage)
    container.style.width = '100%';
    container.style.background = 'linear-gradient(to bottom, #1e293b, #0f172a)';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';

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

    // 2. Calculer les scores des équipes
    const monteesList = Object.values(montees || {});
    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    }

    // 3. Trier les équipes par score décroissant (le meilleur en haut)
    equipes.sort((a, b) => b.score - a.score);

    // 4. Calculer les paliers fixes pour le "podium"
    // On répartit les groupes sur 70% de la hauteur (pour laisser de la marge)
    const totalEquipes = equipes.length;
    const hauteurMax = 70; // en % de la hauteur du conteneur

    let html = `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 100%;">`;

    // Fond de montagne (bandes fixes en bas, pour décorer)
    html += `<div style="position: absolute; bottom: 0; width: 100%; height: 20%; background: #334155; border-top: 2px solid #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 20%; width: 100%; height: 15%; background: #1e293b; border-top: 2px solid #475569;"></div>`;

    // Positionner chaque équipe (les plus performantes en haut)
    for (let i = 0; i < equipes.length; i++) {
        const eq = equipes[i];

        // Calcul de la position en % : le 1er est à 70%, le 2e à 55%, etc.
        // On espace les groupes de manière égale
        const bottomPercent = hauteurMax - (i * (hauteurMax / Math.max(equipes.length, 1)));

        // 5. Récupérer et trier les membres de cette équipe par points décroissants
        let membres = monteesList.filter(m => m.groupe === eq.lettre);
        // On agrège par rôle (élève) pour additionner leurs points
        const membresAggreges = {};
        membres.forEach(m => {
            if (!membresAggreges[m.role]) membresAggreges[m.role] = 0;
            membresAggreges[m.role] += (m.points || 0);
        });
        // On trie les élèves par points décroissants
        const rolesTries = Object.keys(membresAggreges).sort((a, b) => membresAggreges[b] - membresAggreges[a]);

        // Générer les photos triées
        let photosHtml = '';
        for (const role of rolesTries) {
            if (membresAggreges[role] > 0) {
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

        // Assembler le bloc de l'équipe (position absolue en bas)
        html += `
        <div style="position: absolute; bottom: ${bottomPercent}%; left: 10%; width: 80%; display: flex; flex-direction: column; align-items: center; transition: bottom 1s ease;">
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

// Exposer pour appel global
window.renderEscaladeTV = renderEscaladeTV;