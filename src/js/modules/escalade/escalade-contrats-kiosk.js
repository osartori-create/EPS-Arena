// src/js/modules/escalade/escalade-contrats-kiosk.js
// Kiosk élève du module « Contrats » escalade.
// Flux : numéro personnel -> rôle -> contrat -> saisie -> validation -> relais.
// 100 % anonyme côté Firebase (code uniquement). Aucune donnée nominative.

import { listenContratsConfig, listenContratsEvaluations, addContratsEvaluation } from './escalade-contrats-firebase.js';
import { evaluerContrat, scoreErreur } from './escalade-contrats-core.js';
import { COTATION_CHIFFRES } from './escalade-contrats-config.js';

let currentClasse = '';
let currentCode = '';
let currentConfig = null;
let currentRole = null;
let currentContrat = null;
let configListener = null;
let evaluationsListener = null;

let saisieGrimpeur = { degaines: 0, erreurs: 0, cotationChiffre: 4, cotationLettre: 'a' };
let saisieEchelle = {};
let mesEvaluations = {};

// ============================================================
// INITIALISATION
// ============================================================
export function initContratsKiosk(classe) {
    currentClasse = classe;
    currentCode = '';
    currentRole = null;
    currentContrat = null;

    if (configListener) configListener();
    configListener = listenContratsConfig(classe, (data) => {
        currentConfig = data;
        afficherSaisieNumero();
    });

    if (evaluationsListener) evaluationsListener();
    evaluationsListener = listenContratsEvaluations(classe, (data) => {
        mesEvaluations = data || {};
        if (currentContrat && currentContrat.mode === 'grimpeur' && contratUtiliseMoyenne(currentContrat)) {
            afficherSaisie();
        }
    });
}

export function cleanupContratsKiosk() {
    if (configListener) { configListener(); configListener = null; }
    if (evaluationsListener) { evaluationsListener(); evaluationsListener = null; }
    currentClasse = '';
    currentCode = '';
    currentRole = null;
    currentContrat = null;
}

// ============================================================
// HELPERS DOM
// ============================================================
function getContainer() {
    let el = document.getElementById('contrats-module');
    if (!el) {
        el = document.createElement('div');
        el.id = 'contrats-module';
        el.className = 'space-y-4';
        const screen = document.getElementById('activity-screen');
        if (screen) screen.appendChild(el);
    }
    return el;
}

function viderContainer() {
    const el = getContainer();
    el.innerHTML = '';
    return el;
}

function rolesActifs() {
    return (currentConfig?.roles || []).filter(r => r.actif);
}

