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

// --- IMPORT CSV avec Fusion (CORRIGÉ) ---
export async function importCSV(file) {
    return new Promise((resolve) => {
        Papa.parse(file, {
            delimiter: ";", header: false, skipEmptyLines: true,
            complete: async (results) => {
                // On récupère la liste existante (créée par le ZIP, par exemple)
                const existingEleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
                
                // On prépare une map pour retrouver facilement les élèves existants par ID
                const existingMap = {};
                existingEleves.forEach(e => { existingMap[e.id] = e; });

                const newEleves = [];
                results.data.forEach((row, index) => {
                    if (index === 0 || !row[0]) return;
                    
                    // Nettoyage des colonnes (comme précédemment)
                    const [nomComplet, , , vitesse, palier, , longueur, , , , sprint1, sprint2, sprint3] = row;
                    const nomCompletClean = fixMojibake(nomComplet).trim();
                    const parts = nomCompletClean.split(' ');
                    const prenom = parts[0];
                    const nom = parts.slice(1).join(' ').toUpperCase();
                    const id = `${normalizeForComparison(nom)}_${normalizeForComparison(prenom).charAt(0)}`;

                    // Fusion : On récupère l'existant pour garder la photo et le sexe s'il y en a
                    const existing = existingMap[id];
                    
                    newEleves.push({
                        id: id,
                        nom: nom, prenom: prenom,
                        vma: parseFloat(String(vitesse).replace(",", ".")) || 0,
                        palier: parseInt(palier) || 0,
                        longueur: parseFloat(String(longueur).replace(",", ".")) || null,
                        sprint30: parseFloat(String(sprint1).replace(",", ".")) || null,
                        sexe: existing ? existing.sexe : '', // On garde le sexe du ZIP
                        needsManualCheck: existing ? existing.needsManualCheck : false // On garde le flag
                    });
                });

                // Sauvegarde : On remplace la liste par la nouvelle fusionnée
                localStorage.setItem('eps_arena_eleves', JSON.stringify(newEleves));
                resolve(newEleves);
            }
        });
    });
}

// --- IMPORT ZIP (inchangé, mais assurez-vous qu'il est bien après le CSV) ---
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
            // Fallback
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
            // Création orpheline (car elle n'existait pas dans le CSV)
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

    localStorage.setItem('eps_arena_eleves', JSON.stringify(eleves));
    return eleves;
}

// --- NOUVELLE FONCTION : Récupérer les photos orphelines (pour le bouton "Lier") ---
export function getOrphanPhotos() {
    const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
    // On retourne les élèves créés depuis le ZIP (VMA=0 et needsManualCheck=true)
    return eleves.filter(e => e.needsManualCheck && (e.vma === 0 || !e.vma));
}

export function getPendingStudents() {
    const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
    return eleves.filter(e => e.needsManualCheck || !e.vma || e.vma === 0);
}

export async function assignPhotoToStudent(studentId, sourcePhotoId) {
    const tx = dbPhotos.transaction("eleves", "readwrite");
    const req = tx.objectStore("eleves").get(sourcePhotoId);
    
    return new Promise((resolve) => {
        req.onsuccess = () => {
            const sourceData = req.result;
            if (sourceData && sourceData.blob) {
                savePhoto(studentId, sourceData.blob);
                const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
                const target = eleves.find(e => e.id === studentId);
                if (target) {
                    target.needsManualCheck = false;
                    // On met à jour le sexe et le nom si l'orpheline avait plus d'infos
                    const sourceEleve = eleves.find(e => e.id === sourcePhotoId);
                    if (sourceEleve) target.sexe = sourceEleve.sexe;
                }
                // On supprime l'orpheline de la liste active pour nettoyer
                const filtered = eleves.filter(e => e.id !== sourcePhotoId);
                localStorage.setItem('eps_arena_eleves', JSON.stringify(filtered));
                resolve(true);
            } else {
                resolve(false);
            }
        };
        req.onerror = () => resolve(false);
    });
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