// src/js/services/criteria-service.js
// Dépôt transversal des critères dérivés d'élèves.
//
// Principe : chaque module "producteur de donnée" (natation, demi-fond, …)
// écrit une métrique dérivée directement dans la fiche élève
// (eps_arena_eleves_${classe}), que le module multi-activités peut ensuite
// utiliser comme critère de constitution d'équipes — sans surcharger les
// modules métier avec la logique de répartition.

const ELEVES_PREFIX = 'eps_arena_eleves_';

// ============================================================
// FICHE ÉLÈVE PARTAGÉE
// ============================================================
export function getElevesClasse(classe) {
    return JSON.parse(localStorage.getItem(`${ELEVES_PREFIX}${classe}`) || '[]');
}

export function saveElevesClasse(classe, eleves) {
    localStorage.setItem(`${ELEVES_PREFIX}${classe}`, JSON.stringify(eleves));
}

// ============================================================
// ÉCRITURE D'UN CRITÈRE DÉRIVÉ
// ============================================================
/**
 * Écrit un critère numérique sur la fiche élève, repéré par son id.
 * @returns {boolean} true si l'élève a été trouvé et la valeur écrite.
 */
export function enregistrerCritereEleve(classe, eleveId, champ, valeur) {
    if (!classe || !eleveId) return false;
    const eleves = getElevesClasse(classe);
    const eleve = eleves.find(e => e.id === eleveId);
    if (!eleve) return false;

    const n = Number(valeur);
    if (valeur === null || valeur === undefined || Number.isNaN(n)) return false;

    eleve[champ] = n;
    saveElevesClasse(classe, eleves);
    return true;
}

/**
 * Écrit un critère numérique sur la fiche élève, repéré par son codeAutoEval.
 */
export function enregistrerCritereParCodeAutoEval(classe, code, champ, valeur) {
    if (!classe || code === null || code === undefined) return false;
    const eleves = getElevesClasse(classe);
    const eleve = eleves.find(e => String(e.codeAutoEval) === String(code));
    if (!eleve) return false;

    const n = Number(valeur);
    if (Number.isNaN(n)) return false;

    eleve[champ] = n;
    saveElevesClasse(classe, eleves);
    return true;
}

// ============================================================
// DÉCLARATION DES CRITÈRES CONNUS
// ============================================================
// Critères statiques (déjà présents sur la fiche élève).
export const CRITERES_STATIQUES = [
    { id: 'vma', label: 'VMA' },
    { id: 'force', label: 'Jauge ★' },
    { id: 'polyvalent', label: 'Polyvalent (VMA+L+30m)' },
];

// Critères dérivés, écrits par les modules métiers.
export const CRITERES_DERIVES = [
    { id: 'indiceNage', label: '🏊 Indice de nage' },
    { id: 'vitesseDemiFond', label: '🏃 Vitesse 1/2 fond (km/h)' },
];

/**
 * Retourne la liste des critères réellement disponibles pour un groupe
 * d'élèves : les statiques + les dérivés possédant au moins une valeur.
 */
export function getCriteresDisponibles(eleves) {
    const pool = eleves || [];
    const liste = [...CRITERES_STATIQUES];
    for (const c of CRITERES_DERIVES) {
        const dispo = pool.some(e => {
            const v = e[c.id];
            return v !== undefined && v !== null && !Number.isNaN(Number(v));
        });
        if (dispo) liste.push(c);
    }
    return liste;
}

/**
 * Retourne la valeur numérique d'un critère pour un élève donné.
 * Sémantique : plus la valeur est grande, "meilleur" est l'élève
 * (cohérent avec la VMA ou la force).
 */
export function getCritereValue(eleve, critere) {
    if (!eleve) return 0;

    // Critère composite historique.
    if (critere === 'polyvalent') {
        const vma = Number(eleve.vma) || 0;
        const longueur = Number(eleve.longueur) || 0;
        const sprint = Number(eleve.sprint30) || 0;
        // Sprint : un temps plus petit est meilleur → on inverse sur une base.
        const sprintScore = sprint > 0 ? Math.max(0, 10 - sprint) : 0;
        return vma + longueur * 0.1 + sprintScore;
    }

    const v = eleve[critere];
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
}