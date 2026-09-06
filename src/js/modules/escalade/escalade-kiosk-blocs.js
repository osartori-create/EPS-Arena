// src/js/modules/escalade/escalade-kiosk-blocs.js
// Interface élève Bloc Contest (drag & drop)

import { listenBlocConfig, listenValidations, addValidation } from './escalade-blocs-firebase.js';
import { calculerValeurBloc } from './escalade-blocs-core.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentClasse = '';
let currentCode = '';
let currentEleveId = '';
let blocs = [];
let validations = {};
let config = null;
let monGroupe = '';
let elevesParGroupe = {};
let validationListener = null;

// ============================================================
// Initialisation
// ============================================================
export function initBlocKiosk(classe, code) {
    currentClasse = classe;
    currentCode = code;

    // On récupère l’ID de l’élève à partir du code (via le mapping local)
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${classe}`) || '{}');
    // Le mapping est de la forme { "classe_A1": "eleveId", ... } ou { "classe_A": ["eleveId1", ...] }
    // On cherche une clé qui se termine par "_A1", "_B2", etc.
    const key = Object.keys(mapping).find(k => k.endsWith(`_${code}`));
    currentEleveId = key ? mapping[key] : null;
    if (!currentEleveId) {
        // Fallback : on utilise le code comme identifiant
        currentEleveId = code;
    }

    // Écouter la configuration
    listenBlocConfig(classe, (configData) => {
        if (configData) {
            config = configData;
            blocs = config.blocs || [];
            // On détermine le groupe de l’élève
            const groupes = config.groupes || {};
            for (const [g, ids] of Object.entries(groupes)) {
                if (ids.includes(currentEleveId)) {
                    monGroupe = g;
                    break;
                }
            }
            // Écouter les validations
            if (validationListener) validationListener();
            validationListener = listenValidations(classe, (validData) => {
                validations = validData;
                afficherInterface();
            });
        } else {
            // Pas de config : afficher un message d’attente
            afficherMessage('⏳ En attente de la configuration du professeur...');
        }
    });
}

// ============================================================
// Affichage de l’interface
// ============================================================
function afficherInterface() {
    const container = document.getElementById('bloc-kiosk-container');
    if (!container) return;

    if (!config || !config.actif) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400"><p>⏳ Le professeur n’a pas encore activé le Bloc Contest.</p></div>`;
        return;
    }

    // Filtrer les blocs : on pourrait afficher tous les blocs, mais on peut aussi ne montrer que ceux non encore validés par l’élève
    const blocsAffiches = blocs; // on affiche tous

    // Construire le HTML
    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex items-center gap-4">
                <div id="bloc-eleve-photo" class="w-16 h-16 rounded-full border-2 bg-slate-700 overflow-hidden flex items-center justify-center text-3xl">
                    <span>👤</span>
                </div>
                <div>
                    <p class="text-2xl font-black text-white">${currentCode}</p>
                    <p class="text-sm text-slate-400">Groupe ${monGroupe}</p>
                    <p class="text-xs text-slate-500">Glisse ton code sur un bloc pour le valider</p>
                </div>
            </div>
        </div>
        <div id="bloc-grid" class="grid grid-cols-2 md:grid-cols-3 gap-4">
    `;

    blocsAffiches.forEach(bloc => {
        const estValide = estBlocValide(bloc.id);
        const nbValidations = compterValidations(bloc.id);
        const valeurActuelle = calculerValeurBloc(nbValidations, config.score.valeurInitiale, config.score.decote);
        const couleurFond = estValide ? 'bg-emerald-600' : 'bg-slate-700';
        const border = estValide ? 'border-2 border-emerald-400' : 'border-2 border-slate-600';

        html += `
            <div class="bloc-card ${couleurFond} ${border} rounded-2xl p-4 text-center cursor-grab active:cursor-grabbing transition-all hover:scale-105"
                 data-bloc-id="${bloc.id}"
                 draggable="false"
                 onclick="window.validerBloc('${bloc.id}')">
                <div class="text-xl font-black text-white">${bloc.label}</div>
                <div class="text-xs text-slate-300">Valeur : ${valeurActuelle} pts</div>
                <div class="text-xs text-slate-400 mt-1">${nbValidations} validation(s)</div>
                ${estValide ? '<div class="text-xs text-emerald-300 font-bold mt-2">✅ Validé</div>' : ''}
            </div>
        `;
    });

    html += `</div>`;

    // Zone d’information : afficher le total de points de l’élève
    const totalPoints = calculerTotalPoints();
    html += `
        <div class="mt-4 text-center text-slate-400">
            Total points : <span class="text-2xl font-black text-yellow-400">${totalPoints}</span>
        </div>
    `;

    container.innerHTML = html;

    // Charger la photo de l’élève
    chargerPhoto();

    // Initialiser le drag & drop (Sortable) si on utilise Sortable
    // Ici, on utilise un onclick pour simplifier, mais on peut implémenter le drag & drop avec Sortable.js
    // Pour le moment, on garde le onclick.
}

// ============================================================
// Fonctions utilitaires
// ============================================================
function estBlocValide(blocId) {
    if (!currentEleveId) return false;
    const valid = Object.values(validations).find(v => v.eleveId === currentEleveId && v.blocId === blocId);
    return !!valid;
}

function compterValidations(blocId) {
    return Object.values(validations).filter(v => v.blocId === blocId).length;
}

function calculerTotalPoints() {
    if (!config) return 0;
    const params = config.score;
    const mesValidations = Object.values(validations).filter(v => v.eleveId === currentEleveId);
    let total = 0;
    mesValidations.forEach(v => {
        if (params.mode === 'fige') {
            total += v.valeurAuMoment || 0;
        } else {
            // mode évolutif : on recalcule
            const nbTotal = Object.values(validations).filter(va => va.blocId === v.blocId).length;
            total += calculerValeurBloc(nbTotal, params.valeurInitiale, params.decote);
        }
    });
    return total;
}

function chargerPhoto() {
    const container = document.getElementById('bloc-eleve-photo');
    if (!container) return;
    getPhotoUrl(currentEleveId).then(url => {
        if (url) {
            container.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-full">`;
        } else {
            container.innerHTML = `<span class="text-3xl">👤</span>`;
        }
    });
}

