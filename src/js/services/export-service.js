// src/js/services/export-service.js
// Service centralisé d'export (iDoceo + Excel)
//
// ════════════════════════════════════════════════════════════
//  CONVENTIONS EPS-ARENA (à respecter pour tout nouveau module)
// ════════════════════════════════════════════════════════════
//
//  Export iDoceo (CSV) :
//   • Identité : !Nom ; !Prénom  (préfixe "!" OBLIGATOIRE pour le matching)
//   • Données  : AUCUN préfixe (iDoceo détecte nombre vs texte)
//   • Séparateur : ";"  |  BOM UTF-8 obligatoire
//
//  Export Excel (XLSX) :
//   • Utilisé pour les activités "par match" (badminton, relais, tournoi)
//   • Multi-feuilles possible (ex: Matchs + Classement)
//   • Aucune contrainte de préfixe
// ════════════════════════════════════════════════════════════

const XLSX = window.XLSX;

// ============================================================
// CONVENTIONS
// ============================================================
export const IDENTITE = {
    nom: '!Nom',
    prenom: '!Prénom'
};

// ============================================================
// HELPERS DE COLONNES
// ============================================================

/**
 * Renvoie les colonnes d'identité standard (à placer en tête)
 * → [{ nom: '!Nom', cle: 'nom' }, { nom: '!Prénom', cle: 'prenom' }]
 */
export function colonnesIdentite() {
    return [
        { nom: IDENTITE.nom,    cle: 'nom' },
        { nom: IDENTITE.prenom, cle: 'prenom' }
    ];
}

/**
 * Raccourci pour déclarer une colonne de données (sans préfixe)
 */
export function col(nom, cle) {
    return { nom, cle };
}

// ============================================================
// GÉNÉRATION CSV (bas niveau)
// ============================================================

export function genererCSV(colonnes, donnees, options = {}) {
    const separateur = options.separateur || ';';
    const avecBOM = options.bom !== undefined ? options.bom : true;

    let csv = '';
    if (avecBOM) csv += '\uFEFF';
    csv += colonnes.map(c => `"${c.nom}"`).join(separateur) + '\n';

    donnees.forEach(ligne => {
        const row = colonnes.map(c => {
            const valeur = ligne[c.cle] !== undefined && ligne[c.cle] !== null ? ligne[c.cle] : '';
            return `"${String(valeur).replace(/"/g, '""')}"`;
        });
        csv += row.join(separateur) + '\n';
    });

    return csv;
}

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

// ============================================================
// NOM DE FICHIER STANDARD
// ============================================================
function nomFichierStandard(nomModule, classe, extension) {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    return `EPS-Arena_${nomModule}_${classe}_${dateStr}.${extension}`;
}

// ============================================================
// EXPORT iDoceo (CSV) — API haut niveau
// ============================================================
/**
 * @param {string} nomModule   - ex: 'Evaluation', 'Natation', 'Escalade'
 * @param {string} classe      - ex: '506'
 * @param {Array}  colonnes    - [{ nom, cle }]
 * @param {Array}  donnees     - [{ cle: valeur, ... }]
 */
export function exporterVersIDoceo(nomModule, classe, colonnes, donnees) {
    const csv = genererCSV(colonnes, donnees);
    const nomFichier = nomFichierStandard(nomModule, classe, 'csv').replace(/\.csv$/, '');
    telechargerCSV(csv, nomFichier);
    console.log(`📥 Export iDoceo : ${nomFichier}.csv (${colonnes.length} colonnes, ${donnees.length} lignes)`);
}

// ============================================================
// EXPORT EXCEL (XLSX) — API haut niveau
// ============================================================
/**
 * @param {string} nomModule  - ex: 'Badminton', 'Relais', 'Tournoi'
 * @param {string} classe     - ex: '506'
 * @param {Array}  feuilles   - [{ nom: 'Matchs', colonnes: [{nom, cle}], donnees: [{...}] }, ...]
 */
export function exporterVersExcel(nomModule, classe, feuilles) {
    if (!XLSX) {
        alert('❌ SheetJS non chargé — vérifie que libs/xlsx.full.min.js est bien inclus dans maitre.html');
        return;
    }

    const wb = XLSX.utils.book_new();

    feuilles.forEach(feuille => {
        // Construction du tableau [entêtes, ...lignes]
        const entetes = feuille.colonnes.map(c => c.nom);
        const lignes = feuille.donnees.map(ligne =>
            feuille.colonnes.map(c => ligne[c.cle] ?? '')
        );
        const aoa = [entetes, ...lignes];

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Largeurs de colonnes automatiques (approx)
        ws['!cols'] = feuille.colonnes.map(c => ({ wch: Math.max(12, c.nom.length + 2) }));

        XLSX.utils.book_append_sheet(wb, ws, feuille.nom || 'Feuille');
    });

    const nomFichier = nomFichierStandard(nomModule, classe, 'xlsx');
    XLSX.writeFile(wb, nomFichier);
    console.log(`📥 Export Excel : ${nomFichier} (${feuilles.length} feuille(s))`);
}

// ============================================================
// HELPERS HAUT NIVEAU (pour simplifier la vie des modules)
// ============================================================

/**
 * Export iDoceo prêt à l'emploi pour un module "notes par élève"
 * @param {string} nomModule
 * @param {string} classe
 * @param {Array}  lignes      - [{ nom, prenom, donnees: { cle1: v1, cle2: v2, ... } }]
 * @param {Array}  colonnesDonnees - [{ nom, cle }]  (SANS les colonnes identité)
 */
export function exporterNotesEleves(nomModule, classe, lignes, colonnesDonnees) {
    const colonnes = [
        ...colonnesIdentite(),
        ...colonnesDonnees
    ];

    const donnees = lignes.map(l => ({
        nom: l.nom || '',
        prenom: l.prenom || '',
        ...l.donnees
    }));

    exporterVersIDoceo(nomModule, classe, colonnes, donnees);
}

// ============================================================
// ANCIENNE API (compatibilité)
// ============================================================
/** @deprecated Utiliser colonnesIdentite() + col() et exporterVersIDoceo() */
export function exporterVersIDoceoLegacy() {
    console.warn('[export-service] API legacy appelée. Migrer vers les nouveaux helpers.');
}