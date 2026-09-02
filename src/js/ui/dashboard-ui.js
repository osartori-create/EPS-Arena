// src/js/ui/dashboard-ui.js
import { importCSV, importZIP, getPhotoUrl, getPendingStudents, getOrphanPhotos, assignPhotoToStudent, uploadManualPhoto, updateStudentForce, getExistingEleves, saveEleves } from '../services/admin-service.js';

let currentEleves = [];
let activeClasse = "";

function getStorageKey() {
    return `eps_arena_eleves_${activeClasse}`;
}

function loadLocalEleves() {
    currentEleves = getExistingEleves(activeClasse);
    // Tri par nom, puis prénom
    currentEleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
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
                    currentEleves = await importZIP(e.target.files[0], activeClasse);
                    // Le tri est fait dans importZIP, mais on le refait ici pour être sûr
                    currentEleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
                    renderEleves();
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
                    currentEleves = await importCSV(e.target.files[0], activeClasse);
                    currentEleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
                    renderEleves();
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

    currentEleves.forEach(async (e) => {
        const url = await getPhotoUrl(e.id);
        const photoHtml = url
            ? `<img src="${url}" class="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-slate-600">`
            : `<div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl">👤</div>`;

        // Remplacer le badge ! par un crayon
        const editIcon = `<span onclick="event.stopPropagation(); openEditModal('${e.id}')" class="absolute top-2 right-2 bg-slate-600 hover:bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-black cursor-pointer transition-colors">✏️</span>`;

        let extraData = '';
        if (e.longueur) extraData += `<span class="bg-black px-2 py-1 rounded border border-slate-600 text-orange-400">L: ${e.longueur} cm</span>`;
        if (e.sprint30) extraData += `<span class="bg-black px-2 py-1 rounded border border-slate-600 text-purple-400">30m: ${e.sprint30}s</span>`;

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            const filled = e.force >= i ? 'text-yellow-400' : 'text-slate-600';
            starsHtml += `<span onclick="event.stopPropagation(); setForce('${e.id}', ${i})" class="cursor-pointer text-lg ${filled}">★</span>`;
        }

        container.innerHTML += `
            <div class="bg-slate-800 rounded-2xl p-4 flex flex-col items-center border border-slate-700 text-center relative">
                ${editIcon}
                <div class="mb-2">${photoHtml}</div>
                <p class="font-black text-white leading-tight">${e.prenom}</p>
                <p class="text-xs text-slate-400 uppercase font-bold mb-2">${e.nom}</p>
                <div class="flex flex-wrap justify-center gap-2 text-xs font-bold">
                    <span class="bg-black px-2 py-1 rounded border border-slate-600 text-emerald-400">VMA: ${e.vma || '--'}</span>
                    ${extraData}
                </div>
                <div class="flex gap-1 mt-2">${starsHtml}</div>
                <span class="text-[10px] text-slate-500 mt-1">${e.sexe ? e.sexe : 'Sexe inconnu'}</span>
            </div>
        `;
    });
}

// === MODALE D'ÉDITION ===
window.openEditModal = function(eleveId) {
    const eleve = currentEleves.find(e => e.id === eleveId);
    if (!eleve) return;

    // Supprimer une modale existante
    const existing = document.getElementById('editModal');
    if (existing) existing.remove();

    const modalHtml = `
        <div id="editModal" class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
                <h3 class="text-xl font-black text-blue-400 uppercase mb-4">✏️ Modifier l'élève</h3>
                <div class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Prénom</label>
                        <input type="text" id="edit-prenom" value="${eleve.prenom}" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Nom</label>
                        <input type="text" id="edit-nom" value="${eleve.nom}" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Sexe</label>
                        <select id="edit-sexe" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white">
                            <option value="M" ${eleve.sexe === 'M' ? 'selected' : ''}>M</option>
                            <option value="F" ${eleve.sexe === 'F' ? 'selected' : ''}>F</option>
                            <option value="" ${!eleve.sexe ? 'selected' : ''}>Non spécifié</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">VMA (km/h)</label>
                        <input type="number" id="edit-vma" value="${eleve.vma || ''}" step="0.1" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white">
                    </div>
                    <div class="flex gap-2">
                        <button onclick="saveEditModal('${eleveId}')" class="flex-1 bg-emerald-600 py-2 rounded-xl font-black text-white active:scale-95">💾 Enregistrer</button>
                        <button onclick="document.getElementById('editModal').remove()" class="flex-1 bg-slate-700 py-2 rounded-xl font-black text-white active:scale-95">❌ Annuler</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.saveEditModal = function(eleveId) {
    const prenom = document.getElementById('edit-prenom').value.trim();
    const nom = document.getElementById('edit-nom').value.trim();
    const sexe = document.getElementById('edit-sexe').value;
    const vma = parseFloat(document.getElementById('edit-vma').value) || 0;

    if (!prenom || !nom) {
        alert("Le prénom et le nom sont obligatoires.");
        return;
    }

    const eleve = currentEleves.find(e => e.id === eleveId);
    if (eleve) {
        eleve.prenom = prenom;
        eleve.nom = nom.toUpperCase();
        eleve.sexe = sexe;
        eleve.vma = vma;
        // Recalculer l'id si nécessaire ? On garde l'id existant pour les références.
        // Mais on peut mettre à jour la clé unique si le nom/prénom change.
        // Pour simplifier, on ne change pas l'id.
        saveEleves(activeClasse, currentEleves);
        // Re-trier
        currentEleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
        renderEleves();
        document.getElementById('editModal').remove();
        alert("✅ Élève modifié !");
    }
};

window.setForce = function(studentId, force) {
    updateStudentForce(studentId, force, activeClasse);
    loadLocalEleves();
};

// Ajouter un élève manuellement
window.addEleve = function() {
    const prenom = prompt("Prénom ?");
    const nom = prompt("Nom ?");
    const vma = parseFloat(prompt("VMA (Palier) ?"));
    if (!prenom || !nom || isNaN(vma)) return alert("Champs invalides");

    const normalized = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
    const id = `${normalized(nom)}_${normalized(prenom).charAt(0)}`;

    const newEleve = {
        id, prenom, nom: nom.toUpperCase(),
        vma, palier: vma, sexe: '', longueur: null, sprint30: null, force: 0, needsManualCheck: false
    };

    currentEleves.push(newEleve);
    currentEleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    saveEleves(activeClasse, currentEleves);
    renderEleves();
};

window.purgeEleves = function() {
    if (!confirm("Supprimer tous les élèves de cette classe ?")) return;
    currentEleves = [];
    saveEleves(activeClasse, []);
    renderEleves();
};