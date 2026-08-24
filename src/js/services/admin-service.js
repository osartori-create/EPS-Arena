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

// ... (gardez tout le haut du fichier : constantes, dbPhotos, savePhoto, etc.)

// Fonction pour nettoyer les en-têtes de colonnes (enlève émojis, accents, caractères spéciaux)
function cleanHeader(header) {
    // Corrige le mojibake (ex: ðŸƒ -> 🏃)
    let h = fixMojibake(header || "");
    // Enlève les emojis et caractères non alphanumériques (sauf espaces)
    h = h.replace(/[^\w\sÀ-ÿ]/g, '').trim();
    // Supprime les accents pour la comparaison
    h = h.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return h.toLowerCase();
}

export async function importCSV(file) {
    return new Promise((resolve) => {
        Papa.parse(file, {
            delimiter: ";",
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                // 1. Identifier les index de colonnes en fonction des en-têtes nettoyés
                const headers = (results.data[0] || []).map(cleanHeader);
                // Index des colonnes importantes (trouvées par mots-clés)
                let idxNom = headers.findIndex(h => h.includes('prenom') || h.includes('nom') || (h === ''));
                if (idxNom === -1) idxNom = 0; // Fallback : 1ère colonne
                
                let idxVMA = headers.findIndex(h => h.includes('vitesse palier') || h.includes('vma') || h.includes('luc'));
                let idxLongueur = headers.findIndex(h => h.includes('longueur'));
                let idxSprint = headers.findIndex(h => h.includes('sprint') || h.includes('30m'));

                // 2. Parcourir les lignes de données
                const eleves = [];
                // On démarre à l'index 2 car la ligne 0 = en-têtes et la ligne 1 = sous-titre
                for (let i = 2; i < results.data.length; i++) {
                    const row = results.data[i];
                    if (!row || !row[0]) continue; // Ligne vide

                    const nomComplet = row[0]; // Colonne 0 = Prenom NOM
                    const parts = nomComplet.trim().split(' ');
                    const prenom = parts[0];
                    const nom = parts.slice(1).join(' ').toUpperCase();

                    // Extraire les valeurs (avec gestion des valeurs manquantes et des virgules)
                    const getVal = (idx) => {
                        if (idx === -1 || idx >= row.length) return null;
                        let val = row[idx];
                        if (val === undefined || val === null || val === '') return null;
                        // Remplacer la virgule par un point pour les décimales
                        val = String(val).replace(',', '.');
                        // Si plusieurs valeurs (ex: 3 essais), on prend la première non vide
                        if (val.includes(';')) val = val.split(';')[0];
                        return parseFloat(val);
                    };

                    // Récupération des données
                    const vma = getVal(idxVMA);
                    const longueur = getVal(idxLongueur);
                    const sprint30 = getVal(idxSprint);

                    // Création de l'objet élève
                    eleves.push({
                        id: `${normalizeForComparison(nom)}_${normalizeForComparison(prenom).charAt(0)}`,
                        nom: nom,
                        prenom: prenom,
                        vma: vma,                       // VMA (Vitesse)
                        vitessePalier: vma,             // Pour compatibilité
                        palier: 0,                      // Palier (non extrait ici, pourrait être déduit de la VMA)
                        longueur: longueur,             // Longueur sans élan (cm)
                        sprint30: sprint30,             // 30m (secondes)
                        sexe: ''
                    });

                    // Log de débogage pour vérifier
                    console.log(`[CSV] ${prenom} ${nom} -> VMA: ${vma}, Longueur: ${longueur}, 30m: ${sprint30}`);
                }

                localStorage.setItem('eps_arena_eleves', JSON.stringify(eleves));
                resolve(eleves);
            }
        });
    });
}

// ... (gardez le reste du fichier : importZIP, etc.)

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

// === NOUVELLES FONCTIONS EXPORTÉES ===

export function getPendingStudents() {
    const eleves = JSON.parse(localStorage.getItem('eps_arena_eleves') || '[]');
    return eleves.filter(e => e.needsManualCheck || !e.vma || e.vma === 0);
}

// Fonction pour assigner une photo source (orpheline) à un élève
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

// Fonction pour téléverser manuellement une photo
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