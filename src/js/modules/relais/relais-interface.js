// src/js/modules/relais/relais-interface.js
// UI Professeur : groupes, réglages, import CSV, transmission
// ⚠️ RGPD : seules les lettres (a,b,c) et le sexe transitent sur Firebase.
// Le mapping nom ↔ code reste dans localStorage (prof uniquement).

import { db, ref, set } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse, setLocalMapping, getLocalMapping } from '../../core/live-engine.js';
import { getLettre } from './relais-core.js';

let currentClasse = '';
let sortableInstances = [];

function getStorageKey(classe) {
    return `eps_arena_relais_groupes_${classe}`;
}

function getVitessesKey(classe) {
    return `eps_arena_relais_vitesses_${classe}`;
}

// ============================================================
// INITIALISATION
// ============================================================
export function initRelaisInterface() {
    const container = document.getElementById('viewRelaisSettings');
    if (!container) {
        console.warn('[Relais] Conteneur introuvable, création dynamique');
        const parent = document.getElementById('viewActivities');
        if (!parent) return;
        const div = document.createElement('div');
        div.id = 'viewRelaisSettings';
        div.className = 'hidden space-y-4';
        parent.appendChild(div);
        setTimeout(() => initRelaisInterface(), 50);
        return;
    }

    currentClasse = getCurrentClasse();
    container.innerHTML = '';

    container.appendChild(createHeader());
    container.appendChild(createBody());

    const savedNbGroupes = localStorage.getItem(`eps_arena_relais_nb_groupes_${currentClasse}`) || 5;
    const savedTaille = localStorage.getItem(`eps_arena_relais_taille_${currentClasse}`) || 3;
    const savedMode = localStorage.getItem(`eps_arena_relais_mode_${currentClasse}`) || 'essai';
    const savedNbPlots = localStorage.getItem(`eps_arena_relais_nb_plots_${currentClasse}`) || 14;
    const elNbG = document.getElementById('relaisNbGroupes');
    const elT = document.getElementById('relaisTailleGroupe');
    const elM = document.getElementById('relaisMode');
    const elP = document.getElementById('relaisNbPlots');
    if (elNbG) elNbG.value = savedNbGroupes;
    if (elT) elT.value = savedTaille;
    if (elM) elM.value = savedMode;
    if (elP) elP.value = savedNbPlots;

    setTimeout(() => {
        window.relaisUpdateModeStyle();
        loadAffectations();
    }, 100);
}

// ============================================================
// EN-TÊTE
// ============================================================
function createHeader() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-5 rounded-2xl border border-slate-700';

    div.innerHTML = `
        <div class="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h3 class="font-black text-blue-400 uppercase text-sm">🏁 Relais – Configuration</h3>
            <div class="flex flex-wrap gap-2">
                <button onclick="window.relaisGenererGroupes()" 
                        class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400 active:scale-95">
                    🔄 Générer Groupes
                </button>
                <button onclick="window.relaisImportCSV()" 
                        class="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400 active:scale-95">
                    📥 Import CSV iDoeceo
                </button>
                <button onclick="window.relaisExportConfig()" 
                        class="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400 active:scale-95">
                    ⬇️ Export JSON
                </button>
                <button onclick="document.getElementById('relaisImportJSON').click()" 
                        class="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400 active:scale-95">
                    ⬆️ Import JSON
                </button>
                <input type="file" id="relaisImportJSON" class="hidden" accept=".json" onchange="window.relaisImportConfig(event)">
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
                <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Mode</label>
                <select id="relaisMode" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm" onchange="window.relaisUpdateModeStyle()">
                    <option value="essai">🌱 Essai (indicatif)</option>
                    <option value="competition">🏆 Compétition (classement)</option>
                </select>
            </div>
            <div>
                <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Nb groupes</label>
                <input type="number" id="relaisNbGroupes" value="5" min="1" max="30"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-sm">
            </div>
            <div>
                <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Taille cible / groupe</label>
                <input type="number" id="relaisTailleGroupe" value="3" min="2" max="6"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-sm">
            </div>
            <div>
                <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Nb plots cibles</label>
                <input type="number" id="relaisNbPlots" value="14" min="5" max="20"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-sm">
                <p class="text-[10px] text-slate-500 mt-0.5">De 15 à 28 km/h</p>
            </div>
        </div>

        <div id="relaisBannerInfo" class="text-center text-xs font-bold py-2 rounded-xl mb-4 bg-emerald-900/30 text-emerald-300 border border-emerald-500/50">
            🌱 Mode ESSAI — les élèves peuvent tester sans conséquence
        </div>

        <div class="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4 text-[11px] text-slate-400">
            🔒 <strong class="text-emerald-400">RGPD :</strong> seules les lettres (a, b, c) et le sexe sont transmises sur Firebase.
            Le nom des élèves reste sur cet appareil (mapping local).
        </div>

        <button onclick="window.relaisTransmettre()" 
                class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-base uppercase tracking-widest text-white border-4 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] active:scale-[0.98] transition-transform">
            📡 Transmettre aux iPads Élèves
        </button>
    `;

    return div;
}

