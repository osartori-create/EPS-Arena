// src/js/modules/tournoi/variantes/atp/atp-core.js
// Logique ATP : barème, calcul des points, recalcul complet, tri du classement,
// série de victoires, matrice de confrontations et suggestions de matchs.

export const POINTS_INITIAUX = 100;

export const BAREME_DEFAUT = [
    { ecartMin: -50, ecartMax: -11, ptsV: 6, ptsP: -6, label: 'Outsider net' },
    { ecartMin: -10, ecartMax: -5,  ptsV: 5, ptsP: -5, label: 'Outsider' },
    { ecartMin: -4,  ecartMax: -1,  ptsV: 4, ptsP: -4, label: 'Léger outsider' },
    { ecartMin: 0,   ecartMax: 4,   ptsV: 3, ptsP: -3, label: 'Équilibré' },
    { ecartMin: 5,   ecartMax: 10,  ptsV: 2, ptsP: -2, label: 'Favori léger' },
    { ecartMin: 11,  ecartMax: 50,  ptsV: 1, ptsP: -1, label: 'Favori net' }
];

// ============================================================
// POINTS D'UN JOUEUR
// ============================================================
export function getPoints(joueur) {
    if (!joueur) return POINTS_INITIAUX;
    return typeof joueur.points === 'number' ? joueur.points : POINTS_INITIAUX;
}

// ============================================================
// AJUSTEMENTS MANUELS (bonus/malus saisis par le prof dans le live)
// ============================================================
export function appliquerAjustements(joueursMap, ajustements = {}) {
    Object.keys(ajustements || {}).forEach(code => {
        const j = joueursMap[String(code)];
        if (!j) return;
        const delta = Number(ajustements[code]) || 0;
        j.points += delta;
    });
    return joueursMap;
}

// ============================================================
// PALIER DU BARÈME
// ============================================================
export function getPalier(ecart, bareme = BAREME_DEFAUT) {
    if (!Array.isArray(bareme) || bareme.length === 0) return null;
    for (const p of bareme) {
        if (ecart >= p.ecartMin && ecart <= p.ecartMax) return p;
    }
    if (ecart < bareme[0].ecartMin) return bareme[0];
    return bareme[bareme.length - 1];
}

// ============================================================
// CALCUL D'UN MATCH (points AVANT match)
// ============================================================
export function calculerMatch(joueurV, joueurP, bareme = BAREME_DEFAUT) {
    const ptsVAvant = getPoints(joueurV);
    const ptsPAvant = getPoints(joueurP);
    const ecart = ptsVAvant - ptsPAvant;
    const palier = getPalier(ecart, bareme) || { ptsV: 0, ptsP: 0, label: 'Hors barème' };
    return { ecart, ptsV: palier.ptsV, ptsP: palier.ptsP, palier };
}

// ============================================================
// RECALCUL COMPLET (rejouer tous les matchs dans l'ordre)
// ============================================================
export function recalculerTout(codes, historique, bareme = BAREME_DEFAUT) {
    const joueurs = {};
    codes.forEach(code => {
        joueurs[String(code)] = {
            points: POINTS_INITIAUX,
            victoires: 0,
            defaites: 0,
            matchesJoues: 0,
            pointsMarques: 0,
            pointsEncaisses: 0,
            diffPoints: 0,
            serieActuelle: 0,
            meilleureSerie: 0
        };
    });

    const matchs = Object.values(historique || {})
        .filter(m => m && m.codeV && m.codeP)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    matchs.forEach(m => {
        const v = joueurs[String(m.codeV)];
        const p = joueurs[String(m.codeP)];
        if (!v || !p) return;

        const { ptsV, ptsP } = calculerMatch(v, p, bareme);

        v.points += ptsV;
        p.points += ptsP;
        v.victoires++;
        p.defaites++;
        v.matchesJoues++;
        p.matchesJoues++;

        // Série de victoires (ordre chronologique)
        v.serieActuelle++;
        p.serieActuelle = 0;
        if (v.serieActuelle > v.meilleureSerie) v.meilleureSerie = v.serieActuelle;

        const scV = Number(m.scoreV) || 0;
        const scP = Number(m.scoreP) || 0;
        v.pointsMarques += scV;
        v.pointsEncaisses += scP;
        p.pointsMarques += scP;
        p.pointsEncaisses += scV;
        v.diffPoints += (scV - scP);
        p.diffPoints += (scP - scV);
    });

    return joueurs;
}

