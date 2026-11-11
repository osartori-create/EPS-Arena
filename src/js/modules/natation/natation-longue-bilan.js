// src/js/modules/natation/natation-longue-bilan.js
// Calcul et agrégation des résultats de l'épreuve « Longue distance »

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getSessionObsPath, getSessionModifsPath, COULEURS_GROUPES, getEleveParNumero } from './natation-longue-common.js';
import { calculerDistance, calculerVitesse, calculerTemps50m } from './natation-longue-core.js';

// ============================================================
// CHARGEMENT FIREBASE (lecture one-shot)
// ============================================================
export async function chargerObservations(classe, sessionId) {
    const obsBase = getSessionObsPath(classe, sessionId);
    const result = {};
    for (const c of COULEURS_GROUPES) {
        result[c.id] = await new Promise(resolve => {
            onValue(ref(db, `${obsBase}/${c.id}`), snap => resolve(snap.val() || {}), { onlyOnce: true });
        });
    }
    return result;
}

export async function chargerModifications(classe, sessionId) {
    const modifsPath = getSessionModifsPath(classe, sessionId);
    return new Promise(resolve => {
        onValue(ref(db, modifsPath), snap => resolve(snap.val() || {}), { onlyOnce: true });
    });
}

// ============================================================
// CALCUL D'UN RÉSULTAT ÉLÈVE (à partir d'une observation)
// ============================================================
export function calculerResultat(obs, config) {
    const distanceParClic = config.distanceParClic || 50;
    const duree = config.duree || 420;
    if (!obs) {
        return { passages: 0, partiel: 0, distance: 0, vitesse: 0, abandon: false, temps50m: null };
    }
    const timestamps = obs.timestamps || [];
    const partiel = obs.partiel || 0;
    const abandon = !!obs.abandon;
    const distance = abandon ? 0 : calculerDistance(timestamps, partiel, distanceParClic);
    const vitesse = abandon ? 0 : calculerVitesse(distance, duree);
    const temps50m = abandon ? null : calculerTemps50m(timestamps);
    return { passages: timestamps.length, partiel, distance, vitesse, abandon, temps50m };
}

// ============================================================
// AGRÉGATION DE LA SESSION (toutes vagues)
// ============================================================
export function agregerResultats(classe, observations, modifications, config, statuts) {
    const resultats = [];

    for (const c of COULEURS_GROUPES) {
        const parNumero = observations[c.id] || {};
        for (const numero of Object.keys(parNumero)) {
            const obs = parNumero[numero];
            const eleve = getEleveParNumero(classe, numero);
            const statutLocal = statuts?.[eleve?.id] || 'present';
            const modif = modifications?.[numero] || {};
            const brut = calculerResultat(obs, config);

            const distanceFinale = modif.distance != null
                ? Math.max(0, Number(modif.distance))
                : Math.max(0, brut.distance - (Number(modif.penalite) || 0));

            const exclu = statutLocal !== 'present'
                || brut.abandon
                || modif.statut === 'abandon'
                || modif.statut === 'blessure';

            resultats.push({
                numero,
                eleveId: eleve?.id || null,
                nom: eleve ? `${eleve.prenom} ${eleve.nom}` : `#${numero}`,
                sexe: eleve?.sexe || null,
                couleur: c,
                passages: brut.passages,
                partiel: brut.partiel,
                distance: distanceFinale,
                distanceBrute: brut.distance,
                vitesse: brut.vitesse,
                temps50m: brut.temps50m,
                abandon: brut.abandon,
                statut: statutLocal,
                modifStatut: modif.statut || null,
                commentaire: modif.commentaire || '',
                modifie: !!(modif.distance != null || modif.penalite || modif.statut || modif.commentaire),
                exclu
            });
        }
    }

    resultats.sort((a, b) => {
        if (a.exclu !== b.exclu) return a.exclu ? 1 : -1;
        return b.distance - a.distance;
    });
    return resultats;
}
