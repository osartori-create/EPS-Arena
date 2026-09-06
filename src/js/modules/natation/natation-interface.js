// src/js/modules/natation/natation-interface.js
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, update, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse, setLocalMapping } from '../../core/live-engine.js';

let currentClasse = '';
let elevesData = [];
let tempsData = {};
let tempsUnsubscribe = null; // pour nettoyer l'écoute plus tard

// ============================================================
// INITIALISATION
// ============================================================
export function initNatationInterface() {
    const container = document.getElementById('viewNatationSettings');
    if (!container) {
        const parent = document.getElementById('viewActivities');
        if (!parent) return;
        const div = document.createElement('div');
        div.id = 'viewNatationSettings';
        div.className = 'hidden space-y-4';
        // 🔽 Remplacer prepend() par appendChild()
        parent.appendChild(div);
        setTimeout(() => initNatationInterface(), 50);
        return;
    }

    // Si la vue est cachée, on l'affiche
    container.classList.remove('hidden');

    currentClasse = getCurrentClasse();
    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
        return;
    }

    // Charger les données...
    elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    elevesData.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    elevesData.forEach((e, idx) => { e.numero = idx + 1; });

    chargerTemps();

    container.innerHTML = '';
    const header = createHeader();
    container.appendChild(header);
    const grid = createGrid();
    container.appendChild(grid);

    // Écouter le changement de classe
    const select = document.getElementById('selectClasse');
    if (select) {
        select.removeEventListener('change', onClassChange);
        select.addEventListener('change', onClassChange);
    }
}

function onClassChange() {
    currentClasse = getCurrentClasse();
    if (currentClasse) initNatationInterface();
}

// ============================================================
// CHARGEMENT DES TEMPS (Firebase + local)
// ============================================================
function chargerTemps() {
    if (tempsUnsubscribe) {
        tempsUnsubscribe();
        tempsUnsubscribe = null;
    }
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps`);
    tempsUnsubscribe = onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        const grid = document.getElementById('natation-grid');
        if (grid) renderGrid(grid);
    });
}

// ============================================================
// EN-TÊTE
// ============================================================
function createHeader() {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 flex-wrap gap-2';

    const title = document.createElement('h3');
    title.className = 'font-black text-blue-400 uppercase text-sm';
    title.textContent = '🏊 Natation – Indice de nage (25m)';

    const right = document.createElement('div');
    right.className = 'flex gap-2 flex-wrap';

    // Distance
    const distGroup = document.createElement('div');
    distGroup.className = 'flex items-center gap-2';
    const distLabel = document.createElement('label');
    distLabel.className = 'text-xs font-bold text-slate-400';
    distLabel.textContent = 'Distance (m)';
    const distInput = document.createElement('input');
    distInput.type = 'number';
    distInput.id = 'natation-distance';
    distInput.value = '25';
    distInput.min = '10';
    distInput.max = '100';
    distInput.className = 'w-16 bg-slate-900 border border-slate-600 rounded p-1 text-white text-center';
    distGroup.appendChild(distLabel);
    distGroup.appendChild(distInput);
    right.appendChild(distGroup);

    const btnTransmettre = document.createElement('button');
    btnTransmettre.className = 'bg-blue-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-blue-400 active:scale-95';
    btnTransmettre.textContent = '📡 Transmettre';
    btnTransmettre.onclick = () => transmettreNatationConfig();

    const btnExport = document.createElement('button');
    btnExport.className = 'bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400 active:scale-95';
    btnExport.textContent = '⬇️ Export JSON';
    btnExport.onclick = () => exportNatationConfig();

    const btnImport = document.createElement('button');
    btnImport.className = 'bg-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400 active:scale-95';
    btnImport.textContent = '⬆️ Import JSON';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'importNatationFile';
    fileInput.className = 'hidden';
    fileInput.accept = '.json';
    fileInput.onchange = (e) => importNatationConfig(e);
    btnImport.onclick = () => fileInput.click();
    btnImport.appendChild(fileInput);

    right.appendChild(btnTransmettre);
    right.appendChild(btnExport);
    right.appendChild(btnImport);

    div.appendChild(title);
    div.appendChild(right);
    return div;
}

// ============================================================
// GRILLE DES ÉLÈVES (inspirée du Tournoi)
// ============================================================
function createGrid() {
    const div = document.createElement('div');
    div.id = 'natation-grid';
    div.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
    renderGrid(div);
    return div;
}

async function renderGrid(container) {
    const elevesAffiches = elevesData.filter(e => e.numero !== undefined);
    if (elevesAffiches.length === 0) {
        container.innerHTML = '<p class="text-slate-500 col-span-full text-center">Aucun élève importé.</p>';
        return;
    }

    let html = '';
    for (const eleve of elevesAffiches) {
        const temps = tempsData[eleve.id] || null;
        const tempsStr = temps !== null ? `${(temps / 1000).toFixed(1)}s` : '--';
        const photoHtml = await getPhotoUrl(eleve.id) 
            ? `<img src="${await getPhotoUrl(eleve.id)}" class="w-14 h-14 rounded-full object-cover border-2 border-slate-500">`
            : `<div class="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-2xl">👤</div>`;

        const sexeBg = eleve.sexe === 'M' ? 'bg-blue-200 border-blue-400' : 
                        eleve.sexe === 'F' ? 'bg-rose-200 border-rose-400' : 
                        'bg-slate-200 border-slate-400';

        html += `
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-slate-700">
                <div class="flex items-center gap-3">
                    <div class="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ${sexeBg} flex items-center justify-center">
                        ${photoHtml}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-black text-white text-sm truncate">${eleve.prenom} ${eleve.nom}</div>
                        <div class="text-xs text-slate-400">#${eleve.numero}</div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-yellow-400 font-bold text-lg">${tempsStr}</span>
                            <button onclick="window.modifierTempsNatation('${eleve.id}')" 
                                    class="bg-blue-600 text-white text-xs px-2 py-1 rounded-lg font-black hover:bg-blue-700">
                                ✏️
                            </button>
                            ${temps !== null ? `<button onclick="window.supprimerTempsNatation('${eleve.id}')" 
                                    class="bg-red-600 text-white text-xs px-2 py-1 rounded-lg font-black hover:bg-red-700">
                                🗑️
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// ACTIONS : MODIFIER / SUPPRIMER UN TEMPS
// ============================================================
window.modifierTempsNatation = function(eleveId) {
    const eleve = elevesData.find(e => e.id === eleveId);
    if (!eleve) return;
    const tempsActuel = tempsData[eleveId] || null;
    const valeur = prompt(`Nouveau temps pour ${eleve.prenom} ${eleve.nom} (en secondes) :`, tempsActuel !== null ? (tempsActuel/1000).toFixed(1) : '');
    if (valeur === null) return;
    const secondes = parseFloat(valeur.replace(',', '.'));
    if (isNaN(secondes) || secondes < 0) {
        alert('Valeur invalide.');
        return;
    }
    const tempsMs = Math.round(secondes * 1000);
    sauvegarderTemps(eleveId, tempsMs);
};

window.supprimerTempsNatation = function(eleveId) {
    if (!confirm('Supprimer ce temps ?')) return;
    sauvegarderTemps(eleveId, null);
};

function sauvegarderTemps(eleveId, tempsMs) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps/${eleveId}`);
    if (tempsMs === null) {
        set(tempsRef, null);
    } else {
        set(tempsRef, tempsMs);
    }
    // Mise à jour locale immédiate
    if (tempsMs === null) {
        delete tempsData[eleveId];
    } else {
        tempsData[eleveId] = tempsMs;
    }
    const grid = document.getElementById('natation-grid');
    if (grid) renderGrid(grid);
}

