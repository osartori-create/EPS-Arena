// src/js/modules/badminton/badminton-live.js
import { ref, onValue } from '../../core/firebase-service.js';
import { exportIDoceo } from '../../services/export-idocéo.js';

export function renderBadmintonLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const activeClasse = document.getElementById('selectClasse').value;
    const scoresRef = ref(db, `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}/${activeClasse}/badminton/results`);

    onValue(scoresRef, (snap) => {
        const results = snap.val() || {};
        let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏸 Résultats Badminton</h3>`;

        // Classement global par points (Victoires = 3pts, Défaites = 1pt, Forfait = 0pt)
        const standings = {};
        Object.values(results).forEach(match => {
            if (!standings[match.p1]) standings[match.p1] = { pts: 0, wins: 0, losses: 0 };
            if (!standings[match.p2]) standings[match.p2] = { pts: 0, wins: 0, losses: 0 };

            if (match.score1 > match.score2) {
                standings[match.p1].pts += 3;
                standings[match.p1].wins++;
                standings[match.p2].losses++;
            } else {
                standings[match.p2].pts += 3;
                standings[match.p2].wins++;
                standings[match.p1].losses++;
            }
        });

        const sorted = Object.entries(standings).sort((a, b) => b[1].pts - a[1].pts);

        html += `<div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-2">Classement</h4>
            <table class="w-full text-center">
                <thead><tr class="text-xs text-slate-500"><th>Joueur</th><th>Pts</th><th>V</th><th>D</th></tr></thead>
                <tbody>
                    ${sorted.map(([code, data], idx) => `
                        <tr class="border-t border-slate-700">
                            <td class="py-2 font-black">${idx + 1}. ${code}</td>
                            <td class="text-emerald-400 font-black">${data.pts}</td>
                            <td class="text-blue-400">${data.wins}</td>
                            <td class="text-red-400">${data.losses}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;

        // Bouton Export iDoceo
        html += `<button onclick="window.exportBadmintonIDoceo()" class="bg-green-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-green-400">⬇️ Export iDoceo</button>`;

        container.innerHTML = html;
    });
}