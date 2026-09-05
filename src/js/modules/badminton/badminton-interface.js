// src/js/modules/badminton/badminton-interface.js
// Adapté de Webjéjé (BadZ Impact) et du module Escalade EPS-Arena.
// Licence Creative Commons Attribution (CC BY).

import { getPhotoUrl } from '../../services/admin-service.js';

const MAX_PAR_TERRAIN = 5;

// ============================================================
// INITIALISATION DE L'INTERFACE PROFESSEUR
// ============================================================

export function initBadmintonInterface(nbTerrains = 6, force = false) {
    const container = document.getElementById('postesGridBadminton');
    if (!container) return;

    const activeClasse = document.getElementById('selectClasse').value;
    const savedData = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
    
    let nbTerrainsCalcule = nbTerrains;
    if (!force && savedData.nbTerrains) {
        nbTerrainsCalcule = savedData.nbTerrains;
    } else if (!force) {
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        const joueurs = eleves.filter(e => e.code !== 'INAPTE' && e.code !== 'ABS');
        if (joueurs.length > 0) {
            nbTerrainsCalcule = Math.max(1, Math.ceil(joueurs.length / MAX_PAR_TERRAIN));
        }
    }

    let html = '';
    for (let i = 1; i <= nbTerrainsCalcule; i++) {
        html += `
            <div class="flex flex-col">
                <div class="header-col !bg-blue-600">Terrain ${i}</div>
                <div class="escalade-col" data-terrain="${i}">
                    <div class="terrain-members flex flex-col gap-2"></div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    const assignments = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
    assignments.nbTerrains = nbTerrainsCalcule;
    localStorage.setItem(`eps_arena_badminton_assignments_${activeClasse}`, JSON.stringify(assignments));

    window.currentBadmintonTerrains = nbTerrainsCalcule;
    setTimeout(() => initSortableBadminton(), 100);
}

// ============================================================
// GÉNÉRATION DES TERRAINS PAR NIVEAU DE FORCE
// ============================================================

export function generateBadmintonTeams(eleves, nbTerrains = 6) {
    const activeClasse = document.getElementById('selectClasse').value;
    
    initBadmintonInterface(nbTerrains, true);

    const absents = eleves.filter(e => e.code === 'ABS');
    const inaptes = eleves.filter(e => e.code === 'INAPTE');
    const joueurs = eleves.filter(e => e.code !== 'ABS' && e.code !== 'INAPTE');

    joueurs.sort((a, b) => (b.force || 0) - (a.force || 0) || Math.random() - 0.5);

    const nbJoueurs = joueurs.length;
    const nbParTerrain = Math.floor(nbJoueurs / nbTerrains);
    const reste = nbJoueurs % nbTerrains;

    const terrains = Array.from({ length: nbTerrains }, () => []);

    let index = 0;
    for (let t = 0; t < nbTerrains; t++) {
        const taille = nbParTerrain + (t < reste ? 1 : 0);
        for (let i = 0; i < taille; i++) {
            if (index < nbJoueurs) {
                terrains[t].push(joueurs[index]);
                index++;
            }
        }
    }

    inaptes.forEach((eleve, index) => {
        eleve.isPlaying = false;
        terrains[index % nbTerrains].push(eleve);
    });

    const assignments = {
        reserveAbsents: absents.map(e => e.id),
        reserveInaptes: inaptes.map(e => e.id),
        nbTerrains: nbTerrains
    };
    terrains.forEach((terrain, idx) => {
        const terrainNum = idx + 1;
        assignments[terrainNum] = terrain.map(e => e.id);
    });

    localStorage.setItem(`eps_arena_badminton_assignments_${activeClasse}`, JSON.stringify(assignments));
    
    setTimeout(() => loadBadmintonAssignments(), 100);
}

// ============================================================
// GLISSER-DÉPOSER (SORTABLE)
// ============================================================

export function initSortableBadminton() {
    const absContainer = document.getElementById('reserveBadmintonAbsents');
    const inaptContainer = document.getElementById('reserveBadmintonInaptes');
    
    if (!absContainer || !inaptContainer) {
        console.warn('Conteneurs de réserve Badminton introuvables.');
        return;
    }

    if (absContainer.__sortable) absContainer.__sortable.destroy();
    if (inaptContainer.__sortable) inaptContainer.__sortable.destroy();
    document.querySelectorAll('.terrain-members').forEach(el => {
        if (el.__sortable) el.__sortable.destroy();
    });

    const onEnd = () => { saveBadmintonAssignments(); updateCodes(); };

    absContainer.__sortable = new Sortable(absContainer, { group: 'badminton', animation: 150, onEnd });
    inaptContainer.__sortable = new Sortable(inaptContainer, { group: 'badminton', animation: 150, onEnd });
    document.querySelectorAll('.terrain-members').forEach(el => {
        el.__sortable = new Sortable(el, { group: 'badminton', animation: 150, onEnd });
    });
}

// ============================================================
// CRÉATION D'UNE CARTE ÉLÈVE
// ============================================================

async function createEleveCard(eleve) {
    const url = await getPhotoUrl(eleve.id);
    let bgClass = 'bg-slate-200 border-slate-400';
    if (eleve.sexe === 'M') bgClass = 'bg-blue-200 border-blue-400';
    else if (eleve.sexe === 'F') bgClass = 'bg-rose-200 border-rose-400';
    
    let statut = '';
    if (eleve.code === 'INAPTE') {
        bgClass = 'bg-orange-200 border-orange-400 opacity-60';
        statut = '<span class="text-[10px] text-orange-700 font-bold uppercase">Inapte</span>';
    } else if (eleve.code === 'ABS') {
        bgClass = 'bg-red-200 border-red-400 opacity-60';
        statut = '<span class="text-[10px] text-red-700 font-bold uppercase">Absent</span>';
    }

    const photoHtml = url ? `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">` : `<div class="w-10 h-10 rounded-full bg-slate-400 flex items-center justify-center text-xl">👤</div>`;
    let stars = '';
    for (let i = 1; i <= (eleve.force || 0); i++) stars += '★';

    const div = document.createElement('div');
    div.className = `p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing flex items-center gap-3 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `
        ${photoHtml}
        <div class="flex flex-col leading-tight">
            <span class="font-black text-slate-900 text-base">${eleve.prenom}</span>
            <span class="text-xs font-bold text-slate-600 uppercase">${eleve.nom}</span>
            <span class="text-[10px] text-yellow-600 font-bold">${stars}</span>
            ${statut}
        </div>
    `;
    return div;
}

// ============================================================
// CHARGEMENT DES AFFECTATIONS
// ============================================================

export async function loadBadmintonAssignments() {
    const activeClasse = document.getElementById('selectClasse').value;
    const assignments = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    
    const absContainer = document.getElementById('reserveBadmintonAbsents');
    const inaptContainer = document.getElementById('reserveBadmintonInaptes');
    if (!absContainer || !inaptContainer) return;
    
    absContainer.innerHTML = '';
    inaptContainer.innerHTML = '';

    const placedIds = new Set();
    const terrains = document.querySelectorAll('[data-terrain]');

    for (const terrainDiv of terrains) {
        const terrainNum = terrainDiv.dataset.terrain;
        const membersDiv = terrainDiv.querySelector('.terrain-members');
        if (membersDiv && assignments[terrainNum]) {
            for (const id of assignments[terrainNum]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) {
                    membersDiv.appendChild(await createEleveCard(eleve));
                    placedIds.add(id);
                }
            }
        }
    }

    const absents = assignments.reserveAbsents || [];
    const inaptes = assignments.reserveInaptes || [];

    for (const id of absents) {
        const eleve = eleves.find(e => e.id === id);
        if (eleve) absContainer.appendChild(await createEleveCard(eleve));
    }
    for (const id of inaptes) {
        const eleve = eleves.find(e => e.id === id);
        if (eleve) inaptContainer.appendChild(await createEleveCard(eleve));
    }

    const nonPlaces = eleves.filter(e => !placedIds.has(e.id) && !absents.includes(e.id) && !inaptes.includes(e.id));
    for (const eleve of nonPlaces) {
        inaptContainer.appendChild(await createEleveCard(eleve));
    }

    if (absContainer.children.length === 0) absContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun absent</p>';
    if (inaptContainer.children.length === 0) inaptContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun inapte</p>';

    updateCodes();
    setTimeout(() => initSortableBadminton(), 100);
}

// ============================================================
// SAUVEGARDE DES AFFECTATIONS
// ============================================================

export function saveBadmintonAssignments() {
    const activeClasse = document.getElementById('selectClasse').value;
    const assignments = { reserveAbsents: [], reserveInaptes: [], nbTerrains: window.currentBadmintonTerrains || 6 };

    const absContainer = document.getElementById('reserveBadmintonAbsents');
    const inaptContainer = document.getElementById('reserveBadmintonInaptes');
    
    if (absContainer) absContainer.querySelectorAll('[data-id]').forEach(el => assignments.reserveAbsents.push(el.dataset.id));
    if (inaptContainer) inaptContainer.querySelectorAll('[data-id]').forEach(el => assignments.reserveInaptes.push(el.dataset.id));

    document.querySelectorAll('[data-terrain]').forEach(terrainDiv => {
        const membersDiv = terrainDiv.querySelector('.terrain-members');
        const ids = [];
        if (membersDiv) membersDiv.querySelectorAll('[data-id]').forEach(el => ids.push(el.dataset.id));
        assignments[terrainDiv.dataset.terrain] = ids;
    });

    localStorage.setItem(`eps_arena_badminton_assignments_${activeClasse}`, JSON.stringify(assignments));
}

// ============================================================
// MISE À JOUR DES CODES (A, B, C...)
// ============================================================

export function updateCodes() {
    document.querySelectorAll('[data-terrain]').forEach(terrainDiv => {
        const membersDiv = terrainDiv.querySelector('.terrain-members');
        const children = membersDiv ? membersDiv.querySelectorAll('[data-id]') : [];
        const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        children.forEach((child, index) => {
            let badge = child.querySelector('.rank-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'rank-badge bg-blue-900 text-white text-2xl font-black px-3 py-1 rounded-lg ml-auto';
                child.appendChild(badge);
            }
            badge.textContent = lettres[index] || '?';
        });
    });
}

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================

export function exportBadmintonConfig() {
    const activeClasse = document.getElementById('selectClasse').value;
    const assignments = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
    
    // Récupérer les paramètres avancés
    const mode = document.getElementById('badmintonMode')?.value || 'frontback';
    const centerSize = parseInt(document.getElementById('badmintonCenterSize')?.value) || 33;
    const centerPoints = parseInt(document.getElementById('badmintonCenterPoints')?.value) || 1;
    const otherPoints = parseInt(document.getElementById('badmintonOtherPoints')?.value) || 3;
    const cornerPoints = parseInt(document.getElementById('badmintonCornerPoints')?.value) || 3;
    const faultPoints = parseInt(document.getElementById('badmintonFaultPoints')?.value) || 1;
    const faultPenalty = document.getElementById('badmintonFaultPenalty')?.checked || false;

    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    const data = {
        version: 2,
        classe: activeClasse,
        activite: 'badminton',
        date: dateStr,
        mode: mode,
        centerSize: centerSize,
        centerPoints: centerPoints,
        otherPoints: otherPoints,
        cornerPoints: cornerPoints,
        faultPoints: faultPoints,
        faultPenalty: faultPenalty,
        ...assignments
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeClasse}_badminton_${dateStr}.json`;
    a.click();
}

export function importBadmintonConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.nbTerrains) throw new Error("Format de fichier invalide");
            
            // Restaurer les paramètres avancés (si présents)
            if (data.version >= 2) {
                if (data.mode) document.getElementById('badmintonMode').value = data.mode;
                if (data.centerSize) document.getElementById('badmintonCenterSize').value = data.centerSize;
                if (data.centerPoints) document.getElementById('badmintonCenterPoints').value = data.centerPoints;
                if (data.otherPoints) document.getElementById('badmintonOtherPoints').value = data.otherPoints;
                if (data.cornerPoints) document.getElementById('badmintonCornerPoints').value = data.cornerPoints;
                if (data.faultPoints) document.getElementById('badmintonFaultPoints').value = data.faultPoints;
                if (data.faultPenalty !== undefined) document.getElementById('badmintonFaultPenalty').checked = data.faultPenalty;
            }
            
            localStorage.setItem(`eps_arena_badminton_assignments_${data.classe}`, JSON.stringify(data));
            
            const select = document.getElementById('selectClasse');
            if (select.value !== data.classe) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change'));
            } else {
                initBadmintonInterface(data.nbTerrains, true);
                await loadBadmintonAssignments();
            }
            alert("✅ Configuration Badminton importée !");
        } catch (err) {
            alert("❌ Erreur import : " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============================================================
// TRANSMISSION FIREBASE (AVEC PARAMÈTRES AVANCÉS)
// ============================================================

export async function transmettreBadmintonConfig() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const assignments = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
    const localMapping = {};
    const configData = { activite: 'badminton' };

    // ✅ Paramètres avancés (BIEN RÉCUPÉRÉS)
    configData.mode = document.getElementById('badmintonMode')?.value || 'frontback';
    configData.centerSize = parseInt(document.getElementById('badmintonCenterSize')?.value) || 33;
    configData.centerPoints = parseInt(document.getElementById('badmintonCenterPoints')?.value) || 1;
    configData.otherPoints = parseInt(document.getElementById('badmintonOtherPoints')?.value) || 3;
    configData.cornerPoints = parseInt(document.getElementById('badmintonCornerPoints')?.value) || 3;
    configData.faultPoints = parseInt(document.getElementById('badmintonFaultPoints')?.value) || 1;
    configData.faultPenalty = document.getElementById('badmintonFaultPenalty')?.checked || false;

    // Terrains
    const lettres = ['A','B','C','D','E','F','G','H','I','J'];
    for (let t = 1; t <= (assignments.nbTerrains || 6); t++) {
        const idsTerrain = assignments[t] || [];
        idsTerrain.forEach((eleveId, index) => {
            const lettre = lettres[index] || '?';
            localMapping[`${activeClasse}_${t}_${lettre}`] = eleveId;
        });
        configData[t] = idsTerrain.length;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}`;

    try {
        console.log("📡 Transmission Badminton :", configData);
        await set(ref(db, `${basePath}/${activeClasse}/config`), configData);
        await set(ref(db, `${basePath}/active_classes/${activeClasse}`), true);
        localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));
        alert("✅ Configuration Badminton transmise aux iPads !");
    } catch (e) {
        console.error("Erreur transmission :", e);
        alert("Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
    }
}