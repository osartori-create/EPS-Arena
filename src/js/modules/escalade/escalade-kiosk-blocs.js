// src/js/modules/escalade/escalade-kiosk-blocs.js
// Interface élève Bloc Contest — 100 % anonyme (codes uniquement, aucune photo).

import { listenBlocConfig, listenValidations, addValidation } from './escalade-blocs-firebase.js';
import { calculerValeurBloc } from './escalade-blocs-core.js';

let currentClasse = '';
let currentCode = '';
let blocs = [];
let validations = {};
let config = null;
let monGroupe = '';
let validationListener = null;

// ============================================================
// Initialisation
// ============================================================
export function initBlocKiosk(classe, code) {
    currentClasse = classe;
    currentCode = code;
    // Le groupe est déduit du code (ex. "A1" → groupe "A").
    monGroupe = (code || '').replace(/[0-9]+$/, '');

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

    // Les codes disponibles pour ce groupe (config.groupes = { A: ["A1","A2"], ... }).
    // On n'affiche que les blocs ; le code choisi est déjà connu.
    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex items-center justify-between gap-4">
                <div>
                    <p class="text-3xl font-black text-white">Code ${currentCode}</p>
                    <p class="text-sm text-slate-400">Groupe ${monGroupe}</p>
                    <p class="text-xs text-slate-500">Clique sur un bloc pour le valider</p>
                </div>
                <div class="text-5xl">🧗</div>
            </div>
        </div>
        <div id="bloc-grid" class="grid grid-cols-2 md:grid-cols-3 gap-4">
    `;

    blocs.forEach(bloc => {
        const estValide = estBlocValide(bloc.id);
        const nbValidations = compterValidations(bloc.id);
        const valeurActuelle = calculerValeurBloc(nbValidations, config.score.valeurInitiale, config.score.decote);
        const couleurFond = estValide ? 'bg-emerald-600' : 'bg-slate-700';
        const border = estValide ? 'border-2 border-emerald-400' : 'border-2 border-slate-600';

        html += `
            <div class="bloc-card ${couleurFond} ${border} rounded-2xl p-4 text-center cursor-pointer active:scale-95 transition-all"
                 onclick="window.validerBloc('${bloc.id}')">
                <div class="text-xl font-black text-white">${bloc.label}</div>
                <div class="text-xs text-slate-300">Valeur : ${valeurActuelle} pts</div>
                <div class="text-xs text-slate-400 mt-1">${nbValidations} validation(s)</div>
                ${estValide ? '<div class="text-xs text-emerald-300 font-bold mt-2">✅ Validé</div>' : ''}
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

// ============================================================
// Helpers (basés sur le CODE anonyme, jamais sur l'ID réel)
// ============================================================
function estBlocValide(blocId) {
    return Object.values(validations).some(v => v.eleveId === currentCode && v.blocId === blocId);
}

function compterValidations(blocId) {
    return Object.values(validations).filter(v => v.blocId === blocId).length;
}

function calculerTotalPoints() {
    if (!config) return 0;
    const params = config.score;
    let total = 0;
    Object.values(validations).forEach(v => {
        if (v.eleveId !== currentCode) return;
        if (params.mode === 'fige') {
            total += v.valeurAuMoment || 0;
        } else {
            const nbTotal = Object.values(validations).filter(va => va.blocId === v.blocId).length;
            total += calculerValeurBloc(nbTotal, params.valeurInitiale, params.decote);
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
                if (v.eleveId !== code) return;
                if (params.mode === 'fige') {
                    total += v.valeurAuMoment || 0;
                } else {
                    const nbTotal = Object.values(validations).filter(va => va.blocId === v.blocId).length;
                    total += calculerValeurBloc(nbTotal, params.valeurInitiale, params.decote);
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
// Validation d'un bloc
// ============================================================
window.validerBloc = function(blocId) {
    if (!currentClasse || !currentCode) {
        alert('Veuillez sélectionner votre code.');
        return;
    }
    if (estBlocValide(blocId)) {
        alert('✅ Vous avez déjà validé ce bloc.');
        return;
    }

    const nbValidations = compterValidations(blocId);
    const params = config.score;
    const valeur = calculerValeurBloc(nbValidations, params.valeurInitiale, params.decote);

    const validationData = {
        eleveId: currentCode,  // code anonyme uniquement
        code: currentCode,
        blocId: blocId,
        timestamp: Date.now(),
        valeurAuMoment: (params.mode === 'fige') ? valeur : undefined,
    };

    addValidation(currentClasse, validationData)
        .then(() => {
            // Optimistic update pour que le feedback reflète la validation immédiatement.
            validations = { ...validations, [`pending_${Date.now()}`]: validationData };
            afficherFeedback();
            setTimeout(() => {
                if (typeof cleanupBlocKiosk === 'function') cleanupBlocKiosk();
                if (typeof window.resetToLogin === 'function') window.resetToLogin();
            }, 3000);
        })
        .catch(err => {
            alert('❌ Erreur lors de la validation : ' + err.message);
        });
};

// ============================================================
// Feedback post-validation (anonyme : points élève + équipe + rang)
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
            <h2 class="text-3xl font-black text-white mb-6">Bloc validé !</h2>
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