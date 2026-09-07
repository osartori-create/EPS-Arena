// src/js/modules/natation/natation-interface.js
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, update, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse, setLocalMapping } from '../../core/live-engine.js';

let currentClasse = '';
let elevesData = [];
let tempsData = {};
let coupsData = {};
let tempsUnsubscribe = null;
let coupsUnsubscribe = null;

// ============================================================
// BARÈME (tableau ordonné du plus élevé au plus bas)
// ============================================================
const DEFAULT_BAREME = [
    { min: 4.0, label: 'Excellent', couleur: 'bg-emerald-500' },
    { min: 3.0, label: 'Très satisfaisant', couleur: 'bg-blue-500' },
    { min: 2.0, label: 'Satisfaisant', couleur: 'bg-yellow-500' },
    { min: 1.31, label: 'Fragile', couleur: 'bg-orange-500' },
    { min: 0, label: 'Très insuffisant', couleur: 'bg-red-500' }
];

function getBareme() {
    if (!currentClasse) return DEFAULT_BAREME;
    const saved = localStorage.getItem(`eps_arena_natation_bareme_${currentClasse}`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0 && 'min' in parsed[0]) {
                return parsed;
            }
        } catch (e) {}
    }
    return DEFAULT_BAREME;
}

function saveBareme(bareme) {
    if (currentClasse) {
        localStorage.setItem(`eps_arena_natation_bareme_${currentClasse}`, JSON.stringify(bareme));
    }
}

function getNiveau(indice) {
    if (indice === null || isNaN(indice)) {
        return { couleur: 'bg-slate-600', label: '--' };
    }
    const bareme = getBareme();
    // Parcourir du plus haut seuil au plus bas
    for (const niveau of bareme) {
        if (indice >= niveau.min) {
            return { couleur: niveau.couleur, label: niveau.label };
        }
    }
    // Fallback (normalement jamais atteint)
    return { couleur: 'bg-red-500', label: 'Erreur' };
}

