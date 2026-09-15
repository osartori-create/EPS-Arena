// src/js/modules/tournoi/variantes/atp/atp-live.js
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse } from '../../tournoi-core.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { recalculerTout, trierClassement, BAREME_DEFAUT, getMedaille, formatEcart } from './atp-core.js';

let unsub = null;

export function renderLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    if (unsub) { unsub(); unsub = null; }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseATP = `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/atp`;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const elevesMap = {};
    eleves.forEach(e => {
        if (e.codeAutoEval) elevesMap[String(e.codeAutoEval)] = e;
    });

    let matchs = {};
    let config = {};

    function render() {
        const bareme = (config.bareme && config.bareme.length > 0) ? config.bareme : BAREME_DEFAUT;
        const codes = eleves.map(e => String(e.codeAutoEval)).filter(Boolean);
        const joueurs = recalculerTout(codes, matchs, bareme);
        const classement = trierClassement(joueurs, elevesMap);

        let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-3">🏆 Classement ATP en direct</h3>`;
        html += `<div class="space-y-2 max-h-[70vh] overflow-y-auto pr-1">`;

        (async () => {
            for (const item of classement) {
                const eleve = item.eleve;
                const photo = eleve ? await getPhotoUrl(eleve.id) : null;
                const photoHtml = photo
                    ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600">`
                    : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">👤</div>`;

                const couleur = item.rang === 1 ? 'border-yellow-500 bg-yellow-500/5' :
                                item.rang === 2 ? 'border-slate-400' :
                                item.rang === 3 ? 'border-amber-600' : 'border-slate-700';

                html += `
                    <div class="flex items-center gap-3 bg-slate-800 p-2 rounded-xl border-2 ${couleur}">
                        <div class="text-2xl min-w-[42px] text-center font-black text-slate-300">${getMedaille(item.rang)}</div>
                        ${photoHtml}
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-white text-sm truncate">${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}</div>
                            <div class="text-[10px] text-slate-500">#${item.code} · ${item.victoires}V-${item.defaites}D</div>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-black ${item.points >= 100 ? 'text-emerald-400' : 'text-red-400'}">${item.points}</div>
                            <div class="text-[9px] text-slate-500 uppercase">pts</div>
                        </div>
                    </div>
                `;
            }
            html += `</div>`;
            container.innerHTML = html;
        })();
    }

    unsub = () => {
        // On stocke les unsub internes pour cleanup
    };

    let loadedCount = 0;
    const check = () => { if (loadedCount >= 2) render(); };

    const u1 = onValue(ref(db, `${baseATP}/matchs`), snap => {
        matchs = snap.val() || {};
        loadedCount++;
        if (loadedCount >= 2) render();
    });
    const u2 = onValue(ref(db, `${baseATP}/config`), snap => {
        config = snap.val() || {};
        loadedCount++;
        if (loadedCount >= 2) render();
    });

    unsub = () => { u1(); u2(); };
}