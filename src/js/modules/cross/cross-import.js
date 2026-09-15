// src/js/modules/cross/cross-import.js
// Import CSV iDoceo établissement + import Excel dossards

import { saveEleves, getExistingEleves, migrerCodesAutoEval } from '../../services/admin-service.js';
import {
    KEYS, setClassesParticipantes, getClassesParticipantes,
    getDossards, setDossards, setDossardPourEleve
} from './cross-config.js';

const Papa = window.Papa;
const XLSX = window.XLSX;

// ============================================================
// IMPORT CSV ÉTABLISSEMENT (tout l'établissement, groupé par @group)
// ============================================================
/**
 * Parse un CSV iDoceo contenant tous les élèves.
 * Pour chaque @group détecté, écrit dans eps_arena_eleves_{classe}.
 * N'affecte PAS la liste eps_arena_mes_classes du prof.
 * @param {File} file
 * @returns {Promise<{classes: Object, totalEleves: number}>}
 */
export function importCSVEtablissement(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const sep = csv.includes(';') ? ';' : ',';
                const result = Papa.parse(csv, {
                    delimiter: sep,
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (h) => h.trim()
                });
                if (result.errors.length > 0 && result.data.length === 0) {
                    reject(new Error('CSV illisible : ' + result.errors[0].message));
                    return;
                }

                // Regroupement par @group
                const parClasse = {};
                result.data.forEach(row => {
                    const classe = (row['@group'] || '').trim();
                    if (!classe) return;
                    if (!parClasse[classe]) parClasse[classe] = [];
                    parClasse[classe].push(row);
                });

                let totalEleves = 0;
                const rapport = {};

                Object.entries(parClasse).forEach(([classe, rows]) => {
                    // On part des élèves déjà existants pour cette classe (si le prof
                    // l'a déjà importée via le flux normal) pour ne pas les écraser.
                    const existants = getExistingEleves(classe);
                    const mapExistants = {};
                    existants.forEach(e => { mapExistants[e.id] = e; });

                    rows.forEach(row => {
                        const prenom = (row['@name'] || '').trim();
                        const nom    = (row['@lastname'] || '').trim();
                        const sexe   = (row['@sexe'] || '').trim().toUpperCase();
                        const date   = (row['@birthday'] || '').trim();
                        const vma    = parseFloat(row['@VMA (km/h)']) || 0;
                        const palier = parseFloat(row['@Endurance (palier)']) || 0;

                        if (!prenom || !nom) return;

                        const id = normalizeId(nom, prenom);
                        const eleve = mapExistants[id] || {
                            id,
                            nom, prenom, sexe,
                            dateNaissance: date,
                            vma: 0, palier: 0,
                            longueur: null, sprint30: null, force: 0
                        };
                        if (vma > 0) eleve.vma = vma;
                        if (palier > 0) eleve.palier = palier;
                        if (sexe) eleve.sexe = sexe;
                        mapExistants[id] = eleve;
                    });

                    const finalList = Object.values(mapExistants);
                    saveEleves(classe, finalList);
                    // Attribution des codes auto-éval manquants
                    migrerCodesAutoEval(classe);

                    rapport[classe] = finalList.length;
                    totalEleves += finalList.length;
                });

                // Met à jour la liste des classes participantes
                const classesActuelles = getClassesParticipantes();
                const nouvelles = Array.from(new Set([...classesActuelles, ...Object.keys(parClasse)]));
                setClassesParticipantes(nouvelles);

                resolve({ classes: rapport, totalEleves });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
        reader.readAsText(file);
    });
}

function normalizeId(nom, prenom) {
    const clean = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
    return `${clean(nom)}_${clean(prenom).charAt(0)}`;
}

// ============================================================
// IMPORT EXCEL DOSSARDS (fichier de publipostage)
// ============================================================
/**
 * Lit un fichier Excel au format "dossards" et associe automatiquement les
 * dossards aux élèves par nom+prénom+classe.
 *
 * Structure attendue :
 * - Feuille "dossards" (ou 1ère feuille)
 * - Colonne A : n° séquence (dossard)
 * - Colonne B : code division (classe)
 * - Colonne C : sexe
 * - Colonne D : nom
 * - Colonne E : prénom
 */
export function importExcelDossards(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const sheetName = wb.SheetNames.includes('dossards') ? 'dossards' : wb.SheetNames[0];
                const sheet = wb.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                // Sauter l'en-tête (ligne 1)
                const body = rows.slice(1).filter(r => r[0] !== '' && r[0] != null);

                let associes = 0;
                let ignores = 0;
                const mapDossards = getDossards();

                body.forEach(row => {
                    const dossard = String(row[0]).trim();
                    const classe  = String(row[1]).trim();
                    const nom     = String(row[3] || '').trim();
                    const prenom  = String(row[4] || '').trim();

                    if (!dossard || !nom || !prenom || !classe) { ignores++; return; }

                    const eleves = getExistingEleves(classe);
                    const id = normalizeId(nom, prenom);
                    const eleve = eleves.find(el => el.id === id);
                    if (!eleve) { ignores++; return; }

                    mapDossards[dossard] = eleve.id;
                    associes++;
                });

                setDossards(mapDossards);

                resolve({ associes, ignores });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier Excel.'));
        reader.readAsArrayBuffer(file);
    });
}

// ============================================================
// GÉNÉRATION AUTOMATIQUE DES DOSSARDS
// ============================================================
/**
 * Attribue des dossards à tous les élèves sans dossard, dans l'ordre alphabétique
 * global (classe puis nom+prénom).
 * @returns {{attribues: number, premier: number, dernier: number}}
 */
export function genererDossardsAuto(classesParticipantes) {
    const mapDossards = getDossards();
    const sansDossard = [];
    const elevesParId = {};
    const vus = new Set();

    classesParticipantes.forEach(classe => {
        const eleves = getExistingEleves(classe);
        eleves.forEach(e => {
            if (vus.has(e.id)) return;
            vus.add(e.id);
            elevesParId[e.id] = { ...e, classe };
            // L'élève a-t-il déjà un dossard ?
            const aUnDossard = Object.values(mapDossards).includes(e.id);
            if (!aUnDossard) sansDossard.push(e.id);
        });
    });

    sansDossard.sort((a, b) => {
        const eA = elevesParId[a], eB = elevesParId[b];
        if (eA.classe !== eB.classe) return eA.classe.localeCompare(eB.classe);
        const nA = `${eA.nom} ${eA.prenom}`.toUpperCase();
        const nB = `${eB.nom} ${eB.prenom}`.toUpperCase();
        return nA.localeCompare(nB);
    });

    // Prochain dossard libre
    let prochain = 1;
    while (mapDossards[String(prochain)]) prochain++;

    const premier = prochain;
    sansDossard.forEach(eleveId => {
        mapDossards[String(prochain)] = eleveId;
        prochain++;
    });
    setDossards(mapDossards);

    return {
        attribues: sansDossard.length,
        premier,
        dernier: prochain - 1
    };
}