// ============================================================
// TRANSMISSION FIREBASE
// ============================================================
export async function transmettreNatationConfig() {
    const classe = currentClasse || getCurrentClasse();
    if (!classe) return alert('Sélectionnez une classe.');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `etablissements/0680013V/profs/${profCode}`;
    const distance = parseInt(document.getElementById('natation-distance')?.value) || 25;

    // Mapping local : numéro -> eleveId
    const localMapping = {};
    elevesData.forEach(e => {
        if (e.numero) {
            localMapping[`${classe}_${e.numero}`] = e.id;
        }
    });
    setLocalMapping(classe, localMapping);

    // Config principale
    const configData = {
        activite: 'natation',
        distance: distance,
        nbEleves: elevesData.length
    };

    try {
        await set(ref(db, `${baseProf}/${classe}/natation/config`), configData);
        await set(ref(db, `${baseProf}/${classe}/config`), { activite: 'natation' });
        await set(ref(db, `${baseProf}/active_classes/${classe}`), true);
        alert('✅ Configuration Natation transmise aux iPads !');
    } catch (e) {
        console.error(e);
        alert('Erreur lors de la transmission.');
    }
}

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================
export function exportNatationConfig() {
    const classe = currentClasse || getCurrentClasse();
    if (!classe) return alert('Sélectionnez une classe.');
    const distance = document.getElementById('natation-distance')?.value || '25';
    const data = {
        version: 1,
        classe,
        activite: 'natation',
        distance: parseInt(distance, 10),
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        temps: tempsData
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${classe}_natation_${data.date}.json`;
    a.click();
}

export function importNatationConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe) throw new Error('Format invalide');
            if (data.temps) {
                const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
                const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${data.classe}/natation/temps`);
                await set(tempsRef, data.temps);
                if (data.distance) {
                    const distInput = document.getElementById('natation-distance');
                    if (distInput) distInput.value = data.distance;
                }
                alert('✅ Temps importés avec succès !');
                if (currentClasse === data.classe) {
                    chargerTemps();
                } else {
                    const select = document.getElementById('selectClasse');
                    if (select) {
                        select.value = data.classe;
                        select.dispatchEvent(new Event('change'));
                    }
                }
            } else {
                alert('Aucune donnée de temps à importer.');
            }
        } catch (err) {
            alert('❌ Erreur import : ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}