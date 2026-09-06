// src/js/modules/co/co-live.js
// Affichage en direct des résultats des élèves pour la CO classique
// Les cartes sont cliquables pour ouvrir la modale de correction

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping } from '../../core/live-engine.js';
import { openCoDetail } from './co-detail.js';

// ✅ Exposer openCoDetail globalement pour les onclick HTML
window.openCoDetail = openCoDetail;

let currentClasse = '';
let currentUnsub = null;
let currentPassagesData = {};

export function renderCOLive() {
    // Retourner une promesse pour que le dispatcher puisse utiliser .then/.catch
    return new Promise((resolve, reject) => {
        try {
            const container = document.getElementById('live-content');
            if (!container) {
                resolve();
                return;
            }

            const selectClasse = document.getElementById('selectClasse');
            if (!selectClasse) {
                container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
                resolve();
                return;
            }
            currentClasse = selectClasse.value;
            if (!currentClasse) {
                container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
                resolve();
                return;
            }

            const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
            const basePath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/passages`;
            const passagesRef = ref(db, basePath);

            if (currentUnsub) {
                currentUnsub();
                currentUnsub = null;
            }

            container.innerHTML = '<p class="text-slate-500 text-center">Chargement...</p>';

            // ✅ On résout la promesse après le premier chargement des données
            let initialLoadDone = false;

            currentUnsub = onValue(passagesRef, async (snap) => {
                try {
                    const data = snap.val() || {};
                    currentPassagesData = data;
                    const passages = Object.values(data);

                    if (passages.length === 0) {
                        container.innerHTML = '<p class="text-slate-500 text-center">Aucun résultat pour l\'instant.</p>';
                        if (!initialLoadDone) {
                            initialLoadDone = true;
                            resolve();
                        }
                        return;
                    }

                    // Grouper par code élève
                    const byCode = {};
                    passages.forEach(p => {
                        if (!byCode[p.code]) byCode[p.code] = [];
                        byCode[p.code].push(p);
                    });

                    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
                    const mapping = getLocalMapping(currentClasse) || {};

                    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏃 Résultats CO en direct</h3>`;
                    html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;

                    for (const [code, sessions] of Object.entries(byCode)) {
                        // Calculer les totaux pour ce code
                        let totalPts = 0;
                        let totalMax = 0;
                        let dernierCircuit = null;
                        let dernierTemps = 0;

                        sessions.forEach(s => {
                            totalPts += s.pts || 0;
                            totalMax += s.total || 0;
                            if (s.timestamp && s.timestamp > dernierTemps) {
                                dernierTemps = s.timestamp;
                                dernierCircuit = s.circuitId;
                            }
                        });

                        // Trouver TOUS les élèves associés à ce code
                        let elevesAssocies = [];

                        for (const [key, value] of Object.entries(mapping)) {
                            if (key.endsWith(`_${code}`)) {
                                if (Array.isArray(value)) {
                                    elevesAssocies = value.map(id => eleves.find(e => e.id === id)).filter(Boolean);
                                } else if (typeof value === 'string') {
                                    const e = eleves.find(el => el.id === value);
                                    if (e) elevesAssocies.push(e);
                                }
                                break;
                            }
                        }

                        // Fallback : si aucun élève trouvé, utiliser le code seul
                        if (elevesAssocies.length === 0) {
                            elevesAssocies.push({ prenom: code, nom: '', id: code });
                        }

                        // Pour chaque élève associé, créer une carte
                        for (const eleve of elevesAssocies) {
                            const nom = eleve ? `${eleve.prenom} ${eleve.nom}`.trim() || code : code;
                            let photoHtml = '<div class="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>';
                            if (eleve.id) {
                                try {
                                    const url = await getPhotoUrl(eleve.id);
                                    if (url) {
                                        photoHtml = `<img src="${url}" class="w-12 h-12 rounded-full object-cover border-2 border-slate-500">`;
                                    }
                                } catch (e) {}
                            }

                            const pct = totalMax > 0 ? Math.round((totalPts / totalMax) * 100) : 0;
                            const couleurPct = pct >= 80 ? 'text-emerald-400' : (pct >= 50 ? 'text-yellow-400' : 'text-red-400');

                            // Construire la map des passages pour ce code
                            const passagesMap = {};
                            sessions.forEach(s => {
                                for (const [key, val] of Object.entries(currentPassagesData)) {
                                    if (val.code === code && val.circuitId === s.circuitId) {
                                        passagesMap[key] = val;
                                        break;
                                    }
                                }
                            });

                            const passagesJson = JSON.stringify(passagesMap);

                            html += `
                                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 cursor-pointer hover:border-blue-500 transition-colors" 
                                     data-code="${code}"
                                     data-classe="${currentClasse}"
                                     data-passages="${encodeURIComponent(passagesJson)}"
                                     onclick="handleCoCardClick(this)">
                                    <div class="flex items-center gap-3 mb-2">
                                        ${photoHtml}
                                        <div>
                                            <div class="font-black text-white text-lg">${nom}</div>
                                            <div class="text-xs text-slate-400">Code : ${code}</div>
                                            ${elevesAssocies.length > 1 ? '<div class="text-xs text-amber-400">⚠️ Poste partagé</div>' : ''}
                                        </div>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <div>
                                            <span class="text-3xl font-black text-yellow-400">${totalPts}</span>
                                            <span class="text-sm text-slate-500"> / ${totalMax}</span>
                                        </div>
                                        <span class="${couleurPct} font-black text-lg">${pct}%</span>
                                    </div>
                                    <div class="w-full h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
                                        <div class="h-full ${pct >= 80 ? 'bg-emerald-500' : (pct >= 50 ? 'bg-yellow-500' : 'bg-red-500')} rounded-full transition-all" style="width:${pct}%"></div>
                                    </div>
                                    <div class="text-[10px] text-slate-500 mt-2">
                                        ${sessions.length} circuit(s) validé(s)
                                        ${dernierCircuit ? `· Dernier : ${dernierCircuit}` : ''}
                                    </div>
                                </div>
                            `;
                        }
                    }

                    html += `</div>`;
                    container.innerHTML = html;

                    // ✅ Résoudre la promesse après le premier chargement réussi
                    if (!initialLoadDone) {
                        initialLoadDone = true;
                        resolve();
                    }
                } catch (err) {
                    console.error('[CO Live] Erreur lors du rendu :', err);
                    if (!initialLoadDone) {
                        initialLoadDone = true;
                        reject(err);
                    }
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

// ✅ Gestionnaire de clic sur les cartes
window.handleCoCardClick = function(element) {
    const code = element.dataset.code;
    const classe = element.dataset.classe;
    const passagesEncoded = element.dataset.passages;
    try {
        const passages = JSON.parse(decodeURIComponent(passagesEncoded));
        openCoDetail(classe, code, passages);
    } catch (e) {
        console.error('Erreur lors de l\'ouverture de la modale :', e);
        alert('Erreur : impossible d\'ouvrir les détails.');
    }
};

export function cleanupCOLive() {
    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }
}