function createBody() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-5 rounded-2xl border border-slate-700';

    div.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="bg-slate-900 p-4 rounded-2xl border-2 border-dashed border-slate-600">
                <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Réserve</h4>
                <div class="flex gap-2">
                    <div class="flex-1">
                        <div class="text-xs font-bold text-blue-400 uppercase mb-1">👦 Garçons</div>
                        <div id="relaisReserveGarcons" class="flex flex-col gap-1 min-h-[100px] border border-blue-800/30 rounded-lg p-1"></div>
                    </div>
                    <div class="flex-1">
                        <div class="text-xs font-bold text-rose-400 uppercase mb-1">👩 Filles</div>
                        <div id="relaisReserveFilles" class="flex flex-col gap-1 min-h-[100px] border border-rose-800/30 rounded-lg p-1"></div>
                    </div>
                </div>
            </div>

            <div class="lg:col-span-2">
                <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Groupes (a, b, c, d... par élève)</h4>
                <div id="relaisGroupesGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
            </div>
        </div>
    `;

    return div;
}

// ============================================================
// CARTE ÉLÈVE
// ============================================================
async function createEleveCard(eleve) {
    const url = await getPhotoUrl(eleve.id);
    let bgClass = 'bg-slate-200 border-slate-400';
    if (eleve.sexe === 'M') bgClass = 'bg-blue-200 border-blue-400';
    else if (eleve.sexe === 'F') bgClass = 'bg-rose-200 border-rose-400';

    const photoHtml = url
        ? `<img src="${url}" class="w-9 h-9 rounded-full object-cover border-2 border-slate-500">`
        : `<div class="w-9 h-9 rounded-full bg-slate-400 flex items-center justify-center text-lg">👤</div>`;

    const div = document.createElement('div');
    div.className = `p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing flex items-center gap-2 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `
        ${photoHtml}
        <div class="flex flex-col leading-tight flex-1 min-w-0">
            <span class="font-black text-slate-900 text-xs truncate">${eleve.prenom}</span>
            <span class="text-[10px] font-bold text-slate-600 uppercase truncate">${eleve.nom}</span>
        </div>
        <span class="lettre-badge bg-blue-900 text-white text-sm font-black px-2 py-0.5 rounded hidden"></span>
    `;
    return div;
}

