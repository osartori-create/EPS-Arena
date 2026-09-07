// src/js/modules/natation/natation-kiosk.js
import { db, ref, onValue, set } from '../../core/firebase-service.js';

let currentClasse = '';
let currentNumero = null;
let config = null;
let configListener = null;

let chronoRunning = false;
let chronoStart = 0;
let chronoElapsed = 0;
let rafId = null;
let tempsFinal = null;

export function initNatationKiosk(classe) {
    currentClasse = classe;
    currentNumero = null;
    tempsFinal = null;

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
        afficherKiosk();
    });
}

function afficherKiosk() {
    const container = document.getElementById('natation-module');
    if (!container) return;

    const distance = config?.distance || 25;

    let tempsAffiche = '--:--.-';
    let boutonStartDisabled = true;
    let message = 'Entre ton numéro pour commencer.';

    if (currentNumero !== null) {
        boutonStartDisabled = false;
        message = `Numéro ${currentNumero} sélectionné.`;
        if (tempsFinal !== null) {
            tempsAffiche = formatTime(tempsFinal);
            message = `Temps enregistré : ${tempsAffiche}`;
        } else if (chronoRunning) {
            tempsAffiche = formatTime(chronoElapsed);
        }
    }

    container.innerHTML = `
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center max-w-md mx-auto">
            <h2 class="text-2xl font-black text-white mb-2">🏊 Indice de nage</h2>
            <p class="text-sm text-slate-400 mb-4">${distance}m - Départ dans l'eau</p>

            <div class="mb-4">
                <label class="text-xs font-bold text-slate-400 uppercase">Ton numéro</label>
                <div class="flex justify-center items-center gap-2 mt-1">
                    <input type="number" id="natation-code-input" 
                           inputmode="numeric" 
                           class="w-24 bg-slate-900 border-2 border-slate-600 rounded-xl p-2 text-center text-3xl font-black text-white"
                           placeholder="N°" 
                           min="1" max="99" 
                           value="${currentNumero || ''}"
                           oninput="window.natationSetCode(this.value)">
                    <button onclick="window.natationSetCode(document.getElementById('natation-code-input').value)" 
                            class="bg-blue-600 px-4 py-2 rounded-xl font-black text-sm text-white active:scale-95">
                        OK
                    </button>
                </div>
                <p id="natation-message" class="text-xs text-slate-400 mt-1">${message}</p>
            </div>

            <div class="text-6xl font-black tabular-nums text-yellow-400 mb-6" id="natation-chrono-display">
                ${tempsAffiche}
            </div>

            <div class="flex gap-3 justify-center">
                <button id="natation-start-btn" 
                        class="bg-emerald-600 px-8 py-4 rounded-2xl font-black text-white text-xl active:scale-95 ${chronoRunning ? 'hidden' : ''}"
                        onclick="window.natationDemarrer()"
                        ${boutonStartDisabled ? 'disabled' : ''}>
                    ▶ Démarrer
                </button>
                <button id="natation-stop-btn" 
                        class="bg-red-600 px-8 py-4 rounded-2xl font-black text-white text-xl active:scale-95 ${chronoRunning ? '' : 'hidden'}"
                        onclick="window.natationArreter()">
                    ⏹ Arrêter
                </button>
                <button id="natation-reset-btn" 
                        class="bg-slate-600 px-6 py-4 rounded-2xl font-black text-white text-sm active:scale-95 ${tempsFinal !== null ? '' : 'hidden'}"
                        onclick="window.natationReset()">
                    ↺ Recommencer
                </button>
            </div>

            <button onclick="window.retourMenuNatation()" 
                    class="mt-6 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                ← Retour
            </button>
        </div>
    `;

    updateButtons();
}

