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

    // Après l'import ZIP, identifier les photos orphelines et les élèves sans photo
async function handleZipImport(file, classeName) {
    try {
        const result = await importZIP(file, classeName);
        // Récupérer les élèves sans photo
        const eleves = getExistingEleves(classeName);
        const elevesSansPhoto = [];
        const photosOrphelines = [];

        for (const e of eleves) {
            const url = await getPhotoUrl(e.id);
            if (!url) elevesSansPhoto.push(e);
        }

        // Récupérer les photos orphelines (stockées dans IndexedDB mais sans élève associé)
        // Pour simplifier, on va parcourir les fichiers du ZIP et comparer avec les élèves
        // On utilise un flag pour savoir si la photo a été associée
        // (Cette partie est simplifiée, on pourrait stocker les photos orphelines dans une table séparée)

        if (photosOrphelines.length > 0 || elevesSansPhoto.length > 0) {
            openDragDropModal(photosOrphelines, elevesSansPhoto, classeName);
        }

        loadLocalEleves();
        alert(`✅ ${eleves.length} élèves importés.`);
    } catch (err) {
        alert("Erreur : " + err.message);
    }
}

// Fonction pour ouvrir la modale de drag & drop
async function openDragDropModal(photosOrphelines, elevesSansPhoto, classeName) {
    // Générer les URLs pour les photos orphelines
    const photosWithUrls = await Promise.all(photosOrphelines.map(async (p) => {
        const url = await getPhotoUrl(p.id);
        return { ...p, url };
    }));

    const modalHtml = `
    <div id="dragDropModal" class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-black text-blue-400 uppercase">🖼️ Associer les photos</h3>
                <button onclick="closeDragDropModal()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white">✖ Fermer</button>
            </div>
            <p class="text-xs text-slate-400 mb-4">
                Glissez une photo sur un élève pour l'associer.
            </p>
            <div class="flex flex-col md:flex-row gap-6">
                <div class="w-full md:w-1/3">
                    <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">📸 Photos orphelines</h4>
                    <div id="orphanPhotosList" class="flex flex-col gap-2 min-h-[200px] border border-dashed border-slate-600 p-2 rounded-xl">
                        ${photosWithUrls.map(p => `
                            <div draggable="true" class="orphan-photo bg-slate-800 p-2 rounded-xl flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-slate-700 transition-colors" 
                                 data-id="${p.id}" data-url="${p.url}">
                                <img src="${p.url}" class="w-12 h-12 rounded-full object-cover">
                                <span class="text-xs text-slate-400 truncate">${p.nom || 'Photo'}</span>
                            </div>
                        `).join('')}
                        ${photosWithUrls.length === 0 ? '<p class="text-slate-500 text-xs">Aucune photo orpheline.</p>' : ''}
                    </div>
                </div>
                <div class="w-full md:w-2/3">
                    <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">👤 Élèves sans photo</h4>
                    <div id="studentsWithoutPhotoList" class="flex flex-col gap-2 min-h-[200px] border border-dashed border-slate-600 p-2 rounded-xl">
                        ${elevesSansPhoto.map(e => `
                            <div class="student-drop-zone bg-slate-800 p-2 rounded-xl flex items-center gap-3 border-2 border-transparent hover:border-blue-500 transition-colors" 
                                 data-id="${e.id}">
                                <div class="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-xl">👤</div>
                                <div>
                                    <p class="text-sm font-bold text-white">${e.prenom} ${e.nom}</p>
                                    <p class="text-xs text-slate-400">${e.id}</p>
                                </div>
                                <span class="ml-auto text-xs text-amber-400">📷 manquante</span>
                            </div>
                        `).join('')}
                        ${elevesSansPhoto.length === 0 ? '<p class="text-slate-500 text-xs">Tous les élèves ont une photo.</p>' : ''}
                    </div>
                </div>
            </div>
            <div class="mt-6 flex justify-end">
                <button onclick="closeDragDropModal()" class="bg-emerald-600 px-6 py-2 rounded-xl font-black text-sm text-white">✅ Terminer</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Initialiser les événements de drag & drop
    document.querySelectorAll('.orphan-photo').forEach(photo => {
        photo.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', photo.dataset.id);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    document.querySelectorAll('.student-drop-zone').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            zone.classList.add('border-blue-500', 'bg-blue-500/10');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('border-blue-500', 'bg-blue-500/10');
        });
        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('border-blue-500', 'bg-blue-500/10');
            const photoId = e.dataTransfer.getData('text/plain');
            const eleveId = zone.dataset.id;
            
            const success = await assignPhotoToStudent(eleveId, photoId, classeName);
            if (success) {
                const photoEl = document.querySelector(`.orphan-photo[data-id="${photoId}"]`);
                if (photoEl) photoEl.remove();
                
                zone.innerHTML = `
                    <div class="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-2xl">✅</div>
                    <div>
                        <p class="text-sm font-bold text-white">${zone.querySelector('.text-sm.font-bold')?.textContent || ''}</p>
                        <p class="text-xs text-slate-400">${zone.dataset.id}</p>
                    </div>
                    <span class="ml-auto text-xs text-emerald-400">📷 associée</span>
                `;
                zone.classList.remove('hover:border-blue-500');
                zone.style.borderColor = '#22c55e';
                zone.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';

                if (document.querySelectorAll('.orphan-photo').length === 0) {
                    document.getElementById('orphanPhotosList').innerHTML = '<p class="text-slate-500 text-xs">Toutes les photos ont été associées.</p>';
                }
                loadLocalEleves();
            } else {
                alert("Erreur lors de l'association.");
            }
        });
    });
}

window.closeDragDropModal = function() {
    const modal = document.getElementById('dragDropModal');
    if (modal) modal.remove();
};
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

async function renderEleves() {
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
                <span class="text-[10px] text-slate-500 mt-1">🎂 ${e.dateNaissance || 'Date inconnue'}</span>
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