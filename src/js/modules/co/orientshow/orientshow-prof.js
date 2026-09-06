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

export function initProf(classe, container) {
    currentClasse = classe || document.getElementById('selectClasse')?.value || '';
    // ✅ Si un conteneur est fourni, on l’utilise
    const targetContainer = container || document.getElementById('co-orientshow-container');
    if (targetContainer) {
        // ✅ Vider le conteneur avant d’initialiser
        targetContainer.innerHTML = '';
        initOrientShowInterface(targetContainer);
        loadOrientShowAssignments();
    } else {
        // Fallback
        initOrientShowInterface();
        loadOrientShowAssignments();
    }
}

export function initKiosk(classe, code) {
    console.log('[OrientShow] Kiosk init pour', classe, code);
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
    
    const matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix') || '{}');
    const startTimeStr = localStorage.getItem('eps_arena_os_startTime');
    const endTimeStr = localStorage.getItem('eps_arena_os_endTime');

    const startTime = (startTimeStr && startTimeStr !== 'null' && startTimeStr !== 'undefined') ? parseInt(startTimeStr) : null;
    const endTime = (endTimeStr && endTimeStr !== 'null' && endTimeStr !== 'undefined') ? parseInt(endTimeStr) : null;

    const configData = {
        activite: 'orientshow',
        matrix: matrix,
        nbCircuits: 12,
        nbCouleurs: 5
    };

    if (startTime !== null && !isNaN(startTime)) configData.startTime = startTime;
    if (endTime !== null && !isNaN(endTime)) configData.endTime = endTime;

    // ✅ Récupérer les codes (couleurs) pour que l’élève voie les bons codes
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${activeClasse}`) || '{}');
    const couleurs = ['NOIR', 'ROUGE', 'BLEU', 'VERT', 'JAUNE'];
    const codeCounts = {};
    couleurs.forEach(c => codeCounts[c] = 0);
    Object.keys(mapping).forEach(key => {
        if (key.startsWith(activeClasse + '_')) {
            const code = key.replace(activeClasse + '_', '');
            const match = code.match(/^([A-Z]+)_(\d+)$/);
            if (match) {
                const couleur = match[1];
                const num = parseInt(match[2], 10);
                if (codeCounts[couleur] !== undefined && num > codeCounts[couleur]) {
                    codeCounts[couleur] = num;
                }
            }
        }
    });
    // Ajouter les couleurs avec leur nombre max à la config
    Object.keys(codeCounts).forEach(couleur => {
        if (codeCounts[couleur] > 0) {
            configData[couleur] = codeCounts[couleur];
        }
    });

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

export default {
    initProf,
    initKiosk,
    generateTeams,
    transmettre
};