// ============================================================
// GÉNÉRATION DES GROUPES
// ============================================================
window.relaisGenererGroupes = async function() {
    const activeClasse = getCurrentClasse();
    if (!activeClasse) return alert('Sélectionnez une classe.');

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    if (eleves.length === 0) return alert('Aucun élève dans cette classe.');

    const nbGroupes = parseInt(document.getElementById('relaisNbGroupes')?.value) || 5;
    const tailleCible = parseInt(document.getElementById('relaisTailleGroupe')?.value) || 3;
    const nbPlots = parseInt(document.getElementById('relaisNbPlots')?.value) || 14;

    localStorage.setItem(`eps_arena_relais_nb_groupes_${activeClasse}`, nbGroupes);
    localStorage.setItem(`eps_arena_relais_taille_${activeClasse}`, tailleCible);
    localStorage.setItem(`eps_arena_relais_nb_plots_${activeClasse}`, nbPlots);

    const grid = document.getElementById('relaisGroupesGrid');
    if (!grid) return;

    let html = '';
    for (let i = 0; i < nbGroupes; i++) {
        const lettre = getLettre(i);
        html += `
            <div class="flex flex-col">
                <div class="header-col bg-blue-600 text-white font-black text-center py-2 rounded-t-lg uppercase text-sm">
                    Groupe ${i + 1} <span class="text-[10px] opacity-70">(${lettre})</span>
                </div>
                <div class="groupe-members bg-slate-900 border border-slate-700 rounded-b-lg min-h-[80px] p-2 flex flex-col gap-1" data-groupe="${i}"></div>
            </div>
        `;
    }
    grid.innerHTML = html;

    await populateReserve(eleves);

    setTimeout(() => initSortable(), 100);
    saveAffectations();
    alert(`✅ ${nbGroupes} groupes créés (taille cible : ${tailleCible}). Glissez les élèves !`);
};

async function populateReserve(eleves) {
    const garconsContainer = document.getElementById('relaisReserveGarcons');
    const fillesContainer = document.getElementById('relaisReserveFilles');
    if (!garconsContainer || !fillesContainer) return;

    garconsContainer.innerHTML = '';
    fillesContainer.innerHTML = '';

    const garcons = eleves.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = eleves.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = eleves.filter(e => e.sexe !== 'M' && e.sexe !== 'F').sort((a, b) => a.nom.localeCompare(b.nom));

    for (const e of garcons) garconsContainer.appendChild(await createEleveCard(e));
    for (const e of filles) fillesContainer.appendChild(await createEleveCard(e));
    for (const e of autres) garconsContainer.appendChild(await createEleveCard(e));

    if (garconsContainer.children.length === 0) garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
    if (fillesContainer.children.length === 0) fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';
}

// ============================================================
// SORTABLE
// ============================================================
function initSortable() {
    if (typeof Sortable === 'undefined') return;

    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    const garcons = document.getElementById('relaisReserveGarcons');
    const filles = document.getElementById('relaisReserveFilles');

    if (garcons) {
        garcons.__sortable = new Sortable(garcons, {
            group: 'relais',
            animation: 150,
            onEnd: () => { saveAffectations(); updateLettres(); }
        });
        sortableInstances.push(garcons.__sortable);
    }
    if (filles) {
        filles.__sortable = new Sortable(filles, {
            group: 'relais',
            animation: 150,
            onEnd: () => { saveAffectations(); updateLettres(); }
        });
        sortableInstances.push(filles.__sortable);
    }
    document.querySelectorAll('.groupe-members').forEach(el => {
        el.__sortable = new Sortable(el, {
            group: 'relais',
            animation: 150,
            onEnd: () => { saveAffectations(); updateLettres(); }
        });
        sortableInstances.push(el.__sortable);
    });
}

function updateLettres() {
    document.querySelectorAll('.groupe-members').forEach(groupeEl => {
        const children = groupeEl.querySelectorAll('[data-id]');
        children.forEach((child, index) => {
            const badge = child.querySelector('.lettre-badge');
            if (badge) {
                badge.textContent = getLettre(index);
                badge.classList.remove('hidden');
            }
        });
    });
}

// ============================================================
// SAUVEGARDE / CHARGEMENT
// ============================================================
function saveAffectations() {
    const activeClasse = getCurrentClasse();
    if (!activeClasse) return;

    const data = { groupes: [], reserve: [] };

    document.querySelectorAll('#relaisReserveGarcons [data-id], #relaisReserveFilles [data-id]').forEach(el => {
        data.reserve.push(el.dataset.id);
    });

    document.querySelectorAll('.groupe-members').forEach((el, idx) => {
        const membres = [];
        el.querySelectorAll('[data-id]').forEach(child => {
            membres.push(child.dataset.id);
        });
        data.groupes[idx] = membres;
    });

    localStorage.setItem(getStorageKey(activeClasse), JSON.stringify(data));
}

