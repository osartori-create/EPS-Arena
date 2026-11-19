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

// Depuis V1.1 : un seul scoreur d'erreurs au kiosk -> un seul compteur (0..9).
export function nbErreursSaisie(saisie) {
    return Math.max(0, Math.min(9, parseInt(saisie.erreurs, 10) || 0));
}

/**
 * Compose le « score parlant » d'une épreuve à partir de la saisie.
 * @param {Object} saisie - { degaines, erreurs, cotationChiffre, cotationLettre }
 * @param {Object} epreuve - { type, ... }
 * @returns {number}
 */
export function composerScoreParlant(saisie, epreuve) {
    const degaines = parseInt(saisie.degaines, 10) || 0;
    const erreurs = nbErreursSaisie(saisie);
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
// Cible « je cherche X » d'une épreuve : le score parlant à atteindre.
export function cibleEpreuve(epreuve, nbDegainesMax) {
    const sommet = epreuve.exigeSommet === false ? (epreuve.cibleDegaines || 0) : nbDegainesMax;
    const scoreErreurCible = 9 - (epreuve.erreursMax ?? 0);
    const cot = (epreuve.cotationChiffre || 0) * 10 + valeurLettre(epreuve.cotationLettre);

    switch (epreuve.type) {
        case 'degaines':
        case 'degaines-moyenne':
            return sommet;
        case 'degaines-erreurs':
            return sommet * 10 + scoreErreurCible;
        case 'degaines-cotation':
            return sommet * 100 + cot;
        case 'degaines-cotation-erreurs':
            return sommet * 1000 + cot * 10 + scoreErreurCible;
        default:
            return sommet;
    }
}

export function evaluerEpreuve(saisie, epreuve, nbDegainesMax, cumul) {
    // Épreuve « régularité » : moyenne des dégaines sur toutes les ascensions.
    if (epreuve.type === 'degaines-moyenne') {
        const totalDegaines = cumul?.totalDegaines ?? 0;
        const nbAscents = cumul?.nbAscents ?? 0;
        const moyenne = nbAscents > 0 ? totalDegaines / nbAscents : 0;
        const arrondi = Math.round(moyenne * 10) / 10;
        return { valide: arrondi >= cibleEpreuve(epreuve, nbDegainesMax), scoreParlant: arrondi };
    }

    const scoreParlant = composerScoreParlant(saisie, epreuve);
    return { valide: scoreParlant >= cibleEpreuve(epreuve, nbDegainesMax), scoreParlant };
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
export function evaluerContrat(saisie, contrat, nbDegainesMax, cumul) {
    if (contrat.mode === 'grimpeur') {
        const epreuves = (contrat.epreuves || []).map(ep => evaluerEpreuve(saisie, ep, nbDegainesMax, cumul));
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
