// src/js/modules/cross/cross-import.js
// Import CSV iDoceo établissement + import Excel dossards

import {
    setClassesParticipantes, getClassesParticipantes,
    getDossards, setDossards,
    getExistingElevesCross, saveElevesCross, migrerCodesAutoEvalCross,
    getStatutsCross, setStatutsCross
} from './cross-config.js';

const Papa = window.Papa;
const XLSX = window.XLSX;

// ============================================================
// IMPORT CSV ÉTABLISSEMENT (tout l'établissement, groupé par @group)
// ============================================================
/**
 * Parse un CSV iDoceo contenant tous les élèves.
 * Pour chaque @group détecté, écrit dans l'espace isolé du CROSS
 * (``eps_arena_cross_eleves_{classe}``), jamais dans les clés partagées
 * de l'administration (``eps_arena_eleves_{classe}``).
 * N'affecte PAS la liste ``eps_arena_classes`` du prof.
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
                    // On part des élèves déjà existants pour cette classe (dans
                    // l'espace isolé du CROSS) pour ne pas les écraser.
                    const existants = getExistingElevesCross(classe);
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
                    saveElevesCross(classe, finalList);
                    // Attribution des codes auto-éval manquants
                    migrerCodesAutoEvalCross(classe);

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

                    const eleves = getExistingElevesCross(classe);
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
// IMPORT EXCEL « LISTE ÉLÈVES » (Division + VMA + remarques)
// ============================================================
/**
 * Importe le fichier Excel type Pronote/EDS exporté avec, a minima, les
 * colonnes :
 *   Division, Nom de famille, Prénom 1, Sexe, VMA,
 *   (optionnellement) Remarque 1, Remarque 2, Remarque libre.
 *
 * - Les élèves sont rangés dans l'espace ISOLÉ du CROSS.
 * - Un élève dont les remarques contiennent « INAPTE » / « DISPENSÉ »
 *   est marqué ``inapte`` (statut du CROSS).
 * - Les VMA sont copiées sur la fiche de l'élève.
 */
