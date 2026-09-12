// src/js/modules/grilles/grilles-import.js
// Import d'une grille XLSX via SheetJS
// Détecte automatiquement : critères, niveaux, pondérations, descripteurs

import { genererIdGrille } from './grilles-core.js';

const XLSX = window.XLSX;

/**
 * Importe un fichier XLSX et retourne une grille parsée.
 * @param {File} file
 * @returns {Promise<Object>} grille
 */
export function importerGrilleXLSX(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Prendre la 1ère feuille
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Convertir en tableau 2D
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                const grille = parserGrille(rows, sheetName);

                if (!grille) {
                    reject(new Error('Format de grille non reconnu.'));
                    return;
                }

                resolve(grille);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parse le contenu d'une feuille en grille structurée.
 */
function parserGrille(rows, sheetName) {
    // Filtrer les lignes vides
    const lignes = rows.filter(r => r.some(cell => String(cell).trim() !== ''));
    if (lignes.length < 3) return null;

    // Ligne 1 (index 0) : en-tête des niveaux
    const header = lignes[0];

    // Détecter les colonnes de niveaux (doit contenir "MAÎTRISE" ou des chiffres)
    // On suppose que les 4 dernières colonnes sont les niveaux
    const niveaux = [];
    for (let i = 1; i < header.length; i++) {
        const cell = String(header[i] || '').trim();
        if (cell && (cell.includes('MAÎTRISE') || cell.includes('MAITRISE') || /^\d$/.test(cell))) {
            niveaux.push({ colIndex: i, header: cell });
        }
    }

    // Fallback : 4 dernières colonnes
    if (niveaux.length < 4) {
        niveaux.length = 0;
        for (let i = header.length - 4; i < header.length; i++) {
            niveaux.push({ colIndex: i, header: String(header[i] || `Niveau ${i - header.length + 5}`) });
        }
    }

    // Extraire les valeurs numériques des niveaux (4, 3, 2, 1) depuis le header
    const niveauxParses = niveaux.slice(-4).map((n, idx) => {
        const match = n.header.match(/(\d)/);
        const valeur = match ? parseInt(match[1]) : (4 - idx);
        // Extraire le libellé (avant le <br> ou le retour ligne)
        const label = n.header.split(/\n|<br>/)[0].trim() || `Niveau ${valeur}`;
        return { valeur, label, colIndex: n.colIndex };
    });

    // Critères : lignes suivantes (index 1 à n)
    const criteres = [];
    for (let i = 1; i < lignes.length; i++) {
        const row = lignes[i];
        const nomCell = String(row[0] || '').trim();
        if (!nomCell) continue;

        // Détecter la pondération dans le nom (ex: "20%")
        const pondMatch = nomCell.match(/(\d+)\s*%/);
        const ponderation = pondMatch ? parseInt(pondMatch[1]) : 0;

        // Nettoyer le nom (retirer la pondération et les retours ligne)
        const nom = nomCell.replace(/\s*\d+\s*%\s*$/, '').trim();

        // Extraire les descripteurs pour chaque niveau
        const descripteurs = niveauxParses.map(n => {
            const cell = String(row[n.colIndex] || '').trim();
            return { valeur: n.valeur, descripteur: cell };
        });

        // Détecter le type (auto si un connecteur existe, sinon prof)
        const type = detecterTypeCritere(nom);

        criteres.push({
            id: nom.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40),
            nom: nom,
            ponderation: ponderation,
            type: type,
            niveaux: descripteurs
        });
    }

    if (criteres.length === 0) return null;

    // Détecter le niveau C3/C4 ou 6e/5e/4e/3e depuis le nom de la feuille
    const niveauMatch = sheetName.match(/\b(C[1-5]|[3-6]e|6ème|5ème|4ème|3ème)\b/i);
    const niveau = niveauMatch ? niveauMatch[1] : 'C4';

    // Détecter l'activité depuis le nom de la feuille
    const activite = detecterActivite(sheetName);

    const grille = {
        id: genererIdGrille(activite, niveau),
        activite: activite,
        niveau: niveau,
        titre: sheetName,
        dateCreation: Date.now(),
        dateImport: Date.now(),
        figee: false,
        periodes: ['Début', 'Milieu', 'Fin'],
        criteres: criteres
    };

    return grille;
}

/**
 * Détecte l'activité à partir du nom de la feuille.
 */
function detecterActivite(nom) {
    const n = nom.toLowerCase();
    if (n.includes('relais')) return 'relais';
    if (n.includes('arcathlon')) return 'arcathlon';
    if (n.includes('escalade')) return 'escalade';
    if (n.includes('badminton')) return 'badminton';
    if (n.includes('hand')) return 'hand';
    if (n.includes('demi') || n.includes('fond')) return 'demi_fond';
    if (n.includes('natation')) return 'natation';
    return 'autre';
}

/**
 * Détecte si un critère est auto-remplissable.
 */
function detecterTypeCritere(nomCritere) {
    const n = nomCritere.toLowerCase();
    // Critères "auto" possibles
    if (n.includes('performance') && n.includes('donneur')) return 'auto';
    if (n.includes('performance') && n.includes('tir')) return 'auto';
    if (n.includes('projet')) return 'auto';
    if (n.includes('allure')) return 'auto';
    if (n.includes('grimpeur')) return 'auto';
    if (n.includes('badiste')) return 'auto';
    if (n.includes('coureur')) return 'auto';
    // Sinon prof
    return 'prof';
}