// ============================================================
// ÉCRAN 1 — SAISIE DU NUMÉRO PERSONNEL
// ============================================================
function afficherSaisieNumero() {
    currentCode = '';
    currentRole = null;
    currentContrat = null;
    const container = viderContainer();

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
            <div class="text-4xl mb-2">⛰️</div>
            <h2 class="text-xl font-black text-white mb-1">Contrats escalade</h2>
            <p class="text-sm text-slate-400 mb-4">Entre ton numéro personnel</p>
            <div id="contrats-numero-display" class="bg-slate-950 border-2 border-slate-700 rounded-2xl h-16 flex items-center justify-center text-4xl font-black tracking-[0.4em] text-emerald-400 mb-4"></div>
            <div id="contrats-keypad" class="grid grid-cols-3 gap-3 max-w-xs mx-auto"></div>
            <button onclick="window.contratsKioskQuitter()" class="mt-5 w-full bg-slate-700 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Quitter</button>
        </div>
    `;

    let numero = '';
    const display = document.getElementById('contrats-numero-display');
    const keypad = document.getElementById('contrats-keypad');

    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    digits.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'bg-slate-700 hover:bg-slate-600 h-16 rounded-xl text-2xl font-black text-white active:scale-95 transition-transform';
        btn.textContent = d;
        btn.onclick = () => {
            if (numero.length < 4) {
                numero += d;
                display.textContent = numero;
            }
        };
        keypad.appendChild(btn);
    });

    const effacer = document.createElement('button');
    effacer.className = 'bg-red-700 hover:bg-red-600 h-16 rounded-xl text-sm font-black text-white active:scale-95';
    effacer.textContent = '⌫';
    effacer.onclick = () => { numero = numero.slice(0, -1); display.textContent = numero; };
    keypad.appendChild(effacer);

    const valider = document.createElement('button');
    valider.className = 'bg-emerald-600 hover:bg-emerald-500 h-16 rounded-xl text-sm font-black text-white active:scale-95 col-span-3';
    valider.textContent = '✅ Valider';
    valider.onclick = () => {
        if (!numero) return;
        currentCode = numero;
        afficherRoles();
    };
    keypad.appendChild(valider);
}

// ============================================================
// ÉCRAN 2 — CHOIX DU RÔLE
// ============================================================
function afficherRoles() {
    const container = viderContainer();
    const roles = rolesActifs();

    if (roles.length === 0) {
        container.innerHTML = `
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
                <p class="text-slate-400">⏳ Aucun rôle activé par le professeur.</p>
                <button onclick="window.contratsKioskQuitter()" class="mt-4 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">← Quitter</button>
            </div>
        `;
        return;
    }

    const icones = { grimpeur: '🧗', assureur: '🪢', citoyen: '🤝' };
    const boutons = roles.map(r => `
        <button onclick="window.contratsKioskChoisirRole('${r.id}')"
                class="w-full bg-slate-700 hover:bg-slate-600 py-5 rounded-2xl font-black text-lg text-white active:scale-95 transition-transform">
            ${icones[r.id] || '🎯'} ${r.label}
        </button>
    `).join('');

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <h2 class="text-xl font-black text-white mb-1 text-center">Quel est ton rôle ?</h2>
            <p class="text-xs text-slate-400 mb-4 text-center">Numéro : <span class="text-yellow-400 font-black">${currentCode}</span></p>
            <div class="space-y-3">${boutons}</div>
            <button onclick="window.contratsKioskEleveSuivant()" class="mt-4 w-full bg-slate-700 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Changer de numéro</button>
        </div>
    `;
}

window.contratsKioskChoisirRole = function(roleId) {
    currentRole = rolesActifs().find(r => r.id === roleId) || null;
    if (!currentRole) return;
    afficherContrats();
};

// ============================================================
// ÉCRAN 3 — CHOIX DU CONTRAT (couleur puis numéro)
// ============================================================
function couleursDistinctes() {
    const vues = [];
    const out = [];
    (currentRole?.contrats || []).forEach(c => {
        if (!vues.includes(c.label)) {
            vues.push(c.label);
            out.push(c);
        }
    });
    return out;
}

function contratsDeCouleur(label) {
    return (currentRole?.contrats || []).filter(c => c.label === label);
}

function numeroContrat(c) {
    return contratsDeCouleur(c.label).findIndex(x => x.id === c.id) + 1;
}

function afficherContrats() {
    const container = viderContainer();
    if (!currentRole || !currentRole.contrats || currentRole.contrats.length === 0) {
        container.innerHTML = `<div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center"><p class="text-slate-400">Aucun contrat défini pour ce rôle.</p></div>`;
        return;
    }

    const boutons = couleursDistinctes().map(c => `
        <button onclick="window.contratsKioskChoisirCouleur('${c.label}')"
                class="w-full py-5 rounded-2xl font-black text-lg text-white active:scale-95 transition-transform"
                style="background:${c.couleur};">
            ${c.label}
        </button>
    `).join('');

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <h2 class="text-xl font-black text-white mb-1 text-center">Choisis ta couleur de contrat</h2>
            <p class="text-xs text-slate-400 mb-4 text-center">${currentRole.label} · Numéro <span class="text-yellow-400 font-black">${currentCode}</span></p>
            <div class="space-y-3">${boutons}</div>
            <button onclick="window.contratsKioskRetourRoles()" class="mt-4 w-full bg-slate-700 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Changer de rôle</button>
        </div>
    `;
}

window.contratsKioskChoisirCouleur = function(label) {
    const contrats = contratsDeCouleur(label);
    if (contrats.length === 1) {
        choisirContrat(contrats[0].id);
    } else {
        afficherNumeros(label);
    }
};

function afficherNumeros(label) {
    const container = viderContainer();
    const contrats = contratsDeCouleur(label);

    const boutons = contrats.map((c, idx) => `
        <button onclick="window.contratsKioskChoisirContrat('${c.id}')"
                class="w-full py-4 px-4 rounded-2xl font-black text-white active:scale-95 transition-transform text-left"
                style="background:${c.couleur};">
            <div class="text-lg">N° ${idx + 1} — ${c.label}</div>
            <div class="text-xs font-normal opacity-90 mt-1">${c.descriptif || ''}</div>
        </button>
    `).join('');

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <h2 class="text-xl font-black text-white mb-1 text-center">Choisis ton numéro</h2>
            <p class="text-xs text-slate-400 mb-4 text-center">${label} · Numéro <span class="text-yellow-400 font-black">${currentCode}</span></p>
            <div class="space-y-3">${boutons}</div>
            <button onclick="window.contratsKioskRetourCouleurs()" class="mt-4 w-full bg-slate-700 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Changer de couleur</button>
        </div>
    `;
}