// ============================================================
// CALCUL DE L'INDICE
// ============================================================
function calculIndice(tempsMs, nbCoups) {
    if (tempsMs === null || nbCoups === null || tempsMs <= 0 || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

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
        parent.appendChild(div);
        setTimeout(() => initNatationInterface(), 50);
        return;
    }

    container.classList.remove('hidden');

    currentClasse = getCurrentClasse();
    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
        return;
    }

    elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    elevesData.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    elevesData.forEach((e, idx) => { e.numero = idx + 1; });

    chargerTempsEtCoups();

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
// CHARGEMENT DES TEMPS ET DES COUPS
// ============================================================
function chargerTempsEtCoups() {
    if (tempsUnsubscribe) tempsUnsubscribe();
    if (coupsUnsubscribe) coupsUnsubscribe();
    
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/coups`);

    tempsUnsubscribe = onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        const grid = document.getElementById('natation-grid');
        if (grid) renderGrid(grid);
    });

    coupsUnsubscribe = onValue(coupsRef, (snap) => {
        coupsData = snap.val() || {};
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

    // Bouton Barème
    const btnBareme = document.createElement('button');
    btnBareme.className = 'bg-purple-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400 active:scale-95';
    btnBareme.textContent = '⚙️ Barème';
    btnBareme.onclick = ouvrirBaremeModal;
    right.appendChild(btnBareme);

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
// MODALE BARÈME (adaptée au tableau)
// ============================================================
function ouvrirBaremeModal() {
    const bareme = getBareme();
    // bareme est un tableau trié par min décroissant
    // On va construire une modale avec des inputs pour chaque seuil (sauf le dernier qui est 0)
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    let html = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
            <h3 class="text-xl font-black text-blue-400 text-center mb-4">⚙️ Barème de l'indice de nage</h3>
            <p class="text-xs text-slate-400 text-center mb-4">Seuils minimums pour chaque niveau</p>
            <div class="space-y-3">
    `;
    // On affiche tous les niveaux sauf le dernier (Très insuffisant) qui a min=0
    for (let i = 0; i < bareme.length - 1; i++) {
        const niveau = bareme[i];
        const couleur = niveau.couleur.replace('bg-', '');
        const emoji = couleur === 'emerald-500' ? '🟢' : couleur === 'blue-500' ? '🔵' : couleur === 'yellow-500' ? '🟡' : '🟠';
        html += `
            <div class="flex items-center gap-3">
                <span class="w-24 text-xs font-bold text-slate-400">${emoji} ${niveau.label}</span>
                <input type="number" id="bareme-${i}" value="${niveau.min}" step="0.1" min="0" max="10" class="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-white text-center">
                <span class="text-xs text-slate-500">et +</span>
            </div>
        `;
    }
    // Dernier niveau (Très insuffisant) affiché en lecture seule
    const dernier = bareme[bareme.length - 1];
    html += `
        <div class="flex items-center gap-3 opacity-70">
            <span class="w-24 text-xs font-bold text-slate-400">🔴 ${dernier.label}</span>
            <span class="flex-1 text-center text-xs text-slate-500">moins de ${dernier.min}</span>
        </div>
    `;
    html += `
            </div>
            <div class="flex gap-3 mt-6">
                <button onclick="window.fermerBaremeModal()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white text-sm active:scale-95">Annuler</button>
                <button onclick="window.sauvegarderBareme()" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">💾 Enregistrer</button>
            </div>
        </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    window._baremeModal = modal;
}

window.fermerBaremeModal = function() {
    if (window._baremeModal) {
        window._baremeModal.remove();
        window._baremeModal = null;
    }
};

window.sauvegarderBareme = function() {
    const inputs = document.querySelectorAll('#bareme-modal input[type="number"]');
    const baremeActuel = getBareme();
    const nouveauBareme = [];
    for (let i = 0; i < inputs.length; i++) {
        const val = parseFloat(inputs[i].value);
        if (isNaN(val) || val < 0) {
            alert('Veuillez saisir des valeurs numériques valides.');
            return;
        }
        // On garde le label et la couleur du niveau correspondant
        const niveau = baremeActuel[i];
        nouveauBareme.push({
            min: val,
            label: niveau.label,
            couleur: niveau.couleur
        });
    }
    // Ajouter le dernier niveau (Très insuffisant) avec min = 0
    const dernier = baremeActuel[baremeActuel.length - 1];
    nouveauBareme.push({
        min: 0,
        label: dernier.label,
        couleur: dernier.couleur
    });
    // Trier par min décroissant
    nouveauBareme.sort((a, b) => b.min - a.min);
    saveBareme(nouveauBareme);
    window.fermerBaremeModal();
    const grid = document.getElementById('natation-grid');
    if (grid) renderGrid(grid);
    alert('✅ Barème enregistré !');
};

// ============================================================
// GRILLE DES ÉLÈVES
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
        const coups = coupsData[eleve.id] || null;
        const indice = calculIndice(temps, coups);
        const niveau = indice !== null ? getNiveau(indice) : { couleur: 'bg-slate-600', label: '--' };

        const tempsStr = temps !== null ? `${(temps / 1000).toFixed(1)}s` : '--';
        const coupsStr = coups !== null ? `${coups}` : '--';
        const indiceStr = indice !== null ? indice.toFixed(2) : '--';

        const photoUrl = await getPhotoUrl(eleve.id);
        const photoHtml = photoUrl 
            ? `<img src="${photoUrl}" class="w-14 h-14 rounded-full object-cover border-2 border-slate-500">`
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
                        <div class="text-xs text-slate-400">N° ${eleve.numero}</div>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="text-yellow-400 font-bold text-sm">${tempsStr}</span>
                            <span class="text-blue-400 font-bold text-sm">${coupsStr} bras</span>
                            <span class="${niveau.couleur} px-2 py-0.5 rounded-full text-xs font-black text-white">${indiceStr}</span>
                            <button onclick="window.modifierTempsNatation('${eleve.id}')" 
                                    class="bg-blue-600 text-white text-xs px-2 py-1 rounded-lg font-black hover:bg-blue-700 active:scale-95">
                                ✏️
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// ACTIONS : MODIFIER / SUPPRIMER
// ============================================================
window.modifierTempsNatation = function(eleveId) {
    const eleve = elevesData.find(e => e.id === eleveId);
    if (!eleve) return;
    const tempsActuel = tempsData[eleveId] || null;
    const coupsActuel = coupsData[eleveId] || null;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
            <h3 class="text-xl font-black text-white text-center mb-4">${eleve.prenom} ${eleve.nom}</h3>
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Temps (secondes)</label>
                    <input type="number" id="edit-temps" value="${tempsActuel !== null ? (tempsActuel/1000).toFixed(1) : ''}" 
                           step="0.1" min="0" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-xl font-black text-center">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Nombre de coups de bras</label>
                    <input type="number" id="edit-coups" value="${coupsActuel !== null ? coupsActuel : ''}" 
                           min="1" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-xl font-black text-center">
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button onclick="window.fermerEditNatation()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white text-sm active:scale-95">Annuler</button>
                <button onclick="window.sauvegarderEditNatation('${eleveId}')" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">💾 Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    window._editModal = modal;
};

window.fermerEditNatation = function() {
    if (window._editModal) {
        window._editModal.remove();
        window._editModal = null;
    }
};

window.sauvegarderEditNatation = function(eleveId) {
    const tempsInput = document.getElementById('edit-temps');
    const coupsInput = document.getElementById('edit-coups');
    const temps = parseFloat(tempsInput.value.replace(',', '.'));
    const coups = parseInt(coupsInput.value);
    
    if (isNaN(temps) || temps < 0) {
        alert('Veuillez saisir un temps valide.');
        return;
    }
    if (isNaN(coups) || coups < 1) {
        alert('Veuillez saisir un nombre de coups valide (≥ 1).');
        return;
    }
    
    const tempsMs = Math.round(temps * 1000);
    sauvegarderTemps(eleveId, tempsMs);
    sauvegarderCoups(eleveId, coups);
    window.fermerEditNatation();
};

function sauvegarderTemps(eleveId, tempsMs) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps/${eleveId}`);
    set(tempsRef, tempsMs);
}

