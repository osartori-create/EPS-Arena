// src/js/services/export-service.js

/**
 * Service centralisé d'export iDoceo
 * Tous les modules utilisent ce service pour garantir un format uniforme
 */

/**
 * Génère un fichier CSV compatible iDoceo
 * @param {Array} colonnes - Liste des colonnes avec leurs noms et clés
 *   Ex: [{ nom: '!groupe', cle: 'numero' }, { nom: '!Nom', cle: 'nom' }]
 * @param {Array} donnees - Liste des objets contenant les données
 * @param {Object} options - Options (separateur: ';' ou ',', bom: true/false)
 * @returns {string} - Le contenu CSV
 */
export function genererCSV(colonnes, donnees, options = {}) {
    const separateur = options.separateur || ';';
    const avecBOM = options.bom !== undefined ? options.bom : true;

    // 1. En-tête
    let csv = '';
    if (avecBOM) csv += '\uFEFF';
    csv += colonnes.map(c => `"${c.nom}"`).join(separateur) + '\n';

    // 2. Données
    donnees.forEach(ligne => {
        const row = colonnes.map(c => {
            const valeur = ligne[c.cle] !== undefined && ligne[c.cle] !== null ? ligne[c.cle] : '';
            // Échapper les guillemets
            return `"${String(valeur).replace(/"/g, '""')}"`;
        });
        csv += row.join(separateur) + '\n';
    });

    return csv;
}

/**
 * Télécharge un fichier CSV
 * @param {string} csv - Le contenu CSV
 * @param {string} nomFichier - Le nom du fichier (sans extension)
 */
export function telechargerCSV(csv, nomFichier) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${nomFichier}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

/**
 * Export standardisé vers iDoceo
 * @param {string} nomModule - Nom du module (pour le nom du fichier)
 * @param {string} classe - Nom de la classe
 * @param {Array} colonnes - Liste des colonnes
 * @param {Array} donnees - Liste des données
 * @param {Object} options - Options supplémentaires
 */
export function exporterVersIDoceo(nomModule, classe, colonnes, donnees, options = {}) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const nomFichier = `${nomModule}_${classe}_${date}`;
    const csv = genererCSV(colonnes, donnees, options);
    telechargerCSV(csv, nomFichier);
}