// src/js/services/sync-service.js
// Export / Import complet du localStorage EPS-Arena
// ⚠️ Ne contient PAS les photos (IndexedDB) ni l'audio : elles sont déjà gérées via Nextcloud.

const PREFIX = 'eps_arena_';
const SYNC_VERSION = 1;

// ============================================================
// LECTURE DE TOUTES LES CLÉS EPS-ARENA
// ============================================================
function lireToutesLesCles() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(PREFIX)) continue;
        // On exclut profCode : chaque appareil garde le sien
        if (key === 'eps_arena_profCode') continue;
        data[key] = localStorage.getItem(key);
    }
    return data;
}

// ============================================================
// RÉSUMÉ POUR L'INTERFACE
// ============================================================
export function resumerDonneesLocales() {
    const data = lireToutesLesCles();
    const classes = JSON.parse(data['eps_arena_classes'] || '[]');

    let nbEleves = 0;
    let nbEvals = 0;
    classes.forEach(classe => {
        const eleves = JSON.parse(data[`eps_arena_eleves_${classe}`] || '[]');
        nbEleves += eleves.length;
        if (data[`eps_arena_evaluation_${classe}`]) nbEvals++;
    });

    const nbGrilles = JSON.parse(data['eps_arena_grilles_bibliotheque'] || '[]').length;

    return {
        nbClasses: classes.length,
        classes,
        nbEleves,
        nbEvals,
        nbGrilles,
        nbCles: Object.keys(data).length,
        tailleKo: Math.round(JSON.stringify(data).length / 1024)
    };
}

export function resumerFichierSync(json) {
    if (!json || !json.data) return null;
    const classes = JSON.parse(json.data['eps_arena_classes'] || '[]');
    let nbEleves = 0;
    classes.forEach(classe => {
        const eleves = JSON.parse(json.data[`eps_arena_eleves_${classe}`] || '[]');
        nbEleves += eleves.length;
    });
    return {
        version: json.version,
        profCode: json.profCode,
        appareil: json.appareil || '?',
        dateExport: json.dateExport,
        nbClasses: classes.length,
        classes,
        nbEleves,
        nbCles: Object.keys(json.data).length
    };
}

// ============================================================
// EXPORT
// ============================================================
export function exporterToutesLesDonnees(appareil = 'Appareil') {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const data = lireToutesLesCles();

    const payload = {
        version: SYNC_VERSION,
        profCode: profCode,
        appareil: appareil,
        dateExport: Date.now(),
        data: data
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    // Nom : EPS-Arena_sync_MARTIN_iPad_20260414-1830.json
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const safeAppareil = appareil.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `EPS-Arena_sync_${profCode}_${safeAppareil}_${stamp}.json`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);

    console.log(`📤 Export sync : ${filename} (${Math.round(json.length/1024)} ko)`);
    return { filename, tailleKo: Math.round(json.length / 1024) };
}

// ============================================================
// IMPORT
// ============================================================
export function importerFichierSync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.version || !json.data) {
                    throw new Error('Format de fichier invalide (version ou data manquant).');
                }
                if (json.version > SYNC_VERSION) {
                    throw new Error(`Fichier créé par une version plus récente (v${json.version}). Mets à jour l'app.`);
                }

                // Restauration
                let nbRestaurées = 0;
                for (const [key, value] of Object.entries(json.data)) {
                    if (typeof value !== 'string') continue;
                    localStorage.setItem(key, value);
                    nbRestaurées++;
                }

                console.log(`📥 Restauration : ${nbRestaurées} clés restaurées depuis le fichier du ${new Date(json.dateExport).toLocaleString('fr-FR')}`);
                resolve({
                    nbRestaurées,
                    profCode: json.profCode,
                    appareil: json.appareil,
                    dateExport: json.dateExport
                });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
        reader.readAsText(file);
    });
}

// ============================================================
// APERÇU SANS RESTAURATION (pour modale de confirmation)
// ============================================================
export function lireFichierSync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.version || !json.data) {
                    throw new Error('Format de fichier invalide.');
                }
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Erreur de lecture.'));
        reader.readAsText(file);
    });
}

// ============================================================
// EXPOSITION GLOBALE
// ============================================================
window.syncExporter = () => {
    const appareil = document.getElementById('syncAppareil')?.value || 'Appareil';
    try {
        const res = exporterToutesLesDonnees(appareil);
        alert(`✅ Sauvegarde téléchargée :\n${res.filename}\n(${res.tailleKo} ko)\n\nDépose-la maintenant dans ton dossier Nextcloud.`);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de l\'export : ' + err.message);
    }
};

window.syncImporterFichier = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const json = await lireFichierSync(file);
        const resume = resumerFichierSync(json);
        const dateStr = new Date(resume.dateExport).toLocaleString('fr-FR');

        const msg = `⚠️ Tu vas remplacer TOUTES les données locales par :\n\n` +
                    `• Appareil source : ${resume.appareil}\n` +
                    `• ProfCode source : ${resume.profCode}\n` +
                    `• Date d'export : ${dateStr}\n` +
                    `• ${resume.nbClasses} classe(s) · ${resume.nbEleves} élève(s)\n` +
                    `• ${resume.nbCles} clé(s) au total\n\n` +
                    `Les données actuelles de cet appareil seront ÉCRASÉES.\n` +
                    `Continuer ?`;

        if (!confirm(msg)) {
            event.target.value = '';
            return;
        }

        const res = await importerFichierSync(file);
        alert(`✅ Restauration réussie !\n${res.nbRestaurées} clé(s) restaurée(s).\n\nL'application va recharger.`);
        event.target.value = '';
        location.reload();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur d\'import : ' + err.message);
        event.target.value = '';
    }
};

window.syncAfficherResume = () => {
    const container = document.getElementById('sync-resume-local');
    if (!container) return;
    const r = resumerDonneesLocales();
    const classes = r.classes.length > 0 ? r.classes.join(', ') : '—';
    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Classes</div>
                <div class="text-2xl font-black text-blue-400">${r.nbClasses}</div>
                <div class="text-[10px] text-slate-500 truncate" title="${classes}">${classes}</div>
            </div>
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Élèves</div>
                <div class="text-2xl font-black text-emerald-400">${r.nbEleves}</div>
            </div>
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Évaluations</div>
                <div class="text-2xl font-black text-yellow-400">${r.nbEvals}</div>
            </div>
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Grilles</div>
                <div class="text-2xl font-black text-purple-400">${r.nbGrilles}</div>
            </div>
        </div>
        <p class="text-[10px] text-slate-500 mt-2 text-center">
            ${r.nbCles} clés localStorage · taille estimée ${r.tailleKo} ko
        </p>
    `;
};

// Auto-affichage au chargement de l'onglet (si le conteneur existe)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (document.getElementById('sync-resume-local')) {
            window.syncAfficherResume();
        }
    }, 500);
});