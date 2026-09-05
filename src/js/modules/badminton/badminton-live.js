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

    // ✅ Récupérer le mapping local et les élèves
    const mapping = getLocalMapping(classe) || {};
    const studentsMap = getStudentsMap(classe) || {};

    console.log("📋 [Live] Mapping local :", mapping);
    console.log("📋 [Live] StudentsMap :", studentsMap);

    // Fonction pour retrouver un élève à partir d'un code (ex: "1_A")
    function getEleveFromCode(code) {
        // Recherche directe dans le mapping
        const key = `${classe}_${code}`;
        if (mapping[key]) {
            const eleveId = mapping[key];
            const nom = studentsMap[eleveId] || code;
            return { id: eleveId, nom: nom };
        }

        // Recherche avec tableau (cas où plusieurs joueurs par lettre)
        const match = code.match(/^(\d+)_([A-Z])$/);
        if (match) {
            const terrain = match[1];
            const lettre = match[2];
            // Chercher une clé qui commence par `${classe}_${terrain}_${lettre}`
            for (const [key, value] of Object.entries(mapping)) {
                if (key.startsWith(`${classe}_${terrain}_${lettre}`)) {
                    // Si c'est un tableau, prendre l'élément approprié
                    if (Array.isArray(value)) {
                        // On n'a pas l'index, on prend le premier
                        const eleveId = value[0] || value;
                        const nom = studentsMap[eleveId] || code;
                        return { id: eleveId, nom: nom };
                    } else {
                        const eleveId = value;
                        const nom = studentsMap[eleveId] || code;
                        return { id: eleveId, nom: nom };
                    }
                }
            }
        }

        return { id: null, nom: code };
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
            const p1Code = m.p1 || '?';
            const p2Code = m.p2 || '?';
            const score1 = m.score1 || 0;
            const score2 = m.score2 || 0;
            const style1 = m.avecManiere1 ? '✅ avec manière' : '❌ sans manière';
            const style2 = m.avecManiere2 ? '✅ avec manière' : '❌ sans manière';

            // ✅ Récupérer les infos des joueurs
            const joueur1 = getEleveFromCode(p1Code);
            const joueur2 = getEleveFromCode(p2Code);

            const photo1 = await getPhotoFromId(joueur1.id);
            const photo2 = await getPhotoFromId(joueur2.id);

            const winner = m.winner === p1Code ? p1Code : (m.winner === p2Code ? p2Code : '?');
            const couleurGagnant = winner === p1Code ? 'text-emerald-400' : (winner === p2Code ? 'text-emerald-400' : 'text-yellow-400');

            html += `
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center gap-2">
                            ${photo1}
                            <span class="font-black text-white">${joueur1.nom}</span>
                            <span class="text-[10px] text-slate-500">${p1Code}</span>
                        </div>
                        <div class="text-center">
                            <span class="text-3xl font-black text-yellow-400">${score1} - ${score2}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] text-slate-500">${p2Code}</span>
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