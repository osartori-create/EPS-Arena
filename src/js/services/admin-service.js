// src/js/services/admin-service.js
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

function savePhoto(id, blob) { /* ... (inchangé) ... */ }
async function getPhotoUrl(id) { /* ... (inchangé) ... */ }

function fixMojibake(str) { /* ... (inchangé) ... */ }
function normalizeForComparison(str) { /* ... (inchangé) ... */ }
function parseZipFileName(fileName) { /* ... (inchangé) ... */ }

export async function importCSV(file) { /* ... (inchangé) ... */ }

export async function importZIP(file) {
    // ... (Code d'import identique, mais on marque les élèves créés automatiquement)
    // On modifie la création automatique pour ajouter un flag
    if (!eleve) {
        const newId = infos.cleUnique;
        console.warn(`🛠️ Création automatique (VMA à 0) : ${infos.prenom} ${infos.nom}`);
        eleves.push({
            id: newId,
            nom: infos.nom.toUpperCase(),
            prenom: infos.prenom,
            vma: 0,
            vitessePalier: 0,
            palier: 0,
            sexe: infos.sexe,
            needsManualCheck: true // Flag pour la Modal
        });
        const blob = await entry.async('blob');
        savePhoto(newId, blob);
    }
    localStorage.setItem('eps_arena_eleves', JSON.stringify(eleves));
    return eleves;
}

// === NOUVELLES FONCTIONS POUR LA GESTION MANUELLE ===

// Récupérer les élèves nécessitant une action (pas de VMA ou créés automatiquement)
export function getPendingStudents() {
    const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
    return eleves.filter(e => e.needsManualCheck || !e.vma || e.vma === 0);
}

// Assigner une photo orpheline (déjà importée) à un élève
export async function assignPhotoToStudent(studentId, sourcePhotoId) {
    // Récupérer le blob de la photo source dans IndexedDB
    const tx = dbPhotos.transaction("eleves", "readwrite");
    const req = tx.objectStore("eleves").get(sourcePhotoId);
    
    return new Promise((resolve) => {
        req.onsuccess = () => {
            const sourceData = req.result;
            if (sourceData && sourceData.blob) {
                savePhoto(studentId, sourceData.blob); // Copie dans la case de l'élève
                // On retire le flag "needsManualCheck"
                const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
                const target = eleves.find(e => e.id === studentId);
                if (target) target.needsManualCheck = false;
                localStorage.setItem('eps_arena_eleves', JSON.stringify(eleves));
                resolve(true);
            } else {
                resolve(false);
            }
        };
        req.onerror = () => resolve(false);
    });
}

// Téléverser manuellement une photo pour un élève
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