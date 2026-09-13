// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-core.js
// Calculs spécifiques au sous-module 3x5min R=3'

export const SOUS_MODULE_ID = '3x5min';
export const TITRE_AFFICHE = "3×5min R=3'";

// ============================================================
// PARAMÈTRES PAR DÉFAUT
// ============================================================
export const DEFAUT_PARAMS = {
    duree: 300,            // 5min par course
    pause: 180,            // 3min entre chaque
    nbCourses: 3,
    tour: 200,             // 200m par tour
    plots: 8,              // 8 plots par tour
    antiDoubleClic: 30000, // 30s
    cibleVMA: 0.90,        // 90% VMA pour l'allure cible
    seuilLente: 7,         // km/h en dessous duquel on considère "anormalement lent"
    seuilProgression: 0.5  // km/h pour détecter progression/régression
};

// ============================================================
// CALCULS DE COURSE
// ============================================================
/**
 * Calcule la distance parcourue à partir des timestamps et du partiel.
 * @param {Array} timestamps - [t1, t2, ...] (un par tour)
 * @param {number} partiel - plots supplémentaires dans le dernier tour (0-8)
 * @param {number} tour - distance d'un tour (200m)
 * @param {number} plots - plots par tour (8)
 */
export function calculerDistance(timestamps, partiel, tour = 200, plots = 8) {
    const nbTours = (timestamps || []).length;
    const distanceParPlot = tour / plots;
    return nbTours * tour + (partiel || 0) * distanceParPlot;
}

/**
 * Calcule la vitesse moyenne d'une course.
 */
export function calculerVitesse(distanceM, dureeSec) {
    if (!distanceM || !dureeSec || dureeSec <= 0) return 0;
    const vitesseMs = distanceM / dureeSec;
    return Math.round(vitesseMs * 3.6 * 10) / 10; // km/h arrondi 0.1
}

/**
 * Calcule la régularité (écart-type des temps de tour).
 */
export function calculerRegularite(timestamps) {
    if (!timestamps || timestamps.length < 2) return null;
    const temps = [];
    for (let i = 1; i < timestamps.length; i++) {
        temps.push((timestamps[i] - timestamps[i - 1]) / 1000); // en secondes
    }
    const moy = temps.reduce((a, b) => a + b, 0) / temps.length;
    const variance = temps.reduce((a, t) => a + Math.pow(t - moy, 2), 0) / temps.length;
    const ecartType = Math.sqrt(variance);
    const cv = moy > 0 ? (ecartType / moy) * 100 : 0; // coefficient de variation en %
    return {
        tempsMoyen: Math.round(moy * 10) / 10,
        ecartType: Math.round(ecartType * 10) / 10,
        cv: Math.round(cv * 10) / 10
    };
}

// ============================================================
// ÉVALUATION ALLURE
// ============================================================
/**
 * Évalue le critère "Allure" à partir des vitesses des 3 courses.
 * Règles :
 *   Niveau 4 : V3 - V1 >= +0.5 km/h
 *   Niveau 3 : |V3 - V1| < 0.5 ET |V2 - V1| < 0.5
 *   Niveau 2 : V3 - V1 <= -0.5 km/h
 *   Niveau 1 : abandon ou V1/V2 < seuil
 */
export function evaluerAllure(vitesses, abandons = [], seuilLente = 7, seuil = 0.5) {
    // Abandon → niveau 1
    if (abandons.length > 0) return { niveau: 1, raison: 'Abandon enregistré' };

    const v1 = vitesses[0];
    const v2 = vitesses[1];
    const v3 = vitesses[2];

    if (v1 === null || v1 === undefined) return { niveau: 1, raison: 'Course 1 non terminée' };
    if (v2 === null || v2 === undefined) return { niveau: 1, raison: 'Course 2 non terminée' };
    if (v3 === null || v3 === undefined) return { niveau: 1, raison: 'Course 3 non terminée' };

    // Vitesse anormalement lente
    if (v1 < seuilLente || v2 < seuilLente) {
        return { niveau: 1, raison: `Vitesse < ${seuilLente} km/h` };
    }

    const deltaV3V1 = v3 - v1;
    const deltaV2V1 = v2 - v1;

    if (deltaV3V1 >= seuil) {
        return { niveau: 4, raison: `Progression globale (+${deltaV3V1.toFixed(1)} km/h)` };
    }
    if (Math.abs(deltaV3V1) < seuil && Math.abs(deltaV2V1) < seuil) {
        return { niveau: 3, raison: 'Allure stable sur les 3 courses' };
    }
    if (deltaV3V1 <= -seuil) {
        return { niveau: 2, raison: `Régression globale (${deltaV3V1.toFixed(1)} km/h)` };
    }
    // Cas intermédiaire : on prend la tendance
    if (deltaV3V1 > 0) {
        return { niveau: 4, raison: 'Tendance à la progression' };
    }
    return { niveau: 2, raison: 'Tendance à la régression' };
}

// ============================================================
// ÉVALUATION PERFORMANCE (basée sur % VMA course 3)
// ============================================================
/**
 * Niveau 4 : >= 90% VMA
 * Niveau 3 : 85-89%
 * Niveau 2 : 75-84%
 * Niveau 1 : < 75% ou arrêt
 */
export function evaluerPerformance(vitesseCourse3, vma) {
    if (!vma || vma <= 0) return { niveau: null, pourcentage: null, raison: 'VMA inconnue' };
    if (vitesseCourse3 === null || vitesseCourse3 === undefined) {
        return { niveau: 1, pourcentage: 0, raison: 'Course 3 non terminée' };
    }
    const pourcentage = (vitesseCourse3 / vma) * 100;

    if (pourcentage >= 90) return { niveau: 4, pourcentage, raison: `≥ 90% VMA (${pourcentage.toFixed(0)}%)` };
    if (pourcentage >= 85) return { niveau: 3, pourcentage, raison: `85-89% VMA (${pourcentage.toFixed(0)}%)` };
    if (pourcentage >= 75) return { niveau: 2, pourcentage, raison: `75-84% VMA (${pourcentage.toFixed(0)}%)` };
    return { niveau: 1, pourcentage, raison: `< 75% VMA (${pourcentage.toFixed(0)}%)` };
}

// ============================================================
// GÉNÉRATION DE GROUPE AUTO
// ============================================================
/**
 * Répartit les élèves en N groupes (max 4) de façon équilibrée.
 * @param {Array} eleves - Liste des élèves
 * @param {number} nbGroupes - 1 à 4
 * @returns {Object} { BLEU: [ids], ROUGE: [ids], VERT: [ids], JAUNE: [ids] }
 */
export function repartirEnGroupes(eleves, nbGroupes) {
    nbGroupes = Math.max(1, Math.min(4, nbGroupes));
    // ✅ CORRECTION : 'VERT' au lieu de 'NOIR'
    const couleurIds = ['BLEU', 'ROUGE', 'VERT', 'JAUNE'];

    // Mélanger
    const melanges = [...eleves].sort(() => Math.random() - 0.5);

    const groupes = {};
    couleurIds.forEach(id => { groupes[id] = []; });

    melanges.forEach((eleve, i) => {
        const groupeIdx = i % nbGroupes;
        groupes[couleurIds[groupeIdx]].push(eleve.id);
    });

    return groupes;
}