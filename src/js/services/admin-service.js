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
    try {
        return decodeURIComponent(escape(str));
    } catch (e) {
        return str;
    }
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

export async function importCSV(file) {
    return new Promise((resolve) => {
        Papa.parse(file, {
            delimiter: ";", header: false, skipEmptyLines: true,
            complete: async (results) => {
                const eleves = [];
                results.data.forEach((row, index) => {
                    if (index === 0 || !row[0]) return;
                    const [nomComplet, vitesse, palier, palierNum] = row;
                    const nomCompletClean = fixMojibake(nomComplet).trim();
                    const parts = nomCompletClean.split(' ');
                    const prenom = parts[0];
                    const nom = parts.slice(1).join(' ').toUpperCase();

                    eleves.push({
                        id: `${normalizeForComparison(nom)}_${normalizeForComparison(prenom).charAt(0)}`,
                        nom: nom, prenom: prenom,
                        vma: parseFloat(String(vitesse).replace(",", ".")),
                        vitessePalier: parseFloat(String(palier).replace(",", ".")),
                        palier: parseInt(palierNum),
                        sexe: ''
                    });
                });
                localStorage.setItem('eps_arena_eleves', JSON.stringify(eleves));
                resolve(eleves);
            }
        });
    });
}

export async function importZIP(file) {
    const zip = await JSZip.loadAsync(file);
    let eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
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
                needsManualCheck: true
            });
            const blob = await entry.async('blob');
            savePhoto(newId, blob);
        }
    }

    localStorage.setItem('eps_arena_eleves', JSON.stringify(eleves));
    return eleves;
}

export function getPendingStudents() {
    const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
    return eleves.filter(e => e.needsManualCheck || !e.vma || e.vma === 0);
}

export async function uploadManualPhoto(studentId, file) {
    const blob = await file;
    savePhoto(studentId, blob);
    const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
    const target = eleves.find(e => e.id === studentId);
    if (target) target.needsManualCheck = false;
    localStorage.setItem('eps_arena_eleves', JSON.stringify(eleves));
    return true;
}

export { getPhotoUrl };