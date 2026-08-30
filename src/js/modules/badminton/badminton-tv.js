// src/js/modules/badminton/badminton-tv.js
// Mode TV plein écran pour le Badminton

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js'; // Import pour les photos

let currentClasse = '';
let currentUnsub = null;

export function renderBadmintonTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '0';
        tvView.style.margin = '0';
    }

    // Permettre le défilement si nécessaire (au lieu de couper)
    container.style.height = '100vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#0f172a';
    container.style.overflowY = 'auto'; 
    container.style.padding = '10px';

    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Choisissez une classe.</p>';
        return;
    }

    currentClasse = activeClasse;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';

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

        if (currentUnsub) currentUnsub();
        const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results`);
        currentUnsub = onValue(resultsRef, (snap) => {
            const data = snap.val() || {};
            renderTVGrid(terrainsConfig, data);
        });
    });
}

async function renderTVGrid(terrainsConfig, data) {
    const container = document.getElementById('tvGlobe');
    const mapping = getLocalMapping(currentClasse) || {};
    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    // Grille adaptative et compacte : elle essaie de mettre 4 colonnes, et passe à 3 si l'écran est plus petit
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; width: 100%; height: 100%;">
    `;

    for (let t in terrainsConfig) {
        const terrain = t;
        const nbPlayers = terrainsConfig[t];
        const playersList = lettres.slice(0, nbPlayers);

        let terrainData = {};
        playersList.forEach(p => terrainData[p] = { pts: 0, wins: 0, losses: 0, diff: 0, total: 0, middle: 0, extreme: 0 });

        Object.values(data).forEach(m => {
            if (String(m.terrain) !== String(terrain)) return;

            if (m.s1 > m.s2) {
                terrainData[m.p1].pts += 3; terrainData[m.p1].wins++; terrainData[m.p1].diff += (m.s1 - m.s2);
                terrainData[m.p2].losses++; terrainData[m.p2].pts += 1; terrainData[m.p2].diff -= (m.s1 - m.s2);
            } else {
                terrainData[m.p2].pts += 3; terrainData[m.p2].wins++; terrainData[m.p2].diff += (m.s2 - m.s1);
                terrainData[m.p1].losses++; terrainData[m.p1].pts += 1; terrainData[m.p1].diff -= (m.s2 - m.s1);
            }

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

        const sortedPlayers = Object.entries(terrainData).sort((a, b) => b[1].pts - a[1].pts || b[1].diff - a[1].diff);

        // Début de la carte Terrain
        html += `
            <div class="bg-slate-800 rounded-2xl border-4 border-slate-600 p-3 flex flex-col shadow-xl" style="max-height: 48vh;">
                <div class="bg-blue-600 rounded-xl p-2 text-center mb-2">
                    <h3 style="font-size: 1.8rem; font-weight: 900; color: white; margin: 0;">TERRAIN ${terrain}</h3>
                </div>
                <div class="flex-1 space-y-1">
        `;

        for (let i = 0; i < sortedPlayers.length; i++) {
            const [player, stats] = sortedPlayers[i];
            const pctBonus = stats.total > 0 ? Math.round((stats.extreme / stats.total) * 100) : 0;
            let bonusColor = 'text-red-400';
            if (pctBonus > 60) bonusColor = 'text-emerald-400';
            else if (pctBonus > 40) bonusColor = 'text-amber-400';

            const mappingKey = `${currentClasse}_${terrain}_${player}`;
            const eleveId = mapping[mappingKey];
            
            // Récupération de la photo
            let photoUrl = null;
            if (eleveId) {
                try {
                    photoUrl = await getPhotoUrl(eleveId);
                } catch(e) { photoUrl = null; }
            }
            
            const photoHtml = photoUrl 
                ? `<img src="${photoUrl}" class="w-8 h-8 rounded-full object-cover border-2 border-slate-500">` 
                : `<div class="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm">👤</div>`;

            let podiumClass = 'border border-slate-700';
            if (i === 0) podiumClass = 'border-4 border-yellow-500';
            else if (i === 1) podiumClass = 'border-2 border-gray-400';
            else if (i === 2) podiumClass = 'border-2 border-amber-700';

            // On récupère le nom
            let nomEleve = player;
            if (eleveId) {
                const localEleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
                const eleve = localEleves.find(e => e.id === eleveId);
                nomEleve = eleve ? eleve.prenom : player;
            }

            html += `
                <div class="flex justify-between items-center bg-slate-900 rounded-lg p-2 ${podiumClass}" style="height: 44px;">
                    <div class="flex items-center gap-2 text-sm font-bold">
                        ${photoHtml}
                        <span style="color: #94a3b8; font-weight: 900;">${i + 1}.</span>
                        <span style="color: white;">${nomEleve}</span>
                        <span style="color: #3b82f6; font-size: 10px;">(${player})</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs font-black">
                        <span style="color: #facc15;">${stats.pts} pts</span>
                        <span style="color: #60a5fa;">${stats.wins}V - ${stats.losses}D</span>
                        <span style="color: ${pctBonus > 60 ? '#34d399' : pctBonus > 40 ? '#fbbf24' : '#f87171'};">🎯 ${pctBonus}%</span>
                    </div>
                </div>`;
        }
        
        html += `</div></div>`; // Fin de la carte
    }

    html += '</div>';
    container.innerHTML = html;
}