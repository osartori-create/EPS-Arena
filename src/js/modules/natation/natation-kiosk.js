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

// ============================================================
// EXPOSITION DES FONCTIONS SUR window
// ============================================================
// On définit TOUTES les fonctions globales ici pour être sûr
// qu'elles sont disponibles au moment du clic.

window.natationChoisirNumero = function(num) {
    console.log('🖱️ [GLOBAL] Clic sur le numéro', num);
    if (!num || num < 1 || num > nbEleves) {
        console.warn('Numéro invalide :', num);
        return;
    }
    currentNumero = num;
    tempsFinal = null;
    chronoElapsed = 0;
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    mode = 'chrono';
    console.log('🔄 Mode changé en "chrono" pour le numéro', num);
    afficherInterface();
};

window.natationRetourListe = function() {
    console.log('⬅️ [GLOBAL] Retour à la liste');
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
    if (currentNumero === null) {
        alert('Erreur : aucun numéro sélectionné.');
        return;
    }
    if (chronoRunning) return;
    console.log('▶️ [GLOBAL] Démarrer le chrono pour', currentNumero);
    chronoRunning = true;
    chronoStart = performance.now() - chronoElapsed;
    rafId = requestAnimationFrame(updateChrono);
    
    const startBtn = document.getElementById('natation-start-btn');
    const stopBtn = document.getElementById('natation-stop-btn');
    if (startBtn) startBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
};

window.natationArreter = function() {
    if (!chronoRunning) return;
    console.log('⏹️ [GLOBAL] Arrêter le chrono pour', currentNumero);
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    tempsFinal = chronoElapsed;
    // Passer en mode saisie des coups
    mode = 'saisie';
    afficherInterface();
};

window.natationValiderTemps = function() {
    console.log('✅ [GLOBAL] Validation du temps, passage à la saisie des coups');
    if (mode !== 'saisie') {
        mode = 'saisie';
        afficherInterface();
    }
};

window.natationRecommencer = function() {
    console.log('↺ [GLOBAL] Recommencer le chrono');
    chronoElapsed = 0;
    tempsFinal = null;
    mode = 'chrono';
    afficherInterface();
};

window.natationAdjustCoups = function(delta) {
    const display = document.getElementById('natation-coups-display');
    if (!display) return;
    let val = parseInt(display.textContent) || 25; // ← démarre à 25
    val = Math.max(1, val + delta);
    display.textContent = val;
    window._coupsSaisis = val;
    console.log('✋ Coups ajustés à', val);
};

window.natationValiderCoups = function() {
    const nbCoups = window._coupsSaisis || 25;
    if (nbCoups < 1) {
        alert('Veuillez saisir au moins 1 coup de bras.');
        return;
    }
    console.log('💾 [GLOBAL] Enregistrement : temps =', tempsFinal, 'ms, coups =', nbCoups);
    enregistrerTempsEtCoups(tempsFinal, nbCoups);
    // Retour à la liste après enregistrement
    mode = 'liste';
    tempsFinal = null;
    chronoElapsed = 0;
    afficherInterface();
};

window.natationAnnulerCoups = function() {
    console.log('❌ [GLOBAL] Annulation de la saisie des coups, retour au chrono');
    mode = 'chrono';
    afficherInterface();
};

