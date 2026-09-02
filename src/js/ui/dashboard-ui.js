// src/js/ui/dashboard-ui.js
import { importCSV, importZIP, getPhotoUrl, getPendingStudents, getOrphanPhotos, assignPhotoToStudent, uploadManualPhoto, updateStudentForce, getExistingEleves, saveEleves } from '../services/admin-service.js';

let currentEleves = [];
let activeClasse = "";

function getStorageKey() {
    return `eps_arena_eleves_${activeClasse}`;
}

function loadLocalEleves() {
    currentEleves = getExistingEleves(activeClasse);
    renderEleves();
}

export function initAdminUI() {
    const select = document.getElementById('selectClasse');
    if (select) {
        select.addEventListener('change', (e) => {
            activeClasse = e.target.value;
            loadLocalEleves();
            checkPendingStudents();
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
                    currentEleves = await importZIP(e.target.files[0], activeClasse);
                    renderEleves();
                    checkPendingStudents();
                    alert(`✅ ${currentEleves.length} élève(s) importé(s) depuis les photos.`);
                } catch (err) {
                    console.error(err);
                    alert("Erreur lors de l'import du ZIP.\nVérifie que les noms de fichiers sont au format _NOM,_Prénom_M.jpg");
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
                    currentEleves = await importCSV(e.target.files[0], activeClasse);
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

// Le reste du fichier (renderEleves, checkPendingStudents, etc.) reste inchangé.
// Je le réécris ci-dessous pour être complet.

function checkPendingStudents() {
    const pending = getPendingStudents(activeClasse);
    if (pending.length > 0) {
        openManualAssignModal();
    }
}

async function renderEleves() {
    const container = document.getElementById('eleveList');
    if (!container) return;
    container.innerHTML = '';

    if (currentEleves.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm col-span-full">Aucun élève importé pour cette classe.<br>📸 Utilisez "Import ZIP Photos" pour créer la classe.</p>';
        return;
    }

    for (const e of currentEleves) {
        const url = await getPhotoUrl(e.id);
        const photoHtml = url
            ? `<img src="${url}" class="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-slate-600">`
            : `<div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl">👤</div>`;

        let needsBadge = '';
        if (e.needsManualCheck || !e.vma) {
            needsBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-0.5 rounded-full text-[10px] font-black">!</span>';
        }

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
                ${needsBadge}
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
    }
}

window.setForce = function(studentId, force) {
    updateStudentForce(studentId, force, activeClasse);
    loadLocalEleves();
};

async function openManualAssignModal() {
    const pending = getPendingStudents(activeClasse);
    if (pending.length === 0) return;

    const existing = document.getElementById('manualAssignModal');
    if (existing) existing.remove();

    const pendingWithUrls = [];
    for (const stu of pending) {
        const url = await getPhotoUrl(stu.id);
        pendingWithUrls.push({ ...stu, photoUrl: url || '' });
    }

    const orphans = getOrphanPhotos(activeClasse);
    const orphansWithUrls = [];
    for (const o of orphans) {
        const url = await getPhotoUrl(o.id);
        orphansWithUrls.push({ ...o, photoUrl: url || '' });
    }

    const modalHtml = `
    <div id="manualAssignModal" class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <h3 class="text-xl font-black text-blue-400 uppercase mb-4">Association des photos</h3>
            <p class="text-xs text-slate-400 mb-4">
                <strong>1.</strong> Cliquez sur une photo à gauche pour la sélectionner (elle devient jaune).<br>
                <strong>2.</strong> Cliquez ensuite sur l'élève à droite pour lui attribuer la photo.
            </p>
            <div class="flex gap-6">
                <div class="w-1/3">
                    <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Photos sans élève</h4>
                    <div id="orphansList" class="flex flex-col gap-3 min-h-[200px]">
                        ${orphansWithUrls.length === 0 ? '<p class="text-slate-500 text-xs">Aucune photo orpheline.</p>' : ''}
                        ${orphansWithUrls.map(o => `
                            <div id="orphan-${o.id}" onclick="selectOrphan('${o.id}')" 
                                 class="bg-slate-800 p-3 rounded-2xl border-2 border-slate-600 cursor-pointer transition-all hover:border-purple-400 flex items-center gap-3">
                                <img src="${o.photoUrl}" class="w-12 h-12 rounded-full object-cover pointer-events-none">
                                <div class="pointer-events-none">
                                    <p class="font-bold text-white text-sm">${o.prenom} ${o.nom}</p>
                                    <p class="text-[10px] text-slate-500">Sexe: ${o.sexe || '?'}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="w-2/3">
                    <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Élèves en attente d'une photo</h4>
                    <div id="pendingList" class="flex flex-col gap-3 min-h-[200px]">
                        ${pendingWithUrls.map(stu => `
                            <div id="student-${stu.id}" onclick="assignToStudent('${stu.id}')"
                                 class="bg-slate-800 p-4 rounded-2xl border-2 border-dashed border-slate-600 flex items-center justify-between transition-colors hover:border-emerald-500 cursor-pointer">
                                <div class="flex items-center gap-3">
                                    <img src="${stu.photoUrl || 'https://via.placeholder.com/50'}" class="w-12 h-12 rounded-full object-cover bg-slate-700">
                                    <div>
                                        <p class="font-bold text-white">${stu.prenom} ${stu.nom}</p>
                                        <p class="text-xs text-slate-500">VMA: ${stu.vma || '???'} | Sexe: ${stu.sexe || '?'}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <button onclick="document.getElementById('manualAssignModal').remove()" class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-bold text-white text-sm uppercase">Fermer</button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    window.selectedOrphanId = null;

    window.selectOrphan = (orphanId) => {
        document.querySelectorAll('[id^="orphan-"]').forEach(el => {
            el.classList.remove('ring-4', 'ring-yellow-400', 'border-yellow-500');
            el.classList.add('border-slate-600');
        });
        window.selectedOrphanId = orphanId;
        const el = document.getElementById(`orphan-${orphanId}`);
        if (el) {
            el.classList.remove('border-slate-600');
            el.classList.add('ring-4', 'ring-yellow-400', 'border-yellow-500');
        }
    };

    window.assignToStudent = async (studentId) => {
        if (!window.selectedOrphanId) {
            alert("Veuillez d'abord sélectionner une photo à gauche.");
            return;
        }
        if (await assignPhotoToStudent(studentId, window.selectedOrphanId, activeClasse)) {
            alert("✅ Photo associée avec succès !");
            loadLocalEleves();
            document.getElementById('manualAssignModal').remove();
            checkPendingStudents();
        } else {
            alert("Erreur lors de l'association.");
        }
    };
}

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
    renderEleves();
};

window.purgeEleves = function() {
    if (!confirm("Supprimer tous les élèves de cette classe ?")) return;
    currentEleves = [];
    saveEleves(activeClasse, []);
    renderEleves();
};