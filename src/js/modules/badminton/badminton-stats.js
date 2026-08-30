// src/js/modules/badminton/badminton-stats.js
import { db, ref, onValue, update } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping } from '../../core/live-engine.js';

let currentEditClasse = '';
let currentEditTerrain = '';
let currentEditPlayer = '';

export async function openBadmintonPlayerStats(player, terrain, classe) {
    currentEditClasse = classe;
    currentEditTerrain = terrain;
    currentEditPlayer = player;

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const mapping = getLocalMapping(classe);
    const eleveId = mapping[`${classe}_${terrain}_${player}`];
    const eleve = eleves.find(e => e.id === eleveId);

    let photoUrl = null;
    if (eleveId) {
        try { photoUrl = await getPhotoUrl(eleveId); } catch (e) {}
    }

    // Créer la modale
    const modalHtml = `
        <div class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" id="statsModal">
            <div class="bg-slate-800 p-6 rounded-3xl border-2 border-slate-600 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-black text-white">${eleve ? eleve.prenom : 'Joueur'} ${eleve ? eleve.nom : ''}</h2>
                    <button onclick="document.getElementById('statsModal').remove()" class="bg-red-600 px-4 py-2 rounded-xl font-bold text-xs text-white">✖ Fermer</button>
                </div>
                
                <div class="flex items-center gap-4 mb-6">
                    ${photoUrl ? `<img src="${photoUrl}" class="w-20 h-20 rounded-full object-cover border-4 border-blue-500">` : `<div class="w-20 h-20 rounded-full bg-slate-600 flex items-center justify-center text-4xl">👤</div>`}
                    <div>
                        <p class="text-lg font-black text-white">Terrain ${terrain} - Joueur ${player}</p>
                        <p class="text-sm text-slate-400">Cliquez sur les scores pour les modifier.</p>
                    </div>
                </div>

                <div id="match-list-content" class="space-y-4">
                    <p class="text-slate-400">Chargement des matchs...</p>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Écouter les résultats pour cet élève
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/badminton/results`);
    
    onValue(resultsRef, (snap) => {
        const data = snap.val() || {};
        const playerMatches = Object.entries(data).filter(([id, m]) => 
            (m.p1 === player && m.terrain === terrain) || (m.p2 === player && m.terrain === terrain)
        );

        const listContainer = document.getElementById('match-list-content');
        if (!listContainer) return;

        if (playerMatches.length === 0) {
            listContainer.innerHTML = '<p class="text-slate-400">Aucun match joué pour le moment.</p>';
            return;
        }

        let html = '';
        playerMatches.forEach(([matchId, m]) => {
            const isP1 = m.p1 === player;
            const opponent = isP1 ? m.p2 : m.p1;
            const myScore = isP1 ? m.s1 : m.s2;
            const oppScore = isP1 ? m.s2 : m.s1;
            const win = myScore > oppScore;

            html += `
                <div class="bg-slate-900 p-4 rounded-xl border-2 ${win ? 'border-emerald-600' : 'border-red-800'}">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-black text-white">vs Joueur ${opponent}</span>
                        <span class="text-xs text-slate-400">${win ? '🏆 Victoire' : '❌ Défaite'}</span>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex items-center gap-2">
                            <label class="text-xs text-slate-400">Mon score</label>
                            <input type="number" id="edit-${matchId}-${player}" value="${myScore}" min="0" max="99" class="w-20 bg-slate-800 text-center text-2xl font-black text-white border-2 border-slate-600 rounded-lg p-1">
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-xs text-slate-400">Score adverse</label>
                            <input type="number" id="edit-${matchId}-opp" value="${oppScore}" min="0" max="99" class="w-20 bg-slate-800 text-center text-2xl font-black text-white border-2 border-slate-600 rounded-lg p-1">
                        </div>
                        <button onclick="saveMatchScore('${matchId}', '${m.p1}', '${m.p2}', '${player}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-black text-xs uppercase">
                            💾 Modifier
                        </button>
                    </div>
                </div>`;
        });

        listContainer.innerHTML = html;
    });
}

// Fonction pour sauvegarder les modifications dans Firebase
window.saveMatchScore = function(matchId, p1, p2, player) {
    let s1Input = document.getElementById(`edit-${matchId}-${p1}`);
    let s2Input = document.getElementById(`edit-${matchId}-${p2}`);
    
    // Si c'est le joueur p1 qui est édité
    let s1, s2;
    if (player === p1) {
        s1 = parseInt(s1Input.value) || 0;
        s2 = parseInt(document.getElementById(`edit-${matchId}-opp`).value) || 0;
    } else {
        s1 = parseInt(document.getElementById(`edit-${matchId}-opp`).value) || 0;
        s2 = parseInt(s1Input.value) || 0;
    }

    if (confirm(`Confirmer la modification du score (${p1} vs ${p2} : ${s1} - ${s2}) ?`)) {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentEditClasse}/badminton/results/${matchId}`);
        
        update(resultRef, { s1: s1, s2: s2 })
            .then(() => {
                alert("✅ Score modifié !");
                // Fermer et rouvrir la modale pour mettre à jour l'affichage
                document.getElementById('statsModal').remove();
                openBadmintonPlayerStats(currentEditPlayer, currentEditTerrain, currentEditClasse);
            })
            .catch(err => alert("Erreur : " + err.message));
    }
};