// src/js/modules/grilles/grilles-core.js
// Modèle de données + calculs pour les grilles d'évaluation
// ⚠️ Stockage : localStorage uniquement (RGPD)
// Niveaux : toujours 4 (4=Très bonne maîtrise, 3=Satisfaisante, 2=Fragile, 1=Insuffisante)

const STORAGE_KEY_GRILLES = 'eps_arena_grilles_bibliotheque';
const STORAGE_KEY_EVALUATIONS = 'eps_arena_grilles_evaluations';
const STORAGE_KEY_DERNIER_ELEVE = 'eps_arena_grilles_dernier_eleve';

export const NIVEAUX = [
    { valeur: 4, label: 'TRÈS BONNE MAÎTRISE', couleur: '#22c55e' },
    { valeur: 3, label: 'MAÎTRISE SATISFAISANTE', couleur: '#84cc16' },
    { valeur: 2, label: 'MAÎTRISE FRAGILE', couleur: '#eab308' },
    { valeur: 1, label: 'MAÎTRISE INSUFFISANTE', couleur: '#ef4444' }
];

// ============================================================
// BIBLIOTHÈQUE DE GRILLES
// ============================================================
export function getToutesGrilles() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_GRILLES) || '[]');
}

export function getGrille(id) {
    return getToutesGrilles().find(g => g.id === id) || null;
}

export function sauvegarderGrille(grille) {
    const grilles = getToutesGrilles();
    const idx = grilles.findIndex(g => g.id === grille.id);
    if (idx >= 0) {
        grilles[idx] = grille;
    } else {
        grilles.push(grille);
    }
    localStorage.setItem(STORAGE_KEY_GRILLES, JSON.stringify(grilles));
    return grille;
}

export function supprimerGrille(id) {
    const grilles = getToutesGrilles().filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEY_GRILLES, JSON.stringify(grilles));
}

export function figerGrille(id) {
    const grille = getGrille(id);
    if (grille) {
        grille.figee = true;
        grille.dateFigement = Date.now();
        sauvegarderGrille(grille);
    }
    return grille;
}

// ============================================================
// CALCUL DE LA NOTE
// ============================================================
/**
 * @param {Object} notes - { [critereId]: valeur (1-4) }
 * @param {Array} criteres - Liste des critères avec leur pondération
 * @returns {Object} { sur100, sur20 }
 */
export function calculerNoteFinale(notes, criteres) {
    let total = 0;
    let totalPonderation = 0;

    criteres.forEach(c => {
        const val = notes[c.id];
        if (val === undefined || val === null) return;

        // Pondération : si 0, équipondéré
        const poids = c.ponderation > 0 ? c.ponderation : (100 / criteres.length);
        total += val * poids;
        totalPonderation += poids;
    });

    // Si toutes les notes ne sont pas saisies, on normalise sur les critères saisis
    if (totalPonderation === 0) {
        return { sur100: null, sur20: null };
    }

    // Note sur 4 → sur 100 (chaque point = 25)
    const noteSur100 = (total / totalPonderation) * 25;
    const noteSur20 = noteSur100 / 5;

    return {
        sur100: Math.round(noteSur100 * 10) / 10,
        sur20: Math.round(noteSur20 * 10) / 10
    };
}

// ============================================================
// STOCKAGE DES ÉVALUATIONS PROF
// ============================================================
/**
 * Évaluations prof : { [classe]: { [grilleId]: { [periode]: { [eleveId]: { notes: {}, timestamp } } } } }
 */
export function getEvaluationsClasse(classe) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_EVALUATIONS) || '{}');
    return all[classe] || {};
}

export function sauvegarderEvaluation(classe, grilleId, periode, eleveId, notes, timestamp = null) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_EVALUATIONS) || '{}');
    if (!all[classe]) all[classe] = {};
    if (!all[classe][grilleId]) all[classe][grilleId] = {};
    if (!all[classe][grilleId][periode]) all[classe][grilleId][periode] = {};

    all[classe][grilleId][periode][eleveId] = {
        notes,
        timestamp: timestamp || Date.now()
    };

    localStorage.setItem(STORAGE_KEY_EVALUATIONS, JSON.stringify(all));
}

export function getEvaluationEleve(classe, grilleId, periode, eleveId) {
    const evals = getEvaluationsClasse(classe);
    return evals[grilleId]?.[periode]?.[eleveId] || null;
}

// ============================================================
// DERNIER NIVEAU "ÉLÈVE" (pré-remplissage transversal)
// ============================================================
/**
 * Stocke le dernier niveau "Élève" par classe/élève, pour pré-remplissage.
 */
export function setDernierNiveauEleve(classe, eleveId, niveau, activiteSource) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_DERNIER_ELEVE) || '{}');
    if (!all[classe]) all[classe] = {};
    all[classe][eleveId] = { niveau, activite: activiteSource, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY_DERNIER_ELEVE, JSON.stringify(all));
}

export function getDernierNiveauEleve(classe, eleveId) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_DERNIER_ELEVE) || '{}');
    return all[classe]?.[eleveId] || null;
}

// ============================================================
// UTILITAIRES
// ============================================================
export function genererIdGrille(activite, niveau) {
    return `${activite}_${niveau}`.toLowerCase().replace(/\s+/g, '_');
}

export function getCouleurNiveau(valeur) {
    return NIVEAUX.find(n => n.valeur === valeur)?.couleur || '#64748b';
}

export function getLabelNiveau(valeur) {
    return NIVEAUX.find(n => n.valeur === valeur)?.label || '--';
}