// src/js/modules/escalade/escalade-contrats-core.js
// Logique métier pure du module « Contrats » escalade.
// - Score parlant : nombre composé de chiffres juxtaposés
//   (ex. 59 = 5 dégaines + 0 erreur ; 551 = 5 dégaines + cotation 5a).
// - Validation d'un contrat à partir de la saisie.
// Aucun accès Firebase : testable directement en console.

import { COTATION_LETTRES } from './escalade-contrats-config.js';

export function valeurLettre(lettre) {
    return COTATION_LETTRES[lettre] || 0;
}

// Score erreur = 9 - nb erreurs (0 erreur -> 9, 1 -> 8, ..., 9 -> 0).
export function scoreErreur(nbErreurs) {
    const n = Math.max(0, Math.min(9, parseInt(nbErreurs, 10) || 0));
    return 9 - n;
}

// Nombre d'erreurs retenu pour une épreuve :
// - 'toutes' (ou vide) -> somme de tous les types ;
// - sinon -> le compteur du type demandé.
export function nbErreursSaisie(saisie, erreurType) {
    const map = saisie.erreurs || {};
    if (!erreurType || erreurType === 'toutes') {
        return Object.values(map).reduce((acc, v) => acc + (parseInt(v, 10) || 0), 0);
    }
    return parseInt(map[erreurType], 10) || 0;
}

/**
 * Compose le « score parlant » d'une épreuve à partir de la saisie.
 * @param {Object} saisie - { degaines, erreurs: {typeId: nb}, cotationChiffre, cotationLettre }
 * @param {Object} epreuve - { type, erreurType, ... }
 * @returns {number}
 */
export function composerScoreParlant(saisie, epreuve) {
    const degaines = parseInt(saisie.degaines, 10) || 0;
    const erreurs = nbErreursSaisie(saisie, epreuve.erreurType);
    const cotChiffre = parseInt(saisie.cotationChiffre, 10) || 0;
    const cotLettre = valeurLettre(saisie.cotationLettre);

    switch (epreuve.type) {
        case 'degaines':
            return degaines;
        case 'degaines-erreurs':
            return degaines * 10 + scoreErreur(erreurs);
        case 'degaines-cotation':
            return degaines * 100 + cotChiffre * 10 + cotLettre;
        case 'degaines-cotation-erreurs':
            return degaines * 1000 + cotChiffre * 100 + cotLettre * 10 + scoreErreur(erreurs);
        default:
            return degaines;
    }
}

/**
 * Évalue une épreuve d'un contrat grimpeur.
 * @returns {{ valide: boolean, scoreParlant: number }}
 */
export function evaluerEpreuve(saisie, epreuve, nbDegainesMax) {
    const scoreParlant = composerScoreParlant(saisie, epreuve);
    const degaines = parseInt(saisie.degaines, 10) || 0;
    const cible = epreuve.exigeSommet === false ? (epreuve.cibleDegaines || 0) : nbDegainesMax;
    if (degaines < cible) return { valide: false, scoreParlant };

    if (epreuve.type.includes('erreurs')) {
        const nb = nbErreursSaisie(saisie, epreuve.erreurType);
        if (nb > (epreuve.erreursMax ?? 0)) return { valide: false, scoreParlant };
    }

    if (epreuve.type.includes('cotation')) {
        const cot = (parseInt(saisie.cotationChiffre, 10) || 0) * 10 + valeurLettre(saisie.cotationLettre);
        const cibleCot = (epreuve.cotationChiffre || 0) * 10 + valeurLettre(epreuve.cotationLettre);
        if (cot < cibleCot) return { valide: false, scoreParlant };
    }

    return { valide: true, scoreParlant };
}

/**
 * Score total d'une évaluation « échelle » (somme des notes 1-3).
 */
export function scoreEchelle(notes, contrat) {
    return (contrat.competences || []).reduce((acc, c) => acc + (notes[c.id] || 0), 0);
}

/**
 * Valide une saisie « échelle » (notes 1-3 par compétence) contre un contrat.
 */
export function validerContratEchelle(notes, contrat) {
    return scoreEchelle(notes, contrat) >= (contrat.seuil || 0);
}

/**
 * Valide un contrat quel que soit son mode.
 * @returns {{ valide: boolean, score: number, scoreParlant: number|null }}
 */
export function evaluerContrat(saisie, contrat, nbDegainesMax) {
    if (contrat.mode === 'grimpeur') {
        const epreuves = (contrat.epreuves || []).map(ep => evaluerEpreuve(saisie, ep, nbDegainesMax));
        const scoreParlant = epreuves.length ? epreuves[0].scoreParlant : null;
        return {
            valide: epreuves.length > 0 && epreuves.every(e => e.valide),
            score: scoreParlant,
            scoreParlant,
            epreuves
        };
    }

    const score = scoreEchelle(saisie.notes || {}, contrat);
    return {
        valide: validerContratEchelle(saisie.notes || {}, contrat),
        score,
        scoreParlant: null
    };
}
