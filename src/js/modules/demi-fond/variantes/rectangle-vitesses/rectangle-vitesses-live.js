// src/js/modules/demi-fond/variantes/rectangle-vitesses/rectangle-vitesses-live.js
// Live prof : suivi des bilans (vitesse + RPE) saisis par les élèves.
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getExistingEleves } from '../../../../services/admin-service.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { getCurrentClasse } from '../../../../core/live-engine.js';
import { getBasePath } from '../../demifond-common.js';

let unsubs = [];
let config = null;
let observations = {};

function elevesParCode(eleves) {
    const map = {};
    eleves.forEach(e => {
        if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) {
            map[String(e.codeAutoEval)] = e;
        }
    });
    return map;
}

export function renderRectangleVitessesLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];

    const basePath = getBasePath(classe);

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => {
        config = snap.val() || null;
        rendre();
    }));

    unsubs.push(onValue(ref(db, `${basePath}/observations/rectangle-vitesses`), snap => {
        observations = snap.val() || {};
        rendre();
    }));

    rendre();

    return () => {
        unsubs.forEach(u => { try { u(); } catch (e) {} });
        unsubs = [];
    };
}

async function rendre() {
    const container = document.getElementById('live-content');
    if (!container) return;

    if (!config || config.sousModule !== 'rectangle-vitesses') {
        container.innerHTML = '<p class="text-slate-500 text-center">Sous-module « Rectangle des vitesses » non transmis.</p>';
        return;
    }

    const classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    const elevesMap = elevesParCode(getExistingEleves(classe));
    const titreSousActivite = config.sousActivite === 'echauffement'
        ? 'Fiche d’échauffement'
        : 'Régulier sur 3 minutes';

    const entrees = Object.values(observations).sort((a, b) => b.vitesse - a.vitesse);
    const nbSaisis = entrees.length;
    const nbTotal = Object.keys(elevesMap).length;

    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">🟦 Rectangle des vitesses — ${titreSousActivite}</h3>
                    <p class="text-xs text-slate-400">${nbSaisis} / ${nbTotal} bilans saisis</p>
                </div>
            </div>
        </div>
    `;

    if (entrees.length === 0) {
        html += '<p class="text-slate-500 text-center py-6">En attente des premiers bilans...</p>';
        container.innerHTML = html;
        return;
    }

    for (const obs of entrees) {
        const eleve = elevesMap[String(obs.code)];
        const photo = eleve ? await getPhotoUrl(eleve.id) : null;
        const photoHtml = photo
            ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600">`
            : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">👤</div>`;

        const rpe = obs.rpe;
        const rpeCouleur = rpe <= 3 ? '#22c55e' : (rpe <= 5 ? '#eab308' : (rpe <= 7 ? '#f97316' : '#ef4444'));

        html += `
            <div class="flex items-center gap-3 bg-slate-800 p-3 rounded-2xl border border-slate-700">
                ${photoHtml}
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-white text-sm truncate">${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + obs.code}</div>
                    <div class="text-[10px] text-slate-500">#${obs.code}</div>
                </div>
                <div class="text-center">
                    <div class="text-xl font-black text-emerald-400">${obs.vitesse} km/h</div>
                    <div class="text-[9px] text-slate-500 uppercase">vitesse</div>
                </div>
                <div class="text-center px-2 py-1 rounded-lg" style="background:${rpeCouleur}20; color:${rpeCouleur}">
                    <div class="text-base font-black">RPE ${rpe}</div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}