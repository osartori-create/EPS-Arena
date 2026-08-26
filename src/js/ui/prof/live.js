// src/js/ui/prof/live.js
import { listenToActivityData, ref, onValue } from '../../core/firebase-service.js';
import { db } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js'; // ✅ Import pour les photos

let currentUnsub = null;
let currentClasse = "";
let configData = {};

export function initLiveUI() {
    const select = document.getElementById('selectClasse');
    if (select) {
        select.addEventListener('change', () => {
            const newClasse = select.value;
            if (newClasse !== currentClasse) {
                currentClasse = newClasse;
                startListening();
                loadConfig();
            }
        });
    }
}

async function loadConfig() {
    if (!currentClasse) return;
    const configRef = ref(db, `${currentClasse}/config`);
    onValue(configRef, (snap) => {
        configData = snap.val() || {};
        renderLiveData(); // Relance le rendu si la config change
    });
}

function startListening() {
    if (currentUnsub) currentUnsub();
    if (!currentClasse) return;

    currentUnsub = listenToActivityData(currentClasse, (type, data) => {
        renderLiveData(type, data);
    });
}

function getStudentsMap() {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const map = {};
    eleves.forEach(e => { map[e.id] = `${e.prenom} ${e.nom}`; });
    return map;
}

function getLocalMapping() {
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    return mapping;
}

// Récupère l'ID de l'élève depuis un code (ex: "E1")
function getEleveIdFromCode(code) {
    if (code.length < 2) return null;
    const lettre = code.slice(0, 1);
    const index = parseInt(code.slice(1)) - 1; 
    
    const localMap = getLocalMapping();
    const key = `${currentClasse}_${lettre}`;
    
    if (localMap[key] && localMap[key][index]) {
        return localMap[key][index];
    }
    return null;
}

// Récupère le nom de l'élève depuis un code
function getNomFromCode(code) {
    const eleveId = getEleveIdFromCode(code);
    if (eleveId) {
        const studentsMap = getStudentsMap();
        if (studentsMap[eleveId]) {
            return studentsMap[eleveId];
        }
    }
    return code; // Si non trouvé, on affiche le code
}

// ✅ Fonction pour obtenir le HTML de la photo (asynchrone)
async function getPhotoHtml(code) {
    const eleveId = getEleveIdFromCode(code);
    if (eleveId) {
        const url = await getPhotoUrl(eleveId);
        if (url) {
            return `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`;
        }
    }
    return `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
}

// ✅ Rendu asynchrone (on attend les photos avant d'afficher)
async function renderLiveData(type, data) {
    const container = document.getElementById('live-content');
    if (!container) return;

    let html = '';

    if (type === 'escalade') {
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade</h3>`;
        html += `<div class="space-y-2">`;
        for (const m of entries) {
            const code = `${m.groupe}${m.role}`;
            const nom = getNomFromCode(code);
            const photoHtml = await getPhotoHtml(code); // Chargement de la photo
            const hauteur = m.hauteur ? `${m.hauteur}m` : 'Top';
            
            html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <div>
                        <span class="font-bold text-white">${nom}</span>
                        <span class="text-xs text-slate-400 ml-2 block">Voie ${m.voie_num} - ${hauteur}</span>
                    </div>
                </div>
                <span class="text-emerald-400 font-black">${m.points}m</span>
            </div>`;
        }
        html += `</div>`;
    }
    else if (type === 'co') {
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧭 Validations CO</h3>`;
        html += `<div class="space-y-2">`;
        for (const v of entries) {
            const nom = getNomFromCode(v.code);
            const photoHtml = await getPhotoHtml(v.code);
            html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <span class="font-bold text-white">${nom}</span>
                </div>
                <span class="text-blue-400 font-black">Balise ${v.balise}</span>
            </div>`;
        }
        html += `</div>`;
    }
    else if (type === 'multi') {
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">⏱️ Chronos Multi</h3>`;
        html += `<div class="space-y-2">`;
        for (const p of entries) {
            const nom = getNomFromCode(p.code);
            const photoHtml = await getPhotoHtml(p.code);
            html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <span class="font-bold text-white">${nom}</span>
                </div>
                <span class="text-yellow-400 font-black">${p.temps}</span>
            </div>`;
        }
        html += `</div>`;
    }

    container.innerHTML = html;
}

// Export CSV
window.exportResultsLive = function() {
    if (!currentClasse) return alert("Sélectionnez une classe.");

    const studentsMap = getStudentsMap();
    const localMap = getLocalMapping();

    let csv = "\uFEFFNom;Type;Valeur\n";

    // On lit le DOM pour exporter les données déjà affichées
    const rows = document.querySelectorAll('#live-content .bg-slate-800');
    rows.forEach(row => {
        const nameSpan = row.querySelector('.text-white');
        const valueSpan = row.querySelector('span:last-child');

        const name = nameSpan ? nameSpan.innerText : '';
        const value = valueSpan ? valueSpan.innerText : '';

        // On tente de retrouver le code depuis le nom (si mapping dispo)
        // Ceci est une simplification, le mieux est de stocker les données brutes en mémoire.
        // Pour l'instant on exporte ce qui est visible.
        csv += `${name};Performance;${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Live_${currentClasse}.csv`;
    a.click();
};