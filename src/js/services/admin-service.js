// src/js/services/admin-service.js
// Gestion des photos et des élèves

const Papa = window.Papa;
const JSZip = window.JSZip;

let dbPhotos;
const request = indexedDB.open("EPS_Arena_LocalDB", 1);
request.onupgradeneeded = e => {
    dbPhotos = e.target.result;
    if (!dbPhotos.objectStoreNames.contains("eleves")) {
        dbPhotos.createObjectStore("eleves", { keyPath: "id" });
    }
};
request.onsuccess = e => { dbPhotos = e.target.result; };

function savePhoto(id, blob) {
    if (!dbPhotos) return;
    const tx = dbPhotos.transaction("eleves", "readwrite");
    tx.objectStore("eleves").put({ id, blob });
}

async function getPhotoUrl(id) {
    return new Promise(resolve => {
        if (!dbPhotos) return resolve(null);
        const tx = dbPhotos.transaction("eleves", "readonly");
        const req = tx.objectStore("eleves").get(id);
        req.onsuccess = () => resolve(req.result ? URL.createObjectURL(req.result.blob) : null);
        req.onerror = () => resolve(null);
    });
}

/**
 * Table de correspondance pour les caractères mal encodés
 */
const ACCENT_MAP = {
    '╠é': 'é', '╠ü': 'é', '╠Ç': 'è', '╠ê': 'è',
    '╠á': 'à', '╠ó': 'â', '╠┤': 'ô', '╠╣': 'ù',
    '╠¿': 'ï', '╠½': 'ë', '╠ª': 'ê', '╠│': 'î',
    '╠╝': 'û', '╠Â': 'ç', '╠¢': 'œ', '╠®': 'é',
    '╠▓': 'é', '╠░': 'è', '╠▒': 'è', '╠╡': 'à',
    '╠╢': 'â', '╠╕': 'ô', '╠╗': 'ù', '╠╬': 'ï',
    '╠«': 'ë', '╠¬': 'ê', '╠ƒ': 'æ'
};

function decodeAccents(str) {
    if (!str) return '';
    let result = str;
    for (const [key, value] of Object.entries(ACCENT_MAP)) {
        result = result.replace(new RegExp(key, 'g'), value);
    }
    return result;
}

function normalizeForComparison(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s_\-.'']/g, '')
        .trim()
        .toUpperCase();
}

/**
 * Parse le nom de fichier pour extraire nom, prénom et sexe
 * Supporte :
 *   - Prénom_Nom_M_302.jpg
 *   - Prénom_Nom_F_302.jpg
 *   - Prénom_Nom1_Nom2_M_302.jpg
 *   - Prénom_Nom1_-_Nom2_F_302.jpg
 *   - _NOM,_Prénom_M.jpg
 */
