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

    const csvInput = document.getElementById('csvFile');
    const zipInput = document.getElementById('zipFile');

    if (csvInput) csvInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            currentEleves = await importCSV(e.target.files[0]);
            renderEleves();
        }
        e.target.value = '';
    });

    if (zipInput) zipInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            try {
                currentEleves = await importZIP(e.target.files[0]);
                renderEleves();
                checkPendingStudents();
            } catch (err) {
                console.error(err);
                alert("Erreur lors de l'import du ZIP");
            }
        }
        e.target.value = '';
    });

    // Vérifie au chargement initial s'il y a des élèves à associer
    checkPendingStudents();
}

function checkPendingStudents() {
    const pending = getPendingStudents();
    if (pending.length > 0) {
        openManualAssignModal();
    }
}

async function renderEleves() {
    const container = document.getElementById('eleveList');
    if (!container) return;

    container.innerHTML = '';

    if (currentEleves.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm col-span-full">Aucun élève importé. Importez un CSV ou un ZIP.</p>';
        return;
    }

    for (const e of currentEleves) {
        const url = await getPhotoUrl(e.id);
        const photoHtml = url 
            ? `<img src="${url}" class="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-slate-600">`
            : `<div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl">👤</div>`;

        // Badge jaune si l'élève a besoin d'une vérification manuelle (VMA manquante ou créé depuis ZIP)
        let needsBadge = '';
        if (e.needsManualCheck || !e.vma) {
            needsBadge = '<span class="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-0.5 rounded-full text-[10px] font-black">!</span>';
        }

        container.innerHTML += `
            <div class="bg-slate-800 rounded-2xl p-4 flex flex-col items-center border border-slate-700 text-center relative">
                ${needsBadge}
                <div class="mb-2">${photoHtml}</div>
                <p class="font-black text-white leading-tight">${e.prenom}</p>
                <p class="text-xs text-slate-400 uppercase font-bold mb-2">${e.nom}</p>
                <div class="flex gap-2 text-xs font-bold">
                    <span class="bg-black px-2 py-1 rounded border border-slate-600 text-emerald-400">VMA: ${e.vma || '--'}</span>
                    <span class="bg-black px-2 py-1 rounded border border-slate-600 text-blue-400">Palier: ${e.palier || '--'}</span>
                </div>
                <span class="text-[10px] text-slate-500 mt-1">${e.sexe ? e.sexe : 'Sexe inconnu'}</span>
            </div>
        `;
    }
}

// === MODAL DE GESTION MANUELLE (CORRIGÉE) ===
async function openManualAssignModal() {
    const pending = getPendingStudents();
    if (pending.length === 0) return;

    // On retire une modal existante si elle est déjà là
    const existing = document.getElementById('manualAssignModal');
    if (existing) existing.remove();

    // 1. On pré-calcule les URLs des photos AVANT de générer le HTML (pour éviter le "await" dans le map)
    const pendingWithUrls = [];
    for (const stu of pending) {
        const url = await getPhotoUrl(stu.id);
        pendingWithUrls.push({ ...stu, photoUrl: url || '' });
    }

    // 2. On génère le HTML avec les données prêtes
    const modalHtml = `
    <div id="manualAssignModal" class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 class="text-xl font-black text-blue-400 uppercase mb-4">Gestion manuelle des photos</h3>
            <p class="text-xs text-slate-400 mb-4">Ces élèves ont été créés depuis le ZIP, mais n'ont pas pu être associés au CSV (nom mal orthographié, VMA manquante, etc.). Associez-les manuellement.</p>
            
            <div class="space-y-3">
                ${pendingWithUrls.map(stu => `
                    <div class="bg-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4 border border-slate-700">
                        <div class="flex items-center gap-3">
                            <img src="${stu.photoUrl}" class="w-12 h-12 rounded-full object-cover bg-slate-700">
                            <div>
                                <p class="font-bold text-white">${stu.prenom} ${stu.nom}</p>
                                <p class="text-xs text-slate-500">VMA: ${stu.vma || '???'} | Sexe: ${stu.sexe || '?'}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="document.getElementById('file_${stu.id}').click()" class="btn bg-blue-600 text-xs uppercase">📁 Téléverser</button>
                            <input type="file" id="file_${stu.id}" accept="image/*" class="hidden" onchange="window.uploadManual('${stu.id}', this)">
                            
                            <button onclick="assignOrphan('${stu.id}')" class="btn bg-purple-600 text-xs uppercase">🔗 Lier orpheline</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <button onclick="document.getElementById('manualAssignModal').remove()" class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-bold text-white text-sm uppercase">Fermer</button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Fonctions globales pour les boutons
    window.uploadManual = async (studentId, input) => {
        if (input.files.length > 0) {
            await uploadManualPhoto(studentId, input.files[0]);
            loadLocalEleves();
            document.getElementById('manualAssignModal').remove();
            alert("✅ Photo associée !");
        }
    };

    window.assignOrphan = async (studentId) => {
        // Ici, on demandera de choisir un fichier (simulation)
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

// Fonctions globales pour les boutons principaux
window.addEleve = function() {
    const prenom = prompt("Prénom ?");
    const nom = prompt("Nom ?");
    const vma = parseFloat(prompt("VMA ?"));
    
    if (!prenom || !nom || isNaN(vma)) return alert("Champs invalides");
    
    const normalized = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
    const id = `${normalized(nom)}_${normalized(prenom).charAt(0)}`;
    
    const newEleve = {
        id: id,
        prenom: prenom,
        nom: nom.toUpperCase(),
        vma: vma,
        palier: 0,
        sexe: ''
    };

    currentEleves.push(newEleve);
    localStorage.setItem('eps_arena_eleves', JSON.stringify(currentEleves));
    renderEleves();
};

window.purgeEleves = function() {
    if (!confirm("Supprimer tous les élèves ? (Les photos resteront dans le navigateur)")) return;
    currentEleves = [];
    localStorage.removeItem('eps_arena_eleves');
    renderEleves();
};