// src/js/modules/natation/natation-kiosk.js
import { db, ref, onValue, set } from '../../core/firebase-service.js';

let currentClasse = '';
let currentNumero = null;
let config = null;
let configListener = null;
let nbEleves = 0;

let chronoRunning = false;
let chronoStart = 0;
let chronoElapsed = 0;
let rafId = null;
let tempsFinal = null;

// État de l'interface
let mode = 'liste'; // 'liste' | 'chrono' | 'saisie'

export function initNatationKiosk(classe) {
    currentClasse = classe;
    currentNumero = null;
    tempsFinal = null;
    mode = 'liste';

    const container = document.getElementById('natation-module');
    if (!container) {
        console.warn('Conteneur natation-module introuvable');
        return;
    }
    container.innerHTML = '';
    container.style.display = 'block';

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/config`);
    if (configListener) configListener();
    configListener = onValue(configRef, (snap) => {
        config = snap.val() || {};
        nbEleves = config.nbEleves || 0;
        // Si pas de nbEleves, on essaie de le déduire du mapping local
        if (nbEleves === 0) {
            const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${classe}`) || '{}');
            const nums = Object.keys(mapping).filter(k => k.startsWith(`${classe}_`)).map(k => parseInt(k.split('_')[1])).filter(n => !isNaN(n));
            nbEleves = Math.max(...nums, 0);
        }
        afficherInterface();
    });
}

// ============================================================
// AFFICHAGE PRINCIPAL
// ============================================================
function afficherInterface() {
    const container = document.getElementById('natation-module');
    if (!container) return;

    if (mode === 'liste') {
        afficherListeNumeros(container);
    } else if (mode === 'chrono') {
        afficherChrono(container);
    } else if (mode === 'saisie') {
        afficherSaisieCoups(container);
    }
}

// ============================================================
// 1. LISTE DES NUMÉROS
// ============================================================
function afficherListeNumeros(container) {
    const distance = config?.distance || 25;
    const nums = [];
    for (let i = 1; i <= nbEleves; i++) nums.push(i);

    // Vérifier si des résultats existent déjà pour colorer les numéros
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps`);
    let tempsData = {};
    onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        // On ne réaffiche que si on est encore en mode liste
        if (mode === 'liste') {
            afficherListeNumeros(container);
        }
    }, { onlyOnce: true });

    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center">
            <h2 class="text-2xl font-black text-white mb-2">🏊 Indice de nage</h2>
            <p class="text-sm text-slate-400 mb-4">${distance}m - Départ dans l'eau</p>
            <p class="text-xs text-slate-500 mb-4">Choisis ton numéro</p>
            <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 max-w-2xl mx-auto">
    `;

    nums.forEach(num => {
        const eleveId = getEleveIdFromNumero(num);
        const temps = eleveId ? tempsData[eleveId] : null;
        const aTemps = temps !== null && temps > 0;
        const bgClass = aTemps ? 'bg-emerald-600 border-emerald-400' : 'bg-blue-600 border-blue-400';
        const label = aTemps ? `${num} ✅` : `${num}`;
        html += `
            <button onclick="window.natationChoisirNumero(${num})" 
                    class="${bgClass} p-6 rounded-2xl font-black text-4xl text-white border-4 active:scale-95 transition-transform shadow-lg hover:scale-105">
                ${label}
            </button>
        `;
    });

    html += `
            </div>
            <button onclick="window.retourMenuNatation()" 
                    class="mt-6 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                ← Retour
            </button>
        </div>
    `;

    container.innerHTML = html;
}

function getEleveIdFromNumero(num) {
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    return mapping[`${currentClasse}_${num}`] || null;
}

