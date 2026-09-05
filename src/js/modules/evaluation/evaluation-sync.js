// src/js/modules/evaluation/evaluation-sync.js
// Gestion de la synchronisation entre les tests d'évaluation et les fiches élèves (administration)

import { getExistingEleves, saveEleves } from '../../services/admin-service.js';
import { getVMAFromPalier } from './evaluation-utils.js';

// Correspondance test → champ admin
const MAPPING = {
    endurance: { field: 'vma', transform: (val) => getVMAFromPalier(val.palier) },
    force: { field: 'longueur', transform: (val) => val.meilleur },
    vitesse: { field: 'sprint30', transform: (val) => val.meilleur },
    souplesse: { field: 'souplesse', transform: (val) => val.meilleur },
    equilibre: { field: 'equilibre', transform: (val) => val.temps },
    coordination: { field: 'coordination', transform: (val) => val.nb_lancers },
    endurance_musculaire: { field: 'enduranceMusculaire', transform: (val) => val.temps }
};

// Champs qui ont une jauge ★ (force) → on garde la logique existante
// Pour la force (jauge), on pourrait aussi la synchroniser mais elle est déjà gérée manuellement.

/**
 * Synchronise un résultat de test vers la fiche élève (administration)
 * @param {string} classe - Nom de la classe
 * @param {string} eleveId - ID de l'élève
 * @param {string} testId - Identifiant du test (endurance, force, vitesse...)
 * @param {object} resultat - Objet résultat (avec palier, meilleur, temps, etc.)
 * @param {boolean} force - Si true, on écrase sans demander confirmation
 * @returns {Promise<boolean>} - true si synchro effectuée, false sinon
 */
export async function syncEvaluationToAdmin(classe, eleveId, testId, resultat, force = false) {
    if (!classe || !eleveId || !testId || !resultat) {
        console.warn('syncEvaluationToAdmin: paramètres manquants');
        return false;
    }

    const mapping = MAPPING[testId];
    if (!mapping) {
        console.warn(`syncEvaluationToAdmin: pas de mapping pour le test "${testId}"`);
        return false;
    }

    // Calculer la valeur à synchroniser
    let valeur = mapping.transform(resultat);
    if (valeur === undefined || valeur === null) {
        console.warn(`syncEvaluationToAdmin: valeur nulle pour ${testId}`, resultat);
        return false;
    }

    // Arrondi pour les décimaux
    if (typeof valeur === 'number' && !Number.isInteger(valeur)) {
        valeur = Math.round(valeur * 10) / 10;
    }

    // Récupérer la liste des élèves
    const eleves = getExistingEleves(classe);
    const eleve = eleves.find(e => e.id === eleveId);
    if (!eleve) {
        console.warn(`syncEvaluationToAdmin: élève ${eleveId} introuvable dans la classe ${classe}`);
        return false;
    }

    const champ = mapping.field;
    const valeurActuelle = eleve[champ];

    // Si même valeur, on ne fait rien
    if (valeurActuelle === valeur) {
        console.log(`syncEvaluationToAdmin: ${eleve.prenom} ${eleve.nom} - ${champ} déjà à ${valeur}`);
        return true;
    }

    // Si valeur actuelle existe et qu'on ne force pas, demander confirmation
    if (valeurActuelle !== undefined && valeurActuelle !== null && valeurActuelle !== '' && !force) {
        const libelles = {
            endurance: 'VMA (km/h)',
            force: 'Longueur (cm)',
            vitesse: 'Sprint 30m (s)',
            souplesse: 'Souplesse (cm)',
            equilibre: 'Équilibre (s)',
            coordination: 'Coordination (nb)',
            endurance_musculaire: 'Endurance musculaire (s)'
        };

        const libelle = libelles[testId] || champ;
        const confirmMsg = `⚠️ ${eleve.prenom} ${eleve.nom} a déjà une valeur pour "${libelle}" : ${valeurActuelle}.\nLa nouvelle valeur est : ${valeur}.\nVoulez-vous écraser ?`;

        if (!confirm(confirmMsg)) {
            console.log(`syncEvaluationToAdmin: synchro annulée pour ${eleve.prenom} ${eleve.nom} - ${champ}`);
            return false;
        }
    }

    // Mettre à jour
    eleve[champ] = valeur;
    saveEleves(classe, eleves);
    console.log(`✅ syncEvaluationToAdmin: ${eleve.prenom} ${eleve.nom} - ${champ} mis à jour → ${valeur}`);
    return true;
}

/**
 * Synchronise tous les résultats d'un élève pour une classe donnée
 * @param {string} classe - Nom de la classe
 * @param {string} eleveId - ID de l'élève
 * @param {object} dataEvaluation - Les données d'évaluation complètes
 * @param {boolean} force - Si true, on écrase sans demander confirmation
 */
export async function syncAllForEleve(classe, eleveId, dataEvaluation, force = false) {
    const eleveData = dataEvaluation.eleves[eleveId];
    if (!eleveData) return;

    const resultats = eleveData.resultats || {};
    let synchroEffectuee = false;

    for (const [testId, resultat] of Object.entries(resultats)) {
        if (resultat && resultat.groupe !== null) {
            const ok = await syncEvaluationToAdmin(classe, eleveId, testId, resultat, force);
            if (ok) synchroEffectuee = true;
        }
    }

    return synchroEffectuee;
}

/**
 * Synchronise tous les élèves d'une classe
 * @param {string} classe - Nom de la classe
 * @param {object} dataEvaluation - Les données d'évaluation complètes
 * @param {boolean} force - Si true, on écrase sans demander confirmation
 */
export async function syncAllForClass(classe, dataEvaluation, force = false) {
    const eleveIds = Object.keys(dataEvaluation.eleves);
    let totalSynchro = 0;

    for (const eleveId of eleveIds) {
        const ok = await syncAllForEleve(classe, eleveId, dataEvaluation, force);
        if (ok) totalSynchro++;
    }

    return totalSynchro;
}