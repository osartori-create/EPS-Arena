// src/js/modules/ppg/ppg-core.js
// Logique pure PPG : bibliothèque d'ateliers, calcul des points, progression

// ============================================================
// BIBLIOTHÈQUE FIGÉE + EXTENSIBLE
// ============================================================
export const BIBLIOTHEQUE_DEFAUT = [
    {
        id: 'corde',
        label: 'Corde à sauter',
        emoji: '🪢',
        couleur: '#3b82f6',
        type: 'quantitatif',
        unite: 'sauts',
        pointsParUnite: 1
    },
    {
        id: 'pompes',
        label: 'Pompes',
        emoji: '💪',
        couleur: '#ef4444',
        type: 'niveaux',
        unite: 'reps',
        niveaux: [
            { valeur: 1, label: 'N1 — Rambarde (corps à 45°)' },
            { valeur: 2, label: 'N2 — Mains sur banc' },
            { valeur: 3, label: 'N3 — Appuis genoux' },
            { valeur: 4, label: 'N4 — Appuis pieds' }
        ]
    },
    {
        id: 'gainage',
        label: 'Gainage',
        emoji: '🧘',
        couleur: '#eab308',
        type: 'quantitatif',
        unite: 'secondes',
        pointsParUnite: 1
    },
    {
        id: 'burpees',
        label: 'Burpees',
        emoji: '🔥',
        couleur: '#f97316',
        type: 'quantitatif',
        unite: 'reps',
        pointsParUnite: 1
    },
    {
        id: 'squats',
        label: 'Squats',
        emoji: '🦵',
        couleur: '#22c55e',
        type: 'quantitatif',
        unite: 'reps',
        pointsParUnite: 1
    },
    {
        id: 'fentes_bulgares',
        label: 'Fentes bulgares',
        emoji: '🦿',
        couleur: '#a855f7',
        type: 'quantitatif',
        unite: 'reps',
        pointsParUnite: 1
    }
];

// ============================================================
// CALCUL DES POINTS
// ============================================================
/**
 * @param {Object} atelier - Config de l'atelier (depuis la bibliothèque)
 * @param {Object} obs - Observation { best, niveau? }
 * @returns {number} points marqués
 */
export function calculerPoints(atelier, obs) {
    if (!atelier || !obs) return 0;
    const best = Number(obs.best) || 0;
    if (atelier.type === 'niveaux') {
        const niveau = Number(obs.niveau) || 1;
        const facteur = niveau; // N1 → ×1, N2 → ×2, N3 → ×3, N4 → ×4
        return best * facteur * (atelier.pointsParUnite || 1);
    }
    // quantitatif pur
    return best * (atelier.pointsParUnite || 1);
}

// ============================================================
// PROGRESSION
// ============================================================
/**
 * Compare les points d'une séance à ceux d'une séance précédente.
 * @returns {Object} { deltaPts, deltaPct, tendance }
 */
export function calculerProgression(ptsActuel, ptsPrecedent) {
    if (ptsPrecedent === null || ptsPrecedent === undefined || ptsPrecedent === 0) {
        return { deltaPts: null, deltaPct: null, tendance: 'nouveau' };
    }
    const deltaPts = ptsActuel - ptsPrecedent;
    const deltaPct = Math.round((deltaPts / ptsPrecedent) * 100);
    let tendance = 'stable';
    if (deltaPct > 5) tendance = 'hausse';
    else if (deltaPct < -5) tendance = 'baisse';
    return { deltaPts, deltaPct, tendance };
}

// ============================================================
// AGRÉGATION D'UNE SÉANCE
// ============================================================
/**
 * @param {Object} observationsDuJour - { corde:{p1,p2,best}, pompes:{...} }
 * @param {Array} ateliersActifs - Config des ateliers de la séance
 * @returns {Object} { totalPts, parAtelier: { id: { pts, best, niveau } } }
 */
export function agregerSeance(observationsDuJour, ateliersActifs) {
    if (!observationsDuJour) return { totalPts: 0, parAtelier: {} };

    // Supporte 2 formats :
    // 1. { corde: {...}, pompes: {...} }                     ← format "à plat"
    // 2. { code, timestamp, perfs: { corde: {...}, ... } }   ← format kiosk
    const source = observationsDuJour.perfs || observationsDuJour;

    const parAtelier = {};
    let totalPts = 0;
    ateliersActifs.forEach(atelier => {
        const obs = source[atelier.id];
        if (!obs) return;
        const pts = calculerPoints(atelier, obs);
        parAtelier[atelier.id] = {
            best: obs.best || 0,
            niveau: obs.niveau || null,
            pts,
            unite: atelier.unite,
            label: atelier.label,
            emoji: atelier.emoji,
            couleur: atelier.couleur
        };
        totalPts += pts;
    });
    return { totalPts, parAtelier };
}

// ============================================================
// TRI DU CLASSEMENT
// ============================================================
/**
 * @param {Object} totauxParCode - { code: { totalPts, parAtelier } }
 * @param {Object} elevesMap - { code: { nom, prenom, ... } }
 * @param {string|null} atelierFiltre - Si défini, trie sur cet atelier uniquement
 * @returns {Array} [{ code, eleve, totalPts, parAtelier, rang }]
 */
export function trierClassement(totauxParCode, elevesMap = {}, atelierFiltre = null) {
    const arr = Object.entries(totauxParCode).map(([code, data]) => {
        const pts = atelierFiltre
            ? (data.parAtelier?.[atelierFiltre]?.pts || 0)
            : data.totalPts;
        return {
            code: String(code),
            eleve: elevesMap[String(code)] || null,
            totalPts: pts,
            totalPtsGlobal: data.totalPts,
            parAtelier: data.parAtelier || {}
        };
    });

    arr.sort((a, b) => {
        if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
        const nomA = a.eleve ? `${a.eleve.nom} ${a.eleve.prenom}` : '';
        const nomB = b.eleve ? `${b.eleve.nom} ${b.eleve.prenom}` : '';
        return nomA.localeCompare(nomB);
    });

    arr.forEach((item, idx) => { item.rang = idx + 1; });
    return arr;
}

// ============================================================
// UTILITAIRES
// ============================================================
export function getMedaille(rang) {
    if (rang === 1) return '🥇';
    if (rang === 2) return '🥈';
    if (rang === 3) return '🥉';
    return `${rang}.`;
}

export function getAtelierById(id, bibliotheque = BIBLIOTHEQUE_DEFAUT) {
    return bibliotheque.find(a => a.id === id) || null;
}

/**
 * Fusionne la bibliothèque par défaut avec une bibliothèque sauvegardée en config.
 * La config prof peut contenir des ateliers ajoutés manuellement (bouton +).
 */
export function fusionnerBibliotheque(bibliothequeSauvee) {
    if (!Array.isArray(bibliothequeSauvee) || bibliothequeSauvee.length === 0) {
        return [...BIBLIOTHEQUE_DEFAUT];
    }
    const idsVus = new Set(bibliothequeSauvee.map(a => a.id));
    const manquants = BIBLIOTHEQUE_DEFAUT.filter(a => !idsVus.has(a.id));
    return [...bibliothequeSauvee, ...manquants];
}