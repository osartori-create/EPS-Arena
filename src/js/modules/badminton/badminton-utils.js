// src/js/modules/badminton/badminton-utils.js
// Constantes et utilitaires pour le module Badminton

export const SEUIL_MANIERE = 8;

export const POINTS_CLASSEMENT = {
    GAGNE_AVEC: 5,
    GAGNE_SANS: 3,
    PERDU_AVEC: 2,
    PERDU_SANS: 1
};

export function calcRatio(stats, mode) {
    const total = stats.center + (mode === '4corners' ? (stats.corner + stats.other + stats.fault) : stats.extreme);
    if (total === 0) return 0;
    const ext = (mode === '4corners') ? (stats.corner + stats.other + stats.fault) : stats.extreme;
    return Math.round((ext / total) * 100);
}

export function getDefaultCheckboxes() {
    return {
        danger: Array(10).fill(false),
        center: Array(10).fill(false)
    };
}

export function getEmptyStats() {
    return {
        p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 },
        p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }
    };
}

export function getDefaultMatchPoints() {
    return { p1: 0, p2: 0 };
}