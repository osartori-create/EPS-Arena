// src/js/modules/relais/relais-core.js
// Logique métier commune au module Relais (2 sous-activités : relais10s, relais2zones)
// ⚠️ RGPD : les "membres" ne contiennent JAMAIS de nom/prénom/id.

export const ZONE_MIN = 15;
export const ZONE_MAX = 28;
export const NB_PLOTS = ZONE_MAX - ZONE_MIN + 1;

// Distances par défaut pour la sous-activité 2 zones
export const DISTANCES_2ZONES_DEFAUT = { z1: 20, trans: 10, z2: 20 };

// ============================================================
// GRILLE DE CONVERSION % → POINTS (2 zones)
// ============================================================
export const PALIERS_TRANSMISSION = [
    { min: 100, points: 5, couleur: '#22c55e', label: '🚀 Parfait' },
    { min: 90,  points: 4, couleur: '#84cc16', label: '🌟 Très bien' },
    { min: 80,  points: 3, couleur: '#eab308', label: '✅ Bien' },
    { min: 70,  points: 2, couleur: '#f97316', label: '👍 Moyen' },
    { min: 60,  points: 1, couleur: '#f43f5e', label: '📈 À améliorer' },
    { min: 0,   points: 0, couleur: '#ef4444', label: '⚠️ Faible' }
];

export function getPalierTransmission(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return PALIERS_TRANSMISSION[PALIERS_TRANSMISSION.length - 1];
    for (const p of PALIERS_TRANSMISSION) {
        if (pct >= p.min) return p;
    }
    return PALIERS_TRANSMISSION[PALIERS_TRANSMISSION.length - 1];
}

export function calculerPointsTransmission(pct) {
    return getPalierTransmission(pct).points;
}

export function getScoreCouleurTransmission(pct) {
    return getPalierTransmission(pct).couleur;
}

export function getLabelTransmission(pct) {
    return getPalierTransmission(pct).label;
}

// ============================================================
// CONVERSIONS VITESSE / ZONE (sous-activité relais10s)
// ============================================================
export function zoneToVitesse(zone) {
    if (!zone) return null;
    // Auto-détection : c'est déjà une vitesse (>= 15)
    if (zone >= ZONE_MIN) return zone;
    if (zone < 1 || zone > NB_PLOTS) return null;
    return ZONE_MIN + (zone - 1);
}

export function vitesseToZone(vitesse) {
    return Math.round(vitesse) - ZONE_MIN + 1;
}

export function formatVitesse(zone) {
    const v = zoneToVitesse(zone);
    return v !== null ? `${v} km/h` : '--';
}

// ============================================================
// CALCULS 10S
// ============================================================
export function calculerVTheorique(vArret, vLance) {
    if (vArret === null || vLance === null) return null;
    return (vArret + vLance) / 2;
}

export function calculerScore(vReelle, vTheorique) {
    if (vReelle === null || vTheorique === null) return null;
    return Math.round((5 + (vReelle - vTheorique)) * 10) / 10;
}

export function getScoreCouleur(score) {
    if (score === null) return '#64748b';
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#84cc16';
    if (score >= 4.5) return '#eab308';
    if (score >= 3) return '#f97316';
    return '#ef4444';
}

export function getScoreLabel(score) {
    if (score === null) return '--';
    if (score >= 8) return '🚀 Excellent';
    if (score >= 6) return '🌟 Très bien';
    if (score >= 4.5) return '✅ Bien';
    if (score >= 3) return '👍 Moyen';
    return '📈 À améliorer';
}

// ============================================================
// CALCULS 2 ZONES
// ============================================================
/**
 * @param {number} vZ1 - vitesse zone 1 (km/h)
 * @param {number} vTrans - vitesse transmission (km/h)
 * @param {number} vZ2 - vitesse zone 2 (km/h)
 * @returns {number|null} pourcentage de transmission
 */
