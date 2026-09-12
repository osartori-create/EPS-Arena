// src/js/ui/dashboard-ui.js
import { importCSV, importZIP, getPhotoUrl, getExistingEleves, saveEleves, updateStudentForce, updateStudentName } from '../services/admin-service.js';
import { openImportModal } from '../services/import-service.js';
import { migrerCodesAutoEval } from '../services/admin-service.js';

let currentEleves = [];
let activeClasse = "";

function getStorageKey() {
    return `eps_arena_eleves_${activeClasse}`;
}

function loadLocalEleves() {
    currentEleves = getExistingEleves(activeClasse);
    currentEleves.sort((a, b) => a.nom.localeCompare(b.nom));
    renderEleves();
}

export function initAdminUI() {
    const select = document.getElementById('selectClasse');
    if (select) {
        select.addEventListener('change', (e) => {
            activeClasse = e.target.value;
            loadLocalEleves();
        });
    }

    const csvInput = document.getElementById('csvFile');
    const zipInput = document.getElementById('zipFile');

    if (zipInput) {
        zipInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                if (!activeClasse) return alert("Veuillez d'abord sélectionner une classe.");
                try {
                    await importZIP(e.target.files[0], activeClasse);
                    loadLocalEleves();
                    alert(`✅ ${currentEleves.length} élève(s) importé(s) depuis les photos.`);
                } catch (err) {
                    console.error(err);
                    alert("Erreur lors de l'import du ZIP.\n" + err.message);
                }
            }
            e.target.value = '';
        });
    }

    if (csvInput) {
        csvInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                if (!activeClasse) return alert("Veuillez d'abord sélectionner une classe.");
                try {
                    await importCSV(e.target.files[0], activeClasse);
                    loadLocalEleves();
                    alert("✅ Données de performance importées.");
                } catch (err) {
                    console.error(err);
                    alert("Erreur lors de l'import du CSV.");
                }
            }
            e.target.value = '';
        });
    }

    window.addEventListener('eleves-imported', () => {
        loadLocalEleves();
    });

    activeClasse = select ? select.value : "";
    if (activeClasse) loadLocalEleves();
}

// ============================================================
// NORMALISATION POUR LA DÉTECTION DES DOUBLONS
// ============================================================
function normaliserNom(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
}

// ============================================================
// AFFICHAGE DES ÉLÈVES
// ============================================================
async function renderEleves() {
    const container = document.getElementById('eleveList');
    if (!container) return;
    container.innerHTML = '';

    if (currentEleves.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm col-span-full">Aucun élève importé pour cette classe.<br>📸 Utilisez "Import ZIP Photos" pour créer la classe.</p>';
        return;
    }

    // Détection des doublons (basée sur nom + prénom normalisés)
    const ids = {};
    const doublons = new Set();
    currentEleves.forEach(e => {
        const cle = normaliserNom(e.nom) + '_' + normaliserNom(e.prenom);
        if (ids[cle]) {
            doublons.add(e.id);
            doublons.add(ids[cle]);
        } else {
            ids[cle] = e.id;
        }
    });

    currentEleves.sort((a, b) => a.nom.localeCompare(b.nom));

    for (const e of currentEleves) {
        const url = await getPhotoUrl(e.id);
        const photoHtml = url
            ? `<img src="${url}" class="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-slate-600">`
            : `<div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl">👤</div>`;

        let extraData = '';
        if (e.longueur) extraData += `<span class="bg-black px-2 py-1 rounded border border-slate-600 text-orange-400">L: ${e.longueur} cm</span>`;
        if (e.sprint30) extraData += `<span class="bg-black px-2 py-1 rounded border border-slate-600 text-purple-400">30m: ${e.sprint30}s</span>`;

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            const filled = e.force >= i ? 'text-yellow-400' : 'text-slate-600';
            starsHtml += `<span onclick="event.stopPropagation(); setForce('${e.id}', ${i})" class="cursor-pointer text-lg ${filled}">★</span>`;
        }

        const isDoublon = doublons.has(e.id);

        container.innerHTML += `
            <div class="bg-slate-800 rounded-2xl p-4 flex flex-col items-center border border-slate-700 text-center relative cursor-pointer hover:border-blue-500 transition-all ${isDoublon ? 'border-yellow-500 border-2' : ''}" onclick="openEditModal('${e.id}')">
                ${isDoublon ? '<span class="absolute top-0 left-0 bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-br-lg z-10">⚠️ Doublon</span>' : ''}
                <button onclick="event.stopPropagation(); supprimerEleve('${e.id}')" 
                        class="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white text-xs w-6 h-6 rounded-full font-black opacity-60 hover:opacity-100 transition-opacity z-10">
                    ✕
                </button>
                <div class="mb-2">${photoHtml}</div>
                <p class="font-black text-white leading-tight">${e.prenom}</p>
                <p class="text-xs text-slate-400 uppercase font-bold mb-2">${e.nom}</p>
                <div class="flex flex-wrap justify-center gap-2 text-xs font-bold">
                    <span class="bg-black px-2 py-1 rounded border border-slate-600 text-emerald-400">VMA: ${e.vma || '--'}</span>
                    ${extraData}
                </div>
                <div class="flex gap-1 mt-2">${starsHtml}</div>
                <span class="text-[10px] text-slate-500 mt-1">${e.sexe ? e.sexe : 'Sexe inconnu'}</span>
                <span class="text-[10px] text-slate-500 mt-1">🎂 ${e.dateNaissance || 'Date inconnue'}</span>
                <span class="text-[10px] text-slate-600 mt-1">✏️ Cliquer pour modifier</span>
            </div>
        `;
    }
}

