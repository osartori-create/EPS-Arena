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

function fixMojibake(str) {
    try { return decodeURIComponent(escape(str)); } catch (e) { return str; }
}

function normalizeForComparison(str) {
    return (str || "")
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s_\-.'']/g, '')
        .trim()
        .toUpperCase();
}

/**
 * Parse le nom de fichier pour extraire nom, prénom et sexe
 * Accepte les deux formats :
 *   - _NOM,_Prénom_M.jpg  (ancien)
 *   - NOM,_Prénom_M.jpg    (nouveau)
 */
function parseZipFileName(fileName) {
    let decoded = fileName;
    try {
        const bytes = new TextEncoder().encode(fileName);
        decoded = new TextDecoder('windows-1252').decode(bytes);
    } catch(e) { decoded = fileName; }

    // Regex avec underscore facultatif au début
    const match = decoded.match(/^_?(.+),_(.+)_([MF])\./i);
    if (!match) return null;

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

// === GESTION DU STOCKAGE PAR CLASSE ===
function getStorageKey(classeName) {
    return `eps_arena_eleves_${classeName}`;
}

export function getExistingEleves(classeName) {
    return JSON.parse(localStorage.getItem(getStorageKey(classeName)) || '[]');
}

export function saveEleves(classeName, eleves) {
    localStorage.setItem(getStorageKey(classeName), JSON.stringify(eleves));
}

/**
 * Import ZIP : crée les élèves à partir des photos
 */
export async function importZIP(file, classeName) {
    const zip = await JSZip.loadAsync(file);
    const elevesExistants = getExistingEleves(classeName);
    const mapExistants = {};
    elevesExistants.forEach(e => mapExistants[e.id] = e);

    const nouveauxEleves = [];
    const zipEntries = Object.values(zip.files).filter(f => !f.dir && f.name.match(/\.(jpg|jpeg|png|gif)$/i));

    if (zipEntries.length === 0) {
        throw new Error("Aucune image trouvée dans le ZIP. Vérifie les formats (jpg, jpeg, png, gif).");
    }

    for (const entry of zipEntries) {
        const infos = parseZipFileName(entry.name);
        if (!infos) {
            console.warn(`Nom de fichier ignoré (format non reconnu) : ${entry.name}`);
            continue;
        }

        let eleve = elevesExistants.find(e =>
            normalizeForComparison(e.nom) === infos.nomNormalise &&
            normalizeForComparison(e.prenom) === infos.prenomNormalise
        ) || elevesExistants.find(e => e.id === infos.cleUnique);

        if (eleve) {
            if (eleve.sexe !== infos.sexe) eleve.sexe = infos.sexe;
            const blob = await entry.async('blob');
            savePhoto(eleve.id, blob);
        } else {
            const newId = infos.cleUnique;
            eleve = {
                id: newId,
                nom: infos.nom.toUpperCase(),
                prenom: infos.prenom,
                sexe: infos.sexe,
                vma: 0,
                palier: 0,
                longueur: null,
                sprint30: null,
                needsManualCheck: false,
                force: 0
            };
            const blob = await entry.async('blob');
            savePhoto(newId, blob);
            nouveauxEleves.push(eleve);
        }
    }

    // Fusionner les nouveaux avec les existants
    const tousLesEleves = [...elevesExistants];
    nouveauxEleves.forEach(n => {
        if (!tousLesEleves.some(e => e.id === n.id)) {
            tousLesEleves.push(n);
        }
    });

    saveEleves(classeName, tousLesEleves);
    return tousLesEleves;
}

/**
 * Import CSV (optionnel) pour compléter les données de performance
 */
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
                        eleve.needsManualCheck = false;
                    }
                });

                saveEleves(classeName, elevesExistants);
                resolve(elevesExistants);
            }
        });
    });
}

export function getPendingStudents(classeName) {
    const eleves = getExistingEleves(classeName);
    return eleves.filter(e => e.needsManualCheck || !e.vma || e.vma === 0);
}

export function getOrphanPhotos(classeName) {
    const eleves = getExistingEleves(classeName);
    return eleves.filter(e => e.needsManualCheck && (e.vma === 0 || !e.vma));
}

export function updateStudentForce(studentId, force, classeName) {
    const eleves = getExistingEleves(classeName);
    const target = eleves.find(e => e.id === studentId);
    if (target) {
        target.force = force;
        saveEleves(classeName, eleves);
    }
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
                    target.needsManualCheck = false;
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
    if (target) target.needsManualCheck = false;
    saveEleves(classeName, eleves);
    return true;
}

export { getPhotoUrl };