window.contratsKioskRetourRoles = function() {
    afficherRoles();
};

window.contratsKioskRetourCouleurs = function() {
    afficherContrats();
};

window.contratsKioskChoisirContrat = function(contratId) {
    choisirContrat(contratId);
};

function choisirContrat(contratId) {
    currentContrat = (currentRole?.contrats || []).find(c => c.id === contratId) || null;
    if (!currentContrat) return;
    saisieGrimpeur = { degaines: 0, erreurs: 0, cotationChiffre: 4, cotationLettre: 'a' };
    saisieEchelle = {};
    afficherSaisie();
}

// ============================================================
// ÉCRAN 4 — SAISIE (selon le mode du contrat)
// ============================================================
function afficherSaisie() {
    const container = viderContainer();
    const c = currentContrat;
    const sommet = currentConfig?.nbDegainesMax || 7;

    const entete = `
        <div class="bg-slate-800 p-5 rounded-2xl border-2" style="border-color:${c.couleur};">
            <h2 class="text-xl font-black text-white mb-1 text-center">${currentRole.label} — ${c.label} N° ${numeroContrat(c)}</h2>
            <p class="text-xs text-slate-300 mb-1 text-center">${c.descriptif || ''}</p>
            <p class="text-xs text-slate-400 mb-4 text-center">Numéro <span class="text-yellow-400 font-black">${currentCode}</span></p>
    `;

    const corps = (c.mode === 'grimpeur') ? saisieGrimpeurHTML(c, sommet) : saisieEchelleHTML(c);

    container.innerHTML = entete + corps + `
            <button onclick="window.contratsKioskEnvoyer()" class="w-full bg-emerald-600 py-5 rounded-3xl text-xl font-black uppercase text-white active:scale-95">📤 Valider</button>
            <button onclick="window.contratsKioskRetourContrats()" class="mt-3 w-full bg-slate-700 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Changer de contrat</button>
        </div>
    `;
}

function contratUtiliseErreurs(c) {
    return (c.epreuves || []).some(e => e.type.includes('erreurs'));
}

function contratUtiliseCotation(c) {
    return (c.epreuves || []).some(e => e.type.includes('cotation'));
}

function contratUtiliseMoyenne(c) {
    return (c.epreuves || []).some(e => e.type === 'degaines-moyenne');
}

function labelErreurContrat(c) {
    const ep = (c.epreuves || []).find(e => e.type.includes('erreurs'));
    const t = ep?.erreurType;
    if (!t || t === 'toutes') return 'Score erreur (toutes)';
    const err = (currentConfig?.erreurs || []).find(x => x.id === t);
    return err ? `Score erreur ${err.label}` : 'Score erreur';
}

function cumulVert() {
    const seance = currentConfig?.seance || 1;
    const asc = Object.values(mesEvaluations).filter(ev =>
        ev && ev.code === currentCode &&
        String(ev.seance) === String(seance) &&
        ev.role === 'grimpeur'
    );
    const total = asc.reduce((s, ev) => s + (parseInt(ev.degaines, 10) || 0), 0) + (saisieGrimpeur.degaines || 0);
    return { totalDegaines: total, nbAscents: asc.length + 1 };
}