function parseZipFileName(fileName) {
    // Décoder les accents
    let decoded = decodeAccents(fileName);
    
    // Enlever l'extension
    const nameWithoutExt = decoded.replace(/\.[^.]+$/, '');
    
    // 1. Ancien format avec virgule
    let match = nameWithoutExt.match(/^_?(.+),(.+)_([MF])$/i);
    if (match) {
        let nomBrut = match[1].trim();
        let prenomBrut = match[2].trim();
        const sexe = match[3].toUpperCase();
        return {
            nom: nomBrut,
            prenom: prenomBrut,
            sexe,
            nomNormalise: normalizeForComparison(nomBrut),
            prenomNormalise: normalizeForComparison(prenomBrut),
            cleUnique: `${normalizeForComparison(nomBrut)}_${normalizeForComparison(prenomBrut).charAt(0)}`
        };
    }
    
    // 2. Nouveau format : Prénom_Nom_M_302.jpg (ou F)
    const parts = nameWithoutExt.split('_');
    if (parts.length < 3) {
        console.warn(`Ignoré (trop peu d'éléments) : ${fileName}`);
        return null;
    }
    
    // Le prénom est le premier élément
    const prenomBrut = parts[0] || '';
    if (!prenomBrut) {
        console.warn(`Ignoré (prénom manquant) : ${fileName}`);
        return null;
    }
    
    // Trouver le sexe : chercher une partie qui est exactement "M" ou "F"
    let sexe = null;
    let sexeIndex = -1;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim().toUpperCase();
        if (part === 'M' || part === 'F') {
            sexe = part;
            sexeIndex = i;
            break;
        }
    }
    
    if (!sexe) {
        console.warn(`Ignoré (sexe non trouvé) : ${fileName}`);
        return null;
    }
    
    // Le nom est tout ce qui est entre le prénom et le sexe
    let nomParts = [];
    for (let i = 1; i < sexeIndex; i++) {
        let part = parts[i].trim();
        // Nettoyer les tirets
        part = part.replace(/^-+|-+$/g, '');
        if (part) nomParts.push(part);
    }
    let nomBrut = nomParts.join(' ');
    // Nettoyer les séparateurs multiples
    nomBrut = nomBrut.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ');
    
    // Si le nom est vide, essayer de prendre les parties restantes après le sexe ?
    // (cas où le nom serait après le sexe, mais normalement non)
    if (!nomBrut) {
        // Fallback : tout entre le prénom et le sexe
        nomBrut = parts.slice(1, sexeIndex).join(' ');
    }
    
    if (!nomBrut) {
        console.warn(`Ignoré (nom manquant) : ${fileName}`);
        return null;
    }
    
    // Nettoyer le prénom des éventuels caractères parasites
    const prenomClean = prenomBrut.replace(/^_+|_+$/g, '');
    
    return {
        nom: nomBrut,
        prenom: prenomClean,
        sexe: sexe,
        nomNormalise: normalizeForComparison(nomBrut),
        prenomNormalise: normalizeForComparison(prenomClean),
        cleUnique: `${normalizeForComparison(nomBrut)}_${normalizeForComparison(prenomClean).charAt(0)}`
    };
}

// === GESTION DU STOCKAGE PAR CLASSE ===
function getStorageKey(classeName) {
    return `eps_arena_eleves_${classeName}`;
}

export function getExistingEleves(classeName) {
    return JSON.parse(localStorage.getItem(getStorageKey(classeName)) || '[]');
}

export function saveEleves(classeName, eleves) {
    const sorted = [...eleves].sort((a, b) => a.nom.localeCompare(b.nom));
    localStorage.setItem(getStorageKey(classeName), JSON.stringify(sorted));
}

export async function importZIP(file, classeName) {
    const zip = await JSZip.loadAsync(file);
    const elevesExistants = getExistingEleves(classeName);

    const nouveauxEleves = [];
    const zipEntries = Object.values(zip.files).filter(f => !f.dir && f.name.match(/\.(jpg|jpeg|png|gif)$/i));

    if (zipEntries.length === 0) {
        throw new Error("Aucune image trouvée dans le ZIP.");
    }

    let parsedCount = 0;
    const ignoredFiles = [];
    for (const entry of zipEntries) {
        const infos = parseZipFileName(entry.name);
        if (!infos) {
            ignoredFiles.push(entry.name);
            continue;
        }

        parsedCount++;
        let eleve = elevesExistants.find(e =>
            normalizeForComparison(e.nom) === infos.nomNormalise &&
            normalizeForComparison(e.prenom) === infos.prenomNormalise
        ) || elevesExistants.find(e => e.id === infos.cleUnique);

        if (eleve) {
            if (eleve.sexe !== infos.sexe) eleve.sexe = infos.sexe;
            if (eleve.nom !== infos.nom) eleve.nom = infos.nom;
            if (eleve.prenom !== infos.prenom) eleve.prenom = infos.prenom;
            const blob = await entry.async('blob');
            savePhoto(eleve.id, blob);
        } else {
            const newId = infos.cleUnique;
            eleve = {
                id: newId,
                nom: infos.nom,
                prenom: infos.prenom,
                sexe: infos.sexe,
                vma: 0,
                palier: 0,
                longueur: null,
                sprint30: null,
                force: 0
            };
            const blob = await entry.async('blob');
            savePhoto(newId, blob);
            nouveauxEleves.push(eleve);
        }
    }

    if (parsedCount === 0) {
        const sample = ignoredFiles.slice(0, 3).join(', ');
        throw new Error(`Aucun fichier reconnu dans le ZIP. Vérifie le format : Prénom_Nom_M_302.jpg ou _NOM,_Prénom_M.jpg.\nExemples ignorés : ${sample}`);
    }

    const tousLesEleves = [...elevesExistants];
    nouveauxEleves.forEach(n => {
        if (!tousLesEleves.some(e => e.id === n.id)) {
            tousLesEleves.push(n);
        }
    });

    saveEleves(classeName, tousLesEleves);
    return tousLesEleves;
}

