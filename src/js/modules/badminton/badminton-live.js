// src/js/modules/badminton/badminton-live.js
// Live Badminton : affichage des matchs en direct

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';

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

    // Récupérer le mapping local
    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    // Construire un map id -> nom + photo
    const eleveMap = {};
    eleves.forEach(e => {
        eleveMap[e.id] = { nom: `${e.prenom} ${e.nom}`, sexe: e.sexe };
    });

    // Fonction pour retrouver l'élève à partir d'un code (ex: "1_A")
    function getEleveFromCode(code) {
        // Le code est de la forme "terrain_lettre" ou "terrain_lettre"
        // On cherche dans le mapping local
        for (const [key, value] of Object.entries(mapping)) {
            // key = "classe_1_A" par exemple
            const parts = key.split('_');
            if (parts.length >= 3) {
                const terrain = parts[1];
                const lettre = parts[2];
                if (`${terrain}_${lettre}` === code) {
                    return eleveMap[value] || { nom: code, sexe: '' };
                }
                // Si c'est un tableau (plusieurs joueurs par lettre)
                if (Array.isArray(value)) {
                    const index = parseInt(lettre) - 1;
                    if (index >= 0 && index < value.length) {
                        const id = value[index];
                        return eleveMap[id] || { nom: code, sexe: '' };
                    }
                }
            }
        }
        return { nom: code, sexe: '' };
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
            const p1 = m.p1 || '?';
            const p2 = m.p2 || '?';
            const score1 = m.score1 || 0;
            const score2 = m.score2 || 0;
            const style1 = m.avecManiere1 ? '✅ avec manière' : '❌ sans manière';
            const style2 = m.avecManiere2 ? '✅ avec manière' : '❌ sans manière';

            // Récupérer les infos des joueurs
            const joueur1 = getEleveFromCode(p1);
            const joueur2 = getEleveFromCode(p2);

            const photo1 = await getPhotoFromId(joueur1.id || p1);
            const photo2 = await getPhotoFromId(joueur2.id || p2);

            const winner = m.winner === p1 ? p1 : (m.winner === p2 ? p2 : '?');
            const couleurGagnant = winner === p1 ? 'text-emerald-400' : (winner === p2 ? 'text-emerald-400' : 'text-yellow-400');

            html += `
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center gap-2">
                            ${photo1}
                            <span class="font-black text-white">${joueur1.nom}</span>
                            <span class="text-xs text-slate-400">${p1}</span>
                        </div>
                        <div class="text-center">
                            <span class="text-3xl font-black text-yellow-400">${score1} - ${score2}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-slate-400">${p2}</span>
                            <span class="font-black text-white">${joueur2.nom}</span>
                            ${photo2}
                        </div>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="${score1 >= (m.bonusManiere || 5) ? 'text-emerald-400' : 'text-red-400'}">${style1}</span>
                        <span class="text-slate-500">Points classement : ${m.pts1 || 0} / ${m.pts2 || 0}</span>
                        <span class="${score2 >= (m.bonusManiere || 5) ? 'text-emerald-400' : 'text-red-400'}">${style2}</span>
                    </div>
                    <div class="text-center text-xs text-slate-500 mt-1">
                        🏆 Gagnant : <span class="font-bold ${couleurGagnant}">${winner}</span>
                        ${m.mode ? `| Mode : ${m.mode}` : ''}
                    </div>
                </div>
            `;
        }

        html += `</div></div>`;
        container.innerHTML = html;
    });
}

// Fonction utilitaire pour récupérer la photo d'un élève
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

// Exporter pour le live
export function initBadmintonLive() {
    renderBadmintonLive();
}