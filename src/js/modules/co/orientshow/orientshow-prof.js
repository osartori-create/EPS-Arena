// src/js/modules/co/orientshow/orientshow-prof.js
// Module professeur pour OrientShow (sous-module CO)

import {
    initOrientShowInterface,
    loadOrientShowAssignments,
    exportOrientShowConfig,
    importOrientShowConfig,
    startOrientShow,
    stopOrientShow
} from '../../orientshow/orientshow-interface.js';

import { db, ref, set } from '../../../core/firebase-service.js';

let currentClasse = '';

// ============================================================
// FONCTIONS D’INITIALISATION
// ============================================================

export function initProf(classe) {
    currentClasse = classe || document.getElementById('selectClasse')?.value || '';
    // Utiliser le conteneur dédié
    const container = document.getElementById('co-orientshow-container');
    if (container) {
        // On déplace l'interface existante dans le conteneur
        // Mais initOrientShowInterface utilise le conteneur #viewOrientShowSettings
        // On va plutôt réinitialiser l'interface pour qu'elle utilise le conteneur
        // On appelle la fonction d'init avec un paramètre optionnel
        initOrientShowInterface(container);
        loadOrientShowAssignments();
    } else {
        // Fallback : utiliser le conteneur existant
        initOrientShowInterface();
        loadOrientShowAssignments();
    }
}

export function initKiosk(classe, code) {
    console.log('[OrientShow] Kiosk init pour', classe, code);
    // Appel à orientshow-kiosk
    import('../../eleve/orientshow-kiosk.js').then(module => {
        module.initOrientShowKiosk(classe, code);
    });
}

// ============================================================
// GÉNÉRATION DES GROUPES
// ============================================================

export async function generateTeams(classe) {
    alert("Pour OrientShow, glissez les élèves depuis la réserve vers les codes.");
}

// ============================================================
// TRANSMISSION FIREBASE
// ============================================================

export async function transmettre(classe) {
    const activeClasse = classe || document.getElementById('selectClasse')?.value || currentClasse;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `etablissements/0680013V/profs/${profCode}`;
    
    // Utiliser la matrice existante
    const matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix') || '{}');
    const startTime = localStorage.getItem('eps_arena_os_startTime');
    const endTime = localStorage.getItem('eps_arena_os_endTime');
    
    const configData = {
        activite: 'orientshow',
        matrix: matrix,
        nbCircuits: 12,
        nbCouleurs: 5
    };
    
    if (startTime) configData.startTime = parseInt(startTime);
    if (endTime) configData.endTime = parseInt(endTime);

    try {
        console.log("📡 Configuration OrientShow envoyée :", configData);
        await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
        await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
        alert("✅ Configuration OrientShow transmise aux iPads !");
    } catch (e) {
        console.error("Erreur transmission :", e);
        alert("Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
    }
}

// ============================================================
// EXPOSITION DES FONCTIONS (compatibilité HTML)
// ============================================================
window.exportOrientShowConfig = exportOrientShowConfig;
window.importOrientShowConfig = importOrientShowConfig;
window.startOrientShow = startOrientShow;
window.stopOrientShow = stopOrientShow;

// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================
export default {
    initProf,
    initKiosk,
    generateTeams,
    transmettre
};