// ============================================================
// TRI DU CLASSEMENT
// ============================================================
export function trierClassement(joueursMap, elevesMap = {}) {
    const arr = Object.keys(joueursMap || {}).map(code => {
        const j = joueursMap[code] || {};
        return {
            code: String(code),
            points: getPoints(j),
            victoires: j.victoires || 0,
            defaites: j.defaites || 0,
            matchesJoues: j.matchesJoues || 0,
            diffPoints: j.diffPoints || 0,
            serieActuelle: j.serieActuelle || 0,
            meilleureSerie: j.meilleureSerie || 0,
            eleve: elevesMap[String(code)] || null
        };
    });

    arr.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.victoires !== a.victoires) return b.victoires - a.victoires;
        if (b.diffPoints !== a.diffPoints) return b.diffPoints - a.diffPoints;
        const nomA = a.eleve ? `${a.eleve.nom} ${a.eleve.prenom}` : '';
        const nomB = b.eleve ? `${b.eleve.nom} ${b.eleve.prenom}` : '';
        return nomA.localeCompare(nomB);
    });

    arr.forEach((item, idx) => { item.rang = idx + 1; });
    return arr;
}

// ============================================================
// MATRICE DE CONFRONTATIONS
// ============================================================
export function creeMatriceConfrontations(historique) {
    const matrix = {};
    Object.values(historique || {}).forEach(m => {
        if (!m || !m.codeV || !m.codeP) return;
        const a = String(m.codeV);
        const b = String(m.codeP);
        const c1 = a < b ? a : b;
        const c2 = a < b ? b : a;
        if (!matrix[c1]) matrix[c1] = {};
        matrix[c1][c2] = (matrix[c1][c2] || 0) + 1;
    });
    return matrix;
}

export function getConfrontations(matrix, codeA, codeB) {
    const a = String(codeA);
    const b = String(codeB);
    const c1 = a < b ? a : b;
    const c2 = a < b ? b : a;
    return matrix?.[c1]?.[c2] || 0;
}

// ============================================================
// SUGGESTIONS DE MATCHS
// ============================================================
export function suggererMatchs(joueursMap, historique, absents = new Set()) {
    const matrix = creeMatriceConfrontations(historique);
    const codes = Object.keys(joueursMap || {}).filter(c => !absents.has(c));
    const suggestions = [];

    for (let i = 0; i < codes.length; i++) {
        for (let j = i + 1; j < codes.length; j++) {
            const cA = codes[i];
            const cB = codes[j];
            const count = getConfrontations(matrix, cA, cB);
            const diffPts = Math.abs((joueursMap[cA]?.points || 0) - (joueursMap[cB]?.points || 0));

            let raison = '';
            let priorite = 0;

            if (count === 0) {
                raison = '🆕 Jamais affrontés';
                priorite = 1000 - diffPts;
            } else if (count === 1) {
                raison = '🔄 Affrontés 1 fois seulement';
                priorite = 500 - diffPts;
            } else if (diffPts <= 10) {
                raison = '⚖️ Points proches';
                priorite = 200 - count * 20 - diffPts;
            } else {
                continue;
            }

            suggestions.push({ codeA: cA, codeB: cB, raison, priorite });
        }
    }

    return suggestions.sort((a, b) => b.priorite - a.priorite);
}

// ============================================================
// SNAPSHOT D'ARCHIVE
// ============================================================
export function genererSnapshot(joueursMap) {
    const snapshot = {};
    Object.keys(joueursMap || {}).forEach(code => {
        snapshot[code] = getPoints(joueursMap[code]);
    });
    return snapshot;
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

export function formatEcart(ecart) {
    if (ecart > 0) return `+${ecart}`;
    if (ecart < 0) return String(ecart);
    return '0';
}