// src/js/modules/ppg/ppg-live.js
// Live prof : suivi temps réel de la séance PPG du jour
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl, getExistingEleves } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import {
    fusionnerBibliotheque, agregerSeance, trierClassement,
    getAtelierById, getMedaille, calculerProgression
} from './ppg-core.js';

let unsubs = [];
let currentSeance = null;
let currentObservations = {};      // toutes les dates
let currentBibliotheque = [];
let currentEleves = [];
let currentDateAffichee = null;    // date "YYYY-MM-DD" ou null (= aujourd'hui)

function getProfBasePath() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}
function getPPGBasePath(classe) {
    return `${getProfBasePath()}/${classe}/ppg`;
}
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}
function elevesParCode(eleves) {
    const map = {};
    eleves.forEach(e => {
        if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) {
            map[String(e.codeAutoEval)] = e;
        }
    });
    return map;
}

export function renderPPGLive() {
    console.log('[PPG Live] renderPPGLive appelée');
    const container = document.getElementById('live-content');
    if (!container) {
        console.warn('[PPG Live] Conteneur live-content introuvable');
        return;
    }

    const classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    currentDateAffichee = getTodayDate();
    currentEleves = getExistingEleves(classe);

    unsubs.forEach(u => { try { u(); } catch(e) {} });
    unsubs = [];

    const basePath = getPPGBasePath(classe);

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => {
        const cfg = snap.val() || {};
        currentBibliotheque = fusionnerBibliotheque(cfg.ateliers);
        rendre();
    }));

    unsubs.push(onValue(ref(db, `${basePath}/seance`), snap => {
        // On charge toutes les séances pour pouvoir changer de date
        window._ppgSeances = snap.val() || {};
        rendre();
    }));

    unsubs.push(onValue(ref(db, `${basePath}/observations`), snap => {
        currentObservations = snap.val() || {};
        rendre();
    }));

    rendre();

    return () => {
        unsubs.forEach(u => { try { u(); } catch(e) {} });
        unsubs = [];
    };
}

function rendre() {
    const container = document.getElementById('live-content');
    if (!container) return;

    if (currentBibliotheque.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center">Chargement...</p>';
        return;
    }

    const dateAffichee = currentDateAffichee || getTodayDate();
    const seance = (window._ppgSeances || {})[dateAffichee] || null;
    const obsDuJour = currentObservations[dateAffichee] || {};
    const elevesMap = elevesParCode(currentEleves);

    if (!seance || !Array.isArray(seance.ateliers) || seance.ateliers.length === 0) {
        container.innerHTML = `
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center">
                <p class="text-slate-400">Aucune séance configurée pour le ${new Date(dateAffichee + 'T00:00:00').toLocaleDateString('fr-FR')}.</p>
            </div>
        `;
        return;
    }

    const ateliersActifs = seance.ateliers
        .map(id => getAtelierById(id, currentBibliotheque))
        .filter(Boolean);

    // Calcul des totaux par code
    const totauxParCode = {};
    Object.entries(obsDuJour).forEach(([code, obs]) => {
        totauxParCode[code] = agregerSeance(obs, ateliersActifs);
    });

    // Stats de saisie
    const nbElevesAvecCode = currentEleves.filter(e => e.codeAutoEval).length;
    const nbSaisis = Object.keys(totauxParCode).length;

    // Rendu
    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">🏋️ PPG — ${new Date(dateAffichee + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</h3>
                    <p class="text-xs text-slate-400">${nbSaisis} / ${nbElevesAvecCode} élèves ont saisi · ${ateliersActifs.length} atelier${ateliersActifs.length > 1 ? 's' : ''}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.ppgLiveChangerDate(-1)" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Précédent</button>
                    <button onclick="window.ppgLiveAujourdhui()" class="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">Aujourd'hui</button>
                    <button onclick="window.ppgLiveChangerDate(1)" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">Suivant →</button>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    `;

    // Colonne 1-2 : classement du jour
    html += `
            <div class="lg:col-span-2 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
                    <h4 class="font-black text-white text-sm uppercase">🏆 Classement du jour</h4>
                </div>
                <div class="flex gap-2 mb-3 flex-wrap" id="ppg-live-tabs">
                    <button onclick="window.ppgLiveFiltre('')" data-atelier="" class="ppg-live-tab px-3 py-1.5 rounded-xl font-black text-xs bg-blue-600 text-white">Tous</button>
    `;
    ateliersActifs.forEach(a => {
        html += `<button onclick="window.ppgLiveFiltre('${a.id}')" data-atelier="${a.id}" class="ppg-live-tab px-3 py-1.5 rounded-xl font-black text-xs bg-slate-700 text-slate-300">${a.emoji} ${a.label}</button>`;
    });
    html += `</div>`;
    html += `<div id="ppg-live-classement" class="space-y-2 max-h-[65vh] overflow-y-auto pr-1"></div>`;
    html += `</div>`;

    // Colonne 3 : pas encore saisi
    html += `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h4 class="font-black text-white text-sm uppercase mb-3">⏳ Pas encore saisi (${nbElevesAvecCode - nbSaisis})</h4>
                <div id="ppg-live-manquants" class="space-y-2 max-h-[65vh] overflow-y-auto pr-1"></div>
            </div>
    `;
    html += `</div>`;

    container.innerHTML = html;

    // Rendu différé du classement (photos asynchrones)
    window._ppgAteliersActifs = ateliersActifs;
    window._ppgTotauxParCode = totauxParCode;
    window._ppgElevesMap = elevesMap;
    window._ppgFiltreActif = '';

    setTimeout(() => {
        rendreClassement('');
        rendreManquants(totauxParCode, elevesMap);
    }, 50);
}

