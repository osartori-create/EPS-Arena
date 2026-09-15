// src/js/modules/grilles/grilles-export.js
// Export iDoeceo (2 formats : notes + rubrique)

import { getExistingEleves } from '../../services/admin-service.js';
import { colonnesIdentite, col, exporterVersIDoceo as exporterService } from '../../services/export-service.js';

const XLSX = window.XLSX;

/**
 * Export "notes iDoeceo" : notes détaillées + note finale
 */
export function exporterNotesIDoceo(grille, evaluations, classe, periode) {
    const eleves = getExistingEleves(classe);
    eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    const eleveData = evaluations[periode] || {};

    const lignes = eleves.map(e => {
        const notes = eleveData[e.id]?.notes || {};
        const noteFinale = calculerNotePourEleve(notes, grille.criteres);

        const donnees = {};
        grille.criteres.forEach(c => {
            const cle = `crit_${c.id}`;
            donnees[cle] = notes[c.id] !== undefined ? notes[c.id] : '';
        });
        donnees.noteSur100 = noteFinale.sur100 !== null ? noteFinale.sur100 : '';
        donnees.noteSur20 = noteFinale.sur20 !== null ? noteFinale.sur20 : '';

        return { nom: e.nom, prenom: e.prenom, donnees };
    });

    const colonnesDonnees = [
        ...grille.criteres.map(c => col(c.nom, `crit_${c.id}`)),
        col('Note /100', 'noteSur100'),
        col('Note /20', 'noteSur20')
    ];

    const donnees = lignes.map(l => ({ nom: l.nom, prenom: l.prenom, ...l.donnees }));
    const nomModule = `Grille_${grille.activite}_${grille.niveau}`;
    exporterService(nomModule, classe, [...colonnesIdentite(), ...colonnesDonnees], donnees);
}

/**
 * Export "rubrique iDoeceo" : structure de la rubrique pour import
 */
export function exporterRubriqueIDoceo(grille, evaluations, classe, periode) {
    const eleves = getExistingEleves(classe);
    eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    const eleveData = evaluations[periode] || {};

    // Format rubrique : 1ère colonne = nom élève, puis 1 colonne par critère
    const headers = ['Nom'];
    grille.criteres.forEach(c => headers.push(c.nom));

    const rows = [headers];

    eleves.forEach(e => {
        const notes = eleveData[e.id]?.notes || {};
        const row = [`${e.nom} ${e.prenom}`];

        grille.criteres.forEach(c => {
            row.push(notes[c.id] !== undefined ? notes[c.id] : '');
        });

        rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rubrique');

    const filename = `Rubrique_${grille.activite}_${grille.niveau}_${periode}_${classe}.xlsx`;
    XLSX.writeFile(wb, filename);
}

/**
 * Export XLSX d'une grille vierge (pour édition)
 */
export function exporterGrilleVierge(grille) {
    const rows = [];

    // En-tête : niveaux
    const header = ['', ...grille.criteres[0]?.niveaux.map(n => `${n.label}\n${n.valeur}`) || []];
    rows.push(header);

    // Critères
    grille.criteres.forEach(c => {
        const row = [`${c.nom}${c.ponderation ? ` ${c.ponderation}%` : ''}`];
        c.niveaux.forEach(n => row.push(n.descripteur));
        rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, grille.titre || 'Grille');

    const filename = `Grille_${grille.activite}_${grille.niveau}.xlsx`;
    XLSX.writeFile(wb, filename);
}

// Utilitaire interne (copié de grilles-core pour éviter les imports circulaires)
function calculerNotePourEleve(notes, criteres) {
    let total = 0;
    let totalPonderation = 0;

    criteres.forEach(c => {
        const val = notes[c.id];
        if (val === undefined || val === null) return;
        const poids = c.ponderation > 0 ? c.ponderation : (100 / criteres.length);
        total += val * poids;
        totalPonderation += poids;
    });

    if (totalPonderation === 0) return { sur100: null, sur20: null };

    const noteSur100 = (total / totalPonderation) * 25;
    const noteSur20 = noteSur100 / 5;

    return {
        sur100: Math.round(noteSur100 * 10) / 10,
        sur20: Math.round(noteSur20 * 10) / 10
    };
}