function sauvegarderCoups(eleveId, nbCoups) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/coups/${eleveId}`);
    set(coupsRef, nbCoups);
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

    const localMapping = {};
    elevesData.forEach(e => {
        if (e.numero) {
            localMapping[`${classe}_${e.numero}`] = e.id;
        }
    });
    
    // ✅ NOUVEAU : sauvegarder le mapping dans Firebase
    const mappingRef = ref(db, `${baseProf}/${classe}/natation/mapping`);
    await set(mappingRef, localMapping);
    setLocalMapping(classe, localMapping);

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
        version: 2,
        classe,
        activite: 'natation',
        distance: parseInt(distance, 10),
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        temps: tempsData,
        coups: coupsData,
        bareme: getBareme()
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
            const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
            
            if (data.temps) {
                const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${data.classe}/natation/temps`);
                await set(tempsRef, data.temps);
            }
            if (data.coups) {
                const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${data.classe}/natation/coups`);
                await set(coupsRef, data.coups);
            }
            if (data.bareme && Array.isArray(data.bareme)) {
                localStorage.setItem(`eps_arena_natation_bareme_${data.classe}`, JSON.stringify(data.bareme));
            }
            if (data.distance) {
                const distInput = document.getElementById('natation-distance');
                if (distInput) distInput.value = data.distance;
            }
            alert('✅ Données Natation importées avec succès !');
            if (currentClasse === data.classe) {
                chargerTempsEtCoups();
            } else {
                const select = document.getElementById('selectClasse');
                if (select) {
                    select.value = data.classe;
                    select.dispatchEvent(new Event('change'));
                }
            }
        } catch (err) {
            alert('❌ Erreur import : ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}