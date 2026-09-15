// src/js/modules/tournoi/tournoi-dispatcher.js
import { getVariantConfig, getDefaultVariant } from './tournoi-registry.js';
import { initTournoiCore, getCurrentClasse, getCurrentVariant } from './tournoi-core.js';
import { db, ref, onValue } from '../../core/firebase-service.js';

let currentVariant = null;
let currentUnload = null;

export async function loadTournoiVariant(classe, mode) {
    if (currentUnload) {
        try { await currentUnload(); } catch(e) {}
        currentUnload = null;
    }

    if (!mode) {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/config`);
        const snap = await new Promise(resolve => onValue(configRef, resolve, { onlyOnce: true }));
        const config = snap.val() || {};
        mode = config.mode || getDefaultVariant();
    }

    console.log(`🎯 [Tournoi] Variante demandée : ${mode}`);
    if (mode === currentVariant) return currentUnload;

    // Clé de variante utilisée dans les chemins Firebase
    // 'elimination' reste à la racine (legacy). 'atp' utilise son sous-dossier.
    const variantKey = (mode === 'atp') ? 'atp' : null;

    // (Re)init du core si la classe ou la variante a changé
    if (getCurrentClasse() !== classe || getCurrentVariant() !== variantKey) {
        initTournoiCore(classe, variantKey);
    }

    currentVariant = mode;
    const variantConfig = getVariantConfig(mode);
    if (!variantConfig) {
        console.warn(`⚠️ Variante "${mode}" inconnue, fallback elimination`);
        return loadTournoiVariant(classe, 'elimination');
    }

    try {
        console.log(`📦 [Tournoi] Chargement de la variante "${mode}"...`);
        const module = await variantConfig.module();
        const initFn = module.default?.init || module.init;
        if (typeof initFn === 'function') {
            currentUnload = await initFn(classe) || (() => {});
            console.log(`✅ [Tournoi] Variante "${mode}" chargée`);
        } else {
            console.error(`❌ La variante "${mode}" n'exporte pas init()`);
        }
    } catch (error) {
        console.error(`❌ Erreur chargement variante "${mode}":`, error);
    }
    return currentUnload;
}

export function initTournoi(classe, mode) {
    return loadTournoiVariant(classe, mode);
}