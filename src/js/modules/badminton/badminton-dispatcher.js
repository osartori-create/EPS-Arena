// src/js/modules/badminton/badminton-dispatcher.js
// Dispatcher : lit config.mode et charge le bon module

import { getModeConfig, getDefaultMode, getModesList } from './badminton-registry.js';
import { initBadmintonCommon, currentClasse } from './badminton-common.js';
import { db, ref, onValue } from '../../core/firebase-service.js';

let currentMode = null;
let currentUnload = null;

export async function loadBadmintonMode(classe) {
    // Détruire l'ancien mode si présent
    if (currentUnload) {
        try {
            await currentUnload();
        } catch (e) {
            console.warn('Erreur déchargement mode :', e);
        }
        currentUnload = null;
    }

    // Initialiser le code commun (une seule fois)
    if (!currentClasse) {
        initBadmintonCommon(classe);
    }

    // Lire la config Firebase pour connaître le mode
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/config`);
    
    return new Promise((resolve) => {
        onValue(configRef, async (snap) => {
            const config = snap.val() || {};
            const mode = config.mode || getDefaultMode();
            
            console.log(`🎯 [Dispatcher] Mode demandé : ${mode}`);

            if (mode === currentMode) {
                resolve(currentUnload);
                return;
            }

            currentMode = mode;

            // Vérifier que le mode existe
            const modeConfig = getModeConfig(mode);
            if (!modeConfig) {
                console.error(`⚠️ Mode "${mode}" inconnu, fallback terrain`);
                currentMode = 'terrain';
                const fallbackConfig = getModeConfig('terrain');
                try {
                    const module = await fallbackConfig.module();
                    if (module.init) {
                        currentUnload = await module.init(classe, config) || (() => {});
                    }
                } catch (err) {
                    console.error('❌ Fallback échoué :', err);
                }
                resolve(currentUnload);
                return;
            }

            try {
                console.log(`📦 [Dispatcher] Chargement du mode "${mode}"...`);
                const module = await modeConfig.module();
                
                if (module.init) {
                    console.log(`✅ [Dispatcher] Mode "${mode}" chargé`);
                    currentUnload = await module.init(classe, config) || (() => {});
                } else {
                    console.error(`❌ Le module "${mode}" n'exporte pas init()`);
                    // Fallback
                    const fallbackModule = await getModeConfig('terrain').module();
                    currentUnload = await fallbackModule.init(classe, config) || (() => {});
                }
            } catch (error) {
                console.error(`❌ Erreur chargement mode "${mode}":`, error);
                // Fallback
                try {
                    const fallbackModule = await getModeConfig('terrain').module();
                    currentUnload = await fallbackModule.init(classe, config) || (() => {});
                } catch (e2) {
                    console.error('❌ Fallback échoué :', e2);
                }
            }
            resolve(currentUnload);
        }, { onlyOnce: true });
    });
}

// Point d'entrée pour eleve-app.js
export function initBadmintonKiosk(classe) {
    return loadBadmintonMode(classe);
}

// ✅ Pour le professeur : générer la liste des modes
export function getBadmintonModes() {
    return getModesList();
}