// src/js/modules/relais/relais-core.js
// Logique métier commune au module Relais
// ⚠️ RGPD : les "membres" ne contiennent JAMAIS de nom/prénom/id.

export const ZONE_MIN = 15;   // Vitesse minimale (km/h)
export const ZONE_MAX = 28;   // Vitesse maximale (km/h)
export const NB_PLOTS = ZONE_MAX - ZONE_MIN + 1; // 14

/**
 * Retourne la vitesse (km/h) quelle que soit la donnée d'entrée :
 * - Si c'est déjà une vitesse (>= 15), elle est retournée telle quelle (cas import CSV)
 * - Si c'est une zone 1-14 (cas kiosque élève), elle est convertie
 */
export function zoneToVitesse(zone) {
    if (!zone) return null;
    // ✅ Auto-détection : c'est déjà une vitesse en km/h (>= 15)
    if (zone >= ZONE_MIN) return zone;
    // C'est une zone 1-14, on convertit
    if (zone < 1 || zone > NB_PLOTS) return null;
    return ZONE_MIN + (zone - 1);
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
// PAIRES D'UN GROUPE (basé sur la LETTRE, pas sur un id)
// ============================================================
export function getLettre(index) {
    return String.fromCharCode(97 + index);
}

/**
 * @param {Array} membres - [{ lettre: 'a', sexe: 'M' }, ...]
 * @returns {Array} [{ relayeIdx, relayeurIdx, pairId, label, relaye, relayeur }]
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
 * Efficacité individuelle (Option B)
 * @param {Array} mesures - [{ relayeLettre, relayeurLettre, score, ... }]
 * @param {Array} membres - [{ lettre, sexe }]
 */
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
        if (efficacite[m.relayeLettre]) {
            efficacite[m.relayeLettre].scoresCommeRelaye.push(m.score);
        }
        if (efficacite[m.relayeurLettre]) {
            efficacite[m.relayeurLettre].scoresCommeRelayeur.push(m.score);
        }
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

export function calculerScoreEquipe(mesures) {
    const meilleur = getMeilleurEssaiParPaire(mesures);
    const essais = Object.values(meilleur);
    if (essais.length === 0) return 0;
    const total = essais.reduce((sum, e) => sum + e.score, 0);
    return Math.round(total * 10) / 10;
}

export function formatScore(score) {
    if (score === null || score === undefined) return '--';
    const signe = score >= 5 ? '+' : '';
    return `${signe}${(score - 5).toFixed(1)}`;
}