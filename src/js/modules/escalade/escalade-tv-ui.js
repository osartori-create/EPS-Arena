// src/js/modules/escalade/escalade-tv-ui.js
import { getConfigData, getEscaladeData, getStudentsMap, getLocalMapping, getEleveIdFromCode } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // Forcer l'affichage du panneau si caché
    const tvView = document.getElementById('viewTV');
    if (tvView && tvView.classList.contains('hidden')) {
        tvView.classList.remove('hidden');
    }

    const config = getConfigData();
    const montees = getEscaladeData();
    const studentsMap = getStudentsMap();
    const localMap = getLocalMapping();

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
            // Code de l'élève (lettre + numéro)
            const code = `${m.groupe}${m.role}`;
            // ID de l'élève depuis le mapping local
            const eleveId = getEleveIdFromCode(code);
            const existing = equipe.membres.find(mem => mem.code === code);
            if (existing) {
                existing.points += (m.points || 0);
            } else {
                equipe.membres.push({ code, points: m.points || 0, eleveId });
            }
        }
    });

    // 3. Trier les équipes par score décroissant
    equipes.sort((a, b) => b.score - a.score);

    // 4. Construire la montagne (CSS inline) avec les têtes dynamiques
    const baseHeight = 500; // Hauteur du globe
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);

    let html = `<div style="width: 100%; height: ${baseHeight}px; position: relative; background: #1e293b; border-radius: 16px; overflow: hidden;">`;

    // Bandeaux de montagne
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 25%; background: #334155;"></div>`;
    html += `<div style="position: absolute; bottom: 25%; left: 0; right: 0; height: 25%; background: #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 50%; left: 0; right: 0; height: 25%; background: #64748b;"></div>`;
    html += `<div style="position: absolute; bottom: 75%; left: 0; right: 0; height: 25%; background: #94a3b8;"></div>`;

    // Grimpeurs et têtes
    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: 20px;">`;

    for (const eq of equipes) {
        // Hauteur du grand grimpeur selon le score total de l'équipe
        const teamHeight = Math.max((eq.score / maxScore) * (baseHeight - 100), 40); // Min 40px

        // On calcule la position de chaque tête selon ses points (relative à l'équipe)
        // On va construire un conteneur vertical pour les têtes
        let membreHtml = '';
        // On récupère les photos de manière asynchrone
        for (const membre of eq.membres) {
            // Récupérer la photo de l'élève (si disponible)
            let photoUrl = null;
            if (membre.eleveId) {
                photoUrl = await getPhotoUrl(membre.eleveId);
            }
            // Si pas de photo ou pas grimpé (membre.points = 0), on n'affiche pas
            if (photoUrl && membre.points > 0) {
                // Hauteur de la tête proportionnelle à ses points par rapport au max de l'équipe (ou global)
                const memberHeight = (membre.points / maxScore) * (baseHeight - 100);
                // On la place en bas du bloc (ou avec transform translateY positive ?)
                // On va utiliser un conteneur flex-col aligné en bas, et on translate chaque tête vers le haut.
                membreHtml += `<div style="width: 50px; height: 50px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 3px solid #3b82f6; transform: translateY(-${memberHeight}px); transition: transform 1s ease;"></div>`;
            }
        }

        // Assembler le bloc : grimpeur + lettre + score + têtes
        // Pour que les têtes montent avec le grimpeur, on les place dans un conteneur commun avec la même translation
        // Le conteneur est positionné en bas, on translate tout le bloc par teamHeight.
        html += `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-${teamHeight}px); transition: transform 1s ease;">
            <div style="font-size: 70px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 40px; font-weight: 900; padding: 8px 20px; border-radius: 12px; margin-top: 10px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 32px; font-weight: 900; margin-top: 6px;">${eq.score.toFixed(0)} m</div>
            <!-- Zone des têtes des élèves qui ont grimpé -->
            <div style="display: flex; flex-direction: column; align-items: center; margin-top: 10px; gap: 10px;">
                ${membreHtml}
            </div>
        </div>`;
    }

    html += `</div></div>`;

    container.innerHTML = html;
}

// Exposer pour appel direct si besoin
window.renderEscaladeTV = renderEscaladeTV;