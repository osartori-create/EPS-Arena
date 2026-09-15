// src/js/modules/ppg/ppg-interface.js
// UI Professeur : config séance du jour + aperçu classe
import { db, ref, onValue, set, remove } from '../../core/firebase-service.js';
import { getPhotoUrl, getExistingEleves } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import {
    BIBLIOTHEQUE_DEFAUT, fusionnerBibliotheque,
    calculerPoints, agregerSeance, trierClassement, getMedaille
} from './ppg-core.js';

let currentClasse = '';
let currentEleves = [];
let currentBibliotheque = [];
let currentSeance = null;         // { ateliers: ['corde','pompes','gainage'], date, timestamp }
let currentObservations = {};     // { date: { code: { corde:{...}, ... } } }
let currentConfig = {};
let unsubs = [];

// ============================================================
// UTILITAIRES
// ============================================================
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

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initPPGInterface() {
    const container = getOrCreateContainer();
    if (!container) return;

    currentClasse = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Sélectionnez une classe.</p>';
        return;
    }

    currentEleves = getExistingEleves(currentClasse);

    // Cleanup
    unsubs.forEach(u => { try { u(); } catch(e) {} });
    unsubs = [];

    const basePath = getPPGBasePath(currentClasse);
    const configRef = ref(db, `${basePath}/config`);
    const seanceRef = ref(db, `${basePath}/seance/${getTodayDate()}`);
    const obsRef = ref(db, `${basePath}/observations`);

    unsubs.push(onValue(configRef, snap => {
        currentConfig = snap.val() || {};
        currentBibliotheque = fusionnerBibliotheque(currentConfig.ateliers);
        rendre();
    }));
    unsubs.push(onValue(seanceRef, snap => {
        currentSeance = snap.val();
        rendre();
    }));
    unsubs.push(onValue(obsRef, snap => {
        currentObservations = snap.val() || {};
        rendre();
    }));

    rendre();

    return () => {
        unsubs.forEach(u => { try { u(); } catch(e) {} });
        unsubs = [];
    };
}

function getOrCreateContainer() {
    let container = document.getElementById('viewPPGSettings');
    if (container) return container;
    const parent = document.getElementById('viewActivities');
    if (!parent) return null;
    container = document.createElement('div');
    container.id = 'viewPPGSettings';
    container.className = 'hidden space-y-4';
    parent.appendChild(container);
    return container;
}

