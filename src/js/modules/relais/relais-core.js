// src/js/modules/relais/relais-core.js
// Logique métier commune au module Relais

// ============================================================
// CONSTANTES
// ============================================================
export const ZONE_MIN = 15;      // Plot 1 = 15 km/h
export const ZONE_MAX = 28;      // Plot 14 = 28 km/h
export const NB_PLOTS = ZONE_MAX - ZONE_MIN + 1; // 14

// Distances de référence (5s / 10s)
export const DIST_5S_PLOT_1 = 20.75;
export const PAS_5S = 1.38;
export const DIST_10S_PLOT_1 = 41.55;
export const PAS_10S = 2.76;

// ============================================================
// CONVERSIONS
// ============================================================
export function zoneToVitesse(zone) {
    if (!zone || zone < 1 || zone > NB_PLOTS) return null;
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
// CALCULS RELAIS
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
    if (score >= 8) return '#22c55e';     // vert foncé (excellent)
    if (score >= 6) return '#84cc16';     // vert clair
    if (score >= 5) return '#eab308';     // jaune (pile = V_th)
    if (score >= 3) return '#f97316';     // orange
    return '#ef4444';                     // rouge
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
// PAIRES D'UN GROUPE
// ============================================================
export function getLettre(index) {
    return String.fromCharCode(97 + index); // a, b, c, d, ...
}

/**
 * Retourne toutes les paires possibles d'un groupe (n*(n-1))
 * @param {Array} membres - [{ id, prenom, nom, lettre }, ...]
 * @returns {Array} [{ relayeIdx, relayeurIdx, pairId, label, relaye, relayeur }, ...]
 */
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
 * Retourne le meilleur essai par paire (score le plus haut)
 */
export function getMeilleurEssaiParPaire(mesures) {
    const meilleur = {};
    mesures.forEach(m => {
        if (!meilleur[m.pairId] || m.score > meilleur[m.pairId].score) {
            meilleur[m.pairId] = m;
        }
    });
    return meilleur;
}

/**
 * Efficacité individuelle (Option B) :
 * - en tant que relayé (part arrêté)
 * - en tant que relayeur (arrive lancé)
 * Basée sur le meilleur essai de chaque paire.
 */
export function calculerEfficaciteIndividuelle(mesures, membres) {
    const efficacite = {};
    membres.forEach(m => {
        efficacite[m.id] = {
            membre: m,
            scoresCommeRelaye: [],
            scoresCommeRelayeur: [],
            moyenneCommeRelaye: null,
            moyenneCommeRelayeur: null,
            moyenneGlobale: null
        };
    });

    // On se base sur les meilleurs essais par paire
    const meilleur = getMeilleurEssaiParPaire(mesures);

    Object.values(meilleur).forEach(m => {
        if (efficacite[m.relayeId]) {
            efficacite[m.relayeId].scoresCommeRelaye.push(m.score);
        }
        if (efficacite[m.relayeurId]) {
            efficacite[m.relayeurId].scoresCommeRelayeur.push(m.score);
        }
    });

    Object.values(efficacite).forEach(eff => {
        if (eff.scoresCommeRelaye.length > 0) {
            eff.moyenneCommeRelaye = moy(eff.scoresCommeRelaye);
        }
        if (eff.scoresCommeRelayeur.length > 0) {
            eff.moyenneCommeRelayeur = moy(eff.scoresCommeRelayeur);
        }
        const tous = [...eff.scoresCommeRelaye, ...eff.scoresCommeRelayeur];
        eff.moyenneGlobale = tous.length > 0 ? moy(tous) : null;
    });

    return efficacite;
}

/**
 * Compositions les plus efficientes : classement des paires (meilleur essai) par moyenne de score
 */
export function calculerCompositionsEfficaces(mesures) {
    const parPaire = {};
    mesures.forEach(m => {
        if (!parPaire[m.pairId]) {
            parPaire[m.pairId] = { pairId: m.pairId, scores: [], count: 0 };
        }
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

/**
 * Score cumulé d'une équipe (somme des meilleurs essais par paire)
 */
export function calculerScoreEquipe(mesures) {
    const meilleur = getMeilleurEssaiParPaire(mesures);
    const essais = Object.values(meilleur);
    if (essais.length === 0) return 0;
    const total = essais.reduce((sum, e) => sum + e.score, 0);
    return Math.round(total * 10) / 10;
}

// ============================================================
// MATCHING ÉLÈVE / VITESSES
// ============================================================
/**
 * Associe les vitesses (Firebase) aux membres d'un groupe
 */
export function enrichirMembresAvecVitesses(membres, vitesses) {
    return membres.map(m => {
        const v = vitesses[m.id] || {};
        return {
            ...m,
            vArret: v.arret || null,
            vLance: v.lance || null
        };
    });
}

// ============================================================
// UTILITAIRES
// ============================================================
export function formatScore(score) {
    if (score === null || score === undefined) return '--';
    const signe = score >= 5 ? '+' : '';
    return `${signe}${(score - 5).toFixed(1)}`;
}