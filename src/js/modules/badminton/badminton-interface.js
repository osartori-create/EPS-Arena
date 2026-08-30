// src/js/modules/badminton/badminton-interface.js
// Adapté de Webjéjé (BadZ Impact) et du module Escalade EPS-Arena.
// Licence Creative Commons Attribution (CC BY).

import { getPhotoUrl } from '../../services/admin-service.js';

const MAX_PAR_TERRAIN = 5; // Capacité max par terrain pour la génération auto

export function initBadmintonInterface(nbTerrains = 6, force = false) {
    const container = document.getElementById('postesGridBadminton');
    if (!container) return;

    const activeClasse = document.getElementById('selectClasse').value;
    const savedData = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
    
    let nbTerrainsCalcule = nbTerrains;
    if (!force && savedData.nbTerrains) {
        nbTerrainsCalcule = savedData.nbTerrains;
    } else {
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        // On ne compte que les joueurs "jouant" (force > 0 ou sexe défini) pour estimer le nombre de terrains
        const joueurs = eleves.filter(e => e.code !== 'INAPTE');
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

export function generateBadmintonTeams(eleves) {
    const activeClasse = document.getElementById('selectClasse').value;
    const nbTerrains = window.currentBadmintonTerrains || 6;

    // SÉPARATION : Les inaptes sont mis de côté pour être répartis numériquement à la fin
    const joueurs = eleves.filter(e => e.code !== 'INAPTE');
    const inaptes = eleves.filter(e => e.code === 'INAPTE');

    // 1. Tri par force (étoiles) décroissante, puis aléatoire pour départager
    joueurs.sort((a, b) => (b.force || 0) - (a.force || 0) || Math.random() - 0.5);

    // 2. Répartition par BLOCS (Tous les forts ensemble au Terrain 1, puis les suivants au Terrain 2...)
    const perTerrain = Math.ceil(joueurs.length / nbTerrains);
    const terrains = Array.from({ length: nbTerrains }, () => []);

    joueurs.forEach((eleve, index) => {
        const terrainIndex = Math.floor(index / perTerrain); // Bloc
        terrains[terrainIndex].push(eleve);
    });

    // 3. Ajout des inaptes (ils sont répartis, mais marqués comme non jouants)
    inaptes.forEach((eleve, index) => {
        const terrainIndex = index % nbTerrains; // Tourniquet
        eleve.isPlaying = false; // Indispensable pour le Round Robin
        terrains[terrainIndex].push(eleve);
    });

    // 4. Sauvegarde
    const assignments = { reserve: [], nbTerrains: nbTerrains };
    terrains.forEach((terrain, idx) => {
        const terrainNum = idx + 1;
        assignments[terrainNum] = terrain.map(e => e.id);
    });

    localStorage.setItem(`eps_arena_badminton_assignments_${activeClasse}`, JSON.stringify(assignments));
    initBadmintonInterface(nbTerrains, true);
    setTimeout(() => loadBadmintonAssignments(), 100);
}

// --- GLISSER-DÉPOSER ET AFFICHAGE ---
export function initSortableBadminton() {
    const reserveContainer = document.getElementById('reserveBadminton');
    if (!reserveContainer) return;

    if (reserveContainer.__sortable) reserveContainer.__sortable.destroy();
    document.querySelectorAll('.terrain-members').forEach(el => {
        if (el.__sortable) el.__sortable.destroy();
    });

    reserveContainer.__sortable = new Sortable(reserveContainer, {
        group: 'badminton',
        animation: 150,
        onEnd: () => { saveBadmintonAssignments(); updateCodes(); }
    });

    document.querySelectorAll('.terrain-members').forEach(el => {
        el.__sortable = new Sortable(el, {
            group: 'badminton',
            animation: 150,
            onEnd: () => { saveBadmintonAssignments(); updateCodes(); }
        });
    });
}

async function createEleveCard(eleve) {
    const url = await getPhotoUrl(eleve.id);
    let bgClass = 'bg-slate-200 border-slate-400';
    if (eleve.sexe === 'M') bgClass = 'bg-blue-200 border-blue-400';
    else if (eleve.sexe === 'F') bgClass = 'bg-rose-200 border-rose-400';
    
    // Style spécial pour les inaptes
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

export async function loadBadmintonAssignments() {
    const activeClasse = document.getElementById('selectClasse').value;
    const assignments = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    
    const reserveContainer = document.getElementById('reserveBadminton');
    reserveContainer.innerHTML = '';

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

    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    for (const eleve of nonPlaces) {
        reserveContainer.appendChild(await createEleveCard(eleve));
    }

    updateCodes();
    setTimeout(() => initSortableBadminton(), 100);
}

export function saveBadmintonAssignments() {
    const activeClasse = document.getElementById('selectClasse').value;
    const assignments = { reserve: [], nbTerrains: window.currentBadmintonTerrains || 6 };

    document.querySelectorAll('#reserveBadminton [data-id]').forEach(el => assignments.reserve.push(el.dataset.id));
    document.querySelectorAll('[data-terrain]').forEach(terrainDiv => {
        const membersDiv = terrainDiv.querySelector('.terrain-members');
        const ids = [];
        if (membersDiv) membersDiv.querySelectorAll('[data-id]').forEach(el => ids.push(el.dataset.id));
        assignments[terrainDiv.dataset.terrain] = ids;
    });

    localStorage.setItem(`eps_arena_badminton_assignments_${activeClasse}`, JSON.stringify(assignments));
}

// Attribution des lettres A, B, C... sur chaque terrain
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