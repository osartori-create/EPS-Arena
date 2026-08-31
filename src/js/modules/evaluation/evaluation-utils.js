// src/js/modules/evaluation/evaluation-utils.js
// Utilitaires : calculs des scores, groupes de maîtrise, export

/**
 * Définition des groupes de maîtrise
 */
export const GROUPES = {
    A_BESOINS: 'a_besoins',
    FRAGILE: 'fragile',
    SATISFAISANT: 'satisfaisant'
};

export const COULEURS_GROUPES = {
    [GROUPES.A_BESOINS]: '#ef4444',   // Rouge
    [GROUPES.FRAGILE]: '#f59e0b',     // Orange
    [GROUPES.SATISFAISANT]: '#22c55e' // Vert
};

export const LIBELLES_GROUPES = {
    [GROUPES.A_BESOINS]: 'À besoins',
    [GROUPES.FRAGILE]: 'Fragile',
    [GROUPES.SATISFAISANT]: 'Satisfaisant'
};

/**
 * Calcule le groupe de maîtrise pour l'endurance (Luc Léger)
 * @param {number} palier - Dernier palier atteint
 * @returns {string} 'a_besoins' | 'fragile' | 'satisfaisant'
 */
export function groupeEndurance(palier) {
    if (palier === undefined || palier === null) return null;
    if (palier <= 1) return GROUPES.A_BESOINS;
    if (palier <= 3) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

/**
 * Calcule le groupe de maîtrise pour la force (saut en longueur)
 * @param {number} distance - Distance en cm
 * @returns {string}
 */
export function groupeForce(distance) {
    if (distance === undefined || distance === null) return null;
    if (distance <= 110) return GROUPES.A_BESOINS;
    if (distance <= 140) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

/**
 * Calcule le groupe de maîtrise pour la vitesse (30m)
 * @param {number} temps - Temps en secondes
 * @returns {string}
 */
export function groupeVitesse(temps) {
    if (temps === undefined || temps === null) return null;
    if (temps >= 6.8) return GROUPES.A_BESOINS;
    if (temps >= 6.0) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

/**
 * Calcule le groupe de maîtrise pour l'équilibre (Flamingo)
 * @param {number} duree - Durée en secondes
 * @returns {string}
 */
export function groupeEquilibre(duree) {
    if (duree === undefined || duree === null) return null;
    if (duree <= 10) return GROUPES.A_BESOINS;
    if (duree <= 30) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

/**
 * Calcule le groupe de maîtrise pour la coordination
 * @param {number} nb - Nombre de lancers rattrapés
 * @returns {string}
 */
export function groupeCoordination(nb) {
    if (nb === undefined || nb === null) return null;
    if (nb <= 3) return GROUPES.A_BESOINS;
    if (nb <= 5) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

/**
 * Calcule le groupe de maîtrise pour la souplesse
 * @param {number} distance - Distance en cm (positive ou négative)
 * @returns {string}
 */
export function groupeSouplesse(distance) {
    if (distance === undefined || distance === null) return null;
    if (distance <= -15) return GROUPES.A_BESOINS;
    if (distance <= -5) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

/**
 * Calcule le groupe de maîtrise pour l'endurance musculaire
 * @param {number} duree - Durée en secondes
 * @returns {string}
 */
export function groupeEnduranceMusculaire(duree) {
    if (duree === undefined || duree === null) return null;
    if (duree <= 30) return GROUPES.A_BESOINS;
    if (duree <= 60) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

/**
 * Map des fonctions de groupe par test
 */
export const FONCTIONS_GROUPE = {
    endurance: groupeEndurance,
    force: groupeForce,
    vitesse: groupeVitesse,
    equilibre: groupeEquilibre,
    coordination: groupeCoordination,
    souplesse: groupeSouplesse,
    endurance_musculaire: groupeEnduranceMusculaire
};

/**
 * Libellés des tests
 */
export const LIBELLES_TESTS = {
    endurance: 'Endurance (Luc Léger)',
    force: 'Force (saut en longueur)',
    vitesse: 'Vitesse (30m)',
    equilibre: 'Équilibre (Flamingo)',
    coordination: 'Coordination (lancer/rattrapé)',
    souplesse: 'Souplesse (sit and reach)',
    endurance_musculaire: 'Endurance musculaire (chaise)'
};

/**
 * Unités des tests
 */
export const UNITES_TESTS = {
    endurance: 'paliers',
    force: 'cm',
    vitesse: 's',
    equilibre: 's',
    coordination: 'lancers',
    souplesse: 'cm',
    endurance_musculaire: 's'
};

/**
 * Génère un CSV complet pour iDoceo
 */
export function genererCSV(data, classe) {
    const eleves = Object.values(data.eleves).sort((a, b) => a.nom.localeCompare(b.nom));
    
    // En-tête
    const entete = [
        '"!groupe"', '"Nom"', '"Prénom"', '"Sexe"', '"Statut"',
        '"Endurance (palier)"', '"Endurance (groupe)"',
        '"Force (cm)"', '"Force (groupe)"',
        '"Vitesse (s)"', '"Vitesse (groupe)"',
        '"Équilibre (s)"', '"Équilibre (groupe)"',
        '"Coordination (nb)"', '"Coordination (groupe)"',
        '"Souplesse (cm)"', '"Souplesse (groupe)"',
        '"Endurance musculaire (s)"', '"Endurance musculaire (groupe)"'
    ].join(';');

    let lignes = [entete];

    eleves.forEach(e => {
        const r = e.resultats || {};
        const ligne = [
            `"${e.id}"`,
            `"${e.nom}"`,
            `"${e.prenom}"`,
            `"${e.sexe || ''}"`,
            `"${e.statut || 'present'}"`,
            r.endurance ? `"${r.endurance.palier ?? ''}"` : '""',
            r.endurance ? `"${LIBELLES_GROUPES[r.endurance.groupe] || ''}"` : '""',
            r.force ? `"${r.force.meilleur ?? ''}"` : '""',
            r.force ? `"${LIBELLES_GROUPES[r.force.groupe] || ''}"` : '""',
            r.vitesse ? `"${r.vitesse.meilleur ?? ''}"` : '""',
            r.vitesse ? `"${LIBELLES_GROUPES[r.vitesse.groupe] || ''}"` : '""',
            r.equilibre ? `"${r.equilibre.temps ?? ''}"` : '""',
            r.equilibre ? `"${LIBELLES_GROUPES[r.equilibre.groupe] || ''}"` : '""',
            r.coordination ? `"${r.coordination.nb_lancers ?? ''}"` : '""',
            r.coordination ? `"${LIBELLES_GROUPES[r.coordination.groupe] || ''}"` : '""',
            r.souplesse ? `"${r.souplesse.meilleur ?? ''}"` : '""',
            r.souplesse ? `"${LIBELLES_GROUPES[r.souplesse.groupe] || ''}"` : '""',
            r.endurance_musculaire ? `"${r.endurance_musculaire.temps ?? ''}"` : '""',
            r.endurance_musculaire ? `"${LIBELLES_GROUPES[r.endurance_musculaire.groupe] || ''}"` : '""'
        ].join(';');
        lignes.push(ligne);
    });

    // BOM UTF-8
    return '\uFEFF' + lignes.join('\n');
}

/**
 * Télécharge un fichier CSV
 */
export function telechargerCSV(csv, nomFichier) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Exporte les données vers iDoceo
 */
export function exporterVersIDoceo(data, classe) {
    const csv = genererCSV(data, classe);
    const nomFichier = `EPS_Arena_Evaluation_${classe}_${new Date().toISOString().slice(0,10)}.csv`;
    telechargerCSV(csv, nomFichier);
}