// ============================================================
// 2. CHRONO
// ============================================================
function afficherChrono(container) {
    const distance = config?.distance || 25;

    let tempsAffiche = '00:00.0';
    if (tempsFinal !== null) {
        tempsAffiche = formatTime(tempsFinal);
    } else if (chronoRunning) {
        tempsAffiche = formatTime(chronoElapsed);
    }

    container.innerHTML = `
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center max-w-md mx-auto">
            <div class="flex items-center justify-center gap-4 mb-4">
                <span class="text-3xl font-black text-white">N°</span>
                <span class="text-6xl font-black text-yellow-400">${currentNumero}</span>
            </div>
            <p class="text-sm text-slate-400 mb-4">${distance}m - Départ dans l'eau</p>

            <div class="text-7xl font-black tabular-nums text-yellow-400 mb-6" id="natation-chrono-display">
                ${tempsAffiche}
            </div>

            <div class="flex gap-3 justify-center">
                <button id="natation-start-btn" 
                        class="bg-emerald-600 px-8 py-4 rounded-2xl font-black text-white text-xl active:scale-95 ${chronoRunning ? 'hidden' : ''}"
                        onclick="window.natationDemarrer()"
                        ${tempsFinal !== null ? 'disabled' : ''}>
                    ▶ Démarrer
                </button>
                <button id="natation-stop-btn" 
                        class="bg-red-600 px-8 py-4 rounded-2xl font-black text-white text-xl active:scale-95 ${chronoRunning ? '' : 'hidden'}"
                        onclick="window.natationArreter()">
                    ⏹ Arrêter
                </button>
            </div>

            ${tempsFinal !== null ? `
                <div class="mt-4 flex gap-3 justify-center">
                    <button onclick="window.natationValiderTemps()" 
                            class="bg-emerald-600 px-6 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                        ✅ Valider
                    </button>
                    <button onclick="window.natationRecommencer()" 
                            class="bg-slate-600 px-6 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                        ↺ Recommencer
                    </button>
                </div>
            ` : ''}

            <button onclick="window.natationRetourListe()" 
                    class="mt-6 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                ← Retour à la liste
            </button>
        </div>
    `;
}

// ============================================================
// 3. SAISIE DES COUPS DE BRAS
// ============================================================
function afficherSaisieCoups(container) {
    const tempsStr = formatTime(tempsFinal);
    container.innerHTML = `
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center max-w-md mx-auto">
            <div class="flex items-center justify-center gap-4 mb-4">
                <span class="text-3xl font-black text-white">N°</span>
                <span class="text-6xl font-black text-yellow-400">${currentNumero}</span>
            </div>
            <p class="text-sm text-slate-400 mb-2">Temps enregistré</p>
            <div class="text-5xl font-black text-yellow-400 mb-4">${tempsStr}</div>
            
            <p class="text-sm text-slate-400 mb-2">Combien de coups de bras ?</p>
            <div class="flex justify-center items-center gap-4 mb-4">
                <button onclick="window.natationAdjustCoups(-1)" 
                        class="bg-slate-700 w-16 h-16 rounded-2xl text-3xl font-black text-white active:scale-95">−</button>
                <span id="natation-coups-display" class="text-6xl font-black text-white w-24 text-center">0</span>
                <button onclick="window.natationAdjustCoups(1)" 
                        class="bg-slate-700 w-16 h-16 rounded-2xl text-3xl font-black text-white active:scale-95">+</button>
            </div>
            <p class="text-xs text-slate-500 mb-4">(1 cycle = 2 coups de bras)</p>

            <div class="flex gap-3 justify-center">
                <button onclick="window.natationValiderCoups()" 
                        class="bg-emerald-600 px-6 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                    ✅ Enregistrer
                </button>
                <button onclick="window.natationAnnulerCoups()" 
                        class="bg-slate-600 px-6 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                    Annuler
                </button>
            </div>

            <button onclick="window.natationRetourListe()" 
                    class="mt-6 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                ← Retour à la liste
            </button>
        </div>
    `;
    // Initialiser le compteur à 1 (minimum)
    window._coupsSaisis = 1;
    document.getElementById('natation-coups-display').textContent = '1';
}

