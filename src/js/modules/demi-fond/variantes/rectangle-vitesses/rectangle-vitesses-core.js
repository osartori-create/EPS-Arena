// src/js/modules/demi-fond/variantes/rectangle-vitesses/rectangle-vitesses-core.js
// Logique pure du sous-module "Rectangle des vitesses".
// Dispositif : rectangle, 1 plot tous les 5 m, séquences de 18 s.
// Règle : 1 plot franchi en 18 s = 1 km/h.

export const SOUS_MODULE_ID = 'rectangle-vitesses';
export const TITRE_AFFICHE = 'Rectangle des vitesses';

// Durée d'une séquence de course en secondes (fixe, imposée par le dispositif).
export const DUREE_SEQUENCE = 18;

export const SOUS_ACTIVITES = {
    regulier: {
        id: 'regulier',
        label: 'Régulier sur 3 minutes',
        icone: '🎯',
        dureeTotaleSec: 180 // 10 × 18 s
    },
    echauffement: {
        id: 'echauffement',
        label: 'Fiche d’échauffement (A → Z)',
        icone: '🔥'
    }
};

// ============================================================
// BIBLIOTHÈQUE D'EXERCICES (extensible)
// ============================================================
// Chaque exercice a un identifiant stable et un libellé lisible.
// Le professeur peut ajouter de nouveaux exercices via l'interface.
export const EXERCICES_DISPONIBLES = [
    { id: 'course', label: 'Course' },
    { id: 'repos', label: 'Repos' },
    { id: 'montee_genoux', label: 'Montée de genoux' },
    { id: 'talons_fesses', label: 'Talons-fesses' },
    { id: 'pas_chasses', label: 'Pas chassés' },
    { id: 'pas_croises', label: 'Pas croisés' },
    { id: 'griffe', label: 'Griffé' },
    { id: 'course_arriere', label: 'Course en arrière' },
    { id: 'jambes_tendues', label: 'Jambes tendues' },
    { id: 'action_bras', label: 'Action des bras' }
];

// ============================================================
// FICHE D'ÉCHAUFFEMENT PAR DÉFAUT (A → Z)
// ============================================================
// Reprend l'annexe du PDF. Chaque lettre = une séquence de 18 s.
// `exercice` : identifiant de EXERCICES_DISPONIBLES ('' = ligne vide / ignorée).
// `vitesse`  : vitesse de déplacement en km/h (0 = pas de déplacement).
export function creerSequenceDefaut() {
    const L = (lettre, exercice, vitesse) => ({ lettre, exercice, vitesse });
    return [
        L('A', 'course', 8),
        L('B', 'repos', 3),
        L('C', 'course', 8),
        L('D', 'course', 8),
        L('E', 'repos', 3),
        L('F', 'montee_genoux', 8),
        L('G', 'repos', 3),
        L('H', 'talons_fesses', 8),
        L('I', 'repos', 3),
        L('J', 'jambes_tendues', 8),
        L('K', 'repos', 3),
        L('L', 'action_bras', 8),
        L('M', 'repos', 3),
        L('N', 'course', 10),
        L('O', 'course', 10),
        L('P', 'course', 10),
        L('Q', 'repos', 3),
        L('R', 'course', 12),
        L('S', 'course', 12),
        L('T', 'course', 12),
        L('U', 'course', 12),
        L('V', 'repos', 3),
        L('W', 'course', 14),
        L('X', 'course', 14),
        L('Y', 'repos', 3),
        L('Z', 'course', 16)
    ];
}

// ============================================================
// PARAMÈTRES PAR DÉFAUT
// ============================================================
export const DEFAUT_PARAMS = {
    dureeSequence: DUREE_SEQUENCE, // 18 s (non modifiable, principe du dispositif)
    nbSequences: 10,               // pour "Régulier sur 3 minutes" (180 s / 18 s)
    annonceParole: true,           // voix synthétique activée
    preavisSec: 4                  // la voix annonce le suivant pendant la séquence, X s avant le bip
};

// ============================================================
// VALIDATION / REGROUPEMENT
// ============================================================
export function estExerciseActif(item) {
    return !!item && !!item.exercice && item.exercice !== '';
}

export function nettoyerSequence(sequence) {
    return (Array.isArray(sequence) ? sequence : []).map(item => ({
        lettre: item?.lettre || '',
        exercice: item?.exercice || '',
        vitesse: Number(item?.vitesse) || 0
    }));
}

export function sequenceActive(sequence) {
    return nettoyerSequence(sequence).filter(estExerciseActif);
}

// ============================================================
// PHRASES VOCALES
// ============================================================
export function libelleExercice(exerciceId, exercices = EXERCICES_DISPONIBLES) {
    const ex = exercices.find(e => e.id === exerciceId);
    return ex ? ex.label : exerciceId;
}

export function phraseExercice(item, exercices = EXERCICES_DISPONIBLES) {
    if (!estExerciseActif(item)) return 'Repos';
    const label = libelleExercice(item.exercice, exercices);
    if (item.exercice === 'repos') return 'Repos';
    const v = Math.round(item.vitesse);
    return `${label}, ${v} kilomètres heure`;
}

export function phraseSequence(sequence, exercices = EXERCICES_DISPONIBLES) {
    const actifs = sequenceActive(sequence);
    return actifs.map(item => phraseExercice(item, exercices)).join('. ');
}

// ============================================================
// CALCUL DU BILAN "RÉGULIER"
// ============================================================
// nbPlots : nombre de plots franchis pendant la séquence de 18 s.
// 1 plot = 5 m -> vitesse(km/h) = nbPlots.
export function plotsVersVitesse(nbPlots) {
    const n = Number(nbPlots);
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n * 10) / 10;
}