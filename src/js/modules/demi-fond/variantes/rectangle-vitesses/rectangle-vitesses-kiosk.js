// src/js/modules/demi-fond/variantes/rectangle-vitesses/rectangle-vitesses-kiosk.js
// Kiosk élève : bilan final uniquement.
// L'élève saisit son code, puis sa vitesse moyenne (km/h) et son RPE (0-10).
// Aucun chrono ni bip côté kiosk : tout est piloté par la tablette prof.
import { getEtab } from '../../../../core/firebase-service.js';
import { db, ref, onValue, set } from '../../../../core/firebase-service.js';
import { getBasePath } from '../../demifond-common.js';

let state = {
    classe: '',
    config: null,
    code: null,
    vitesse: '',
    rpe: null
};
let configListener = null;

const COOLDOWN_MS = 30000;
const COOLDOWN_KEY = 'eps_arena_rect_vit_last_send';

export function initRectangleVitessesKiosk(classe) {
    state.classe = classe;
    state.code = null;
    state.vitesse = '';
    state.rpe = null;

    const container = document.getElementById('demi-fond-module');
    if (!container) return;

    if (configListener) configListener();
    configListener = onValue(ref(db, `${getBasePath(classe)}/config`), (snap) => {
        state.config = snap.val() || null;
        rendre();
    });

    rendre();
    return cleanupRectangleVitessesKiosk;
}

function rendre() {
    const container = document.getElementById('demi-fond-module');
    if (!container) return;

    if (!state.config) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400"><p class="text-xl">⏳ En attente de la configuration...</p></div>';
        return;
    }

    if (state.config.sousModule !== 'rectangle-vitesses') {
        container.innerHTML = '<div class="text-center py-10 text-slate-400">Sous-module non actif.</div>';
        return;
    }

    if (state.code === null) {
        rendreSaisieCode(container);
    } else {
        rendreBilan(container);
    }
}

// ============================================================
// ÉCRAN CODE
// ============================================================
function rendreSaisieCode(container) {
    const titre = state.config.sousActivite === 'echauffement'
        ? 'Fiche d’échauffement'
        : 'Régulier sur 3 minutes';

    container.innerHTML = `
        <div class="max-w-md mx-auto space-y-4 p-4">
            <div class="text-center py-4">
                <div class="text-5xl mb-3">🟦</div>
                <h2 class="text-3xl font-black text-white mb-1">${titre}</h2>
                <p class="text-slate-400 text-sm">Bilan de fin de séance</p>
            </div>
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-2">Ton code élève</label>
                <input type="number" id="rect-code" inputmode="numeric" placeholder="Ex : 12"
                       class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-4xl font-black text-white">
            </div>
            <button onclick="window.rectangleKioskValiderCode()"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-xl text-white active:scale-95 transition-all">
                ✅ Continuer
            </button>
            <button onclick="window.retourMenuDemiFond()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-xs text-white active:scale-95">
                ← Retour
            </button>
        </div>
    `;
}

window.rectangleKioskValiderCode = function() {
    const el = document.getElementById('rect-code');
    const code = parseInt(el?.value);
    if (!code || isNaN(code)) {
        alert('Saisis ton code.');
        return;
    }
    state.code = String(code);
    rendre();
};

