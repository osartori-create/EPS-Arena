// src/js/modules/escalade/escalade-voies-core.js
// Logique métier pure du module « Suivi des réalisations ».
// Aucun accès Firebase : testable directement en console.

import {
    COTATION_INDEX,
    niveauCotation,
    maxCotation,
    BADGES,
    HAUTEUR_MUR
} from './escalade-voies-config.js';

// ============================================================
// AGRÉGATION DES MONTÉES D'UN ÉLÈVE
// ============================================================

/**
 * Calcule les statistiques d'un élève à partir de ses montées.
 * @param {Array<Object>} montees - liste d'objets { cotation, reussie, hauteur, ... }
 * @returns {Object} stats : { total, reussies, echecs, tauxReussite,
 *                            cotationMax, derniereCotation, hauteurMax,
 *                            niveauxAtteints:Set, voiesUniques:Set,
 *                            secteursVisites:Set, badges:Array }
 */
export function calculerStatsEleve(montees) {
    const total = montees.length;
    const reussies = montees.filter(m => m.reussie).length;
    const echecs = total - reussies;

    let cotationMax = null;
    let derniereCotation = null;
    let hauteurMax = 0;
    const niveauxAtteints = new Set();
    const voiesUniques = new Set();
    const secteursVisites = new Set();

    // Le plus récent en dernier pour la progression.
    const triees = [...montees].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    triees.forEach(m => {
        if (m.voieId) voiesUniques.add(m.voieId);
        if (m.secteur) secteursVisites.add(String(m.secteur));

        if (m.cotation) {
            derniereCotation = m.cotation;
            cotationMax = maxCotation(cotationMax, m.cotation);
            // Un niveau n'est « atteint » que si la voie a été réussie.
            if (m.reussie) {
                niveauxAtteints.add(niveauCotation(m.cotation));
            }
        }

        const h = (m.reussie && !m.hauteur) ? HAUTEUR_MUR : (m.hauteur || 0);
        if (h > hauteurMax) hauteurMax = h;
    });

    const tauxReussite = total > 0 ? (reussies / total) * 100 : 0;

    const badges = calculerBadges(total, reussies, niveauxAtteints);

    return {
        total,
        reussies,
        echecs,
        tauxReussite,
        cotationMax,
        derniereCotation,
        hauteurMax,
        niveauxAtteints,
        voiesUniques,
        secteursVisites,
        badges
    };
}

// ============================================================
// CALCUL DES BADGES
// ============================================================

/**
 * Retourne les nouveaux badges à afficher (ceux fraîchement débloqués).
 * Pour le suivi, on retourne simplement la liste complète gagnée.
 */
export function calculerBadges(total, reussies, niveauxAtteints) {
    const gagnes = [];

    BADGES.volume.forEach(b => {
        if (total >= b.seuil) gagnes.push({ type: 'volume', ...b });
    });
    BADGES.reussite.forEach(b => {
        if (reussies >= b.seuil) gagnes.push({ type: 'reussite', ...b });
    });
    BADGES.niveau.forEach(b => {
        if (niveauxAtteints.has(b.niveau)) gagnes.push({ type: 'niveau', ...b });
    });

    return gagnes;
}

/**
 * Compare deux états de badges pour identifier les nouveaux débloqués.
 * (Utilisé côté kiosk pour ne montrer que les nouveautés.)
 */
export function nouveauxBadges(badgesAvant, badgesApres) {
    const idsAvant = new Set(badgesAvant.map(b => b.id));
    return badgesApres.filter(b => !idsAvant.has(b.id));
}

// ============================================================
// PROGRESSION
// ============================================================

/**
 * Retourne l'évolution de la cotation max réussie dans le temps.
 * @returns {Array<{timestamp, cotation, index}>}
 */
export function courbeProgression(montees) {
    const reussies = montees
        .filter(m => m.reussie && m.cotation)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const points = [];
    let maxIndex = -1;
    reussies.forEach(m => {
        const idx = COTATION_INDEX[m.cotation];
        if (idx !== undefined && idx > maxIndex) {
            maxIndex = idx;
            points.push({
                timestamp: m.timestamp,
                cotation: m.cotation,
                index: idx
            });
        }
    });
    return points;
}

// ============================================================
// TRI DES COTATIONS
// ============================================================

/**
 * Compare deux cotations (pour trier des colonnes/valeurs).
 */
export function comparerCotations(a, b) {
    return (COTATION_INDEX[a] || 0) - (COTATION_INDEX[b] || 0);
}

// ============================================================
// TAUX DE RÉUSSITE PAR COTATION (pour le tableau prof)
// ============================================================

/**
 * Agrège les montées par voie : { voieId: { reussies, tentatives, taux } }.
 */
export function agregerParVoie(montees) {
    const map = {};
    montees.forEach(m => {
        const id = m.voieId || m.voie_num || null;
        if (!id) return;
        if (!map[id]) map[id] = { reussies: 0, tentatives: 0 };
        map[id].tentatives++;
        if (m.reussie) map[id].reussies++;
    });
    Object.values(map).forEach(v => {
        v.taux = v.tentatives > 0 ? (v.reussies / v.tentatives) * 100 : 0;
    });
    return map;
}