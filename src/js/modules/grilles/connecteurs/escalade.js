// src/js/modules/grilles/connecteurs/escalade.js
// Connecteur : remplit automatiquement le critère "Grimpeur" de la grille Escalade (C3 ou C4)

import { db, ref, onValue } from '../../../core/firebase-service.js';
import { getLocalMapping } from '../../../core/live-engine.js';

const COTATIONS_ORDER = ['4a', '4b', '4c', '5a', '5b', '5c', '6a', '6b', '6c'];

function cotationIdx(cot) {
    const idx = COTATIONS_ORDER.indexOf(cot);
    return idx >= 0 ? idx : -1;
}

/**
 * Calcule les niveaux automatiques pour un élève en Escalade.
 * @param {string} classe
 * @param {string} eleveId
 * @param {Object} config - Config Firebase Escalade
 * @param {Object} options - { niveau: 'C3' | 'C4' }
 * @returns {Promise<Object>} { [cle]: niveau }
 */
export function calculerNiveauxEscalade(classe, eleveId, config, options = {}) {
    return new Promise((resolve) => {
        const localisation = getLocalisationEscalade(classe, eleveId);
        if (!localisation) {
            console.log(`[Escalade] Élève ${eleveId} non trouvé dans les groupes`);
            resolve({});
            return;
        }

        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const path = `etablissements/0680013V/profs/${profCode}/${classe}/escalade/montees`;

        onValue(ref(db, path), (snap) => {
            const montees = snap.val() || {};
            const mesMontees = Object.values(montees).filter(m =>
                m.groupe === localisation.groupe &&
                String(m.role) === String(localisation.role)
            );
            const result = analyserMontees(mesMontees, options.niveau);
            resolve(result);
        }, { onlyOnce: true });
    });
}

function getLocalisationEscalade(classe, eleveId) {
    const mapping = getLocalMapping(classe) || {};
    for (const [key, value] of Object.entries(mapping)) {
        const codePart = key.replace(`${classe}_`, '');
        if (Array.isArray(value)) {
            const idx = value.indexOf(eleveId);
            if (idx >= 0) return { groupe: codePart, role: idx + 1 };
        }
    }
    return null;
}

function analyserMontees(montees, niveauGrille) {
    const result = {};
    if (montees.length === 0) return result;

    // Tops (hauteur >= 9)
    const tops = montees.filter(m => (m.hauteur || 0) >= 9);
    const maxHauteur = Math.max(...montees.map(m => m.hauteur || 0));

    // ============================================================
    // GRIMPEUR C3
    // 4 : 2 tops ≥ 5a
    // 3 : 2 tops (mixte ou 4a-4c)
    // 2 : hauteur entre 3 et 9m
    // 1 : max hauteur ≤ 3m
    // ============================================================
    const tops5aPlus = tops.filter(m => cotationIdx(m.cotation) >= cotationIdx('5a')).length;
    const topsFacile = tops.filter(m => {
        const idx = cotationIdx(m.cotation);
        return idx >= cotationIdx('4a') && idx <= cotationIdx('4c');
    }).length;

    let niveauC3;
    if (tops5aPlus >= 2) niveauC3 = 4;
    else if (tops5aPlus + topsFacile >= 2) niveauC3 = 3;
    else if (maxHauteur >= 4 && maxHauteur < 9) niveauC3 = 2;
    else if (maxHauteur < 4) niveauC3 = 1;
    else niveauC3 = 2;

    // ============================================================
    // GRIMPEUR C4 (2 voies)
    // 4 : 2 voies ≥ 5c
    // 3 : 2 voies ≥ 5a
    // 2 : 2 voies ≥ 4a
    // 1 : échec
    // ============================================================
    const topsTries = tops.map(m => cotationIdx(m.cotation)).filter(i => i >= 0).sort((a, b) => b - a);

    let niveauC4;
    if (topsTries.length >= 2) {
        const secondeMeilleure = topsTries[1];
        if (secondeMeilleure >= cotationIdx('5c')) niveauC4 = 4;
        else if (secondeMeilleure >= cotationIdx('5a')) niveauC4 = 3;
        else if (secondeMeilleure >= cotationIdx('4a')) niveauC4 = 2;
        else niveauC4 = 1;
    } else if (topsTries.length === 1) {
        // 1 seul top : au mieux niveau 2 (pas assez de voies)
        if (topsTries[0] >= cotationIdx('4a')) niveauC4 = 2;
        else niveauC4 = 1;
    } else {
        niveauC4 = 1;
    }

    // Logs
    console.log(`[Escalade] ${tops.length} tops, tops≥5a: ${tops5aPlus}, tops 4a-4c: ${topsFacile}, maxHauteur: ${maxHauteur}m`);
    console.log(`[Escalade] Niveau C3=${niveauC3}, C4=${niveauC4}, niveau grille=${niveauGrille}`);

    // Retour multi-clés
    result['grimpeur_c3'] = niveauC3;
    result['grimpeur_c4'] = niveauC4;
    result['grimpeur_voies'] = niveauC4;

    // Clé principale selon le niveau de la grille
    if (niveauGrille === 'C4') result['grimpeur'] = niveauC4;
    else result['grimpeur'] = niveauC3;

    return result;
}