export async function importCSV(file, classeName) {
    return new Promise((resolve) => {
        Papa.parse(file, {
            delimiter: ";",
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                const elevesExistants = getExistingEleves(classeName);
                const map = {};
                elevesExistants.forEach(e => map[e.id] = e);

                results.data.forEach((row, index) => {
                    if (index === 0 || !row[0]) return;
                    const [nomComplet, , , vitesse, palier, , longueur, , , , sprint1] = row;
                    const nomCompletClean = fixMojibake(nomComplet).trim();
                    const parts = nomCompletClean.split(' ');
                    const prenom = parts[0];
                    const nom = parts.slice(1).join(' ').toUpperCase();
                    const id = `${normalizeForComparison(nom)}_${normalizeForComparison(prenom).charAt(0)}`;

                    const eleve = map[id];
                    if (eleve) {
                        eleve.vma = parseFloat(String(vitesse).replace(",", ".")) || 0;
                        eleve.palier = parseInt(palier) || 0;
                        eleve.longueur = parseFloat(String(longueur).replace(",", ".")) || null;
                        eleve.sprint30 = parseFloat(String(sprint1).replace(",", ".")) || null;
                    }
                });

                saveEleves(classeName, elevesExistants);
                resolve(elevesExistants);
            }
        });
    });
}

function fixMojibake(str) {
    try { return decodeURIComponent(escape(str)); } catch (e) { return str; }
}

// Suppression des modales automatiques
export function getPendingStudents(classeName) { return []; }
export function getOrphanPhotos(classeName) { return []; }

export function updateStudentForce(studentId, force, classeName) {
    const eleves = getExistingEleves(classeName);
    const target = eleves.find(e => e.id === studentId);
    if (target) {
        target.force = force;
        saveEleves(classeName, eleves);
    }
}

export function updateStudentName(studentId, field, value, classeName) {
    const eleves = getExistingEleves(classeName);
    const target = eleves.find(e => e.id === studentId);
    if (target) {
        target[field] = value;
        saveEleves(classeName, eleves);
        return true;
    }
    return false;
}

export async function assignPhotoToStudent(studentId, sourcePhotoId, classeName) {
    const tx = dbPhotos.transaction("eleves", "readwrite");
    const req = tx.objectStore("eleves").get(sourcePhotoId);
    return new Promise((resolve) => {
        req.onsuccess = () => {
            const sourceData = req.result;
            if (sourceData && sourceData.blob) {
                savePhoto(studentId, sourceData.blob);
                const eleves = getExistingEleves(classeName);
                const target = eleves.find(e => e.id === studentId);
                if (target) {
                    const sourceEleve = eleves.find(e => e.id === sourcePhotoId);
                    if (sourceEleve) target.sexe = sourceEleve.sexe;
                }
                const filtered = eleves.filter(e => e.id !== sourcePhotoId);
                saveEleves(classeName, filtered);
                resolve(true);
            } else {
                resolve(false);
            }
        };
        req.onerror = () => resolve(false);
    });
}

export async function uploadManualPhoto(studentId, file, classeName) {
    const blob = await file;
    savePhoto(studentId, blob);
    const eleves = getExistingEleves(classeName);
    const target = eleves.find(e => e.id === studentId);
    if (target) target.force = target.force || 0;
    saveEleves(classeName, eleves);
    return true;
}

export { getPhotoUrl };