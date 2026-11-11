// src/js/modules/natation/natation-longue-core.js
// Calculs du mode « Longue distance » (épreuve de nage 6-9 min)

export const MODE_ID = 'longue';
export const TITRE_AFFICHE = 'Natation — Longue distance';

export const DEFAUT_PARAMS = {
    duree: 420,             // 7 min par vague
    longueurBassin: 25,     // m
    distanceParClic: 50,    // 2 × 25 m (aller-retour)
    antiDoubleClic: 10,     // secondes
    nbVagues: 2             // nombre de vagues (groupes)
};

// ============================================================
// CALCULS DE DISTANCE
// ============================================================
export function calculerDistance(timestamps, partiel = 0, distanceParClic = 50) {
    const nbPassages = (timestamps || []).length;
    return nbPassages * distanceParClic + (partiel || 0);
}

export function calculerVitesse(distanceM, dureeSec) {
    if (!distanceM || !dureeSec || dureeSec <= 0) return 0;
    const vitesseMs = distanceM / dureeSec;
    return Math.round(vitesseMs * 3.6 * 10) / 10; // km/h arrondi 0,1
}

export function calculerTemps50m(timestamps) {
    if (!timestamps || timestamps.length < 2) return null;
    const ecarts = [];
    for (let i = 1; i < timestamps.length; i++) {
        ecarts.push((timestamps[i] - timestamps[i - 1]) / 1000);
    }
    const moy = ecarts.reduce((a, b) => a + b, 0) / ecarts.length;
    return Math.round(moy * 10) / 10;
}

// ============================================================
// RÉPARTITION ALÉATOIRE EN GROUPES (vagues)
// ============================================================
export function repartirEnGroupes(numeros, nbGroupes) {
    nbGroupes = Math.max(1, Math.min(4, nbGroupes));
    const couleurIds = ['BLEU', 'ROUGE', 'VERT', 'JAUNE'];
    const melanges = [...numeros].sort(() => Math.random() - 0.5);
    const groupes = {};
    couleurIds.forEach(id => { groupes[id] = []; });
    melanges.forEach((num, i) => {
        groupes[couleurIds[i % nbGroupes]].push(num);
    });
    return groupes;
}