export function calculerPourcentageTransmission(vZ1, vTrans, vZ2) {
    if (vZ1 === null || vTrans === null || vZ2 === null) return null;
    const moyenne = (vZ1 + vZ2) / 2;
    if (moyenne <= 0) return null;
    return Math.round((vTrans / moyenne) * 100);
}

// ============================================================
// PAIRES D'UN GROUPE
// ============================================================
export function getLettre(index) {
    return String.fromCharCode(97 + index);
}

export function getPairesGroupe(membres) {
    const paires = [];
    for (let i = 0; i < membres.length; i++) {
        for (let j = 0; j < membres.length; j++) {
            if (i !== j) {
                const relaye = membres[i];
                const relayeur = membres[j];
                paires.push({
                    relayeIdx: i,
                    relayeurIdx: j,
                    pairId: `${relaye.lettre}-${relayeur.lettre}`,
                    label: `${relaye.lettre} → ${relayeur.lettre}`,
                    relaye,
                    relayeur
                });
            }
        }
    }
    return paires;
}

// ============================================================
// ANALYSE
// ============================================================
function moy(arr) {
    if (arr.length === 0) return 0;
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

/**
 * Retourne le meilleur essai par paire.
 * @param {Array} mesures - [{ pairId, score, ... }] où score = points (nombre)
 */
export function getMeilleurEssaiParPaire(mesures) {
    const meilleur = {};
    mesures.forEach(m => {
        if (m.score === null || m.score === undefined) return;
        if (!meilleur[m.pairId] || m.score > meilleur[m.pairId].score) {
            meilleur[m.pairId] = m;
        }
    });
    return meilleur;
}

export function calculerEfficaciteIndividuelle(mesures, membres) {
    const efficacite = {};
    membres.forEach(m => {
        efficacite[m.lettre] = {
            membre: m,
            scoresCommeRelaye: [],
            scoresCommeRelayeur: [],
            moyenneCommeRelaye: null,
            moyenneCommeRelayeur: null,
            moyenneGlobale: null
        };
    });

    const meilleur = getMeilleurEssaiParPaire(mesures);

    Object.values(meilleur).forEach(m => {
        if (efficacite[m.relayeLettre]) efficacite[m.relayeLettre].scoresCommeRelaye.push(m.score);
        if (efficacite[m.relayeurLettre]) efficacite[m.relayeurLettre].scoresCommeRelayeur.push(m.score);
    });

    Object.values(efficacite).forEach(eff => {
        if (eff.scoresCommeRelaye.length > 0) eff.moyenneCommeRelaye = moy(eff.scoresCommeRelaye);
        if (eff.scoresCommeRelayeur.length > 0) eff.moyenneCommeRelayeur = moy(eff.scoresCommeRelayeur);
        const tous = [...eff.scoresCommeRelaye, ...eff.scoresCommeRelayeur];
        eff.moyenneGlobale = tous.length > 0 ? moy(tous) : null;
    });

    return efficacite;
}

export function calculerCompositionsEfficaces(mesures) {
    const parPaire = {};
    mesures.forEach(m => {
        if (m.score === null || m.score === undefined) return;
        if (!parPaire[m.pairId]) parPaire[m.pairId] = { pairId: m.pairId, scores: [], count: 0 };
        parPaire[m.pairId].scores.push(m.score);
        parPaire[m.pairId].count++;
    });

    return Object.values(parPaire)
        .map(p => ({
            pairId: p.pairId,
            moyenneScore: moy(p.scores),
            meilleurScore: Math.max(...p.scores),
            nbEssais: p.count
        }))
        .sort((a, b) => b.meilleurScore - a.meilleurScore);
}

export function calculerScoreEquipe(mesures) {
    const meilleur = getMeilleurEssaiParPaire(mesures);
    const essais = Object.values(meilleur);
    if (essais.length === 0) return 0;
    const total = essais.reduce((sum, e) => sum + e.score, 0);
    return Math.round(total * 10) / 10;
}