// src/js/modules/escalade/escalade-tv-ui.js
import { getConfigData, getEscaladeData } from '../../core/live-engine.js';

// Cette fonction est appelée quand on ouvre l'onglet TV ou quand les données changent
export function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const config = getConfigData();
    const montees = getEscaladeData();

    if (!config) {
        container.innerHTML = '<p class="text-slate-500 text-center mt-20">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Identifier les équipes (A, B, C...)
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });

    // 2. Calculer le total de points par équipe
    Object.values(montees || {}).forEach(m => {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    });

    // 3. Trier par score décroissant
    equipes.sort((a, b) => b.score - a.score);

    // 4. Construire la montagne
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);
    let html = `<div class="relative w-full h-full overflow-hidden rounded-2xl bg-gradient-to-t from-slate-900 to-slate-700 flex flex-col justify-end">`;

    // Les niveaux de la montagne
    html += `<div class="absolute bottom-0 left-0 right-0 h-1/4 bg-slate-800 border-t-2 border-slate-600"></div>`;
    html += `<div class="absolute bottom-1/4 left-0 right-0 h-1/4 bg-slate-700 border-t-2 border-slate-600"></div>`;
    html += `<div class="absolute bottom-1/2 left-0 right-0 h-1/4 bg-slate-600 border-t-2 border-slate-500"></div>`;
    html += `<div class="absolute bottom-3/4 left-0 right-0 h-1/4 bg-slate-500 border-t-2 border-slate-400"></div>`;

    // Les grimpeurs
    html += `<div class="relative z-10 flex justify-around items-end pb-4">`;
    equipes.forEach(eq => {
        const height = Math.max((eq.score / maxScore) * 90, 5);
        html += `
        <div class="flex flex-col items-center justify-end transition-all duration-700" style="transform: translateY(-${height}%)">
            <div class="text-6xl">🧗</div>
            <div class="bg-blue-500 text-white text-4xl font-black px-6 py-2 rounded-xl mt-2 shadow-lg">${eq.lettre}</div>
            <div class="text-yellow-400 text-3xl font-black mt-1">${eq.score.toFixed(0)} m</div>
        </div>`;
    });
    html += `</div></div>`;

    container.innerHTML = html;
    
    // ... fin de la fonction ...
    console.log("Rendu TV exécuté, config:", config, "Montees:", Object.keys(montees).length);
    container.innerHTML = html;
}
