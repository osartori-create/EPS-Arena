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

function parseZipFileName(fileName) {
    let decoded = fileName;
    try {
        const bytes = new TextEncoder().encode(fileName);
        decoded = new TextDecoder('windows-1252').decode(bytes);
    } catch(e) { decoded = fileName; }

    const match = decoded.match(/^_(.+),_(.+)_([MF])\./i);
    if (!match) return null;

    let nomBrut = match[1].trim();
    let prenomBrut = match[2].trim();
    const sexe = match[3].toUpperCase();

    return {
        nom: nomBrut, prenom: prenomBrut, sexe,
        nomNormalise: normalizeForComparison(nomBrut),
        prenomNormalise: normalizeForComparison(prenomBrut),
        cleUnique: `${normalizeForComparison(nomBrut)}_${normalizeForComparison(prenomBrut).charAt(0)}`
    };
}

// === GESTION DU STOCKAGE PAR CLASSE ===
function getStorageKey(classeName) {
    return `eps_arena_eleves_${classeName}`;
}

export async function importCSV(file, classeName) {
    return new Promise((resolve) => {
        Papa.parse(file, {
            delimiter: ";", header: false, skipEmptyLines: true,
            complete: async (results) => {
                // Récupère les élèves déjà présents pour CETTE classe
                const existingEleves = JSON.parse(localStorage.getItem(getStorageKey(classeName)) || '[]');
                const existingMap = {};
                existingEleves.forEach(e => { existingMap[e.id] = e; });

                const newEleves = [];
                results.data.forEach((row, index) => {
                    if (index === 0 || !row[0]) return;
                    const [nomComplet, , , vitesse, palier, , longueur, , , , sprint1, sprint2, sprint3] = row;
                    const nomCompletClean = fixMojibake(nomComplet).trim();
                    const parts = nomCompletClean.split(' ');
                    const prenom = parts[0];
                    const nom = parts.slice(1).join(' ').toUpperCase();
                    const id = `${normalizeForComparison(nom)}_${normalizeForComparison(prenom).charAt(0)}`;

                    const existing = existingMap[id];
                    
                    newEleves.push({
                        id: id,
                        nom: nom, prenom: prenom,
                        vma: parseFloat(String(vitesse).replace(",", ".")) || 0,
                        palier: parseInt(palier) || 0,
                        longueur: parseFloat(String(longueur).replace(",", ".")) || null,
                        sprint30: parseFloat(String(sprint1).replace(",", ".")) || null,
                        sexe: existing ? existing.sexe : '',
                        needsManualCheck: existing ? existing.needsManualCheck : false
                    });
                });

                localStorage.setItem(getStorageKey(classeName), JSON.stringify(newEleves));
                resolve(newEleves);
            }
        });
    });
}

export async function importZIP(file, classeName) {
    const zip = await JSZip.loadAsync(file);
    let eleves = JSON.parse(localStorage.getItem(getStorageKey(classeName)) || '[]');
    const zipEntries = Object.values(zip.files).filter(f => !f.dir && f.name.match(/\.(jpg|jpeg|png|gif)$/i));
    
    for (const entry of zipEntries) {
        const infos = parseZipFileName(entry.name);
        if (!infos) continue;

        let eleve = eleves.find(e => 
            normalizeForComparison(e.nom) === infos.nomNormalise && 
            normalizeForComparison(e.prenom) === infos.prenomNormalise
        ) || eleves.find(e => e.id === infos.cleUnique);

        if (!eleve) {
            eleve = eleves.find(e => {
                const csvNom = normalizeForComparison(e.nom);
                const csvPrenomInit = normalizeForComparison(e.prenom).charAt(0);
                return csvNom === infos.nomNormalise && csvPrenomInit === infos.prenomNormalise.charAt(0);
            });
        }

        if (eleve) {
            eleve.sexe = infos.sexe;
            const blob = await entry.async('blob');
            savePhoto(eleve.id, blob);
        } else {
            const newId = infos.cleUnique;
            eleves.push({
                id: newId, nom: infos.nom.toUpperCase(), prenom: infos.prenom,
                vma: 0, vitessePalier: 0, palier: 0, sexe: infos.sexe,
                longueur: null, sprint30: null,
                needsManualCheck: true
            });
            const blob = await entry.async('blob');
            savePhoto(newId, blob);
        }
    }

    localStorage.setItem(getStorageKey(classeName), JSON.stringify(eleves));
    return eleves;
}

// Fonctions pour la modal
export function getPendingStudents(classeName) {
    const eleves = JSON.parse(localStorage.getItem(getStorageKey(classeName)) || '[]');
    return eleves.filter(e => e.needsManualCheck || !e.vma || e.vma === 0);
}

export function getOrphanPhotos(classeName) {
    const eleves = JSON.parse(localStorage.getItem(getStorageKey(classeName)) || '[]');
    return eleves.filter(e => e.needsManualCheck && (e.vma === 0 || !e.vma));
}

export async function assignPhotoToStudent(studentId, sourcePhotoId, classeName) {
    const tx = dbPhotos.transaction("eleves", "readwrite");
    const req = tx.objectStore("eleves").get(sourcePhotoId);
    
    return new Promise((resolve) => {
        req.onsuccess = () => {
            const sourceData = req.result;
            if (sourceData && sourceData.blob) {
                savePhoto(studentId, sourceData.blob);
                let eleves = JSON.parse(localStorage.getItem(getStorageKey(classeName)) || '[]');
                const target = eleves.find(e => e.id === studentId);
                if (target) {
                    target.needsManualCheck = false;
                    const sourceEleve = eleves.find(e => e.id === sourcePhotoId);
                    if (sourceEleve) target.sexe = sourceEleve.sexe;
                }
                eleves = eleves.filter(e => e.id !== sourcePhotoId);
                localStorage.setItem(getStorageKey(classeName), JSON.stringify(eleves));
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
    const eleves = JSON.parse(localStorage.getItem(getStorageKey(classeName)) || '[]');
    const target = eleves.find(e => e.id === studentId);
    if (target) target.needsManualCheck = false;
    localStorage.setItem(getStorageKey(classeName), JSON.stringify(eleves));
    return true;
}

export { getPhotoUrl };