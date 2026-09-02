// src/js/ui/dashboard-ui.js
import { importCSV, importZIP, getPhotoUrl, getPendingStudents, updateStudentForce, updateStudentName, getExistingEleves, saveEleves } from '../services/admin-service.js';

let currentEleves = [];
let activeClasse = "";

function getStorageKey() {
    return `eps_arena_eleves_${activeClasse}`;
}

function loadLocalEleves() {
    currentEleves = getExistingEleves(activeClasse);
    // Tri alphabétique par nom
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

    // ZIP : création/import des élèves
    if (zipInput) {
        zipInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                if (!activeClasse) return alert("Veuillez d'abord sélectionner une classe.");
                try {
                    await importZIP(e.target.files[0], activeClasse);
                    // Recharger et trier les données après import
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

    // CSV : compléter les données de performance (VMA, etc.)
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

    activeClasse = select ? select.value : "";
    if (activeClasse) loadLocalEleves();
}

function renderEleves() {
    const container = document.getElementById('eleveList');
    if (!container) return;
    container.innerHTML = '';

    if (currentEleves.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm col-span-full">Aucun élève importé pour cette classe.<br>📸 Utilisez "Import ZIP Photos" pour créer la classe.</p>';
        return;
    }

    // Tri de sécurité avant affichage
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

        container.innerHTML += `
            <div class="bg-slate-800 rounded-2xl p-4 flex flex-col items-center border border-slate-700 text-center relative cursor-pointer hover:border-blue-500 transition-all" onclick="openEditModal('${e.id}')">
                <div class="mb-2">${photoHtml}</div>
                <p class="font-black text-white leading-tight">${e.prenom}</p>
                <p class="text-xs text-slate-400 uppercase font-bold mb-2">${e.nom}</p>
                <div class="flex flex-wrap justify-center gap-2 text-xs font-bold">
                    <span class="bg-black px-2 py-1 rounded border border-slate-600 text-emerald-400">VMA: ${e.vma || '--'}</span>
                    ${extraData}
                </div>
                <div class="flex gap-1 mt-2">${starsHtml}</div>
                <span class="text-[10px] text-slate-500 mt-1">${e.sexe ? e.sexe : 'Sexe inconnu'}</span>
                <span class="text-[10px] text-slate-600 mt-1">✏️ Cliquer pour modifier</span>
            </div>
        `;
    }
}

// Fonctions globales
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