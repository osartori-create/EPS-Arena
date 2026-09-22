// src/js/modules/demi-fond/variantes/enchainement/enchainement-core.js
// Sous-module "Enchaînement" : séries de durées variables (ex. 6e : 9 min + 6 min).
// Moteur de calcul pur, sans dépendance UI/Firebase.

import { calculerDistance, calculerVitesse, calculerRegularite } from '../trois-cinq-min/trois-cinq-min-core.js';

export const SOUS_MODULE_ID = 'enchainement';
export const TITRE_AFFICHE = "🏃 Enchaînement (durées libres)";

// ============================================================
// PARAMÈTRES PAR DÉFAUT
// ============================================================
// durees  : durées de chaque course (secondes)
// pause   : repos entre chaque course (secondes) — identique entre toutes les courses
// La 1re valeur est la course 1, la 2e la course 2, etc.
export const DEFAUT_PARAMS = {
    durees: [540, 360],   // 6e : 9 min puis 6 min
    pause: 180,           // 3 min de repos entre les courses
    tour: 200,            // mètres par tour
    plots: 8,             // plots par tour
    antiDoubleClic: 30000,
    // Barème "Coureur (performance)" — vitesses (km/h) par sexe et par niveau 4/3/2/1
    seuilsPerformance: {
        M: { niveau4: 11.5, niveau3: 9, niveau2: 7 },
        F: { niveau4: 10,   niveau3: 7.5, niveau2: 5.5 }
    }
};

// ============================================================
// PLAN DE SÉQUENCE
// ============================================================
/**
 * Transforme la config en un plan linéaire de phases :
 * [{ type: 'course'|'pause', index, debut }]
 * `debut` = instant de début (secondes) depuis le GO.
 */
export function construirePlan(config) {
    const durees = (config.durees || DEFAUT_PARAMS.durees).map(Number);
    const pause = Number(config.pause ?? DEFAUT_PARAMS.pause);
    const plan = [];
    let cursor = 0;

    durees.forEach((duree, i) => {
        plan.push({ type: 'course', index: i + 1, duree, debut: cursor });
        cursor += duree;
        if (i < durees.length - 1) {
            plan.push({ type: 'pause', index: i + 1, duree: pause, debut: cursor });
            cursor += pause;
        }
    });

    return { plan, dureeTotale: cursor, nbCourses: durees.length, durees, pause };
}

/**
 * Retourne la phase en cours pour un temps écoulé (s) depuis le GO,
 * ainsi que le temps restant de la phase courante.
 * @returns {{type, courseNum, restant}}
 */
export function calculerPhaseActive(elapsed, config) {
    const { plan } = construirePlan(config);
    // Dernière phase connue = course ou pause en cours
    let actif = null;
    for (const phase of plan) {
        const fin = phase.debut + phase.duree;
        if (elapsed >= phase.debut && elapsed < fin) {
            actif = phase;
            break;
        }
    }
    if (!actif) {
        // Séquence terminée
        const dernier = plan[plan.length - 1];
        return { type: 'termine', courseNum: dernier ? dernier.index : 1, restant: 0 };
    }
    return { type: actif.type, courseNum: actif.index, restant: actif.debut + actif.duree - elapsed };
}

// ============================================================
// BARÈME "COUREUR (performance)"
// ============================================================
/**
 * Seuils de performance en km/h pour un sexe donné.
 * Renvoie un niveau 1-4 selon la vitesse de la dernière course.
 */
export function evaluerPerformanceRubrique(vitesseDerniereCourse, sexe, seuils) {
    if (vitesseDerniereCourse === null || vitesseDerniereCourse === undefined || !sexe) {
        return { niveau: null, raison: 'Données incomplètes', pourcentage: null };
    }
    const s = (sexe === 'F') ? (seuils?.F || DEFAUT_PARAMS.seuilsPerformance.F)
                              : (seuils?.M || DEFAUT_PARAMS.seuilsPerformance.M);
    const v = vitesseDerniereCourse;

    if (v >= s.niveau4) return { niveau: 4, raison: `≥ ${s.niveau4} km/h (${v.toFixed(1)})`, pourcentage: null };
    if (v >= s.niveau3) return { niveau: 3, raison: `≥ ${s.niveau3} km/h (${v.toFixed(1)})`, pourcentage: null };
    if (v >= s.niveau2) return { niveau: 2, raison: `≥ ${s.niveau2} km/h (${v.toFixed(1)})`, pourcentage: null };
    return { niveau: 1, raison: `< ${s.niveau2} km/h (${v.toFixed(1)})`, pourcentage: null };
}

// ============================================================
// BARÈME "COUREUR (allure)"
// ============================================================
/**
 * Compare les vitesses des courses (par ordre chronologique).
 * Règles (issues de la rubrique) :
 *   4 : allures croissantes entre les séries
 *   3 : allure régulière
 *   2 : baisse des allures dans 1 ou plusieurs séries
 *   1 : arrêt(s) / abandon(s)
 */
export function evaluerAllureRubrique(vitesses, abandons = []) {
    const v = (vitesses || []).filter(x => x !== null && x !== undefined);
    if ((abandons || []).length > 0) {
        return { niveau: 1, raison: 'Arrêt / abandon constaté' };
    }
    if (v.length < 2) {
        return { niveau: 1, raison: 'Campagne incomplète' };
    }

    const premiere = v[0];
    const derniere = v[v.length - 1];
    const delta = derniere - premiere;

    // Tolérance de 0.2 km/h pour qualifier une allure "régulière"
    const epsilon = 0.2;

    // Croissance globale ET aucune régression notable entre deux courses consécutives
    const croissante = delta > epsilon;
    if (croissante) {
        return { niveau: 4, raison: `Allures croissantes (+${delta.toFixed(1)} km/h)` };
    }

    // Régulière : l'écart entre la première et la dernière est faible
    // et aucune chute marquée entre deux courses consécutives.
    let baisse = false;
    for (let i = 1; i < v.length; i++) {
        if (v[i] < v[i - 1] - epsilon) { baisse = true; break; }
    }
    if (!baisse && Math.abs(delta) <= epsilon) {
        return { niveau: 3, raison: 'Allure régulière' };
    }
    if (baisse || delta < -epsilon) {
        return { niveau: 2, raison: `Baisse d'allure (${delta.toFixed(1)} km/h)` };
    }
    return { niveau: 3, raison: 'Allure stable' };
}

// ============================================================
// CALCULS ÉLÈVE (ré-export des helpers communs)
// ============================================================
export { calculerDistance, calculerVitesse, calculerRegularite };