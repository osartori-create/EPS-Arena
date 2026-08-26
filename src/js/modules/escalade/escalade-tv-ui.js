import { getConfigData, getEscaladeData, getCurrentClasse, getEleveIdFromCode } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // NE PAS FORCER L'AFFICHAGE DE viewTV : c'est le travail de layout.js de gérer les onglets !

    const config = getConfigData();
    const montees = getEscaladeData();

    if (!config) {
        container.innerHTML = '<p class="text-slate-500 text-center mt-20">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Identifier les équipes
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0, membres: [] });
        }
    });

    // 2. Calculer les scores par équipe et par membre
    Object.values(montees || {}).forEach(m => {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) {
            equipe.score += (m.points || 0);
            const code = `${m.groupe}${m.role}`;
            const eleveId = getEleveIdFromCode(code);
            const existing = equipe.membres.find(mem => mem.code === code);
            if (existing) {
                existing.points += (m.points || 0);
            } else {
                equipe.membres.push({ code, points: m.points || 0, eleveId });
            }
        }
    });

    // 3. Trier par score décroissant
    equipes.sort((a, b) => b.score - a.score);

    // 4. Calcul hauteur max (RESPONSIVE)
    const baseHeight = 500;
    const maxHeight = baseHeight * 0.85; // Ne monte jamais à plus de 85%
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);

    let html = `<div style="width: 100%; height: ${baseHeight}px; position: relative; background: #1e293b; border-radius: 16px; overflow: hidden;">`;

    // Bandeaux de montagne
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 25%; background: #334155;"></div>`;
    html += `<div style="position: absolute; bottom: 25%; left: 0; right: 0; height: 25%; background: #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 50%; left: 0; right: 0; height: 25%; background: #64748b;"></div>`;
    html += `<div style="position: absolute; bottom: 75%; left: 0; right: 0; height: 25%; background: #94a3b8;"></div>`;

    // Zone des équipes
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: 10px;">`;

    for (const eq of equipes) {
        // Hauteur du bloc équipe
        const teamHeight = (eq.score / maxScore) * maxHeight;

        // 5. Grouper les membres par points identiques (pour les mettre côte à côte)
        const groupes = [];
        for (const m of eq.membres) {
            if (m.points <= 0) continue; // Ne pas afficher ceux qui n'ont pas grimpé
            const last = groupes[groupes.length - 1];
            if (last && last.points === m.points) {
                last.membres.push(m);
            } else {
                groupes.push({ points: m.points, membres: [m] });
            }
        }

        // 6. Générer le HTML des têtes
        let teteHtml = '';
        for (const grp of groupes) {
            // Limiter la hauteur des têtes à 70% du bloc pour ne pas recouvrir le score
            let memberHeight = (grp.points / eq.score) * maxHeight;
            memberHeight = Math.min(memberHeight, teamHeight * 0.7);

            let groupHtml = '<div style="display: flex; justify-content: center; gap: 5px; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%) translateY(-' + memberHeight + 'px); transition: transform 1s ease;">';
            
            for (const m of grp.membres) {
                let photoUrl = null;
                if (m.eleveId) {
                    photoUrl = await getPhotoUrl(m.eleveId);
                }
                if (photoUrl && m.points > 0) {
                    groupHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 2px solid #3b82f6;"></div>`;
                }
            }
            groupHtml += '</div>';
            teteHtml += groupHtml;
        }

        // 7. Assemblage du bloc équipe
        html += `
        <div style="position: relative; height: ${teamHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 150px;">
            
            <!-- Grimpeur + Lettre + Score (placé en haut du bloc) -->
            <div style="position: absolute; bottom: 50px; display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 70px;">🧗</div>
                <div style="background: #3b82f6; color: white; font-size: 40px; font-weight: 900; padding: 8px 20px; border-radius: 12px; margin-top: 10px;">${eq.lettre}</div>
                <div style="color: #facc15; font-size: 32px; font-weight: 900; margin-top: 6px;">${eq.score.toFixed(0)} m</div>
            </div>

            <!-- Zone des têtes (sous le score, alignées en bas) -->
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 50px;">
                ${teteHtml}
            </div>
        </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

// Exposer globalement pour être appelée par layout.js
window.renderEscaladeTV = renderEscaladeTV;