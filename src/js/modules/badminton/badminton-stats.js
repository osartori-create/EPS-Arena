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

    // Ici, il faudrait récupérer les données des matchs joués par ce joueur pour calculer les stats
    // Pour l'exemple, on simule des données (à remplacer par une vraie requête Firebase)
    // matchsGagnes, matchsPerdus, totalPoints, pointsBonus, pointsCentre
    
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

                <!-- Graphique Radar -->
                <div class="bg-slate-900 p-4 rounded-2xl mb-4">
                    <h3 class="text-sm font-bold text-slate-400 uppercase mb-3">Profil de jeu</h3>
                    <canvas id="playerRadar" width="300" height="300"></canvas>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Rendu du graphique (exemple simple avec Canvas, sans librairie externe pour l'instant)
    const canvas = document.getElementById('playerRadar');
    const ctx = canvas.getContext('2d');
    // ... code pour dessiner le radar (matchs gagnés, bonus, centre, etc.)
    // Vous pouvez utiliser Chart.js en l'incluant dans maitre.html pour plus de simplicité.
    // Pour l'instant, on affiche un texte indiquant la fonctionnalité.
    ctx.fillStyle = 'white';
    ctx.font = '14px sans-serif';
    ctx.fillText("Graphique à venir (librairie requise)", 50, 150);
}