import { getConfigData, getEscaladeData, getStudentsMap, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const config = getConfigData();
    const montees = getEscaladeData();
    const studentsMap = getStudentsMap();
    const localMapping = getLocalMapping();

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

    // 2. Calcul des scores par équipe + par membre (avec recherche photo)
    const monteesList = Object.values(montees || {});
    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) {
            equipe.score += (m.points || 0);
            
            // Code élève (ex: "A1") -> Lettre (A) + Index (0)
            const lettre = m.groupe;
            const index = parseInt(m.role) - 1;
            const mappingKey = `${lettre}`; // La clé dans localMapping est "A", "B"...
            
            let eleveId = null;
            if (localMapping[mappingKey] && localMapping[mappingKey][index]) {
                eleveId = localMapping[mappingKey][index];
            }

            const existing = equipe.membres.find(mem => mem.code === `${lettre}${m.role}`);
            if (existing) {
                existing.points += (m.points || 0);
            } else {
                equipe.membres.push({ code: `${lettre}${m.role}`, points: m.points || 0, eleveId });
            }
        }
    }

    // 3. Trier les équipes par score décroissant
    equipes.sort((a, b) => b.score - a.score);

    // 4. Paramètres de hauteur (responsive)
    const baseHeight = 500;
    const maxHeight = baseHeight * 0.85;
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);

    let html = `<div style="width: 100%; height: ${baseHeight}px; position: relative; background: #1e293b; border-radius: 16px; overflow: hidden;">`;

    // Bandeaux de la montagne
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 25%; background: #334155;"></div>`;
    html += `<div style="position: absolute; bottom: 25%; left: 0; right: 0; height: 25%; background: #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 50%; left: 0; right: 0; height: 25%; background: #64748b;"></div>`;
    html += `<div style="position: absolute; bottom: 75%; left: 0; right: 0; height: 25%; background: #94a3b8;"></div>`;

    // Zone des équipes
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: 10px;">`;

    for (const eq of equipes) {
        const teamHeight = (eq.score / maxScore) * maxHeight;
        
        // Regrouper les membres par points identiques (pour affichage côte à côte)
        const groupes = [];
        for (const m of eq.membres) {
            if (m.points <= 0) continue;
            const last = groupes[groupes.length - 1];
            if (last && last.points === m.points) {
                last.membres.push(m);
            } else {
                groupes.push({ points: m.points, membres: [m] });
            }
        }

        // Générer les têtes (photos)
        let teteHtml = '';
        for (const grp of groupes) {
            let memberHeight = (grp.points / eq.score) * maxHeight;
            memberHeight = Math.min(memberHeight, teamHeight * 0.7);

            let groupHtml = '<div style="display: flex; justify-content: center; gap: 5px; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%) translateY(-' + memberHeight + 'px); transition: transform 1s ease;">';
            
            for (const m of grp.membres) {
                let photoUrl = null;
                if (m.eleveId) {
                    photoUrl = await getPhotoUrl(m.eleveId);
                }
                if (photoUrl) {
                    groupHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 2px solid #3b82f6;"></div>`;
                }
            }
            groupHtml += '</div>';
            teteHtml += groupHtml;
        }

        // Assemblage du bloc équipe
        html += `
        <div style="position: relative; height: ${teamHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 150px;">
            <div style="position: absolute; bottom: 50px; display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 70px;">🧗</div>
                <div style="background: #3b82f6; color: white; font-size: 40px; font-weight: 900; padding: 8px 20px; border-radius: 12px; margin-top: 10px;">${eq.lettre}</div>
                <div style="color: #facc15; font-size: 32px; font-weight: 900; margin-top: 6px;">${eq.score.toFixed(0)} m</div>
            </div>
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 50px;">
                ${teteHtml}
            </div>
        </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

// Exposer pour être appelé par layout.js
window.renderEscaladeTV = renderEscaladeTV;