// src/js/modules/tournoi/variantes/elimination/elimination-prof.js
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { getJoueurs, getCurrentClasse, exportTournoiData, importTournoiData } from '../../tournoi-core.js';
import { ajouterElimination, reinitialiserJoueur, toggleExclure, reinitialiserTournoi, getExclus, initCore } from './elimination-core.js';

let currentClasse = '';
let showExclus = false;
let unsubscribe = null;

export function initProf(classe) {
    currentClasse = classe;
    initCore(classe);

    const container = document.getElementById('tournoi-prof-container');
    if (!container) return;

    const handler = () => renderProf();
    window.addEventListener('tournoi-updated', handler);
    unsubscribe = () => window.removeEventListener('tournoi-updated', handler);

    renderProf();
    return () => {
        if (unsubscribe) unsubscribe();
        console.log('🧹 [Élimination Prof] Nettoyage');
    };
}

async function renderProf() {
    const container = document.getElementById('tournoi-prof-container');
    if (!container) return;

    const joueurs = getJoueurs();
    const exclus = getExclus();

    // ✅ Récupérer TOUS les élèves de la classe (triés alphabétiquement)
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const elevesTries = eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    // ✅ Générer les codes (1 à N) dans l'ordre alphabétique
    const codes = elevesTries.map((_, index) => (index + 1).toString());

    if (codes.length === 0) {
        container.innerHTML = `
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center">
                <p class="text-slate-400">Aucun élève dans cette classe.</p>
                <p class="text-xs text-slate-500 mt-2">Importez d'abord les élèves depuis l'onglet Administration.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">🏆 Tournoi Élimination</h3>
                    <p class="text-xs text-slate-400">Classe : ${currentClasse} (${codes.length} élèves)</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.tournoiReinitialiser()" class="bg-red-600 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">🔄 Réinitialiser</button>
                    <button onclick="window.tournoiExporter()" class="bg-emerald-600 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">⬇️ Export</button>
                    <button onclick="document.getElementById('tournoiImportFile').click()" class="bg-slate-600 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">⬆️ Import</button>
                    <input type="file" id="tournoiImportFile" class="hidden" accept=".json" onchange="window.tournoiImporter(event)">
                    <label class="flex items-center gap-2 text-xs text-slate-400">
                        <input type="checkbox" id="tournoi-show-exclus" ${showExclus ? 'checked' : ''} onchange="window.tournoiToggleExclus()">
                        Afficher exclus
                    </label>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    // ✅ Trier les codes par nombre d'éliminations (descendant)
    const sortedCodes = [...codes].sort((a, b) => {
        const elimA = joueurs[a]?.eliminations || 0;
        const elimB = joueurs[b]?.eliminations || 0;
        return elimB - elimA;
    });

    for (const code of sortedCodes) {
        // Trouver l'élève correspondant à ce code (index = code - 1)
        const index = parseInt(code) - 1;
        const eleve = elevesTries[index];
        if (!eleve) continue;

        const info = joueurs[code] || { eliminations: 0 };
        const isExclu = !!exclus[code];
        if (isExclu && !showExclus) continue;

        const nom = `${eleve.prenom} ${eleve.nom}`;
        const photoHtml = await getPhotoHtml(eleve.id);

        let statusColor = 'border-emerald-500', statusBg = 'bg-emerald-500/10', statusText = 'text-emerald-400';
        if (info.eliminations >= 10) { statusColor = 'border-red-500'; statusBg = 'bg-red-500/10'; statusText = 'text-red-400'; }
        else if (info.eliminations >= 5) { statusColor = 'border-yellow-500'; statusBg = 'bg-yellow-500/10'; statusText = 'text-yellow-400'; }

        const sexeBg = eleve.sexe === 'M' ? 'bg-blue-200 border-blue-400' : 
                       eleve.sexe === 'F' ? 'bg-rose-200 border-rose-400' : 
                       'bg-slate-200 border-slate-400';

        html += `
            <div class="bg-slate-900 p-4 rounded-2xl border-2 ${statusColor} ${statusBg}">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ${sexeBg} flex items-center justify-center">
                        ${photoHtml}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-black text-white text-sm truncate">${nom}</div>
                        <div class="text-xs text-slate-400">Code ${code}</div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="${statusText} font-bold">${info.eliminations}</span>
                            <span class="text-xs text-slate-500">éliminations</span>
                            ${isExclu ? '<span class="text-xs text-red-400 font-bold">🚫 Exclu</span>' : ''}
                        </div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <button onclick="window.tournoiAjouterElim('${code}')" class="bg-red-600 px-2 py-1 rounded-lg font-black text-xs text-white hover:bg-red-700 active:scale-95">-1</button>
                        <button onclick="window.tournoiReinitialiserJoueur('${code}')" class="bg-slate-600 px-2 py-1 rounded-lg font-black text-xs text-white hover:bg-slate-700 active:scale-95">↺</button>
                        <button onclick="window.tournoiToggleExclure('${code}')" class="bg-slate-600 px-2 py-1 rounded-lg font-black text-xs text-white hover:bg-slate-700 active:scale-95">${isExclu ? '➕' : '🚫'}</button>
                    </div>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

async function getPhotoHtml(id) {
    if (!id) return `<span class="text-xl">👤</span>`;
    try {
        const url = await getPhotoUrl(id);
        if (url) return `<img src="${url}" class="w-full h-full object-cover rounded-full">`;
    } catch(e) {}
    return `<span class="text-xl">👤</span>`;
}

// Fonctions globales
window.tournoiAjouterElim = function(code) {
    if (confirm(`Ajouter une élimination pour le joueur ${code} ?`)) {
        ajouterElimination(code);
        renderProf();
    }
};
window.tournoiReinitialiserJoueur = function(code) {
    if (confirm(`Réinitialiser les éliminations du joueur ${code} ?`)) {
        reinitialiserJoueur(code);
        renderProf();
    }
};
window.tournoiToggleExclure = function(code) {
    toggleExclure(code);
    renderProf();
};
window.tournoiToggleExclus = function() {
    showExclus = !showExclus;
    renderProf();
};
window.tournoiReinitialiser = function() {
    reinitialiserTournoi();
    renderProf();
};
window.tournoiExporter = function() { exportTournoiData(); };
window.tournoiImporter = function(event) {
    const file = event.target.files[0];
    if (file) {
        importTournoiData(file);
        setTimeout(renderProf, 500);
    }
    event.target.value = '';
};