function loadAffectations() {
    const activeClasse = getCurrentClasse();
    if (!activeClasse) return;

    const data = JSON.parse(localStorage.getItem(getStorageKey(activeClasse)) || 'null');

    // ✅ Si aucune affectation → grille par défaut + réserve remplie automatiquement
    if (!data || !data.groupes || data.groupes.length === 0) {
        console.log('[Relais] Aucune affectation → génération automatique');
        setTimeout(() => {
            if (typeof window.relaisGenererGroupes === 'function') {
                window.relaisGenererGroupes();
            }
        }, 150);
        return;
    }

    const nbGroupes = data.groupes.length;
    const elNb = document.getElementById('relaisNbGroupes');
    if (elNb) elNb.value = nbGroupes;

    const grid = document.getElementById('relaisGroupesGrid');
    if (!grid) return;

    let html = '';
    for (let i = 0; i < nbGroupes; i++) {
        const lettre = getLettre(i);
        html += `
            <div class="flex flex-col">
                <div class="header-col bg-blue-600 text-white font-black text-center py-2 rounded-t-lg uppercase text-sm">
                    Groupe ${i + 1} <span class="text-[10px] opacity-70">(${lettre})</span>
                </div>
                <div class="groupe-members bg-slate-900 border border-slate-700 rounded-b-lg min-h-[80px] p-2 flex flex-col gap-1" data-groupe="${i}"></div>
            </div>
        `;
    }
    grid.innerHTML = html;

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const placedIds = new Set();

    data.groupes.forEach((ids, idx) => {
        const groupeEl = document.querySelector(`.groupe-members[data-groupe="${idx}"]`);
        if (!groupeEl) return;
        ids.forEach(id => {
            const eleve = eleves.find(e => e.id === id);
            if (eleve) {
                placedIds.add(id);
                createEleveCard(eleve).then(card => groupeEl.appendChild(card));
            }
        });
    });

    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    const garcons = nonPlaces.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = nonPlaces.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = nonPlaces.filter(e => e.sexe !== 'M' && e.sexe !== 'F');

    const garconsContainer = document.getElementById('relaisReserveGarcons');
    const fillesContainer = document.getElementById('relaisReserveFilles');
    if (garconsContainer) {
        for (const e of garcons) createEleveCard(e).then(c => garconsContainer.appendChild(c));
        for (const e of autres) createEleveCard(e).then(c => garconsContainer.appendChild(c));
    }
    if (fillesContainer) {
        for (const e of filles) createEleveCard(e).then(c => fillesContainer.appendChild(c));
    }

    setTimeout(() => {
        updateLettres();
        initSortable();
    }, 100);
}

// ============================================================
// BANDEAU MODE
// ============================================================
window.relaisUpdateModeStyle = function() {
    const mode = document.getElementById('relaisMode')?.value || 'essai';
    const banner = document.getElementById('relaisBannerInfo');
    if (!banner) return;

    if (mode === 'competition') {
        banner.className = 'text-center text-xs font-bold py-2 rounded-xl mb-4 bg-yellow-900/30 text-yellow-300 border border-yellow-500/50';
        banner.innerHTML = '🏆 Mode COMPÉTITION — les scores comptent pour le classement';
    } else {
        banner.className = 'text-center text-xs font-bold py-2 rounded-xl mb-4 bg-emerald-900/30 text-emerald-300 border border-emerald-500/50';
        banner.innerHTML = '🌱 Mode ESSAI — les élèves peuvent tester sans conséquence';
    }

    const activeClasse = getCurrentClasse();
    if (activeClasse) {
        localStorage.setItem(`eps_arena_relais_mode_${activeClasse}`, mode);
    }
};

