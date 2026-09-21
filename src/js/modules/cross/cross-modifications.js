// src/js/modules/cross/cross-modifications.js
// Gestion des modifications prof : pénalités, abandons, blessures, changements de classement

import { db, ref, onValue, set, remove } from '../../core/firebase-service.js';
import { getCrossBasePath } from './cross-config.js';

/**
 * Écoute les modifications d'une course.
 */
export function listenModifications(courseId, callback) {
    const path = `${getCrossBasePath()}/courses/${courseId}/modifications`;
    return onValue(ref(db, path), snap => callback(snap.val() || {}));
}

/**
 * Sauvegarde une modification.
 * @param {string} courseId
 * @param {string} dossard
 * @param {Object} modif - { tempsModifie, penaliteSecondes, penalitePoints, statut, commentaire }
 */
export async function sauvegarderModification(courseId, dossard, modif) {
    const path = `${getCrossBasePath()}/courses/${courseId}/modifications/${dossard}`;

    // Nettoyer : on ne stocke que les champs non-nuls
    const clean = {};
    if (modif.tempsModifie !== null && modif.tempsModifie !== undefined && modif.tempsModifie !== '') {
        clean.tempsModifie = Number(modif.tempsModifie);
    }
    if (modif.penaliteSecondes) clean.penaliteSecondes = Number(modif.penaliteSecondes);
    if (modif.penalitePoints) clean.penalitePoints = Number(modif.penalitePoints);
    if (modif.statut && modif.statut !== 'normal') clean.statut = modif.statut;
    if (modif.commentaire) clean.commentaire = String(modif.commentaire).trim();
    clean.timestamp = Date.now();

    // Si aucune modification effective → supprimer le nœud
    const hasRealChange = clean.tempsModifie !== undefined
                       || clean.penaliteSecondes !== undefined
                       || clean.penalitePoints !== undefined
                       || clean.statut !== undefined
                       || clean.commentaire !== undefined;

    if (!hasRealChange) {
        await remove(ref(db, path));
        return null;
    }

    await set(ref(db, path), clean);
    return clean;
}

/**
 * Supprime une modification.
 */
export async function supprimerModification(courseId, dossard) {
    const path = `${getCrossBasePath()}/courses/${courseId}/modifications/${dossard}`;
    await remove(ref(db, path));
}

/**
 * Applique les modifications à un élève.
 * @param {number|null} tempsBrut - temps brut en ms, ou null si non arrivé
 * @param {Object} modif - la modification stockée, ou null
 * @returns {Object} { tempsEffectif, tempsAffiche, statut, commentaire, penalitePoints, excluDuClassement, aModif }
 */
export function appliquerModif(tempsBrut, modif) {
    const result = {
        tempsEffectif: tempsBrut,
        statut: 'normal',
        commentaire: '',
        penalitePoints: 0,
        excluDuClassement: false,
        aModif: false
    };

    if (!modif) return result;

    result.aModif = true;
    result.statut = modif.statut || 'normal';
    result.commentaire = modif.commentaire || '';
    result.penalitePoints = Number(modif.penalitePoints) || 0;

    // Priorité 1 : temps modifié manuellement
    if (modif.tempsModifie !== null && modif.tempsModifie !== undefined) {
        result.tempsEffectif = Number(modif.tempsModifie);
    }
    // Priorité 2 : pénalité de temps
    else if (modif.penaliteSecondes && tempsBrut !== null) {
        result.tempsEffectif = tempsBrut + Number(modif.penaliteSecondes) * 1000;
    }

    // Statuts exclus
    if (result.statut === 'abandon' || result.statut === 'blessure') {
        result.excluDuClassement = true;
    }

    return result;
}

/**
 * Labels et couleurs des statuts.
 */
export const STATUTS = {
    normal:   { label: 'Normal',      emoji: '✅', couleur: '#64748b', bg: '#1e293b' },
    penalite: { label: 'Pénalité',    emoji: '⚠️', couleur: '#f59e0b', bg: '#78350f30' },
    abandon:  { label: 'Abandon',     emoji: '🚫', couleur: '#ef4444', bg: '#7f1d1d30' },
    blessure: { label: 'Blessure',    emoji: '🤕', couleur: '#ec4899', bg: '#83184330' }
};

/**
 * Détermine le "statut visuel" d'une modif pour l'affichage.
 */
export function getStatutVisuel(modif) {
    if (!modif) return 'normal';
    if (modif.statut === 'abandon') return 'abandon';
    if (modif.statut === 'blessure') return 'blessure';
    if (modif.penaliteSecondes || modif.penalitePoints || modif.tempsModifie) return 'penalite';
    return 'normal';
}