function saisieGrimpeurHTML(c, sommet) {
    let html = stepperHTML('Dégaines atteintes', saisieGrimpeur.degaines,
        'window.contratsKioskSetDegaines(-1)', 'window.contratsKioskSetDegaines(1)');

    if (contratUtiliseMoyenne(c)) {
        const cumul = cumulVert();
        const moyenne = cumul.nbAscents > 0 ? cumul.totalDegaines / cumul.nbAscents : 0;
        html += `
            <div class="mb-4 bg-slate-900 p-3 rounded-xl border border-slate-600 text-center">
                <p class="text-xs font-bold text-slate-400 uppercase mb-1">Moyenne dégaines / ascensions</p>
                <div class="text-2xl font-black ${moyenne >= sommet ? 'text-emerald-400' : 'text-amber-400'}">${Math.round(moyenne * 10) / 10} / ${sommet}</div>
                <p class="text-[10px] text-slate-500">${cumul.nbAscents} montée(s) cumulée(s)</p>
            </div>
        `;
    }

    if (contratUtiliseErreurs(c)) {
        html += stepperErreurHTML(labelErreurContrat(c), saisieGrimpeur.erreurs);
    }

    if (contratUtiliseCotation(c)) {
        html += `
            <p class="text-xs font-bold text-slate-400 uppercase mb-1">Cotation de la voie</p>
            <div class="grid grid-cols-5 gap-2 mb-3">
                ${COTATION_CHIFFRES.map(n => `<button onclick="window.contratsKioskSetCotChiffre(${n})" class="py-3 rounded-xl font-black text-white ${saisieGrimpeur.cotationChiffre === n ? 'bg-blue-600' : 'bg-slate-700'}">${n}</button>`).join('')}
            </div>
            <div class="grid grid-cols-3 gap-2 mb-4">
                ${['a', 'b', 'c'].map(l => `<button onclick="window.contratsKioskSetCotLettre('${l}')" class="py-3 rounded-xl font-black text-white ${saisieGrimpeur.cotationLettre === l ? 'bg-blue-600' : 'bg-slate-700'}">${l}</button>`).join('')}
            </div>
        `;
    }

    return html;
}

function stepperHTML(label, valeur, onMoins, onPlus) {
    return `
        <div class="mb-4">
            <p class="text-xs font-bold text-slate-400 uppercase mb-1">${label}</p>
            <div class="flex items-center justify-center gap-4">
                <button onclick="${onMoins}" class="bg-slate-700 hover:bg-slate-600 w-16 h-16 rounded-2xl font-black text-2xl text-white active:scale-95">−</button>
                <div class="bg-slate-950 border-2 border-slate-700 rounded-2xl w-24 h-16 flex items-center justify-center text-3xl font-black text-emerald-400">${valeur}</div>
                <button onclick="${onPlus}" class="bg-slate-700 hover:bg-slate-600 w-16 h-16 rounded-2xl font-black text-2xl text-white active:scale-95">+</button>
            </div>
        </div>
    `;
}

// Scoreur d'erreurs : affiche le SCORE (9 = aucune erreur), démarre à 9.
// « − » signale une erreur (score baisse), « + » corrige (score remonte).
function stepperErreurHTML(label, nbErreurs) {
    const score = scoreErreur(nbErreurs);
    const couleur = score >= 9 ? 'text-emerald-400' : score >= 7 ? 'text-amber-400' : 'text-red-400';
    return `
        <div class="mb-4">
            <p class="text-xs font-bold text-slate-400 uppercase mb-1">${label}</p>
            <div class="flex items-center justify-center gap-4">
                <button onclick="window.contratsKioskSetErreur(1)" class="bg-slate-700 hover:bg-slate-600 w-16 h-16 rounded-2xl font-black text-2xl text-white active:scale-95">−</button>
                <div class="bg-slate-950 border-2 border-slate-700 rounded-2xl w-24 h-16 flex items-center justify-center text-3xl font-black ${couleur}">${score}</div>
                <button onclick="window.contratsKioskSetErreur(-1)" class="bg-slate-700 hover:bg-slate-600 w-16 h-16 rounded-2xl font-black text-2xl text-white active:scale-95">+</button>
            </div>
        </div>
    `;
}

