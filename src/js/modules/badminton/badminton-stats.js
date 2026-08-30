// src/js/modules/badminton/badminton-stats.js
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping } from '../../core/live-engine.js';

export async function openBadmintonPlayerStats(player, terrain, classe) {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const mapping = getLocalMapping(classe);
    const eleveId = mapping[`${classe}_${terrain}_${player}`];
    const eleve = eleves.find(e => e.id === eleveId);
    let photoUrl = null;
    if (eleveId) {
        try { photoUrl = await getPhotoUrl(eleveId); } catch(e) {}
    }

    const modalHtml = `
        <div class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" id="statsModal">
            <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 w-full max-w-lg">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-2xl font-black text-white">${eleve ? eleve.prenom : player} (Terrain ${terrain})</h2>
                    <button onclick="document.getElementById('statsModal').remove()" class="bg-red-600 px-3 py-2 rounded-xl font-bold text-xs text-white">✖ Fermer</button>
                </div>
                
                <div class="flex items-center gap-4 mb-6">
                    ${photoUrl ? `<img src="${photoUrl}" class="w-16 h-16 rounded-full object-cover border-4 border-blue-500">` : `<div class="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center text-3xl">👤</div>`}
                    <div>
                        <p class="text-lg font-black text-white">${eleve ? eleve.prenom + ' ' + eleve.nom : 'Joueur ' + player}</p>
                        <p class="text-sm text-slate-400">Code : ${player}</p>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}