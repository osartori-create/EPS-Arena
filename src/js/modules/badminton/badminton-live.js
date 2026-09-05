// src/js/modules/badminton/badminton-live.js
// Live Badminton : affichage des matchs en direct

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse, getStudentsMap } from '../../core/live-engine.js';

let currentUnsub = null;
let currentClasse = '';

export function renderBadmintonLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = document.getElementById('selectClasse')?.value || getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    currentClasse = classe;

    const mapping = getLocalMapping(classe) || {};
    const studentsMap = getStudentsMap(classe) || {};

    console.log("📋 [Live] Mapping local :", mapping);
    console.log("📋 [Live] StudentsMap :", studentsMap);

    // ✅ Fonction corrigée : utilise le terrain et la lettre
    function getEleveFromCode(terrain, lettre) {
        // Construire la clé complète : "classe_terrain_lettre"
        const key = `${classe}_${terrain}_${lettre}`;
        console.log(`🔍 [Live] Recherche de ${key}`);
        if (mapping[key]) {
            const eleveId = mapping[key];
            const nom = studentsMap[eleveId] || `${lettre}`;
            return { id: eleveId, nom: nom };
        }

        // Si on a un tableau (plusieurs joueurs par lettre), on prend le premier
        for (const [k, v] of Object.entries(mapping)) {
            if (k.startsWith(`${classe}_${terrain}_${lettre}`)) {
                if (Array.isArray(v)) {
                    const eleveId = v[0] || v;
                    const nom = studentsMap[eleveId] || `${lettre}`;
                    return { id: eleveId, nom: nom };
                } else {
                    const eleveId = v;
                    const nom = studentsMap[eleveId] || `${lettre}`;
                    return { id: eleveId, nom: nom };
                }
            }
        }

        return { id: null, nom: `${lettre}` };
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/badminton/results`);

    if (currentUnsub) currentUnsub();

    currentUnsub = onValue(resultsRef, async (snap) => {
        const data = snap.val() || {};
        const matchs = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);

        if (matchs.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-center">Aucun match terminé.</p>';
            return;
        }

        let html = `
            <div class="space-y-4">
                <h3 class="font-black text-blue-400 uppercase text-sm">🏸 Derniers matchs</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        `;

        for (const m of matchs.slice(0, 20)) {
            const terrain = m.terrain || '1';
            const p1Lettre = m.p1 || '?';
            const p2Lettre = m.p2 || '?';
            const score1 = m.score1 || 0;
            const score2 = m.score2 || 0;
            const style1 = m.avecManiere1 ? '✅ avec manière' : '❌ sans manière';
            const style2 = m.avecManiere2 ? '✅ avec manière' : '❌ sans manière';

            // ✅ Récupérer les infos avec terrain + lettre
            const joueur1 = getEleveFromCode(terrain, p1Lettre);
            const joueur2 = getEleveFromCode(terrain, p2Lettre);

            const photo1 = await getPhotoFromId(joueur1.id);
            const photo2 = await getPhotoFromId(joueur2.id);

            const winner = m.winner === p1Lettre ? p1Lettre : (m.winner === p2Lettre ? p2Lettre : '?');
            const couleurGagnant = winner === p1Lettre ? 'text-emerald-400' : (winner === p2Lettre ? 'text-emerald-400' : 'text-yellow-400');

            html += `
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center gap-2">
                            ${photo1}
                            <span class="font-black text-white">${joueur1.nom}</span>
                            <span class="text-[10px] text-slate-500">T${terrain}-${p1Lettre}</span>
                        </div>
                        <div class="text-center">
                            <span class="text-3xl font-black text-yellow-400">${score1} - ${score2}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] text-slate-500">T${terrain}-${p2Lettre}</span>
                            <span class="font-black text-white">${joueur2.nom}</span>
                            ${photo2}
                        </div>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="${score1 >= (m.bonusManiere || 5) ? 'text-emerald-400' : 'text-red-400'}">${style1}</span>
                        <span class="text-slate-500">Points : ${m.pts1 || 0} / ${m.pts2 || 0}</span>
                        <span class="${score2 >= (m.bonusManiere || 5) ? 'text-emerald-400' : 'text-red-400'}">${style2}</span>
                    </div>
                    <div class="text-center text-xs text-slate-500 mt-1">
                        🏆 Gagnant : <span class="font-bold ${couleurGagnant}">${winner}</span>
                    </div>
                </div>
            `;
        }

        html += `</div></div>`;
        container.innerHTML = html;
    });
}

async function getPhotoFromId(id) {
    if (!id) return `<div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm">👤</div>`;
    try {
        const url = await getPhotoUrl(id);
        if (url) {
            return `<img src="${url}" class="w-8 h-8 rounded-full object-cover border-2 border-slate-500">`;
        }
    } catch (e) { /* ignore */ }
    return `<div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm">👤</div>`;
}

export function initBadmintonLive() {
    renderBadmintonLive();
}