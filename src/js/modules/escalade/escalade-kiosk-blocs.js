// src/js/modules/escalade/escalade-kiosk-blocs.js
// Interface élève Bloc Contest — 100 % anonyme (codes uniquement, aucune photo).
// Saisie réussite/échec pour chaque tentative.

import { listenBlocConfig, listenValidations, addValidation } from './escalade-blocs-firebase.js';
import { calculerValeurBloc } from './escalade-blocs-core.js';

let currentClasse = '';
let currentCode = '';
let blocs = [];
let validations = {};
let config = null;
let monGroupe = '';
let validationListener = null;
let blocSelectionne = null; // bloc en attente de choix réussite/échec

// ============================================================
// Initialisation
// ============================================================
export function initBlocKiosk(classe, code) {
    currentClasse = classe;
    currentCode = code;
    // Le groupe est déduit du code (ex. "A1" → groupe "A").
    monGroupe = (code || '').replace(/[0-9]+$/, '');
    blocSelectionne = null;

    listenBlocConfig(classe, (configData) => {
        if (configData) {
            config = configData;
            blocs = config.blocs || [];
            if (validationListener) validationListener();
            validationListener = listenValidations(classe, (validData) => {
                validations = validData;
                afficherInterface();
            });
        } else {
            afficherMessage('⏳ En attente de la configuration du professeur...');
        }
    });
}

// ============================================================
// Affichage
// ============================================================
function afficherInterface() {
    const container = document.getElementById('bloc-kiosk-container');
    if (!container) return;

    if (!config || !config.actif) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400"><p>⏳ Le professeur n’a pas encore activé le Bloc Contest.</p></div>`;
        return;
    }

    // Modale de choix réussite/échec
    if (blocSelectionne) {
        afficherModalChoix(container);
        return;
    }

    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex items-center justify-between gap-4">
                <div>
                    <p class="text-3xl font-black text-white">Code ${currentCode}</p>
                    <p class="text-sm text-slate-400">Groupe ${monGroupe}</p>
                    <p class="text-xs text-slate-500">Clique sur un bloc puis indique si tu l'as réussi ou non</p>
                </div>
                <div class="text-5xl">🧗</div>
            </div>
        </div>
        <div id="bloc-grid" class="grid grid-cols-2 md:grid-cols-3 gap-4">
    `;

    blocs.forEach(bloc => {
        const etat = getEtatBloc(bloc.id); // 'aucune' | 'reussie' | 'echec'
        const nbValidations = compterReussites(bloc.id);
        const valeurActuelle = calculerValeurBloc(nbValidations, config.score.valeurInitiale, config.score.decote);

        let couleurFond = 'bg-slate-700';
        let border = 'border-2 border-slate-600';
        let badge = '';
        if (etat === 'reussie') {
            couleurFond = 'bg-emerald-600';
            border = 'border-2 border-emerald-400';
            badge = '<div class="text-xs text-emerald-300 font-bold mt-2">✅ Réussi</div>';
        } else if (etat === 'echec') {
            couleurFond = 'bg-red-900/60';
            border = 'border-2 border-red-700';
            badge = '<div class="text-xs text-red-300 font-bold mt-2">❌ Raté</div>';
        }

        html += `
            <div class="bloc-card ${couleurFond} ${border} rounded-2xl p-4 text-center cursor-pointer active:scale-95 transition-all"
                 onclick="window.choisirResultatBloc('${bloc.id}')">
                <div class="text-xl font-black text-white">${bloc.label}</div>
                <div class="text-xs text-slate-300">Valeur : ${valeurActuelle} pts</div>
                <div class="text-xs text-slate-400 mt-1">${nbValidations} réussite(s)</div>
                ${badge}
            </div>
        `;
    });

    html += `</div>`;

    const totalPoints = calculerTotalPoints();
    html += `
        <div class="mt-4 text-center text-slate-400">
            Total points : <span class="text-2xl font-black text-yellow-400">${totalPoints}</span>
        </div>
    `;

    container.innerHTML = html;
}

function afficherModalChoix(container) {
    const bloc = blocs.find(b => b.id === blocSelectionne);
    if (!bloc) {
        blocSelectionne = null;
        afficherInterface();
        return;
    }
    const nbValidations = compterReussites(bloc.id);
    const valeurActuelle = calculerValeurBloc(nbValidations, config.score.valeurInitiale, config.score.decote);

    container.innerHTML = `
        <div class="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
            <div class="text-xl font-black text-white mb-2">${bloc.label}</div>
            <div class="text-sm text-slate-400 mb-6">Valeur actuelle : ${valeurActuelle} pts</div>
            <div class="grid grid-cols-2 gap-4 w-full max-w-md">
                <button onclick="window.enregistrerTentativeBloc('${bloc.id}', true)"
                        class="bg-emerald-600 hover:bg-emerald-500 py-6 rounded-2xl font-black text-xl text-white active:scale-95">
                    ✅ Réussi
                </button>
                <button onclick="window.enregistrerTentativeBloc('${bloc.id}', false)"
                        class="bg-red-700 hover:bg-red-600 py-6 rounded-2xl font-black text-xl text-white active:scale-95">
                    ❌ Raté
                </button>
            </div>
            <button onclick="window.annulerChoixResultatBloc()"
                    class="mt-6 bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-2xl font-black text-sm text-white active:scale-95">
                ← Annuler
            </button>
        </div>
    `;
}

// ============================================================
// Helpers (basés sur le CODE anonyme, jamais sur l'ID réel)
// ============================================================
function getValidation(blocId) {
    return Object.values(validations).find(v => v.eleveId === currentCode && v.blocId === blocId);
}

function getEtatBloc(blocId) {
    // "réussi" s'il existe au moins une tentative réussie ;
    // "échec" s'il existe au moins une tentative ratée ; sinon "aucune".
    const mes = Object.values(validations).filter(v => v.eleveId === currentCode && v.blocId === blocId);
    if (mes.some(v => v.reussite !== false)) return 'reussie';
    if (mes.length > 0) return 'echec';
    return 'aucune';
}

function compterReussites(blocId) {
    return Object.values(validations).filter(v => v.blocId === blocId && v.reussite !== false).length;
}

function compterTentatives(blocId) {
    return Object.values(validations).filter(v => v.blocId === blocId).length;
}

function calculerTotalPoints() {
    if (!config) return 0;
    const params = config.score;
    let total = 0;
    Object.values(validations).forEach(v => {
        if (v.eleveId !== currentCode || v.reussite === false) return;
        if (params.mode === 'fige') {
            total += v.valeurAuMoment || 0;
        } else {
            const nbReussites = Object.values(validations).filter(va => va.blocId === v.blocId && va.reussite !== false).length;
            total += calculerValeurBloc(nbReussites, params.valeurInitiale, params.decote);
        }
    });
    return total;
}

function calculerStatsEquipes() {
    const params = config.score;
    const groupes = config.groupes || {};
    const totals = {};

    Object.entries(groupes).forEach(([g, codes]) => {
        let total = 0;
        (codes || []).forEach(code => {
            Object.values(validations).forEach(v => {
                if (v.eleveId !== code || v.reussite === false) return;
                if (params.mode === 'fige') {
                    total += v.valeurAuMoment || 0;
                } else {
                    const nbReussites = Object.values(validations).filter(va => va.blocId === v.blocId && va.reussite !== false).length;
                    total += calculerValeurBloc(nbReussites, params.valeurInitiale, params.decote);
                }
            });
        });
        totals[g] = total;
    });

    const classement = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return { totals, classement };
}

function afficherMessage(msg) {
    const container = document.getElementById('bloc-kiosk-container');
    if (container) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400"><p>${msg}</p></div>`;
    }
}