export function importExcelListeEleves(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const nomFeuille = wb.SheetNames.find(n => /liste/i.test(n)) || wb.SheetNames[0];
                const sheet = wb.Sheets[nomFeuille];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                if (!rows || rows.length < 2) {
                    reject(new Error('Feuille introuvable ou vide.'));
                    return;
                }

                // Recherche des indices de colonnes à partir de la ligne d'en-tête.
                const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
                const findIdx = (aliases) => {
                    for (const a of aliases) {
                        const i = headers.findIndex(h => h === a || h.includes(a));
                        if (i >= 0) return i;
                    }
                    return -1;
                };

                const idxDivision = findIdx(['division', 'classe']);
                const idxNom      = findIdx(['nom de famille', 'nom', 'lastname', 'name_last']);
                const idxPrenom   = findIdx(['prénom 1', 'prenom 1', 'prénom', 'prenom', 'firstname', 'name_first']);
                const idxSexe     = findIdx(['sexe', 'sex', 'gender', 'm/f']);
                const idxVma      = findIdx(['vma', 'vmax']);
                const idxRem1     = findIdx(['remarque 1', 'remarque1']);
                const idxRem2     = findIdx(['remarque 2', 'remarque2']);
                const idxRemLibre = findIdx(['remarque libre', 'remarquelibre']);

                if (idxDivision < 0 || idxNom < 0 || idxPrenom < 0) {
                    reject(new Error('Colonnes attendues non trouvées. Sont requises : Division, Nom de famille, Prénom 1.'));
                    return;
                }

                // IDs déjà connus dans l'espace isolé CROSS pour éviter les doublons.
                const usedIds = new Set();
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('eps_arena_cross_eleves_')) {
                        getExistingElevesCross(k.replace('eps_arena_cross_eleves_', '')).forEach(el => usedIds.add(el.id));
                    }
                }

                const parClasse = {};
                for (let r = 1; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row) continue;

                    const classe = String(row[idxDivision] || '').trim();
                    const nom    = String(row[idxNom] || '').trim();
                    const prenom = String(row[idxPrenom] || '').trim();
                    if (!classe || !nom || !prenom) continue;

                    const sexeRaw = String(row[idxSexe] || '').trim().toUpperCase();
                    const vma     = parseFloat(row[idxVma]) || 0;
                    const rem1    = String(row[idxRem1] || '').trim();
                    const rem2    = String(row[idxRem2] || '').trim();
                    const remLibre = String(row[idxRemLibre] || '').trim();

                    let sexe = '';
                    if (sexeRaw === 'M' || sexeRaw.startsWith('MASC') || sexeRaw === 'GARCON' || sexeRaw === 'HOMME' || sexeRaw === 'H') sexe = 'M';
                    else if (sexeRaw === 'F' || sexeRaw.startsWith('FEM') || sexeRaw.startsWith('FÉM') || sexeRaw === 'FILLE' || sexeRaw === 'FEMME') sexe = 'F';

                    const remarques = `${rem1} ${rem2} ${remLibre}`.toUpperCase();
                    const inapte = remarques.includes('INAPTE') || remarques.includes('DISPENSÉ') || remarques.includes('DISPENSE');

                    if (!parClasse[classe]) parClasse[classe] = [];
                    parClasse[classe].push({ nom, prenom, sexe, vma, rem1, rem2, remLibre, inapte });
                }

                const statuts = getStatutsCross();
                const nouveauStatuts = { ...statuts };
                let totalEleves = 0;
                let doublonsSurVol = 0;
                let vmaConservees = 0;

                Object.entries(parClasse).forEach(([classe, elevesRows]) => {
                    const existants = getExistingElevesCross(classe);
                    const mapByName = {};
                    existants.forEach(el => {
                        mapByName[cleNomPrenom(el.nom, el.prenom)] = el;
                    });

                    elevesRows.forEach(r => {
                        const cle = cleNomPrenom(r.nom, r.prenom);
                        let eleve = mapByName[cle];

                        if (!eleve) {
                            // Anti-doublon : même si le nom n'est pas exactement identique,
                            // on regarde aussi si un ID normalisé identique existe déjà.
                            const base = normalizeId(r.nom, r.prenom);
                            eleve = existants.find(el => el.id === base) || null;
                            if (!eleve) {
                                const id = creerIdUnique(base, usedIds);
                                eleve = {
                                    id,
                                    nom: r.nom,
                                    prenom: r.prenom,
                                    sexe: r.sexe,
                                    dateNaissance: '',
                                    vma: 0,
                                    palier: 0,
                                    longueur: null,
                                    sprint30: null,
                                    force: 0,
                                    commentaire: ''
                                };
                                existants.push(eleve);
                            } else {
                                doublonsSurVol++;
                            }
                            mapByName[cle] = eleve;
                        }

                        // Une VMA vide dans le fichier ne DOIT PAS écraser une VMA déjà saisie.
                        if (r.vma > 0) {
                            eleve.vma = r.vma;
                        } else if ((eleve.vma || 0) > 0) {
                            vmaConservees++;
                        }

                        if (r.sexe && !eleve.sexe) eleve.sexe = r.sexe;
                        if (r.rem1 || r.rem2 || r.remLibre) {
                            eleve.commentaire = [r.rem1, r.rem2, r.remLibre].filter(Boolean).join(' — ');
                        }

                        if (r.inapte) nouveauStatuts[eleve.id] = 'inapte';
                    });

                    saveElevesCross(classe, existants);
                    migrerCodesAutoEvalCross(classe);
                    totalEleves += existants.length;
                });

                setStatutsCross(nouveauStatuts);

                const classesActuelles = getClassesParticipantes();
                const nouvelles = Array.from(new Set([...classesActuelles, ...Object.keys(parClasse)]));
                setClassesParticipantes(nouvelles);

                const nbInaptes = Object.values(nouveauStatuts).filter(s => s === 'inapte').length;
                resolve({ classes: parClasse, totalEleves, nbInaptes, doublonsSurVol, vmaConservees });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
        reader.readAsArrayBuffer(file);
    });
}

function cleNomPrenom(nom, prenom) {
    return `${normaliserNom(nom)}_${normaliserNom(prenom)}`.toUpperCase();
}

function creerIdUnique(base, usedIds) {
    let id = base;
    let suffixe = 1;
    while (usedIds.has(id)) {
        id = `${base}${suffixe}`;
        suffixe++;
    }
    usedIds.add(id);
    return id;
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
    const statuts = getStatutsCross();
    const sansDossard = [];
    const elevesParId = {};
    const vus = new Set();

    classesParticipantes.forEach(classe => {
        const eleves = getExistingElevesCross(classe);
        eleves.forEach(e => {
            if (vus.has(e.id)) return;
            vus.add(e.id);

            // Les absents ne reçoivent pas de dossard.
            const statut = statuts[e.id] || 'present';
            if (statut === 'absent') return;

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