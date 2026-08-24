// src/js/services/admin-service.js
import Papa from 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js';
import JSZip from 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

// ==========================================
// CONFIGURATION LOCALE (RGPD) - INDEXEDDB
// ==========================================
let dbPhotos;
const request = indexedDB.open("EPS_Arena_LocalDB", 1);
request.onupgradeneeded = e => {
    dbPhotos = e.target.result;
    if (!dbPhotos.objectStoreNames.contains("eleves")) {
        dbPhotos.createObjectStore("eleves", { keyPath: "id" });
    }
};
request.onsuccess = e => {
    dbPhotos = e.target.result;
};

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

// ==========================================
// CORRECTION DU PROBLÈME D'ENCODAGE iDOCEO
// ==========================================

// 1. Fonction pour corriger le "Mojibake" (Time╠üo -> Timéo)
function decodeFileName(name) {
    try {
        // iDoceo encode les noms en Windows-1252. On force le décodage.
        const bytes = new TextEncoder().encode(name); // Repasse la chaîne en octets
        return new TextDecoder('windows-1252').decode(bytes); // Décode en CP1252
    } catch (e) {
        return name;
    }
}

// 2. Normaliser le texte pour la comparaison (Majuscules, sans accents, sans tirets)
function normalizeText(str) {
    return (str || "")
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlève les accents (é -> e)
        .replace(/[^a-zA-Z\s]/g, '') // Enlève tirets, apostrophes, etc.
        .trim()
        .toUpperCase();
}

// 3. Extraire les infos du nom de fichier ZIP: _NOM,_Prenom_M.JPG
function parseZipFileName(fileName) {
    const decoded = decodeFileName(fileName); // 🔥 CORRECTION : Décodage CP1252
    const match = decoded.match(/^_(.+),_(.+)_([MF])\./i);
    if (!match) return null;

    let nomBrut = match[1].trim();
    let prenomBrut = match[2].trim();
    const sexe = match[3].toUpperCase();

    return {
        nom: nomBrut,
        prenom: prenomBrut,
        sexe,
        // Normalisation pour matcher le CSV
        nomNormalise: normalizeText(nomBrut),
        prenomNormalise: normalizeText(prenomBrut),
        // Clé unique : Nom + Première lettre du prénom
        cleUnique: `${normalizeText(nomBrut)}_${normalizeText(prenomBrut).charAt(0)}`
    };
}

// ==========================================
// CŒUR DU MODULE : IMPORTS
// ==========================================

export async function importCSV(file) {
    return new Promise((resolve) => {
        Papa.parse(file, {
            delimiter: ";",
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                const eleves = [];
                results.data.forEach((row, index) => {
                    if (index === 0 || !row[0]) return;
                    const [nomComplet, vitesse, palier, palierNum] = row;
                    
                    // Séparation Nom / Prénom (le prénom est le premier mot)
                    const parts = nomComplet.trim().split(' ');
                    const prenom = parts[0];
                    const nom = parts.slice(1).join(' ').toUpperCase();

                    eleves.push({
                        id: `${normalizeText(nom)}_${normalizeText(prenom).charAt(0)}`,
                        nom: nom,
                        prenom: prenom,
                        vma: parseFloat(String(vitesse).replace(",", ".")),
                        vitessePalier: parseFloat(String(palier).replace(",", ".")),
                        palier: parseInt(palierNum),
                        sexe: '' // Sera rempli par le ZIP
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
    const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
    
    const zipEntries = Object.values(zip.files).filter(f => !f.dir && f.name.match(/\.(jpg|jpeg|png|gif)$/i));
    
    for (const entry of zipEntries) {
        const infos = parseZipFileName(entry.name);
        if (!infos) continue;

        // Correspondance exacte (Nom + Prénom normalisés)
        let eleve = eleves.find(e => normalizeText(e.nom) === infos.nomNormalise && normalizeText(e.prenom) === infos.prenomNormalise)
                 || eleves.find(e => e.id === infos.cleUnique);

        if (eleve) {
            eleve.sexe = infos.sexe;
            const blob = await entry.async('blob');
            savePhoto(eleve.id, blob);
        } else {
            // Fallback : Première lettre du prénom si aucune correspondance exacte
            const fallbackKey = `${infos.nomNormalise}_${infos.prenom.charAt(0)}`;
            eleve = eleves.find(e => e.id === fallbackKey);
            
            if (eleve) {
                eleve.sexe = infos.sexe;
                const blob = await entry.async('blob');
                savePhoto(eleve.id, blob);
                console.warn(`⚠️ Association approximative (1ère lettre) pour : ${infos.prenom} ${infos.nom}`);
            } else {
                console.warn(`❌ Élève introuvable pour la photo : ${entry.name}`);
            }
        }
    }

    localStorage.setItem('eps_arena_eleves', JSON.stringify(eleves));
    return eleves;
}

export { getPhotoUrl };