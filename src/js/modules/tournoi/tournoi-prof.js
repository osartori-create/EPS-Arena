// src/js/modules/tournoi/tournoi-prof.js
// Entrée prof unifiée : sélecteur de variante + délégation à la variante active
import { TOURNOI_VARIANTS, getVariantConfig, getDefaultVariant } from './tournoi-registry.js';
import { db, ref, onValue, set } from '../../core/firebase-service.js';

let currentClasse = '';
let currentMode = null;
let variantUnload = null;
let modeUnsub = null;

function getProfBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/tournoi`;
}

export function initTournoiProf(classe) {
    currentClasse = classe;
    ensureSelectorDOM();

    if (modeUnsub) { modeUnsub(); modeUnsub = null; }

    const configRef = ref(db, `${getProfBasePath(classe)}/config`);
    modeUnsub = onValue(configRef, async (snap) => {
        const cfg = snap.val() || {};
        const mode = cfg.mode || getDefaultVariant();
        if (mode !== currentMode) {
            currentMode = mode;
            await chargerVariante(mode);
        }
        renderSelector(mode);
    });

    return () => {
        if (modeUnsub) { modeUnsub(); modeUnsub = null; }
        if (variantUnload) { try { variantUnload(); } catch(e) {} variantUnload = null; }
    };
}

function ensureSelectorDOM() {
    const view = document.getElementById('viewTournoiSettings');
    if (!view) return;
    let selector = document.getElementById('tournoi-mode-selector');
    if (!selector) {
        selector = document.createElement('div');
        selector.id = 'tournoi-mode-selector';
        selector.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4';
        view.prepend(selector);
    }
}

function renderSelector(modeActif) {
    const selector = document.getElementById('tournoi-mode-selector');
    if (!selector) return;

    const variants = Object.values(TOURNOI_VARIANTS);
    let html = `
        <label class="text-xs font-bold text-blue-400 uppercase block mb-2">Variante de tournoi</label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    `;

    variants.forEach(v => {
        const isActive = v.id === modeActif;
        const cls = isActive
            ? 'border-blue-500 bg-blue-900/40 text-white ring-2 ring-blue-400'
            : 'border-slate-700 bg-slate-800 text-slate-300';
        html += `
            <button onclick="window.tournoiChangerVariante('${v.id}')"
                    class="p-4 rounded-xl font-black text-sm border-2 text-left active:scale-95 transition-all ${cls}">
                <div class="text-xl mb-1">${v.icon || ''} ${v.label}</div>
                <div class="text-[10px] font-normal opacity-80">${v.description || ''}</div>
            </button>
        `;
    });

    html += `</div>`;
    selector.innerHTML = html;
}

async function chargerVariante(mode) {
    if (variantUnload) {
        try { await variantUnload(); } catch(e) {}
        variantUnload = null;
    }

    const variant = getVariantConfig(mode);
    if (!variant) return;

    try {
        const module = await variant.module();
        const initProfFn = module.initProf;
        if (typeof initProfFn === 'function') {
            variantUnload = await initProfFn(currentClasse) || (() => {});
        } else {
            console.warn(`[Tournoi Prof] La variante "${mode}" n'exporte pas initProf()`);
        }
    } catch (err) {
        console.error(`[Tournoi Prof] Erreur chargement variante "${mode}":`, err);
    }
}

window.tournoiChangerVariante = async function(mode) {
    if (!currentClasse) return;
    if (!TOURNOI_VARIANTS[mode]) return;

    const target = TOURNOI_VARIANTS[mode];
    if (!confirm(`Basculer vers la variante "${target.label}" ?\n\nLes données de la variante actuelle restent conservées dans Firebase.`)) return;

    await set(ref(db, `${getProfBasePath(currentClasse)}/config/mode`), mode);
    // Le listener onValue détecte le changement et recharge la variante automatiquement
};

window.initTournoiProf = initTournoiProf;