function updateButtons() {
    const startBtn = document.getElementById('natation-start-btn');
    const stopBtn = document.getElementById('natation-stop-btn');
    const resetBtn = document.getElementById('natation-reset-btn');

    if (startBtn) {
        startBtn.classList.toggle('hidden', chronoRunning || tempsFinal !== null);
        startBtn.disabled = (currentNumero === null);
    }
    if (stopBtn) stopBtn.classList.toggle('hidden', !chronoRunning);
    if (resetBtn) resetBtn.classList.toggle('hidden', tempsFinal === null);
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    const dec = Math.floor((ms % 1000) / 100);
    return `${min}:${sec}.${dec}`;
}

// ============================================================
// GESTION DU CODE
// ============================================================
window.natationSetCode = function(value) {
    const num = parseInt(value);
    if (isNaN(num) || num < 1) {
        currentNumero = null;
    } else {
        currentNumero = num;
    }
    window.natationReset();
    afficherKiosk();
};

// ============================================================
// ACTIONS DU CHRONO
// ============================================================
window.natationDemarrer = function() {
    if (currentNumero === null) {
        alert('Entre ton numéro d\'abord.');
        return;
    }
    if (chronoRunning) return;
    chronoRunning = true;
    chronoStart = performance.now() - chronoElapsed;
    rafId = requestAnimationFrame(updateChrono);
    updateButtons();
};

window.natationArreter = function() {
    if (!chronoRunning) return;
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    tempsFinal = chronoElapsed;
    
    // Demander le nombre de coups de bras
    demanderCoupsBras(tempsFinal);
};

function demanderCoupsBras(tempsMs) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
            <h3 class="text-xl font-black text-white text-center mb-2">🏊 Temps enregistré</h3>
            <p class="text-4xl font-black text-yellow-400 text-center mb-4">${formatTime(tempsMs)}</p>
            <p class="text-sm text-slate-400 text-center mb-4">Combien de coups de bras as-tu effectués ?</p>
            <div class="flex justify-center mb-4">
                <input type="number" id="natation-coups-input" 
                       inputmode="numeric" 
                       class="w-32 bg-slate-800 border-2 border-slate-600 rounded-xl p-4 text-center text-3xl font-black text-white"
                       placeholder="Nb" 
                       min="1" max="99" 
                       autofocus>
            </div>
            <div class="flex gap-3">
                <button onclick="window.annulerSaisieCoups()" 
                        class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                    Annuler
                </button>
                <button onclick="window.validerSaisieCoups(${tempsMs})" 
                        class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                    ✅ Valider
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        const input = document.getElementById('natation-coups-input');
        if (input) input.focus();
    }, 300);

    window._coupsOverlay = overlay;
}

window.annulerSaisieCoups = function() {
    if (window._coupsOverlay) {
        window._coupsOverlay.remove();
        window._coupsOverlay = null;
    }
    window.natationReset();
};

window.validerSaisieCoups = function(tempsMs) {
    const input = document.getElementById('natation-coups-input');
    const nbCoups = parseInt(input?.value || '0');
    if (isNaN(nbCoups) || nbCoups < 1) {
        alert('Veuillez saisir un nombre de coups valide (≥ 1).');
        return;
    }
    
    if (window._coupsOverlay) {
        window._coupsOverlay.remove();
        window._coupsOverlay = null;
    }
    
    enregistrerTempsEtCoups(tempsMs, nbCoups);
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
        tempsFinal = tempsMs;
        updateButtons();
        afficherKiosk();
    }).catch(err => {
        console.error('Erreur enregistrement :', err);
        alert('Erreur lors de l\'enregistrement. Réessayez.');
    });
}

window.natationReset = function() {
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    chronoElapsed = 0;
    tempsFinal = null;
    updateButtons();
    afficherKiosk();
};

function updateChrono() {
    if (!chronoRunning) return;
    chronoElapsed = performance.now() - chronoStart;
    const display = document.getElementById('natation-chrono-display');
    if (display) {
        display.textContent = formatTime(chronoElapsed);
    }
    rafId = requestAnimationFrame(updateChrono);
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