// ============================================================
// ACTIONS GLOBALES
// ============================================================
window.natationChoisirNumero = function(num) {
    // Vérifier si l'élève a déjà un temps
    const eleveId = getEleveIdFromNumero(num);
    if (eleveId) {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps/${eleveId}`);
        // On pourrait vérifier si un temps existe déjà, mais on laisse l'élève refaire un essai
        // On réinitialise tout
        window.natationReset();
    }
    currentNumero = num;
    tempsFinal = null;
    chronoElapsed = 0;
    mode = 'chrono';
    afficherInterface();
};

window.natationRetourListe = function() {
    // Annuler tout chrono en cours
    if (chronoRunning) {
        chronoRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
    }
    chronoElapsed = 0;
    tempsFinal = null;
    mode = 'liste';
    afficherInterface();
};

window.natationDemarrer = function() {
    if (currentNumero === null) return;
    if (chronoRunning) return;
    chronoRunning = true;
    chronoStart = performance.now() - chronoElapsed;
    rafId = requestAnimationFrame(updateChrono);
    // Mettre à jour le bouton
    const startBtn = document.getElementById('natation-start-btn');
    const stopBtn = document.getElementById('natation-stop-btn');
    if (startBtn) startBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
};

window.natationArreter = function() {
    if (!chronoRunning) return;
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    tempsFinal = chronoElapsed;
    // Passer en mode saisie des coups
    mode = 'saisie';
    afficherInterface();
};

window.natationValiderTemps = function() {
    // Passer à la saisie des coups (si on n'y est pas déjà)
    if (mode !== 'saisie') {
        mode = 'saisie';
        afficherInterface();
    }
};

window.natationRecommencer = function() {
    chronoElapsed = 0;
    tempsFinal = null;
    mode = 'chrono';
    afficherInterface();
};

window.natationReset = function() {
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    chronoElapsed = 0;
    tempsFinal = null;
};

window.natationAdjustCoups = function(delta) {
    const display = document.getElementById('natation-coups-display');
    let val = parseInt(display.textContent) || 0;
    val = Math.max(1, val + delta);
    display.textContent = val;
    window._coupsSaisis = val;
};

window.natationValiderCoups = function() {
    const nbCoups = window._coupsSaisis || 1;
    if (nbCoups < 1) {
        alert('Veuillez saisir au moins 1 coup de bras.');
        return;
    }
    enregistrerTempsEtCoups(tempsFinal, nbCoups);
    // Retour à la liste après enregistrement
    mode = 'liste';
    tempsFinal = null;
    chronoElapsed = 0;
    afficherInterface();
};

window.natationAnnulerCoups = function() {
    // Retour au chrono sans enregistrer
    mode = 'chrono';
    afficherInterface();
};

function enregistrerTempsEtCoups(tempsMs, nbCoups) {
    if (currentNumero === null) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    const eleveId = mapping[`${currentClasse}_${currentNumero}`];
    if (!eleveId) {
        alert('Numéro non reconnu. Contacte le professeur.');
        return;
    }

    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps/${eleveId}`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/coups/${eleveId}`);

    Promise.all([
        set(tempsRef, tempsMs),
        set(coupsRef, nbCoups)
    ]).then(() => {
        console.log('✅ Temps et coups enregistrés pour', eleveId);
        // On pourrait afficher une confirmation rapide
    }).catch(err => {
        console.error('Erreur enregistrement :', err);
        alert('Erreur lors de l\'enregistrement. Réessayez.');
    });
}

// ============================================================
// CHRONO (animation)
// ============================================================
function updateChrono() {
    if (!chronoRunning) return;
    chronoElapsed = performance.now() - chronoStart;
    const display = document.getElementById('natation-chrono-display');
    if (display) {
        display.textContent = formatTime(chronoElapsed);
    }
    rafId = requestAnimationFrame(updateChrono);
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    const dec = Math.floor((ms % 1000) / 100);
    return `${min}:${sec}.${dec}`;
}

// ============================================================
// RETOUR
// ============================================================
window.retourMenuNatation = function() {
    if (configListener) configListener();
    const container = document.getElementById('natation-module');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
    if (typeof window.resetToLogin === 'function') {
        window.resetToLogin();
    } else {
        location.reload();
    }
};