function saisieEchelleHTML(c) {
    return c.competences.map((comp, i) => {
        const v = saisieEchelle[comp.id] || 0;
        return `
            <div class="mb-3 p-3 rounded-xl border border-slate-700 bg-slate-900">
                <p class="text-sm font-bold text-slate-100 mb-2"><span class="text-slate-500">${i + 1}.</span> ${comp.label}</p>
                <div class="grid grid-cols-3 gap-2">
                    <button onclick="window.contratsKioskNoter('${comp.id}', 1)" class="py-3 rounded-xl font-black text-xs text-white ${v === 1 ? 'bg-red-600' : 'bg-slate-700'}">1 · Non</button>
                    <button onclick="window.contratsKioskNoter('${comp.id}', 2)" class="py-3 rounded-xl font-black text-xs text-white ${v === 2 ? 'bg-amber-500' : 'bg-slate-700'}">2 · Hésitation</button>
                    <button onclick="window.contratsKioskNoter('${comp.id}', 3)" class="py-3 rounded-xl font-black text-xs text-white ${v === 3 ? 'bg-emerald-600' : 'bg-slate-700'}">3 · Sans hésitation</button>
                </div>
            </div>
        `;
    }).join('');
}

window.contratsKioskSetDegaines = function(delta) {
    const max = currentConfig?.nbDegainesMax || 7;
    saisieGrimpeur.degaines = Math.max(0, Math.min(max, saisieGrimpeur.degaines + delta));
    afficherSaisie();
};
window.contratsKioskSetErreur = function(delta) {
    saisieGrimpeur.erreurs = Math.max(0, Math.min(9, saisieGrimpeur.erreurs + delta));
    afficherSaisie();
};
window.contratsKioskSetCotChiffre = function(n) {
    saisieGrimpeur.cotationChiffre = n;
    afficherSaisie();
};
window.contratsKioskSetCotLettre = function(l) {
    saisieGrimpeur.cotationLettre = l;
    afficherSaisie();
};
window.contratsKioskNoter = function(compId, v) {
    saisieEchelle[compId] = v;
    afficherSaisie();
};
window.contratsKioskRetourContrats = function() {
    afficherContrats();
};

// ============================================================
// ÉCRAN 5 — ENVOI + CONFIRMATION
// ============================================================
window.contratsKioskEnvoyer = function() {
    if (!currentCode || !currentRole || !currentContrat) return;

    let saisie;
    if (currentContrat.mode === 'grimpeur') {
        saisie = { ...saisieGrimpeur };
    } else {
        const manquantes = currentContrat.competences.filter(comp => saisieEchelle[comp.id] === undefined);
        if (manquantes.length > 0) {
            alert(`Il reste ${manquantes.length} compétence(s) à noter.`);
            return;
        }
        saisie = { notes: { ...saisieEchelle } };
    }

    const nbDegainesMax = currentConfig?.nbDegainesMax || 7;
    const cumul = currentContrat.mode === 'grimpeur' ? cumulVert() : null;
    const resultat = evaluerContrat(saisie, currentContrat, nbDegainesMax, cumul);

    const data = {
        code: currentCode,
        role: currentRole.id,
        contrat: currentContrat.id,
        notes: saisie.notes || null,
        degaines: saisie.degaines ?? null,
        erreurs: saisie.erreurs ?? null,
        cotationChiffre: saisie.cotationChiffre ?? null,
        cotationLettre: saisie.cotationLettre ?? null,
        score: resultat.score,
        scoreParlant: resultat.scoreParlant,
        epreuves: resultat.epreuves || null,
        valide: resultat.valide,
        seance: currentConfig?.seance || 1,
        timestamp: Date.now()
    };

    addContratsEvaluation(currentClasse, data)
        .then(() => afficherConfirmation(resultat.valide))
        .catch(err => {
            console.error(err);
            alert(`❌ Erreur lors de l'envoi. Réessaye.`);
        });
};

function afficherConfirmation(valide) {
    const container = viderContainer();
    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
            <div class="text-6xl mb-4">${valide ? '🎉' : '💪'}</div>
            <h2 class="text-2xl font-black text-white mb-2">${valide ? 'Contrat validé !' : 'Presque !'}</h2>
            <p class="text-slate-400 text-sm mb-4">${valide ? `Bravo, contrat ${currentContrat.label} réussi.` : 'Continue, tu vas y arriver.'}</p>
            <button onclick="window.contratsKioskEleveSuivant()" class="w-full bg-blue-600 py-4 rounded-2xl font-black text-white text-lg active:scale-95">🔄 Élève suivant</button>
            <button onclick="window.contratsKioskQuitter()" class="mt-3 w-full bg-slate-700 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Quitter</button>
        </div>
    `;
}

window.contratsKioskEleveSuivant = function() {
    afficherSaisieNumero();
};

window.contratsKioskQuitter = function() {
    cleanupContratsKiosk();
    const container = getContainer();
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
};
