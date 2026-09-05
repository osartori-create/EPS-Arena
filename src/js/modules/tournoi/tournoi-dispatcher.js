// src/js/modules/tournoi/tournoi-dispatcher.js
// Dispatcher : charge la bonne variante du tournoi

import { getVariantConfig, getDefaultVariant } from './tournoi-registry.js';
import { initTournoiCore, currentClasse } from './tournoi-core.js';
import { db, ref, onValue } from '../../core/firebase-service.js';

let currentVariant = null;
let currentUnload = null;
let currentClasseName = '';

export async function loadTournoiVariant(classe, mode) {
    // Détruire l'ancienne variante si présente
    if (currentUnload) {
        try {
            await currentUnload();
        } catch (e) {
            console.warn('Erreur déchargement variante :', e);
        }
        currentUnload = null;
    }

    // Initialiser le cœur commun (une seule fois)
    if (!currentClasseName) {
        initTournoiCore(classe);
        currentClasseName = classe;
    }

    // Lire le mode dans Firebase (si non spécifié)
    if (!mode) {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/config`);
        const snap = await new Promise(resolve => onValue(configRef, resolve, { onlyOnce: true }));
        const config = snap.val() || {};
        mode = config.mode || getDefaultVariant();
    }

    console.log(`🎯 [Tournoi] Variante demandée : ${mode}`);

    if (mode === currentVariant) {
        return currentUnload;
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
        
        if (module.init) {
            currentUnload = await module.init(classe) || (() => {});
            console.log(`✅ [Tournoi] Variante "${mode}" chargée`);
        } else {
            console.error(`❌ La variante "${mode}" n'exporte pas init()`);
            const fallback = await getVariantConfig('elimination').module();
            currentUnload = await fallback.init(classe) || (() => {});
        }
    } catch (error) {
        console.error(`❌ Erreur chargement variante "${mode}":`, error);
        const fallback = await getVariantConfig('elimination').module();
        currentUnload = await fallback.init(classe) || (() => {});
    }

    return currentUnload;
}

// Point d'entrée pour eleve-app.js
export function initTournoi(classe, mode) {
    return loadTournoiVariant(classe, mode);
}

// Pour le professeur : générer la liste des variantes
export { getAvailableVariants } from './tournoi-registry.js';