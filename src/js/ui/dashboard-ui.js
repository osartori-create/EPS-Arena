// src/js/ui/dashboard-ui.js
import { importCSV, importZIP, getPhotoUrl, getPendingStudents, assignPhotoToStudent, uploadManualPhoto } from '../services/admin-service.js';

let currentEleves = [];

function loadLocalEleves() {
    const stored = localStorage.getItem('eps_arena_eleves');
    currentEleves = stored ? JSON.parse(stored) : [];
    renderEleves();
}

export function initAdminUI() {
    loadLocalEleves();
    // ... (écouteurs CSV/ZIP inchangés)
    const csvInput = document.getElementById('csvFile');
    const zipInput = document.getElementById('zipFile');

    if (csvInput) csvInput.addEventListener('change', async (e) => { /* ... */ });
    if (zipInput) zipInput.addEventListener('change', async (e) => { 
        // ... (import ZIP)
        currentEleves = await importZIP(e.target.files[0]);
        renderEleves();
        // Appel de la modal s'il y a des élèves à vérifier
        checkPendingStudents();
    });
    
    // Vérifie au chargement initial
    checkPendingStudents();
}

function checkPendingStudents() {
    const pending = getPendingStudents();
    if (pending.length > 0) {
        openManualAssignModal();
    }
}

async function renderEleves() {
    // ... (Rendu identique à l'ancien code, mais on ajoute un badge pour les besoins de vérification)
    for (const e of currentEleves) {
        const url = await getPhotoUrl(e.id);
        let needsBadge = e.needsManualCheck || !e.vma ? '<span class="bg-yellow-500 text-black px-2 py-0.5 rounded-full text-[10px] font-black absolute top-2 right-2">!</span>' : '';
        // ...
        container.innerHTML += `<div class="bg-slate-800 rounded-2xl p-4 flex flex-col items-center border border-slate-700 text-center relative">${needsBadge} ...`;
    }
}

// === MODAL MANUELLE ===
async function openManualAssignModal() {
    const pending = getPendingStudents();
    if (pending.length === 0) return;

    // On retire une modal existante si elle est déjà là
    const existing = document.getElementById('manualAssignModal');
    if (existing) existing.remove();

    const modalHtml = `
    <div id="manualAssignModal" class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 class="text-xl font-black text-blue-400 uppercase mb-4">Gestion manuelle des photos</h3>
            <p class="text-xs text-slate-400 mb-4">Ces élèves ont été créés depuis le ZIP, mais n'ont pas pu être associés au CSV (nom mal orthographié, VMA manquante, etc.). Associez-les manuellement.</p>
            
            <div class="space-y-3">
                ${pending.map(stu => `
                    <div class="bg-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4 border border-slate-700">
                        <div class="flex items-center gap-3">
                            <img src="${await getPhotoUrl(stu.id) || ''}" class="w-12 h-12 rounded-full object-cover bg-slate-700">
                            <div>
                                <p class="font-bold text-white">${stu.prenom} ${stu.nom}</p>
                                <p class="text-xs text-slate-500">VMA: ${stu.vma || '???'} | Sexe: ${stu.sexe || '?'}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="document.getElementById('file_${stu.id}').click()" class="btn bg-blue-600 text-xs uppercase">📁 Téléverser</button>
                            <input type="file" id="file_${stu.id}" accept="image/*" class="hidden" onchange="window.uploadManual('${stu.id}', this)">
                            
                            <!-- Assignation d'une photo orpheline (à implémenter plus tard si besoin) -->
                            <button onclick="assignOrphan('${stu.id}')" class="btn bg-purple-600 text-xs uppercase">🔗 Lier orpheline</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <button onclick="document.getElementById('manualAssignModal').remove()" class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-bold text-white text-sm uppercase">Fermer</button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Fonction globale pour l'upload manuel
    window.uploadManual = async (studentId, input) => {
        if (input.files.length > 0) {
            const file = input.files[0];
            await uploadManualPhoto(studentId, file);
            loadLocalEleves(); // Rafraîchit la grille
            document.getElementById('manualAssignModal').remove(); // Ferme la modal
            alert("✅ Photo associée !");
        }
    };

    // Fonction globale pour lier une orpheline (simulation simple pour l'instant)
    window.assignOrphan = async (studentId) => {
        // Dans une vraie version, on afficherait la liste des photos orphelines (issues d'imports ZIP pas liés)
        // Ici, pour simplifier, on demande de choisir une image
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            if (e.target.files.length > 0) {
                await uploadManualPhoto(studentId, e.target.files[0]);
                loadLocalEleves();
                document.getElementById('manualAssignModal').remove();
                alert("✅ Photo associée !");
            }
        };
        input.click();
    };
}