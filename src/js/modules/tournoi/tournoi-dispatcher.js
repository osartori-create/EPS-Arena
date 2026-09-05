// src/js/modules/tournoi/tournoi-dispatcher.js

import { getVariantConfig, getDefaultVariant } from './tournoi-registry.js';
import { initTournoiCore, currentClasse } from './tournoi-core.js';
import { db, ref, onValue } from '../../core/firebase-service.js';

let currentVariant = null;
let currentUnload = null;

export async function loadTournoiVariant(classe, mode) {
    if (currentUnload) {
        try { await currentUnload(); } catch(e) {}
        currentUnload = null;
    }

    if (!currentClasse) {
        initTournoiCore(classe);
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

    currentVariant = mode;
    const variantConfig = getVariantConfig(mode);

    if (!variantConfig) {
        console.warn(`⚠️ Variante "${mode}" inconnue, fallback elimination`);
        return loadTournoiVariant(classe, 'elimination');
    }

    try {
        console.log(`📦 [Tournoi] Chargement de la variante "${mode}"...`);
        const module = await variantConfig.module();
        
        // Rechercher la fonction init (exportée directement ou via default)
        const initFn = module.init || module.default?.init;
        if (typeof initFn === 'function') {
            currentUnload = await initFn(classe) || (() => {});
            console.log(`✅ [Tournoi] Variante "${mode}" chargée`);
        } else {
            console.error(`❌ La variante "${mode}" n'exporte pas init()`);
            // Fallback vers la variante par défaut
            const fallback = await getVariantConfig('elimination').module();
            const fallbackInit = fallback.init || fallback.default?.init;
            if (typeof fallbackInit === 'function') {
                currentUnload = await fallbackInit(classe) || (() => {});
            } else {
                console.error('❌ Fallback échoué : aucun init trouvé');
            }
        }
    } catch (error) {
        console.error(`❌ Erreur chargement variante "${mode}":`, error);
        // Fallback
        try {
            const fallback = await getVariantConfig('elimination').module();
            const fallbackInit = fallback.init || fallback.default?.init;
            if (typeof fallbackInit === 'function') {
                currentUnload = await fallbackInit(classe) || (() => {});
            }
        } catch (e2) {
            console.error('❌ Fallback échoué :', e2);
        }
    }

    return currentUnload;
}

export function initTournoi(classe, mode) {
    return loadTournoiVariant(classe, mode);
}