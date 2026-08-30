// src/js/modules/badminton/badminton-live.js
// Sous-module "Impacts" - Live Professeur

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { openBadmintonPlayerStats } from './badminton-stats.js'; // Import du module stats

// Exposer la fonction pour le HTML
window.openBadmintonPlayerStats = openBadmintonPlayerStats;

let currentClasse = '';
let currentUnsub = null;

export function renderBadmintonLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) {
        container.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
        return;
    }

    currentClasse = activeClasse;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';

    // 1. Écouter la config (nombre de terrains, joueurs par terrain)
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`);
    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        if (config.activite !== 'badminton') return;
        
        let terrainsConfig = {};
        for (let key in config) {
            if (!isNaN(parseInt(key))) {
                terrainsConfig[parseInt(key)] = config[key];
            }
        }

        // 2. Écouter les résultats
        if (currentUnsub) currentUnsub();
        const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results`);
        currentUnsub = onValue(resultsRef, (snap) => {
            const data = snap.val() || {};
            renderGrid(terrainsConfig, data);
        });
    });
}

async function renderGrid(terrainsConfig, data) {
    const container = document.getElementById('live-content');
    const mapping = getLocalMapping(currentClasse) || {};
    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    let html = '<h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏸 Badminton - Live Impacts</h3>';
    html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';

    // Pour chaque terrain
    for (let t in terrainsConfig) {
        const terrain = t;
        const nbPlayers = terrainsConfig[t];
        const playersList = lettres.slice(0, nbPlayers);

        let terrainData = {};
        playersList.forEach(p => terrainData[p] = { pts: 0, wins: 0, losses: 0, diff: 0, total: 0, middle: 0, extreme: 0 });

        Object.values(data).forEach(m => {
            if (String(m.terrain) !== String(terrain)) return;

            // Mise à jour des scores
            if (m.s1 > m.s2) {
                terrainData[m.p1].pts += 3; terrainData[m.p1].wins++; terrainData[m.p1].diff += (m.s1 - m.s2);
                terrainData[m.p2].losses++; terrainData[m.p2].diff -= (m.s1 - m.s2);
            } else {
                terrainData[m.p2].pts += 3; terrainData[m.p2].wins++; terrainData[m.p2].diff += (m.s2 - m.s1);
                terrainData[m.p1].losses++; terrainData[m.p1].diff -= (m.s2 - m.s1);
            }

            // Mise à jour des stats impacts
            if (m.stats) {
                let p1Stats = m.stats.p1 || { extreme: 0, middle: 0, total: 0 };
                let p2Stats = m.stats.p2 || { extreme: 0, middle: 0, total: 0 };

                terrainData[m.p1].extreme += p1Stats.extreme;
                terrainData[m.p1].middle += p1Stats.middle;
                terrainData[m.p1].total += p1Stats.total;

                terrainData[m.p2].extreme += p2Stats.extreme;
                terrainData[m.p2].middle += p2Stats.middle;
                terrainData[m.p2].total += p2Stats.total;
            }
        });

        // Tri du classement du terrain
        const sortedPlayers = Object.entries(terrainData).sort((a, b) => b[1].pts - a[1].pts || b[1].diff - a[1].diff);

        // Création de la carte (avec récupération des photos)
        html += `<div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-yellow-400 text-xl mb-3">Terrain ${terrain}</h4>
            <div class="space-y-2">
                ${await Promise.all(sortedPlayers.map(async ([player, stats], idx) => {
                    const pctBonus = stats.total > 0 ? Math.round((stats.extreme / stats.total) * 100) : 0;
                    
                    let bonusColor = 'text-red-400';
                    if (pctBonus > 60) bonusColor = 'text-emerald-400';
                    else if (pctBonus > 40) bonusColor = 'text-amber-400';

                    const mappingKey = `${currentClasse}_${terrain}_${player}`;
                    const eleveId = mapping[mappingKey];
                    
                    let nomEleve = player;
                    let photoHtml = `<div class="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm">👤</div>`;
                    
                    if (eleveId) {
                        const localEleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
                        const eleve = localEleves.find(e => e.id === eleveId);
                        nomEleve = eleve ? eleve.prenom : player;
                        
                        try {
                            const photoUrl = await getPhotoUrl(eleveId);
                            if (photoUrl) photoHtml = `<img src="${photoUrl}" class="w-8 h-8 rounded-full object-cover border-2 border-slate-500">`;
                        } catch(e) {}
                    }

                    return `<div onclick="openBadmintonPlayerStats('${player}', '${terrain}', '${currentClasse}')" 
                                class="flex justify-between items-center bg-slate-900 p-2 rounded-xl border border-slate-700 cursor-pointer hover:border-blue-500">
                                <div class="flex items-center gap-2">
                                    ${photoHtml}
                                    <span class="text-slate-500 w-5 font-black">${idx + 1}</span>
                                    <span class="font-black text-white">${nomEleve}</span>
                                    <span class="text-[10px] text-blue-400">(${player})</span>
                                </div>
                                <div class="flex gap-3 text-xs font-bold">
                                    <span class="text-yellow-400">${stats.pts} pts</span>
                                    <span class="text-blue-400">${stats.wins}V - ${stats.losses}D</span>
                                    <span class="${bonusColor}">🎯 ${pctBonus}%</span>
                                </div>
                            </div>`;
                }))}
            </div>
        </div>`;
    }

    html += '</div>';
    
    // Bouton Export
    html += `<div class="mt-6">
        <button onclick="window.exportBadmintonImpactCSV()" class="bg-green-600 px-6 py-3 rounded-xl font-black text-xs uppercase text-white border-2 border-green-400">⬇️ Export iDoceo (Stats Impacts)</button>
    </div>`;

    container.innerHTML = html;
}

// Export iDoceo enrichi
window.exportBadmintonImpactCSV = function() {
    alert("Export des stats Impacts en préparation !");
};