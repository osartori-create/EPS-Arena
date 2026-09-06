// src/js/modules/co/classique/classique-prof.js
// Module professeur pour le CO classique

import {
    initCOInterface,
    populateReserveWithStudents,
    initSortableCO,
    loadCOAssignments,
    exportCOConfig,
    importCOConfig
} from '../co-interface.js';

import {
    renderCircuits,
    addCircuit as addCircuitCO,
    editCircuit as editCircuitCO,
    delCircuit as delCircuitCO
} from '../circuit-manager.js';

import { db, ref, set } from '../../../core/firebase-service.js';

let currentClasse = '';

// ============================================================
// FONCTIONS D’INITIALISATION
// ============================================================

export function initProf(classe) {
    currentClasse = classe || document.getElementById('selectClasse')?.value || '';
    initCOInterface();
    initSortableCO();
    loadCOAssignments();
    renderCircuits('circuitList', "");
}

export function initKiosk(classe, code) {
    console.log('[CO Classique] Kiosk init pour', classe, code);
    // À implémenter selon les besoins
}

// ============================================================
// GÉNÉRATION DES GROUPES
// ============================================================

export async function generateTeams(classe) {
    const activeClasse = classe || document.getElementById('selectClasse')?.value || currentClasse;
    if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
    
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    if (eleves.length === 0) return alert("Aucun élève dans cette classe.");
    
    await populateReserveWithStudents(eleves);
    alert("Tous les élèves sont dans la réserve CO.");
}

// ============================================================
// TRANSMISSION FIREBASE
// ============================================================

export async function transmettre(classe) {
    const activeClasse = classe || document.getElementById('selectClasse')?.value || currentClasse;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `etablissements/0680013V/profs/${profCode}`;
    
    const configData = JSON.parse(localStorage.getItem(`eps_arena_co_assignments_${activeClasse}`) || '{}');
    configData.activite = 'co';
    
    const localMapping = {};
    Object.keys(configData).forEach(lettre => {
        if (lettre !== 'activite' && Array.isArray(configData[lettre])) {
            localMapping[`${activeClasse}_${lettre}`] = configData[lettre];
            configData[lettre] = configData[lettre].length;
        }
    });
    
    localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));

    try {
        console.log("📡 Configuration CO classique envoyée :", configData);
        await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
        await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
        alert("✅ Configuration CO classique transmise aux iPads !");
    } catch (e) {
        console.error("Erreur transmission :", e);
        alert("Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
    }
}

// ============================================================
// GESTION DES CIRCUITS (exposée globalement)
// ============================================================

export const addCircuit = addCircuitCO;
export const editCircuit = editCircuitCO;
export const delCircuit = delCircuitCO;

// Rendre les fonctions disponibles globalement pour les boutons HTML
window.addCircuit = addCircuitCO;
window.editCircuit = editCircuitCO;
window.delCircuit = delCircuitCO;

// Exporter les fonctions d'export/import pour compatibilité
window.exportCOConfig = exportCOConfig;
window.importCOConfig = importCOConfig;

// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================
export default {
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    addCircuit,
    editCircuit,
    delCircuit
};