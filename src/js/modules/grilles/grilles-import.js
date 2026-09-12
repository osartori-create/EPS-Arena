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

                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                // ✅ On passe le NOM DU FICHIER en priorité, la feuille en fallback
                const grille = parserGrille(rows, file.name, sheetName);

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
function parserGrille(rows, fileName, sheetName) {
    const lignes = rows.filter(r => r.some(cell => String(cell).trim() !== ''));
    if (lignes.length < 3) return null;

    const header = lignes[0];

    // Détecter les colonnes de niveaux
    const niveaux = [];
    for (let i = 1; i < header.length; i++) {
        const cell = String(header[i] || '').trim();
        const cellUpper = cell.toUpperCase();
        if (cell && (cellUpper.includes('MAÎTRISE') || cellUpper.includes('MAITRISE') || cellUpper.includes('EXCELLENT') || cellUpper.includes('INSATISFAISANT') || /^\d$/.test(cell))) {
            niveaux.push({ colIndex: i, header: cell });
        }
    }

    if (niveaux.length < 4) {
        niveaux.length = 0;
        for (let i = header.length - 4; i < header.length; i++) {
            niveaux.push({ colIndex: i, header: String(header[i] || `Niveau ${i - header.length + 5}`) });
        }
    }

    const niveauxParses = niveaux.slice(-4).map((n, idx) => {
        const valeur = 4 - idx;
        const headerLower = n.header.toLowerCase();
        let label;
        if (headerLower.includes('très') || headerLower.includes('tres') || headerLower.includes('excellent')) {
            label = 'TRÈS BONNE MAÎTRISE';
        } else if (headerLower.includes('satisfaisant')) {
            label = 'MAÎTRISE SATISFAISANTE';
        } else if (headerLower.includes('fragile')) {
            label = 'MAÎTRISE FRAGILE';
        } else if (headerLower.includes('insuffisant')) {
            label = 'MAÎTRISE INSUFFISANTE';
        } else {
            label = `Niveau ${valeur}`;
        }
        return { valeur, label, colIndex: n.colIndex };
    });

    // Critères
    const criteres = [];
    for (let i = 1; i < lignes.length; i++) {
        const row = lignes[i];
        const nomCell = String(row[0] || '').trim();
        if (!nomCell) continue;

        const pondMatch = nomCell.match(/(\d+)\s*%/);
        const ponderation = pondMatch ? parseInt(pondMatch[1]) : 0;
        const nom = nomCell.replace(/\s*\d+\s*%\s*$/, '').trim();

        const descripteurs = niveauxParses.map(n => {
            const cell = String(row[n.colIndex] || '').trim();
            return { valeur: n.valeur, descripteur: cell };
        });

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

    // ✅ Détection depuis le NOM DU FICHIER (priorité) puis la feuille (fallback)
    const infoFichier = parserNomFichier(fileName) || parserNomFichier(sheetName) || { activite: 'autre', niveau: 'C4' };

    const grille = {
        id: genererIdGrille(infoFichier.activite, infoFichier.niveau),
        activite: infoFichier.activite,
        niveau: infoFichier.niveau,
        titre: infoFichier.titreComplet,
        dateCreation: Date.now(),
        dateImport: Date.now(),
        figee: false,
        periodes: ['Début', 'Milieu', 'Fin'],
        criteres: criteres
    };

    return grille;
}

/**
 * Parse le nom du fichier (ou de la feuille) pour extraire activité + niveau.
 * Ex : "Rubrique_-_ badminton_4e.xlsx" → { activite: "badminton", niveau: "4e" }
 * Ex : "Rubrique_-_Escalade_C3.xlsx" → { activite: "escalade", niveau: "C3" }
 */
function parserNomFichier(nom) {
    if (!nom) return null;

    // Enlever l'extension
    let n = nom.replace(/\.(xlsx?|XLSX?|csv|CSV)$/, '');

    // Enlever le préfixe "Rubrique_-_" ou similaire
    n = n.replace(/^[Rr]ubrique[-_ ]*/i, '');

    // Remplacer les underscores/tirets par des espaces (sauf pour les patterns C4, 4e, etc.)
    n = n.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Détecter le niveau (C1-C5 ou 3e-6e)
    const niveauMatch = n.match(/\b(C[1-5]|[3-6]e|[3-6]ème)\b/i);
    let niveau = 'C4';
    if (niveauMatch) {
        niveau = niveauMatch[1];
        // Normaliser : "6ème" → "6e"
        if (niveau.toLowerCase().endsWith('ème')) {
            niveau = niveau.replace(/ème/i, 'e');
        }
    }

    // Enlever le niveau du nom pour isoler l'activité
    let activite = n.replace(/\b(C[1-5]|[3-6]e|[3-6]ème)\b/i, '').trim();
    // Enlever les mots parasites ("sur 10s", "vitesse", etc.)
    activite = activite.replace(/\b(sur|vitesse|vitesses|relais)\b.*/i, '').trim();
    activite = activite.split(' ')[0]; // premier mot restant

    activite = activite.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Mapping vers les identifiants standard
    const map = {
        'badminton': 'badminton',
        'escalade': 'escalade',
        'arcathlon': 'arcathlon',
        'hand': 'hand',
        'demifond': 'demi_fond',
        'demif': 'demi_fond',
        'natation': 'natation',
        'relais': 'relais',
        'co': 'co',
        'courseorientation': 'co',
        'volley': 'volley'
    };
    activite = map[activite] || activite;

    // Construire un titre propre
    let titreComplet = n.replace(/\s+/g, ' ').trim();
    // Capitaliser première lettre
    titreComplet = titreComplet.charAt(0).toUpperCase() + titreComplet.slice(1);

    return { activite, niveau, titreComplet };
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