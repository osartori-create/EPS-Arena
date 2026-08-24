// src/js/ui/dashboard-ui.js
import { importCSV, importZIP, getPhotoUrl } from '../services/admin-service.js';

let currentEleves = [];

// Charger les élèves depuis le stockage local au démarrage
function loadLocalEleves() {
    const stored = localStorage.getItem('eps_arena_eleves');
    currentEleves = stored ? JSON.parse(stored) : [];
    renderEleves();
}

// Initialisation de l'interface Admin
export function initAdminUI() {
    loadLocalEleves();

    // Écouteurs pour les fichiers
    const csvInput = document.getElementById('csvFile');
    const zipInput = document.getElementById('zipFile');

    if (csvInput) {
        csvInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const eleves = await importCSV(e.target.files[0]);
                currentEleves = eleves; // Mettre à jour la liste locale
                renderEleves();
            }
            e.target.value = ''; // Permet de re-sélectionner le même fichier
        });
    }

    if (zipInput) {
        zipInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                try {
                    currentEleves = await importZIP(e.target.files[0]);
                    renderEleves();
                } catch (err) {
                    console.error(err);
                    alert("Erreur lors de l'import du ZIP");
                }
            }
            e.target.value = '';
        });
    }
}

// Rendu de la grille des élèves avec photos (RGPD)
async function renderEleves() {
    const container = document.getElementById('eleveList');
    if (!container) return;

    container.innerHTML = ''; // Vider

    if (currentEleves.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm col-span-full">Aucun élève importé. Importez un CSV ou un ZIP.</p>';
        return;
    }

    for (let i = 0; i < currentEleves.length; i++) {
        const e = currentEleves[i];
        const url = await getPhotoUrl(e.id); // Récupère la photo depuis IndexedDB

        const photoHtml = url 
            ? `<img src="${url}" class="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-slate-600">`
            : `<div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl">👤</div>`;

        container.innerHTML += `
            <div class="bg-slate-800 rounded-2xl p-4 flex flex-col items-center border border-slate-700 text-center relative">
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

// Fonctions globales appelées depuis l'HTML (boutons)
window.addEleve = function() {
    const prenom = prompt("Prénom ?");
    const nom = prompt("Nom ?");
    const vma = parseFloat(prompt("VMA ?"));
    
    if (!prenom || !nom || isNaN(vma)) return alert("Champs invalides");

    // Génération simple de l'ID (normalisation)
    const id = `${nom.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}_${prenom.charAt(0).toUpperCase()}`;
    
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