function afficherMessage(msg) {
    const container = document.getElementById('bloc-kiosk-container');
    if (container) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400"><p>${msg}</p></div>`;
    }
}

// ============================================================
// Action de validation (appelée par onclick)
// ============================================================
window.validerBloc = function(blocId) {
    if (!currentClasse || !currentEleveId) {
        alert('Veuillez sélectionner votre code.');
        return;
    }
    if (estBlocValide(blocId)) {
        alert('✅ Vous avez déjà validé ce bloc.');
        return;
    }

    // Récupérer le nombre actuel de validations pour ce bloc
    const nbValidations = compterValidations(blocId);
    const params = config.score;
    const valeur = calculerValeurBloc(nbValidations, params.valeurInitiale, params.decote);

    const validationData = {
        eleveId: currentEleveId,
        code: currentCode,
        blocId: blocId,
        timestamp: Date.now(),
        valeurAuMoment: (params.mode === 'fige') ? valeur : undefined,
    };

    addValidation(currentClasse, validationData)
        .then(() => {
            // On peut afficher un toast
            showToast(`✅ Bloc validé ! +${valeur} pts`);
        })
        .catch(err => {
            alert('❌ Erreur lors de la validation : ' + err.message);
        });
};

// ============================================================
// Toast simple
// ============================================================
function showToast(message, duration = 3000) {
    const existing = document.querySelector('.bloc-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'bloc-toast fixed top-20 left-1/2 -translate-x-1/2 bg-slate-900 border-2 border-slate-600 px-6 py-3 rounded-2xl font-bold text-white text-center z-50 shadow-2xl';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
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