// ============================================================
// IMPORT CSV iDoeceo (stocke les vitesses par eleveId côté prof)
// ============================================================
window.relaisImportCSV = function() {
    const activeClasse = getCurrentClasse();
    if (!activeClasse) return alert('Sélectionnez une classe.');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importCSVFile(file, activeClasse);
    };
    input.click();
};

function importCSVFile(file, classe) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const csv = e.target.result;
        const separateur = csv.includes(';') ? ';' : ',';

        Papa.parse(csv, {
            delimiter: separateur,
            header: false,
            skipEmptyLines: true,
            complete: (result) => {
                const rows = result.data;
                if (rows.length < 2) return alert('Fichier vide ou invalide.');

                const header = rows[0].map(h => (h || '').toLowerCase().trim());
                let idxNom = -1, idxArret = -1, idxLance = -1;

                header.forEach((h, i) => {
                    if (h.includes('nom') || h.includes('prénom') || h.includes('prenom')) idxNom = i;
                    if (h.includes('arrêt') || h.includes('arret')) idxArret = i;
                    if (h.includes('lancé') || h.includes('lance')) idxLance = i;
                });

                if (idxNom === -1) idxNom = 0;
                if (idxArret === -1) idxArret = 1;
                if (idxLance === -1) idxLance = 2;

                const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
                const vitesses = {};
                let nbLignes = 0;

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const nomComplet = (row[idxNom] || '').trim();
                    if (!nomComplet) continue;

                    const arret = parseFloat(row[idxArret]);
                    const lance = parseFloat(row[idxLance]);
                    if (isNaN(arret) || isNaN(lance)) continue;

                    const eleve = matchEleve(nomComplet, eleves);
                    if (!eleve) {
                        console.warn(`Élève non trouvé : ${nomComplet}`);
                        continue;
                    }

                    // ⚠️ Vitesses indexées par eleveId (local uniquement)
                    vitesses[eleve.id] = { arret, lance, timestamp: Date.now() };
                    nbLignes++;
                }

                localStorage.setItem(getVitessesKey(classe), JSON.stringify(vitesses));
                alert(`✅ ${nbLignes} vitesse(s) importée(s) depuis le CSV.`);
            }
        });
    };
    reader.readAsText(file);
}