// ============================================================
// ÉCRAN BILAN
// ============================================================
function rendreBilan(container) {
    container.innerHTML = `
        <div class="max-w-md mx-auto space-y-4 p-4">
            <div class="flex items-center justify-between bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <button onclick="window.rectangleKioskRetourCode()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">
                    ← Code
                </button>
                <div class="text-center">
                    <div class="text-[10px] text-slate-400 uppercase">Code élève</div>
                    <div class="text-2xl font-black text-yellow-400">#${state.code}</div>
                </div>
                <div class="w-16"></div>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-2">Vitesse moyenne réalisée</label>
                <input type="number" id="rect-vitesse" inputmode="decimal" step="0.1" min="0" max="30"
                       placeholder="Ex : 10"
                       class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-4xl font-black text-emerald-400">
                <p class="text-[10px] text-slate-500 text-center mt-2">En km/h (1 plot franchi en 18 s = 1 km/h)</p>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-2">Ressenti d’effort (RPE 0-10)</label>
                <div id="rect-rpe" class="grid grid-cols-5 gap-2"></div>
            </div>

            <button onclick="window.rectangleKioskValiderBilan()"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-xl text-white active:scale-95 transition-all">
                ✅ Envoyer mon bilan
            </button>
        </div>
    `;
    rendreRPE();
}

function rendreRPE() {
    const cont = document.getElementById('rect-rpe');
    if (!cont) return;
    let html = '';
    for (let i = 0; i <= 10; i++) {
        const actif = state.rpe === i;
        const couleur = i <= 3 ? '#22c55e' : (i <= 5 ? '#eab308' : (i <= 7 ? '#f97316' : '#ef4444'));
        html += `
            <button onclick="window.rectangleKioskSetRPE(${i})"
                    class="py-3 rounded-xl font-black text-lg border-2 active:scale-95 transition-all ${actif ? 'border-white ring-2' : 'border-slate-700'}"
                    style="background:${actif ? couleur : '#1e293b'}; color:${actif ? '#0f172a' : '#94a3b8'}">
                ${i}
            </button>
        `;
    }
    cont.innerHTML = html;
}

window.rectangleKioskSetRPE = function(valeur) {
    state.rpe = valeur;
    rendreRPE();
};

window.rectangleKioskRetourCode = function() {
    state.code = null;
    state.vitesse = '';
    state.rpe = null;
    rendre();
};

// ============================================================
// ENVOI
// ============================================================
window.rectangleKioskValiderBilan = async function() {
    const vitesse = parseFloat(document.getElementById('rect-vitesse')?.value.replace(',', '.'));
    if (!isFinite(vitesse) || vitesse < 0) {
        alert('Indique ta vitesse moyenne en km/h.');
        return;
    }
    if (state.rpe === null) {
        alert('Choisis ton ressenti (RPE 0-10).');
        return;
    }

    const cooldowns = JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}');
    const now = Date.now();
    const last = cooldowns[state.code] || 0;
    if (now - last < COOLDOWN_MS) {
        const restant = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
        alert(`⏳ Attends encore ${restant}s avant de renvoyer.`);
        return;
    }

    const obsRef = ref(db, `${getBasePath(state.classe)}/observations/rectangle-vitesses/${state.code}`);
    try {
        await set(obsRef, {
            code: state.code,
            vitesse: Math.round(vitesse * 10) / 10,
            rpe: state.rpe,
            sousActivite: state.config.sousActivite,
            timestamp: now
        });
        cooldowns[state.code] = now;
        localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));

        const container = document.getElementById('demi-fond-module');
        if (container) {
            container.innerHTML = `
                <div class="max-w-md mx-auto text-center py-16 p-4">
                    <div class="text-7xl mb-4">✅</div>
                    <h2 class="text-3xl font-black text-emerald-400 mb-2">Bilan enregistré !</h2>
                    <p class="text-slate-300 mb-8">Vitesse ${Math.round(vitesse * 10) / 10} km/h · RPE ${state.rpe}/10</p>
                    <button onclick="window.retourMenuDemiFond()"
                            class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white active:scale-95 transition-all">
                        🔄 Autre élève
                    </button>
                </div>
            `;
        }
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de l\'enregistrement : ' + err.message);
    }
};

export function cleanupRectangleVitessesKiosk() {
    if (configListener) {
        configListener();
        configListener = null;
    }
}

window.retourMenuDemiFond = function() {
    cleanupRectangleVitessesKiosk();
    const container = document.getElementById('demi-fond-module');
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
};