// ============================================================
// EXPORT DE LA FONCTION PRINCIPALE
// ============================================================
export function initNatationKiosk(classe) {
    console.log('🏊 initNatationKiosk appelée pour', classe);
    currentClasse = classe;
    currentNumero = null;
    tempsFinal = null;
    mode = 'liste';
    window._coupsSaisis = 25; // Valeur par défaut pour les coups

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
        console.log('📡 Config Natation reçue :', config);
        nbEleves = config.nbEleves || 0;
        
        // Fallback : déduire le nombre d'élèves du mapping local
        if (nbEleves === 0) {
            const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${classe}`) || '{}');
            const nums = Object.keys(mapping)
                .filter(k => k.startsWith(`${classe}_`))
                .map(k => parseInt(k.split('_')[1]))
                .filter(n => !isNaN(n));
            nbEleves = Math.max(...nums, 0);
            console.log('🔢 nbEleves déduit du mapping :', nbEleves);
        }
        
        // Si toujours 0, on met une valeur par défaut pour tester
        if (nbEleves === 0) {
            nbEleves = 28;
            console.log('⚠️ nbEleves = 0, utilisation de la valeur par défaut : 28');
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
    console.log('🔄 afficherInterface() appelée, mode =', mode);

    if (mode === 'liste') {
        afficherListeNumeros(container);
    } else if (mode === 'chrono') {
        afficherChrono(container);
    } else if (mode === 'saisie') {
        afficherSaisieCoups(container);
    }
}

// ============================================================
// 1. LISTE DES NUMÉROS (améliorée)
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
        <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 text-center max-w-4xl mx-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-3xl font-black text-white">🏊 Indice de nage</h2>
                <span class="text-sm text-slate-400">${distance}m</span>
            </div>
            <p class="text-sm text-slate-400 mb-6">Choisis ton numéro</p>
            <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-4 max-w-3xl mx-auto">
    `;

    nums.forEach(num => {
        const eleveId = getEleveIdFromNumero(num);
        const temps = eleveId ? tempsData[eleveId] : null;
        const aTemps = temps !== null && temps > 0;
        const bgClass = aTemps ? 'bg-emerald-600 border-emerald-400 hover:bg-emerald-500' : 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600';
        const label = aTemps ? `${num} ✅` : `${num}`;
        html += `
            <button onclick="window.natationChoisirNumero(${num})" 
                    class="${bgClass} p-6 rounded-2xl font-black text-4xl text-white border-2 
                           active:scale-95 transition-all shadow-lg hover:scale-105 hover:shadow-2xl
                           touch-manipulation min-h-[80px]">
                ${label}
            </button>
        `;
    });

    html += `
            </div>
            <button onclick="window.retourMenuNatation()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-all touch-manipulation">
                ← Retour
            </button>
        </div>
    `;

    container.innerHTML = html;
    console.log('✅ Liste des numéros affichée, nbEleves =', nbEleves);
}

function getEleveIdFromNumero(num) {
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    return mapping[`${currentClasse}_${num}`] || null;
}

// ============================================================
// 2. CHRONO (avec numéro en gros)
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
        <div class="bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center max-w-md mx-auto">
            <div class="flex items-center justify-center gap-6 mb-6">
                <span class="text-2xl font-black text-slate-400">N°</span>
                <span class="text-7xl font-black text-yellow-400">${currentNumero}</span>
            </div>
            <p class="text-sm text-slate-400 mb-4">${distance}m - Départ dans l'eau</p>

            <div class="text-8xl font-black tabular-nums text-yellow-400 mb-8" id="natation-chrono-display">
                ${tempsAffiche}
            </div>

            <div class="flex gap-4 justify-center">
                <button id="natation-start-btn" 
                        class="bg-emerald-600 hover:bg-emerald-500 px-10 py-5 rounded-2xl font-black text-2xl text-white active:scale-95 transition-all touch-manipulation ${chronoRunning ? 'hidden' : ''}"
                        onclick="window.natationDemarrer()"
                        ${tempsFinal !== null ? 'disabled' : ''}>
                    ▶ Démarrer
                </button>
                <button id="natation-stop-btn" 
                        class="bg-red-600 hover:bg-red-500 px-10 py-5 rounded-2xl font-black text-2xl text-white active:scale-95 transition-all touch-manipulation ${chronoRunning ? '' : 'hidden'}"
                        onclick="window.natationArreter()">
                    ⏹ Arrêter
                </button>
            </div>

            ${tempsFinal !== null ? `
                <div class="mt-6 flex gap-4 justify-center">
                    <button onclick="window.natationValiderTemps()" 
                            class="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all touch-manipulation">
                        ✅ Valider
                    </button>
                    <button onclick="window.natationRecommencer()" 
                            class="bg-slate-600 hover:bg-slate-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all touch-manipulation">
                        ↺ Recommencer
                    </button>
                </div>
            ` : ''}

            <button onclick="window.natationRetourListe()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-all touch-manipulation">
                ← Autre élève
            </button>
        </div>
    `;
    console.log('⏱️ Chrono affiché pour le numéro', currentNumero);
}

// ============================================================
// 3. SAISIE DES COUPS DE BRAS (démarre à 25)
// ============================================================
function afficherSaisieCoups(container) {
    const tempsStr = formatTime(tempsFinal);
    // Valeur par défaut à 25
    const coupsInit = window._coupsSaisis || 25;
    
    container.innerHTML = `
        <div class="bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center max-w-md mx-auto">
            <div class="flex items-center justify-center gap-6 mb-6">
                <span class="text-2xl font-black text-slate-400">N°</span>
                <span class="text-7xl font-black text-yellow-400">${currentNumero}</span>
            </div>
            <p class="text-sm text-slate-400 mb-2">Temps enregistré</p>
            <div class="text-5xl font-black text-yellow-400 mb-6">${tempsStr}</div>
            
            <p class="text-lg font-bold text-white mb-4">Combien de coups de bras ?</p>
            <div class="flex justify-center items-center gap-6 mb-6">
                <button onclick="window.natationAdjustCoups(-1)" 
                        class="bg-slate-700 hover:bg-slate-600 w-20 h-20 rounded-2xl text-4xl font-black text-white active:scale-95 transition-all touch-manipulation">−</button>
                <span id="natation-coups-display" class="text-7xl font-black text-white w-32 text-center">${coupsInit}</span>
                <button onclick="window.natationAdjustCoups(1)" 
                        class="bg-slate-700 hover:bg-slate-600 w-20 h-20 rounded-2xl text-4xl font-black text-white active:scale-95 transition-all touch-manipulation">+</button>
            </div>
            <p class="text-xs text-slate-500 mb-6">(1 cycle = 2 coups de bras)</p>

            <div class="flex gap-4 justify-center">
                <button onclick="window.natationValiderCoups()" 
                        class="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all touch-manipulation">
                    ✅ Enregistrer
                </button>
                <button onclick="window.natationAnnulerCoups()" 
                        class="bg-slate-600 hover:bg-slate-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all touch-manipulation">
                    Annuler
                </button>
            </div>

            <button onclick="window.natationRetourListe()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-all touch-manipulation">
                ← Autre élève
            </button>
        </div>
    `;
    // Initialiser le compteur à 25
    window._coupsSaisis = coupsInit;
    const display = document.getElementById('natation-coups-display');
    if (display) display.textContent = coupsInit;
    console.log('✋ Saisie des coups pour le numéro', currentNumero, ', valeur initiale :', coupsInit);
}

// ============================================================
// ENREGISTREMENT
// ============================================================
function enregistrerTempsEtCoups(tempsMs, nbCoups) {
    if (currentNumero === null) {
        console.warn('Aucun numéro sélectionné');
        return;
    }
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
        alert('✅ Temps et coups enregistrés !');
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
// RETOUR AU MENU PRINCIPAL (élève)
// ============================================================
window.retourMenuNatation = function() {
    console.log('⬅️ Retour au menu principal');
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