// ============================================================
// Actions de saisie réussite / échec
// ============================================================
window.choisirResultatBloc = function(blocId) {
    // On ne bloque que si le bloc est déjà réussi. Un bloc raté peut être retenté.
    if (getEtatBloc(blocId) === 'reussie') {
        alert('Tu as déjà réussi ce bloc.');
        return;
    }
    blocSelectionne = blocId;
    afficherInterface();
};

window.annulerChoixResultatBloc = function() {
    blocSelectionne = null;
    afficherInterface();
};

window.enregistrerTentativeBloc = function(blocId, reussite) {
    if (!currentClasse || !currentCode) {
        alert('Veuillez sélectionner votre code.');
        return;
    }
    if (getEtatBloc(blocId) === 'reussie') {
        alert('Tu as déjà réussi ce bloc.');
        return;
    }

    const nbReussites = compterReussites(blocId);
    const params = config.score;
    const valeur = calculerValeurBloc(nbReussites, params.valeurInitiale, params.decote);

    const validationData = {
        eleveId: currentCode,  // code anonyme uniquement
        code: currentCode,
        blocId: blocId,
        reussite: !!reussite,
        timestamp: Date.now(),
    };
    // Firebase interdit les valeurs undefined : on n'ajoute la valeur figée
    // qu'en cas de réussite (les échecs ne rapportent aucun point).
    if (reussite && params.mode === 'fige') {
        validationData.valeurAuMoment = valeur;
    }

    addValidation(currentClasse, validationData)
        .then(() => {
            blocSelectionne = null;
            // Optimistic update pour que le feedback reflète la tentative immédiatement.
            validations = { ...validations, [`pending_${Date.now()}`]: validationData };
            afficherFeedback();
            setTimeout(() => {
                if (typeof cleanupBlocKiosk === 'function') cleanupBlocKiosk();
                if (typeof window.resetToLogin === 'function') window.resetToLogin();
            }, 3000);
        })
        .catch(err => {
            alert('❌ Erreur lors de l\'enregistrement : ' + err.message);
        });
};

// ============================================================
// Feedback post-tentative (anonyme : points élève + équipe + rang)
// ============================================================
function afficherFeedback() {
    const container = document.getElementById('bloc-kiosk-container');
    if (!container) return;

    const mesPoints = calculerTotalPoints();
    const { totals, classement } = calculerStatsEquipes();
    const monTotalEquipe = totals[monGroupe] ?? 0;
    const monRang = classement.findIndex(([g]) => g === monGroupe) + 1;
    const nbEquipes = classement.length;

    let medaille = '';
    if (monRang === 1) medaille = '🥇';
    else if (monRang === 2) medaille = '🥈';
    else if (monRang === 3) medaille = '🥉';

    container.innerHTML = `
        <div class="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
            <div class="text-6xl mb-4">✅</div>
            <h2 class="text-3xl font-black text-white mb-6">Tentative enregistrée !</h2>
            <div class="bg-slate-800 p-6 rounded-3xl border-2 border-slate-600 w-full max-w-sm space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Mes points</span>
                    <span class="text-2xl font-black text-yellow-400">${mesPoints} pts</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Équipe ${monGroupe}</span>
                    <span class="text-2xl font-black text-white">${monTotalEquipe} pts</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Classement équipe</span>
                    <span class="text-2xl font-black text-white">${medaille} ${monRang}/${nbEquipes}</span>
                </div>
            </div>
            <p class="text-sm text-slate-400 mt-6">Retour au choix du code…</p>
        </div>
    `;
}

// ============================================================
// Nettoyage
// ============================================================
export function cleanupBlocKiosk() {
    if (validationListener) {
        validationListener();
        validationListener = null;
    }
}