function matchEleve(nomComplet, eleves) {
    const norm = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const normNomComplet = norm(nomComplet);
    const parts = normNomComplet.split(/\s+/);

    for (const e of eleves) {
        const nomE = norm(e.nom);
        const prenomE = norm(e.prenom);
        if (normNomComplet === `${prenomE} ${nomE}` || normNomComplet === `${nomE} ${prenomE}`) return e;
    }

    for (const e of eleves) {
        if (parts.length >= 2) {
            const p1 = parts[0];
            const p2 = parts[parts.length - 1];
            const nomE = norm(e.nom);
            const prenomE = norm(e.prenom);
            if ((p1 === prenomE && p2 === nomE) || (p1 === nomE && p2 === prenomE)) return e;
        }
    }

    return null;
}

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================
window.relaisExportConfig = function() {
    const activeClasse = getCurrentClasse();
    if (!activeClasse) return alert('Sélectionnez une classe.');

    const data = {
        version: 1,
        classe: activeClasse,
        activite: 'relais',
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        groupes: JSON.parse(localStorage.getItem(getStorageKey(activeClasse)) || '{}'),
        vitesses: JSON.parse(localStorage.getItem(getVitessesKey(activeClasse)) || '{}'),
        mode: document.getElementById('relaisMode')?.value || 'essai',
        nbPlots: parseInt(document.getElementById('relaisNbPlots')?.value) || 14
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeClasse}_relais_${data.date}.json`;
    a.click();
};

window.relaisImportConfig = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe) throw new Error('Format invalide');
            const classe = data.classe;

            if (data.groupes) localStorage.setItem(getStorageKey(classe), JSON.stringify(data.groupes));
            if (data.vitesses) localStorage.setItem(getVitessesKey(classe), JSON.stringify(data.vitesses));
            if (data.mode) localStorage.setItem(`eps_arena_relais_mode_${classe}`, data.mode);
            if (data.nbPlots) localStorage.setItem(`eps_arena_relais_nb_plots_${classe}`, data.nbPlots);

            const select = document.getElementById('selectClasse');
            if (select && select.value !== classe) {
                select.value = classe;
                select.dispatchEvent(new Event('change'));
            } else {
                initRelaisInterface();
            }
            alert('✅ Configuration Relais importée !');
        } catch (err) {
            alert('❌ Erreur : ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

// ============================================================
// TRANSMISSION FIREBASE (RGPD-COMPLIANT)
// ============================================================
export async function transmettreRelaisConfig() {
    const activeClasse = getCurrentClasse();
    if (!activeClasse) return alert('Sélectionnez une classe.');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${activeClasse}/relais`;

    const affectations = JSON.parse(localStorage.getItem(getStorageKey(activeClasse)) || '{}');
    if (!affectations.groupes || affectations.groupes.length === 0) {
        return alert('Générez d\'abord les groupes.');
    }

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const mode = document.getElementById('relaisMode')?.value || 'essai';
    const nbPlots = parseInt(document.getElementById('relaisNbPlots')?.value) || 14;

    // ============================================================
    // CONFIG ANONYME (RGPD)
    // ============================================================
    const configData = {
        activite: 'relais',
        mode: mode,
        nbPlots: nbPlots,
        groupes: {}
    };

    // Mapping local : prof uniquement. Format : { "504_0_a": "DUPONT_P", ... }
    const localMapping = {};

    affectations.groupes.forEach((ids, idx) => {
        const membres = ids.map((id, i) => {
            const eleve = eleves.find(e => e.id === id);
            if (!eleve) return null;
            const lettre = getLettre(i);
            // ✅ Mapping conservé EN LOCAL uniquement
            localMapping[`${activeClasse}_${idx}_${lettre}`] = id;
            // ✅ Données anonymes uniquement
            return {
                lettre: lettre,
                sexe: eleve.sexe || ''
            };
        }).filter(Boolean);

        if (membres.length > 0) {
            configData.groupes[idx] = {
                numero: idx + 1,
                membres: membres
            };
        }
    });

    // Fusionner avec le mapping existant (pour ne pas écraser d'autres activités)
    const existingMapping = getLocalMapping(activeClasse) || {};
    const mergedMapping = { ...existingMapping, ...localMapping };
    setLocalMapping(activeClasse, mergedMapping);

    // ============================================================
    // VITESSES ANONYMES
    // ============================================================
    const vitessesLocales = JSON.parse(localStorage.getItem(getVitessesKey(activeClasse)) || '{}');
    const vitessesFirebase = {};

    affectations.groupes.forEach((ids, idx) => {
        ids.forEach((id, i) => {
            const lettre = getLettre(i);
            const v = vitessesLocales[id];
            if (v && v.arret && v.lance) {
                // ✅ Code anonyme : "0_a", "0_b", ...
                vitessesFirebase[`${idx}_${lettre}`] = {
                    arret: v.arret,
                    lance: v.lance,
                    timestamp: v.timestamp || Date.now()
                };
            }
        });
    });

    try {
        await set(ref(db, `${basePath}/config`), configData);
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/${activeClasse}/config`), { activite: 'relais' });

        if (Object.keys(vitessesFirebase).length > 0) {
            await set(ref(db, `${basePath}/vitesses`), vitessesFirebase);
        }

        await set(ref(db, `etablissements/0680013V/profs/${profCode}/active_classes/${activeClasse}`), true);

        alert(`✅ Configuration Relais transmise (${Object.keys(vitessesFirebase).length} vitesses, ${Object.keys(configData.groupes).length} groupes).`);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de la transmission.\nVérifie la console (F12).');
    }
}

window.relaisTransmettre = async function() {
    await transmettreRelaisConfig();
};

window.initRelaisInterface = initRelaisInterface;