// ============================================================
// SUPPRESSION D'UN ÉLÈVE
// ============================================================
window.supprimerEleve = function(eleveId) {
    if (!confirm(`Supprimer définitivement cet élève ?`)) return;
    currentEleves = currentEleves.filter(e => e.id !== eleveId);
    saveEleves(activeClasse, currentEleves);
    loadLocalEleves();
};

// ============================================================
// ACTIONS (inchangées)
// ============================================================
window.setForce = function(studentId, force) {
    updateStudentForce(studentId, force, activeClasse);
    loadLocalEleves();
};

window.openEditModal = function(eleveId) {
    const eleve = currentEleves.find(e => e.id === eleveId);
    if (!eleve) return;

    const modalHtml = `
    <div id="editStudentModal" class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
            <h3 class="text-xl font-black text-blue-400 uppercase mb-4">✏️ Modifier l'élève</h3>
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Prénom</label>
                    <input type="text" id="edit-prenom" value="${eleve.prenom}" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-lg font-bold">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Nom</label>
                    <input type="text" id="edit-nom" value="${eleve.nom}" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-lg font-bold">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Sexe</label>
                    <select id="edit-sexe" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white">
                        <option value="M" ${eleve.sexe === 'M' ? 'selected' : ''}>Masculin</option>
                        <option value="F" ${eleve.sexe === 'F' ? 'selected' : ''}>Féminin</option>
                        <option value="" ${!eleve.sexe ? 'selected' : ''}>Non renseigné</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">VMA</label>
                    <input type="number" id="edit-vma" value="${eleve.vma || 0}" step="0.1" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-lg font-bold">
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button onclick="saveEditStudent('${eleve.id}')" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white">💾 Enregistrer</button>
                <button onclick="document.getElementById('editStudentModal').remove()" class="bg-slate-700 px-6 py-3 rounded-xl font-black text-white">Annuler</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('editStudentModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.remove();
    });
};

window.saveEditStudent = function(eleveId) {
    const prenom = document.getElementById('edit-prenom').value.trim();
    const nom = document.getElementById('edit-nom').value.trim();
    const sexe = document.getElementById('edit-sexe').value;
    const vma = parseFloat(document.getElementById('edit-vma').value) || 0;

    if (!prenom || !nom) {
        alert('Le prénom et le nom sont obligatoires.');
        return;
    }

    updateStudentName(eleveId, 'prenom', prenom, activeClasse);
    updateStudentName(eleveId, 'nom', nom, activeClasse);
    updateStudentName(eleveId, 'sexe', sexe, activeClasse);
    updateStudentName(eleveId, 'vma', vma, activeClasse);

    document.getElementById('editStudentModal').remove();
    loadLocalEleves();
    alert('✅ Élève modifié avec succès !');
};

window.addEleve = function() {
    const prenom = prompt("Prénom ?");
    const nom = prompt("Nom ?");
    const vma = parseFloat(prompt("VMA (Palier) ?"));
    if (!prenom || !nom || isNaN(vma)) return alert("Champs invalides");

    const normalized = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
    const id = `${normalized(nom)}_${normalized(prenom).charAt(0)}`;

    const newEleve = {
        id, prenom, nom: nom.toUpperCase(),
        vma, palier: vma, sexe: '', longueur: null, sprint30: null, force: 0
    };

    currentEleves.push(newEleve);
    saveEleves(activeClasse, currentEleves);
    loadLocalEleves();
};

window.purgeEleves = function() {
    if (!confirm("Supprimer tous les élèves de cette classe ?")) return;
    currentEleves = [];
    saveEleves(activeClasse, []);
    loadLocalEleves();
};

// ============================================================
// MODALE : LISTE DES CODES ÉLÈVES
// ============================================================
window.afficherCodesEleves = function() {
    const classe = document.getElementById('selectClasse')?.value;
    if (!classe) {
        alert('Sélectionne une classe d\'abord.');
        return;
    }

    // Migration automatique
    const migre = migrerCodesAutoEval(classe);
    if (migre) {
        console.log('[Admin] Codes auto-éval migrés.');
    }

    const eleves = getExistingEleves(classe);
    if (eleves.length === 0) {
        alert('Aucun élève dans cette classe.');
        return;
    }

    // Trier par codeAutoEval
    eleves.sort((a, b) => (a.codeAutoEval || 999) - (b.codeAutoEval || 999));

    const modal = document.createElement('div');
    modal.id = 'codes-modal';
    modal.className = 'fixed inset-0 bg-black/95 z-50 flex items-start justify-center p-4 overflow-y-auto';

    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-2xl my-8">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-2xl font-black text-indigo-400 uppercase">🔢 Codes élèves</h2>
                    <p class="text-xs text-slate-400">Classe ${classe} · ${eleves.length} élève(s)</p>
                    <p class="text-[10px] text-amber-400 mt-1">⚠️ Ces codes restent sur cet appareil (RGPD)</p>
                </div>
                <button onclick="document.getElementById('codes-modal').remove()" 
                        class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white">
                    ✖ Fermer
                </button>
            </div>

            <div class="bg-amber-900/20 border border-amber-500/50 rounded-xl p-3 mb-4 text-xs text-amber-200">
                💡 <strong class="text-amber-400">Comment ça marche ?</strong> Chaque élève reçoit un code unique et permanent. 
                Ce code est utilisé pour l'auto-évaluation et le tournoi. Il ne change jamais, même si l'élève change de groupe.
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-slate-800 text-slate-400 text-xs uppercase">
                            <th class="p-2 text-left">Code</th>
                            <th class="p-2 text-left">Nom</th>
                            <th class="p-2 text-left">Prénom</th>
                            <th class="p-2 text-left">Sexe</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${eleves.map(e => `
                            <tr class="border-b border-slate-800 hover:bg-slate-800/50">
                                <td class="p-2 font-black text-2xl text-yellow-400">${e.codeAutoEval || '--'}</td>
                                <td class="p-2 font-bold text-white">${e.nom || ''}</td>
                                <td class="p-2 text-slate-300">${e.prenom || ''}</td>
                                <td class="p-2 text-slate-500">${e.sexe || ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="flex gap-3 mt-4">
                <button onclick="window.imprimerCodesEleves()"
                        class="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                    🖨️ Imprimer
                </button>
                <button onclick="window.exporterCodesElevesCSV()"
                        class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                    📥 Export CSV
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Stocker pour les boutons
    window._codesElevesData = { classe, eleves };
};

window.imprimerCodesEleves = function() {
    const data = window._codesElevesData;
    if (!data) return;

    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>Codes élèves - ${data.classe}</title>
        <style>
            body { font-family: Arial; padding: 20px; }
            h1 { color: #3b82f6; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f0f0f0; }
            td.code { font-size: 24px; font-weight: bold; color: #dc2626; width: 80px; }
        </style></head><body>
            <h1>Codes élèves - Classe ${data.classe}</h1>
            <p>Document à conserver. Les codes sont uniques et permanents.</p>
            <table>
                <thead><tr><th>Code</th><th>Nom</th><th>Prénom</th></tr></thead>
                <tbody>
                    ${data.eleves.map(e => `
                        <tr>
                            <td class="code">${e.codeAutoEval || '--'}</td>
                            <td>${e.nom || ''}</td>
                            <td>${e.prenom || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
};

window.exporterCodesElevesCSV = function() {
    const data = window._codesElevesData;
    if (!data) return;

    let csv = '\uFEFF"Code";"Nom";"Prénom"\n';
    data.eleves.forEach(e => {
        csv += `"${e.codeAutoEval || ''}";"${e.nom || ''}";"${e.prenom || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Codes_${data.classe}.csv`;
    a.click();
};

window.openImportModal = function() {
    const classe = document.getElementById('selectClasse').value;
    if (!classe) {
        alert('Sélectionnez une classe d\'abord.');
        return;
    }
    openImportModal(classe);
};