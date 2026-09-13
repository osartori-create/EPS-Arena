// src/js/modules/grilles/connecteurs/demi-fond.js
// Connecteur : remplit automatiquement les critères auto de la grille 1/2 Fond
// - Allure : comparaison des vitesses moyennes C1/C2/C3
// - Performance : seuils fixes par sexe sur la vitesse Course 3
// - Régularité : coefficient de variation des temps de tour

import { db, ref, onValue } from '../../../core/firebase-service.js';
import { getLocalMapping } from '../../../core/live-engine.js';
import { getExistingEleves } from '../../../services/admin-service.js';

/**
 * Calcule les niveaux auto pour un élève en 1/2 Fond.
 * @param {string} classe
 * @param {string} eleveId
 * @param {Object} config - Config Firebase du module demi-fond
 * @param {Object} options - { niveau } (C3, 3e...)
 * @returns {Promise<Object>} { allure, performance, regularite, + alias }
 */
export function calculerNiveauxDemiFond(classe, eleveId, config) {
    return new Promise((resolve) => {
        if (!config || !config.groupes) {
            resolve({});
            return;
        }

        // Trouver le codeAutoEval de l'élève
        const eleves = getExistingEleves(classe);
        const eleve = eleves.find(e => e.id === eleveId);
        if (!eleve || !eleve.codeAutoEval) {
            console.log(`[DemiFond] Élève ${eleveId} sans codeAutoEval`);
            resolve({});
            return;
        }
        const code = String(eleve.codeAutoEval);
        const sexe = eleve.sexe || '';

        // Lire les observations
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/demi-fond/observations`;

        let cours = { 1: null, 2: null, 3: null };
        let loaded = 0;

                function check() {
            if (loaded < 3) return;
            const result = analyser(cours, config, sexe, code);
            resolve(result);
        }

        for (let i = 1; i <= 3; i++) {
            onValue(ref(db, `${basePath}/course-${i}/${code}`), (snap) => {
                cours[i] = snap.val() || null;
                loaded++;
                check();
            }, { onlyOnce: true });
        }
    });
}

// ============================================================
// ANALYSE
// ============================================================
function analyser(cours, config, sexe, code) {
    const result = {};
    const duree = config.duree || 300;
    const tour = config.tour || 200;
    const plots = config.plots || 8;

    // Calculs par course
    const infos = {};
    for (let i = 1; i <= 3; i++) {
        const obs = cours[i];
        if (!obs) {
            infos[i] = null;
            continue;
        }

        const timestamps = obs.timestamps || [];
        const partiel = obs.partiel || 0;
        const abandon = obs.abandon || null;

        const distance = calculerDistance(timestamps, partiel, tour, plots);
        const vitesse = abandon ? 0 : calculerVitesse(distance, duree);
        const cv = calculerCV(timestamps);

        infos[i] = { distance, vitesse, cv, abandon, nbTours: timestamps.length };
    }

    // ============================================================
    // CRITÈRE 1 : ALLURE (comparaison V3 vs V1)
    // ============================================================
    const vitesses = [infos[1]?.vitesse, infos[2]?.vitesse, infos[3]?.vitesse];
    const abandons = [infos[1]?.abandon, infos[2]?.abandon, infos[3]?.abandon].filter(Boolean);

    const niveauAllure = evalAllure(vitesses, abandons);
    result['allure'] = niveauAllure;
    result['coureur_allure'] = niveauAllure;

    // ============================================================
    // CRITÈRE 2 : PERFORMANCE (vitesse C3 + seuils fixes par sexe)
    // ============================================================
    if (infos[3] && !infos[3].abandon) {
        result['performance'] = evalPerformance(infos[3].vitesse, sexe);
    } else {
        result['performance'] = 1;
    }
    result['coureur_performance'] = result['performance'];
    result['coureur_sa_performance'] = result['performance'];

    // ============================================================
    // CRITÈRE 3 : RÉGULARITÉ (CV moyen des 3 courses)
    // ============================================================
    const cvs = [infos[1]?.cv, infos[2]?.cv, infos[3]?.cv].filter(v => v !== null && v !== undefined);
    if (cvs.length > 0) {
        const cvMoyen = cvs.reduce((a, b) => a + b, 0) / cvs.length;
        result['regularite'] = evalRegularite(cvMoyen);
        result['régularité'] = result['regularite'];
    } else {
        result['regularite'] = 1;
        result['régularité'] = 1;
    }
    result['coureur_regularite'] = result['regularite'];

    console.log(`[DemiFond] Code ${code || '?'} | Vitesses: ${vitesses.map(v => v?.toFixed(1)).join(' / ')} | CV moyen: ${cvs.length ? (cvs.reduce((a, b) => a + b, 0) / cvs.length).toFixed(1) : '?'} | Niveaux: Allure=${result.allure} Perf=${result.performance} Rég=${result.regularite}`);

    return result;
}

// ============================================================
// CALCULS
// ============================================================
function calculerDistance(timestamps, partiel, tour, plots) {
    const nbTours = (timestamps || []).length;
    const distanceParPlot = tour / plots;
    return nbTours * tour + (partiel || 0) * distanceParPlot;
}

function calculerVitesse(distanceM, dureeSec) {
    if (!distanceM || !dureeSec || dureeSec <= 0) return 0;
    return Math.round((distanceM / dureeSec) * 3.6 * 10) / 10;
}

function calculerCV(timestamps) {
    if (!timestamps || timestamps.length < 2) return null;
    const temps = [];
    for (let i = 1; i < timestamps.length; i++) {
        temps.push((timestamps[i] - timestamps[i - 1]) / 1000);
    }
    const moy = temps.reduce((a, b) => a + b, 0) / temps.length;
    if (moy <= 0) return null;
    const variance = temps.reduce((a, t) => a + Math.pow(t - moy, 2), 0) / temps.length;
    const ecartType = Math.sqrt(variance);
    return (ecartType / moy) * 100;
}

// ============================================================
// ÉVALUATIONS
// ============================================================
function evalAllure(vitesses, abandons) {
    if (abandons.length > 0) return 1;
    if (!vitesses[0] || !vitesses[1] || !vitesses[2]) return 1;

    const v1 = vitesses[0], v2 = vitesses[1], v3 = vitesses[2];

    // Seuil "vitesse faible" → niveau 1
    if (v1 < 7 || v2 < 7) return 1;

    const deltaV3V1 = v3 - v1;
    const deltaV2V1 = v2 - v1;

    // Niveau 4 : progression globale (V3 - V1 >= +0.5)
    if (deltaV3V1 >= 0.5) return 4;

    // Niveau 3 : stable (|V3-V1| < 0.5 ET |V2-V1| < 0.5)
    if (Math.abs(deltaV3V1) < 0.5 && Math.abs(deltaV2V1) < 0.5) return 3;

    // Niveau 2 : régression globale (V3 - V1 <= -0.5)
    if (deltaV3V1 <= -0.5) return 2;

    // Cas intermédiaires
    return deltaV3V1 > 0 ? 4 : 2;
}

function evalPerformance(vitesseC3, sexe) {
    if (!vitesseC3) return 1;
    const seuilsF = { 4: 12, 3: 9.5, 2: 7.5 };
    const seuilsM = { 4: 13.5, 3: 11, 2: 9 };
    const s = seuilsF ? (sexe === 'M' ? seuilsM : seuilsF) : seuilsM;

    if (vitesseC3 >= s[4]) return 4;
    if (vitesseC3 >= s[3]) return 3;
    if (vitesseC3 >= s[2]) return 2;
    return 1;
}

function evalRegularite(cvMoyen) {
    if (cvMoyen === null || cvMoyen === undefined) return 1;
    if (cvMoyen < 5) return 4;
    if (cvMoyen < 10) return 3;
    if (cvMoyen < 15) return 2;
    return 1;
}