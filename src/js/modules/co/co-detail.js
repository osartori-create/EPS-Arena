// src/js/modules/co/co-detail.js
// Modale de détail et correction manuelle des résultats pour la CO classique

import { db, ref, update } from '../../core/firebase-service.js';
import { MATRICE } from './matrice.js';

let currentClasse = '';
let currentCode = '';
let currentPassages = {}; // { circuitId: passageData }

// ============================================================
// OUVERTURE DE LA MODALE
// ============================================================
export function openCoDetail(classe, code, passages) {
    currentClasse = classe;
    currentCode = code;
    currentPassages = passages; // { circuitId: { pts, total, details, time, timestamp } }

    // Récupérer les élèves pour le nom
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${classe}`) || '{}');
    
    // Trouver le nom de l'élève
    let eleveNom = code;
    for (const [key, value] of Object.entries(mapping)) {
        if (key.endsWith(`_${code}`)) {
            if (Array.isArray(value) && value.length > 0) {
                const e = eleves.find(el => el.id === value[0]);
                if (e) eleveNom = `${e.prenom} ${e.nom}`;
            } else if (typeof value === 'string') {
                const e = eleves.find(el => el.id === value);
                if (e) eleveNom = `${e.prenom} ${e.nom}`;
            }
            break;
        }
    }

    // Créer la modale
    const modal = document.createElement('div');
    modal.id = 'co-detail-modal';
    modal.className = 'fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                <div>
                    <h3 class="text-2xl font-black text-blue-400">${eleveNom}</h3>
                    <p class="text-xs text-slate-400">Code : ${code}</p>
                </div>
                <div class="flex items-center gap-4">
                    <span id="co-detail-score" class="bg-blue-600 px-4 py-2 rounded-xl font-black text-white text-lg">0 pts</span>
                    <button onclick="closeCoDetail()" class="text-4xl text-slate-500 hover:text-white">&times;</button>
                </div>
            </div>
            <div id="co-detail-content" class="flex-1 overflow-y-auto pr-2 space-y-4"></div>
            <button onclick="closeCoDetail()" class="w-full mt-4 py-3 text-xs font-black uppercase border-2 border-slate-700 rounded-xl bg-black active:bg-slate-800 transition-colors">Fermer</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Remplir le contenu
    renderDetailContent();
}

// ============================================================
// RENDU DU CONTENU DE LA MODALE
// ============================================================
function renderDetailContent() {
    const container = document.getElementById('co-detail-content');
    if (!container) return;

    const circuitKeys = Object.keys(currentPassages);
    if (circuitKeys.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center">Aucun circuit validé.</p>';
        return;
    }

    let totalPts = 0;
    let totalMax = 0;

    let html = '';
    circuitKeys.forEach((circuitId, idx) => {
        const data = currentPassages[circuitId];
        totalPts += data.pts || 0;
        totalMax += data.total || 0;

        html += `
            <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div class="bg-slate-900 px-4 py-2 flex justify-between items-center cursor-pointer" onclick="toggleCircuitDetail(this)">
                    <span class="font-black text-blue-400">Circuit ${idx + 1}</span>
                    <span class="text-sm text-yellow-400 font-bold">${data.pts || 0} / ${data.total || 0}</span>
                </div>
                <div class="circuit-detail-content p-4 space-y-2">
        `;

        if (data.details && data.details.length > 0) {
            data.details.forEach((det, posteIdx) => {
                const isGhost = String(det.balise).includes('*');
                const realBal = String(det.balise).replace('*', '');
                const correctCode = isGhost ? '' : (MATRICE[realBal] ? MATRICE[realBal][currentCode] : null);
                const statusClass = det.status === 'correct' ? 'text-emerald-400' : (det.status === 'wrong' ? 'text-red-400' : 'text-slate-500');
                const statusLabel = det.status === 'correct' ? '✅ Correct' : (det.status === 'wrong' ? '❌ Erreur' : '⏳ En attente');

                html += `
                    <div class="bg-black p-3 rounded-xl flex items-center justify-between gap-2">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 text-xs text-slate-400">
                                <span class="font-bold">Poste ${posteIdx + 1}</span>
                                <span>Balise : ${det.balise}</span>
                                ${isGhost ? '<span class="text-amber-400">(fantôme)</span>' : ''}
                            </div>
                            <div class="flex items-center gap-4 mt-1">
                                <span class="text-sm font-bold text-white">Saisi : ${det.userCode || '---'}</span>
                                <span class="text-sm font-bold text-blue-400">Attendu : ${correctCode || '---'}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="${statusClass} font-bold text-sm">${statusLabel}</span>
                            ${det.status !== 'correct' ? `<button onclick="forcerCorrection('${circuitId}', ${posteIdx})" class="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg text-xs font-black text-white transition-colors">✅ Forcer</button>` : ''}
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<p class="text-slate-500 text-sm">Aucun détail disponible.</p>';
        }

        html += `
                </div>
            </div>
        `;
    });

    // Mettre à jour le score total
    document.getElementById('co-detail-score').innerText = `${totalPts} / ${totalMax} pts`;

    container.innerHTML = html;
}

// ============================================================
// TOGGLE EXPANSION D'UN CIRCUIT
// ============================================================
window.toggleCircuitDetail = function(header) {
    const content = header.nextElementSibling;
    if (content) {
        content.classList.toggle('hidden');
    }
};

// ============================================================
// FORCER LA CORRECTION D'UN POSTE
// ============================================================
window.forcerCorrection = function(circuitId, posteIdx) {
    if (!confirm(`Forcer la correction du poste ${posteIdx + 1} ?`)) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/passages`;

    // Trouver la clé du passage correspondant
    const passagesRef = ref(db, basePath);
    // On va chercher dans currentPassages pour trouver la clé
    // currentPassages est un objet avec des clés Firebase comme "-Nxyz..." ou des circuitId
    // On va parcourir les clés pour trouver celle qui correspond

    // On a besoin de la clé Firebase (pushId)
    // Pour simplifier, on va utiliser le circuitId comme clé (si c'est un pushId)
    // Sinon, on fait une recherche
    let passageKey = null;
    const passagesData = currentPassages;
    for (const [key, value] of Object.entries(passagesData)) {
        // Si la valeur a un circuitId qui correspond
        if (value.circuitId === circuitId || key === circuitId) {
            passageKey = key;
            break;
        }
    }

    if (!passageKey) {
        alert('Erreur : passage non trouvé.');
        return;
    }

    // Mise à jour dans Firebase
    const updatePath = `${basePath}/${passageKey}/details/${posteIdx}/status`;
    const updateRef = ref(db, updatePath);
    update(updateRef, 'correct')
        .then(() => {
            // Mettre à jour localement
            if (currentPassages[passageKey] && currentPassages[passageKey].details) {
                currentPassages[passageKey].details[posteIdx].status = 'correct';
                // Recalculer les points
                const pts = currentPassages[passageKey].details.filter(d => d.status === 'correct').length;
                currentPassages[passageKey].pts = pts;
                // Mettre à jour Firebase le pts aussi
                const ptsRef = ref(db, `${basePath}/${passageKey}/pts`);
                update(ptsRef, pts);
            }
            // Re-rendre le contenu
            renderDetailContent();
            alert('✅ Correction forcée !');
        })
        .catch(err => {
            console.error('Erreur lors de la correction :', err);
            alert('❌ Erreur lors de la correction.');
        });
};

// ============================================================
// FERMETURE DE LA MODALE
// ============================================================
window.closeCoDetail = function() {
    const modal = document.getElementById('co-detail-modal');
    if (modal) modal.remove();
};