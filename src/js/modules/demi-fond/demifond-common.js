// src/js/modules/demi-fond/demifond-common.js
// Helpers communs à tous les sous-modules 1/2 Fond

import { getVMAFromPalier } from '../evaluation/evaluation-utils.js';
import { getExistingEleves } from '../../services/admin-service.js';

// ============================================================
// COULEURS DES GROUPES (max 4)
// ============================================================
export const COULEURS_GROUPES = [
    { id: 'BLEU',  label: 'Bleu',  bg: '#3b82f6', text: '#ffffff', border: '#1e40af' },
    { id: 'ROUGE', label: 'Rouge', bg: '#ef4444', text: '#ffffff', border: '#991b1b' },
    { id: 'NOIR',  label: 'Noir',  bg: '#1f2937', text: '#ffffff', border: '#000000' },
    { id: 'JAUNE', label: 'Jaune', bg: '#eab308', text: '#000000', border: '#854d0e' }
];

export function getCouleurGroupe(id) {
    return COULEURS_GROUPES.find(c => c.id === id) || COULEURS_GROUPES[0];
}

// ============================================================
// RÉCUPÉRATION VMA
// ============================================================
/**
 * Retourne la VMA de l'élève :
 * 1. Priorité : champ `vma` dans eps_arena_eleves_{classe}
 * 2. Fallback : palier Luc Léger via eps_arena_evaluation_{classe}
 * @returns {number|null} VMA en km/h
 */
export function getVMAEleve(classe, eleveId) {
    // Priorité 1 : champ direct
    const eleves = getExistingEleves(classe);
    const eleve = eleves.find(e => e.id === eleveId);
    if (eleve?.vma && parseFloat(eleve.vma) > 0) {
        return parseFloat(eleve.vma);
    }

    // Priorité 2 : palier Luc Léger
    const evalData = JSON.parse(localStorage.getItem(`eps_arena_evaluation_${classe}`) || 'null');
    const palier = evalData?.eleves?.[eleveId]?.resultats?.endurance?.palier;
    if (palier !== undefined && palier !== null) {
        const vma = getVMAFromPalier(palier);
        if (vma !== null) return vma;
    }

    return null;
}

// ============================================================
// STORAGE KEYS
// ============================================================
export function getGroupesKey(classe, sousModule) {
    return `eps_arena_demifond_${sousModule}_groupes_${classe}`;
}

export function getConfigKey(classe, sousModule) {
    return `eps_arena_demifond_${sousModule}_config_${classe}`;
}

// ============================================================
// FIREBASE PATHS
// ============================================================
export function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/demi-fond`;
}

// ============================================================
// FORMATAGE
// ============================================================
export function formatDuree(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatVitesse(kmh) {
    if (kmh === null || kmh === undefined || isNaN(kmh)) return '--';
    return kmh.toFixed(1) + ' km/h';
}

export function formatDistance(m) {
    if (m === null || m === undefined || isNaN(m)) return '--';
    return Math.round(m) + ' m';
}