// ============================================================
// RENDU PROF
// ============================================================
function rendre() {
    const container = document.getElementById('viewPPGSettings');
    if (!container) return;

    if (currentBibliotheque.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Chargement...</p>';
        return;
    }

    let html = '';

    // ── Bloc 1 : configuration de la séance du jour ──
    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 class="font-black text-blue-400 uppercase text-sm">🏋️ Séance PPG du jour</h3>
                <span class="text-xs text-slate-400">${getTodayDate()}</span>
            </div>
            <p class="text-xs text-slate-400 mb-3">Choisis 1 à 3 ateliers pour la séance. La structure (2×45''/15'') est fixe.</p>
            <div id="ppg-slots" class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3"></div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="window.ppgAjouterAtelier()" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95 border border-slate-600">
                    ➕ Nouvel atelier
                </button>
                <button onclick="window.ppgValiderSeance()" class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                    ✅ Enregistrer la séance
                </button>
                <button onclick="window.ppgSupprimerSeance()" class="bg-red-900/50 hover:bg-red-800 px-3 py-2 rounded-xl font-black text-xs text-red-300 active:scale-95">
                    🗑️ Effacer
                </button>
            </div>
        </div>
    `;

    // ── Bloc 2 : aperçu du classement (dernière séance) ──
    if (currentSeance && Array.isArray(currentSeance.ateliers) && currentSeance.ateliers.length > 0) {
        const ateliersActifs = currentSeance.ateliers
            .map(id => currentBibliotheque.find(a => a.id === id))
            .filter(Boolean);

        const obsJour = currentObservations[getTodayDate()] || {};
        const elevesMap = elevesParCode(currentEleves);

        // Construction des totaux par code
        const totauxParCode = {};
        Object.entries(obsJour).forEach(([code, obs]) => {
            totauxParCode[code] = agregerSeance(obs, ateliersActifs);
        });

        html += `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
                    <h3 class="font-black text-blue-400 uppercase text-sm">🏆 Résultats du jour</h3>
                    <span class="text-xs text-slate-400">${Object.keys(totauxParCode).length} / ${currentEleves.length} élèves ont saisi</span>
                </div>
        `;

        // Onglets par atelier
        html += `<div class="flex gap-2 mb-3 flex-wrap" id="ppg-tabs-ateliers">`;
        html += `<button onclick="window.ppgFiltreAtelier('')" data-atelier="" class="ppg-tab-btn px-3 py-1.5 rounded-xl font-black text-xs bg-blue-600 text-white">Tous</button>`;
        ateliersActifs.forEach(a => {
            html += `<button onclick="window.ppgFiltreAtelier('${a.id}')" data-atelier="${a.id}" class="ppg-tab-btn px-3 py-1.5 rounded-xl font-black text-xs bg-slate-700 text-slate-300">${a.emoji} ${a.label}</button>`;
        });
        html += `</div>`;

        html += `<div id="ppg-classement" class="space-y-2 max-h-[60vh] overflow-y-auto pr-1"></div>`;
        html += `</div>`;

        // Stockage pour le filtre
        window._ppgAteliersActifs = ateliersActifs;
        window._ppgTotauxParCode = totauxParCode;
        window._ppgElevesMap = elevesMap;
        window._ppgFiltreActif = '';

        // Rendu différé du classement (photos asynchrones)
        setTimeout(() => {
            const initialFiltre = '';
            rendreClassement(initialFiltre);
        }, 50);
    } else {
        html += `
            <div class="bg-blue-900/20 border-2 border-blue-500 p-4 rounded-2xl text-center">
                <p class="text-blue-300 text-sm">Aucune séance configurée aujourd'hui.</p>
            </div>
        `;
    }

    container.innerHTML = html;

    // Rendu des slots d'atelier
    rendreSlotsAteliers();
}

// ============================================================
// SLOTS D'ATELIERS (3 max)
// ============================================================
function rendreSlotsAteliers() {
    const container = document.getElementById('ppg-slots');
    if (!container) return;

    const ateliersActifs = currentSeance?.ateliers || ['', '', ''];

    let html = '';
    for (let i = 0; i < 3; i++) {
        const idActif = ateliersActifs[i] || '';
        const options = currentBibliotheque.map(a =>
            `<option value="${a.id}" ${a.id === idActif ? 'selected' : ''}>${a.emoji} ${a.label}</option>`
        ).join('');

        html += `
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-1">
    Atelier ${i + 1}${i > 0 ? ' <span class="text-slate-600">(optionnel)</span>' : ''}
</label>
                <select id="ppg-slot-${i}" class="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white text-sm">
                    <option value="">-- Choisir --</option>
                    ${options}
                </select>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// CLASSEMENT
// ============================================================
async function rendreClassement(filtreAtelier) {
    const container = document.getElementById('ppg-classement');
    if (!container) return;
    const totauxParCode = window._ppgTotauxParCode || {};
    const elevesMap = window._ppgElevesMap || {};

    if (Object.keys(totauxParCode).length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm text-center py-6">Aucune observation pour aujourd\'hui.</p>';
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

        // Détail par atelier
        const detail = Object.entries(item.parAtelier).map(([atelierId, data]) => {
            const atelier = currentBibliotheque.find(a => a.id === atelierId);
            if (!atelier) return '';
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

window.ppgFiltreAtelier = function(id) {
    window._ppgFiltreActif = id;
    document.querySelectorAll('.ppg-tab-btn').forEach(btn => {
        const isActive = btn.dataset.atelier === id;
        btn.className = `ppg-tab-btn px-3 py-1.5 rounded-xl font-black text-xs ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`;
    });
    rendreClassement(id);
};

// ============================================================
// ACTIONS PROF
// ============================================================
window.ppgValiderSeance = async function() {
    const slots = [0, 1, 2].map(i => document.getElementById(`ppg-slot-${i}`)?.value).filter(Boolean);

    if (slots.length === 0) {
        return alert('Choisis au moins 1 atelier pour la séance.');
    }
    if (slots.length > 3) {
        return alert('Maximum 3 ateliers par séance.');
    }
    if (new Set(slots).size !== slots.length) {
        return alert('Les ateliers doivent être différents.');
    }

    const basePath = getPPGBasePath(currentClasse);
    try {
        await set(ref(db, `${basePath}/seance/${getTodayDate()}`), {
            ateliers: slots,
            timestamp: Date.now()
        });
        alert('✅ Séance enregistrée. Les élèves peuvent saisir au kiosque.');
    } catch (err) {
        alert('❌ Erreur : ' + err.message);
    }
};

window.ppgSupprimerSeance = async function() {
    if (!confirm('Effacer la config de la séance du jour ?\n(Les observations saisies ne sont pas supprimées.)')) return;
    const basePath = getPPGBasePath(currentClasse);
    try {
        await remove(ref(db, `${basePath}/seance/${getTodayDate()}`));
    } catch (err) {
        alert('❌ Erreur : ' + err.message);
    }
};

window.ppgAjouterAtelier = function() {
    const label = prompt('Nom du nouvel atelier ?');
    if (!label) return;
    const emoji = prompt('Emoji ? (ex: 🏃)', '🏃') || '🏃';
    const unite = prompt('Unité ? (reps / secondes / sauts)', 'reps') || 'reps';

    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (currentBibliotheque.find(a => a.id === id)) {
        return alert('Cet atelier existe déjà.');
    }

    const nouvelAtelier = {
        id,
        label: label.trim(),
        emoji,
        couleur: '#94a3b8',
        type: 'quantitatif',
        unite,
        pointsParUnite: 1
    };

    const nouvelleBiblio = [...currentBibliotheque, nouvelAtelier];
    const basePath = getPPGBasePath(currentClasse);
    set(ref(db, `${basePath}/config/ateliers`), nouvelleBiblio)
        .then(() => alert(`✅ Atelier "${label}" ajouté.`))
        .catch(err => alert('❌ Erreur : ' + err.message));
};