async function rendreClassement(filtreAtelier) {
    const container = document.getElementById('ppg-live-classement');
    if (!container) return;
    const totauxParCode = window._ppgTotauxParCode || {};
    const elevesMap = window._ppgElevesMap || {};
    const ateliersActifs = window._ppgAteliersActifs || [];

    if (Object.keys(totauxParCode).length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm text-center py-6">Aucune observation pour cette date.</p>';
        return;
    }

    const classement = trierClassement(totauxParCode, elevesMap, filtreAtelier || null);

    let html = '';
    for (const item of classement) {
        const eleve = item.eleve;
        const photo = eleve ? await getPhotoUrl(eleve.id) : null;
        const photoHtml = photo
            ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600">`
            : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">👤</div>`;

        const detail = Object.entries(item.parAtelier).map(([atelierId, data]) => {
            const niveauStr = data.niveau ? ` (N${data.niveau})` : '';
            return `<span class="text-[10px] px-1.5 py-0.5 rounded" style="background:${data.couleur}30; color:${data.couleur}">
                        ${data.emoji} ${data.best}${niveauStr}
                    </span>`;
        }).join(' ');

        const couleur = item.rang === 1 ? 'border-yellow-500' :
                        item.rang === 2 ? 'border-slate-400' :
                        item.rang === 3 ? 'border-amber-600' : 'border-slate-700';

        html += `
            <div class="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border-2 ${couleur}">
                <div class="text-2xl min-w-[42px] text-center font-black text-slate-300">${getMedaille(item.rang)}</div>
                ${photoHtml}
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-white text-sm truncate">${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}</div>
                    <div class="flex flex-wrap gap-1 mt-1">${detail}</div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-black text-emerald-400">${item.totalPts}</div>
                    <div class="text-[9px] text-slate-500 uppercase">pts</div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function rendreManquants(totauxParCode, elevesMap) {
    const container = document.getElementById('ppg-live-manquants');
    if (!container) return;

    const tousCodes = Object.keys(elevesMap);
    const codesSaisis = new Set(Object.keys(totauxParCode));
    const manquants = tousCodes.filter(c => !codesSaisis.has(c));

    if (manquants.length === 0) {
        container.innerHTML = '<p class="text-emerald-400 text-sm text-center py-6">🎉 Tous les élèves ont saisi !</p>';
        return;
    }

    let html = '';
    for (const code of manquants) {
        const eleve = elevesMap[code];
        const photo = eleve ? await getPhotoUrl(eleve.id) : null;
        const photoHtml = photo
            ? `<img src="${photo}" class="w-8 h-8 rounded-full object-cover border border-slate-600">`
            : `<div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm">👤</div>`;

        html += `
            <div class="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700 opacity-70">
                ${photoHtml}
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-white truncate">${eleve.prenom} ${eleve.nom}</div>
                </div>
                <span class="text-xs font-black text-slate-500">#${code}</span>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// ACTIONS
// ============================================================
window.ppgLiveFiltre = function(atelierId) {
    window._ppgFiltreActif = atelierId;
    document.querySelectorAll('.ppg-live-tab').forEach(btn => {
        const isActive = btn.dataset.atelier === atelierId;
        btn.className = `ppg-live-tab px-3 py-1.5 rounded-xl font-black text-xs ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`;
    });
    rendreClassement(atelierId);
};

window.ppgLiveChangerDate = function(delta) {
    const base = currentDateAffichee || getTodayDate();
    const d = new Date(base + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    currentDateAffichee = d.toISOString().split('T')[0];
    rendre();
};

window.ppgLiveAujourdhui = function() {
    currentDateAffichee = getTodayDate();
    rendre();
};