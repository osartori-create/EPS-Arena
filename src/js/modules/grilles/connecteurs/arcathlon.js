// src/js/modules/grilles/connecteurs/arcathlon.js
// Connecteur : remplit automatiquement les critères auto de la grille Arcathlon
// - Projet : vitesse 1ère série vs VMA (issue du Luc Léger)
// - Performance/Tir : cumul scoreTir sur toutes les séries

import { db, ref, onValue } from '../../../core/firebase-service.js';
import { getExistingEleves } from '../../../services/admin-service.js';
import { getVMAFromPalier } from '../../evaluation/evaluation-utils.js';

/**
 * Calcule les niveaux automatiques pour un élève en Arcathlon.
 * @param {string} classe
 * @param {string} eleveId
 * @param {Object} config - Config Firebase Arcathlon (contient equipes, vmaReference)
 * @param {Object} options - { niveau } (optionnel)
 * @returns {Promise<Object>} { [cle]: niveau }
 */
export function calculerNiveauxArcathlon(classe, eleveId, config, options = {}) {
    return new Promise((resolve) => {
        // 1. Trouver le code Arcathlon de l'élève
        const code = getCodeArcathlon(classe, eleveId);
        if (!code) {
            console.log(`[Arcathlon] Élève ${eleveId} non trouvé dans les équipes`);
            resolve({});
            return;
        }

        // 2. Récupérer la VMA de l'élève
        const vma = getVMAEleve(classe, eleveId);
        if (vma === null) {
            console.warn(`[Arcathlon] VMA introuvable pour ${eleveId}`);
        }

        // 3. Lire les passages
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/arcathlon/passages`;

        onValue(ref(db, basePath), (snap) => {
            const passages = snap.val() || {};
            const result = analyserPassages(passages, code, vma);
            resolve(result);
        }, { onlyOnce: true });
    });
}

function getCodeArcathlon(classe, eleveId) {
    const equipes = JSON.parse(localStorage.getItem(`arcathlon_equipes_${classe}`) || '[]');
    for (const eq of equipes) {
        for (const m of eq.membres) {
            if (m.id === eleveId) return `${eq.id}_${m.maillot}`;
        }
    }
    return null;
}

function getVMAEleve(classe, eleveId) {
    // Priorité 1 : champ direct dans les élèves
    const eleves = getExistingEleves(classe);
    const eleve = eleves.find(e => e.id === eleveId);
    if (eleve?.vma && parseFloat(eleve.vma) > 0) {
        return parseFloat(eleve.vma);
    }

    // Priorité 2 : évaluation Luc Léger (palier → VMA)
    const evalData = JSON.parse(localStorage.getItem(`eps_arena_evaluation_${classe}`) || 'null');
    const palier = evalData?.eleves?.[eleveId]?.resultats?.endurance?.palier;
    if (palier !== undefined && palier !== null) {
        const vma = getVMAFromPalier(palier);
        if (vma !== null) return vma;
    }

    return null;
}

function analyserPassages(passages, code, vma) {
    const result = {};

    // Aplatir tous les passages (tous modes confondus)
    const allPassages = [];
    Object.values(passages).forEach(modeData => {
        Object.values(modeData || {}).forEach(p => {
            if (p.code === code) allPassages.push(p);
        });
    });

    if (allPassages.length === 0) return result;

    // ============================================================
    // Critère PROJET : vitesse 1ère série vs VMA
    // ============================================================
    if (vma !== null) {
        const premiereSerie = allPassages.find(p => p.serie === 1 && !p.isFinale);
        if (premiereSerie && premiereSerie.vitesseGrandeBoucle > 0) {
            const vReelle = premiereSerie.vitesseGrandeBoucle;
            const ecart = Math.abs(vReelle - vma);
            let niveau;
            if (ecart <= 0.5) niveau = 4;
            else if (ecart <= 1) niveau = 3;
            else if (ecart <= 2) niveau = 2;
            else niveau = 1;

            result['projet'] = niveau;
            result['coureur_projet'] = niveau;
            result['coureur_son_projet'] = niveau;

            console.log(`[Arcathlon] Projet ${code} : V_réelle=${vReelle} vs VMA=${vma} → écart ${ecart.toFixed(2)} → niveau ${niveau}`);
        }
    }

    // ============================================================
    // Critère PERFORMANCE / TIR : cumul scoreTir
    // ============================================================
    const totalTir = allPassages.reduce((sum, p) => sum + (p.scoreTir || 0), 0);
    let niveauTir;
    if (totalTir > 15) niveauTir = 4;
    else if (totalTir >= 12) niveauTir = 3;
    else if (totalTir >= 7) niveauTir = 2;
    else niveauTir = 1;

    result['performance_tir'] = niveauTir;
    result['tir'] = niveauTir;
    result['coureur_performance'] = niveauTir;
    result['coureur_performance_tir'] = niveauTir;

    console.log(`[Arcathlon] Performance ${code} : totalTir=${totalTir} → niveau ${niveauTir}`);

    return result;
}