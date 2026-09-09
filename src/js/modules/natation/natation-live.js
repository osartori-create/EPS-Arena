// src/js/modules/natation/natation-live.js
import { db, ref, onValue, set } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';

let currentUnsubTemps = null;
let currentUnsubCoups = null;
let currentUnsubHistorique = null;

// ============================================================
// BARÈME
// ============================================================
function getNiveau(indice) {
    if (indice === null || isNaN(indice)) {
        return { couleur: 'bg-slate-600', label: '--' };
    }
    const rounded = Math.round(indice * 100) / 100;
    
    if (rounded >= 4.0) return { couleur: 'bg-emerald-500', label: '🌟 Excellent' };
    if (rounded >= 3.0) return { couleur: 'bg-blue-500', label: '💪 Très satisfaisant' };
    if (rounded >= 2.0) return { couleur: 'bg-yellow-500', label: '✅ Satisfaisant' };
    if (rounded >= 1.31) return { couleur: 'bg-orange-500', label: '🟡 Fragile' };
    return { couleur: 'bg-red-500', label: '🔴 Très insuffisant' };
}

function calculIndice(tempsMs, nbCoups) {
    if (tempsMs === null || nbCoups === null || tempsMs <= 0 || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

function formatTime(ms) {
    if (!ms || ms <= 0) return '--:--.-';
    const totalSec = Math.floor(ms / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    const dec = Math.floor((ms % 1000) / 100);
    return `${min}:${sec}.${dec}`;
}

// ============================================================
// EXPORT CSV (pour le bouton dans le Live)
// ============================================================
window.exportNatationLiveCSV = function() {
    const classe = getCurrentClasse();
    if (!classe) {
        alert('Sélectionnez une classe.');
        return;
    }
    const container = document.getElementById('live-content');
    const rows = container.querySelectorAll('.natation-live-row');
    let csv = '\uFEFF"!groupe";"Nom";"Prénom";"Temps (s)";"Coups";"Indice";"Niveau"\n';
    rows.forEach(row => {
        csv += `"${row.dataset.numero || ''}";"${row.dataset.nom || ''}";"${row.dataset.prenom || ''}";"${row.dataset.temps || ''}";"${row.dataset.coups || ''}";"${row.dataset.indice || ''}";"${row.dataset.niveau || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Natation_Live_${classe}.csv`;
    link.click();
};

// ============================================================
// RENDU PRINCIPAL
// ============================================================
export function renderNatationLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsubTemps) currentUnsubTemps();
    if (currentUnsubCoups) currentUnsubCoups();
    if (currentUnsubHistorique) currentUnsubHistorique();

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/temps`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/coups`);
    const historiqueRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/historique`);

    let tempsData = {};
    let coupsData = {};
    let historiqueData = {};
    const mapping = getLocalMapping(classe) || {}; // mapping local du prof (numéro -> eleveId)
    const eleves = getExistingEleves(classe); // liste des élèves avec id, nom, prenom

    async function render() {
        // Vérifier si on a des données
        if (Object.keys(tempsData).length === 0 && Object.keys(coupsData).length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-center">Aucun résultat pour l\'instant.</p>';
            return;
        }

        const results = [];
        const seenNumeros = new Set();

        // Parcourir les données par numéro (clés dans tempsData sont des numéros)
        for (const [numero, tempsMs] of Object.entries(tempsData)) {
            if (seenNumeros.has(numero)) continue;
            seenNumeros.add(numero);

            // Récupérer l'eleveId depuis le mapping local
            const eleveId = mapping[`${classe}_${numero}`];
            const eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) continue; // Si l'élève n'est pas trouvé dans le mapping, on ignore

            const coups = coupsData[numero] || null;
            const indice = calculIndice(tempsMs, coups);
            const niveau = indice !== null ? getNiveau(indice) : { label: '--', couleur: 'bg-slate-600' };

            // Récupérer l'historique pour ce numéro
            const historique = [];
            for (const [key, h] of Object.entries(historiqueData)) {
                // On compare avec le numéro (les clés dans historique sont les numéros)
                if (key === numero) {
                    historique.push({
                        tempsMs: h.tempsMs || 0,
                        nbCoups: h.nbCoups || 0,
                        indice: h.indice || 0,
                        timestamp: h.timestamp || Date.now()
                    });
                }
            }

            // Dédoublonner l'historique
            const uniqueMap = new Map();
            for (const item of historique) {
                const key = `${item.tempsMs}-${item.nbCoups}`;
                if (!uniqueMap.has(key) || uniqueMap.get(key).timestamp < item.timestamp) {
                    uniqueMap.set(key, item);
                }
            }
            const historiqueUnique = Array.from(uniqueMap.values()).sort((a, b) => a.timestamp - b.timestamp);

            results.push({
                numero,
                eleve,
                tempsMs,
                coups,
                indice,
                niveau,
                historique: historiqueUnique
            });
        }

        // Trier par indice décroissant
        results.sort((a, b) => {
            if (a.indice === null && b.indice === null) return 0;
            if (a.indice === null) return 1;
            if (b.indice === null) return -1;
            return b.indice - a.indice;
        });

        let html = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-black text-blue-400 uppercase text-sm">🏊 Classement Indice de nage</h3>
                <button onclick="window.exportNatationLiveCSV()" 
                        class="bg-indigo-600 px-3 py-1.5 rounded-xl font-black text-xs text-white border-2 border-indigo-400 active:scale-95">
                    📥 Export CSV
                </button>
            </div>
            <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        `;

        for (const r of results) {
            const photo = await getPhotoUrl(r.eleve.id);
            const photoHtml = photo ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">` : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
            const tempsStr = r.tempsMs !== null ? `${(r.tempsMs/1000).toFixed(1)}s` : '--';
            const coupsStr = r.coups !== null ? `${r.coups}` : '--';
            const indiceStr = r.indice !== null ? r.indice.toFixed(2) : '--';

            html += `
                <div class="natation-live-row bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 cursor-pointer hover:border-blue-500 transition-all"
                     data-numero="${r.numero}"
                     data-nom="${r.eleve.nom || ''}"
                     data-prenom="${r.eleve.prenom || ''}"
                     data-temps="${r.tempsMs !== null ? (r.tempsMs/1000).toFixed(1) : ''}"
                     data-coups="${r.coups || ''}"
                     data-indice="${indiceStr}"
                     data-niveau="${r.niveau.label}"
                     onclick="window.openNatationLiveFiche('${r.numero}')">
                    ${photoHtml}
                    <div class="flex-1">
                        <div class="font-bold text-white">${r.eleve.prenom} ${r.eleve.nom}</div>
                        <div class="text-xs text-slate-400">N° ${r.numero}</div>
                    </div>
                    <div class="flex items-center gap-3 text-sm">
                        <span class="text-yellow-400 font-bold">${tempsStr}</span>
                        <span class="text-blue-400 font-bold">${coupsStr} bras</span>
                        <span class="${r.niveau.couleur} px-2 py-0.5 rounded-full text-xs font-black text-white">${indiceStr}</span>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;
    }

    // Écouter les changements
    currentUnsubTemps = onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        render();
    });

    currentUnsubCoups = onValue(coupsRef, (snap) => {
        coupsData = snap.val() || {};
        render();
    });

    currentUnsubHistorique = onValue(historiqueRef, (snap) => {
        historiqueData = snap.val() || {};
        render();
    });

    // ============================================================
    // FICHE ÉLÈVE DEPUIS LE LIVE (clic sur une ligne)
    // ============================================================
    window.openNatationLiveFiche = function(numero) {
        // Récupérer les données du numéro
        const tempsMs = tempsData[numero] || null;
        const coups = coupsData[numero] || null;
        const indice = calculIndice(tempsMs, coups);
        const niveau = indice !== null ? getNiveau(indice) : { label: '--' };

        // Récupérer l'historique pour ce numéro
        const historique = [];
        for (const [key, h] of Object.entries(historiqueData)) {
            if (key === numero) {
                historique.push({
                    tempsMs: h.tempsMs || 0,
                    nbCoups: h.nbCoups || 0,
                    indice: h.indice || 0,
                    timestamp: h.timestamp || Date.now()
                });
            }
        }

        // Dédoublonner
        const uniqueMap = new Map();
        for (const item of historique) {
            const key = `${item.tempsMs}-${item.nbCoups}`;
            if (!uniqueMap.has(key) || uniqueMap.get(key).timestamp < item.timestamp) {
                uniqueMap.set(key, item);
            }
        }
        const historiqueUnique = Array.from(uniqueMap.values()).sort((a, b) => a.timestamp - b.timestamp);

        // Récupérer l'élève via le mapping local
        const eleveId = (getLocalMapping(classe) || {})[`${classe}_${numero}`];
        const eleve = getExistingEleves(classe).find(e => e.id === eleveId);
        if (!eleve) {
            alert('Élève non trouvé dans le mapping local.');
            return;
        }

        // Générer le HTML de l'historique
        let historiqueHtml = '';
        if (historiqueUnique.length > 0) {
            historiqueHtml = `
                <div class="mt-4">
                    <p class="text-xs font-bold text-slate-400 uppercase mb-2">📊 Historique des essais</p>
                    <div class="space-y-1 max-h-40 overflow-y-auto">
                        ${historiqueUnique.map((h, idx) => {
                            const hTemps = formatTime(h.tempsMs);
                            const hIndice = h.indice || calculIndice(h.tempsMs, h.nbCoups);
                            const hNiveau = hIndice !== null ? getNiveau(hIndice) : { label: '--' };
                            const date = h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : '--';
                            return `
                                <div class="bg-slate-800 p-2 rounded-lg flex justify-between items-center text-xs">
                                    <span class="text-slate-400">Essai ${idx+1}</span>
                                    <span class="text-yellow-400 font-bold">${hTemps}</span>
                                    <span class="text-blue-400">${h.nbCoups || 0} bras</span>
                                    <span class="${hNiveau.couleur} px-1.5 py-0.5 rounded-full text-[10px] font-black text-white">${hIndice ? hIndice.toFixed(2) : '--'}</span>
                                    <span class="text-slate-500">${date}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            historiqueHtml = `
                <div class="mt-4 text-center text-slate-500 text-sm">
                    <p>Aucun essai enregistré</p>
                </div>
            `;
        }

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-white">${eleve.prenom} ${eleve.nom}</h3>
                    <button onclick="this.closest('.fixed').remove()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white">✖</button>
                </div>
                <div class="text-4xl font-black text-yellow-400 text-center mb-4">#${numero}</div>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Temps (secondes)</label>
                        <input type="number" id="edit-live-temps" value="${tempsMs !== null ? (tempsMs/1000).toFixed(1) : ''}" 
                               step="0.1" min="0" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-xl font-black text-center">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Nombre de coups de bras</label>
                        <input type="number" id="edit-live-coups" value="${coups !== null ? coups : ''}" 
                               min="1" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-xl font-black text-center">
                    </div>
                    
                    <div class="bg-slate-800 p-3 rounded-xl text-center">
                        <p class="text-xs text-slate-400">Indice actuel</p>
                        <p class="text-3xl font-black text-yellow-400">${indice !== null ? indice.toFixed(2) : '--'}</p>
                        <p class="text-sm font-bold ${niveau.couleur} text-white">${niveau.label}</p>
                    </div>

                    ${historiqueHtml}

                    <div class="flex gap-3 mt-4">
                        <button onclick="window.sauvegarderLiveNatation('${numero}')" 
                                class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                            💾 Enregistrer
                        </button>
                        <button onclick="this.closest('.fixed').remove()" 
                                class="bg-slate-700 px-6 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Fonction de sauvegarde
        window.sauvegarderLiveNatation = function(numero) {
            const tempsInput = document.getElementById('edit-live-temps');
            const coupsInput = document.getElementById('edit-live-coups');
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
            
            const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
            const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/temps/${numero}`);
            const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/coups/${numero}`);
            
            Promise.all([
                set(tempsRef, tempsMs),
                set(coupsRef, coups)
            ]).then(() => {
                alert('✅ Données mises à jour !');
                modal.remove();
                render(); // rafraîchir le Live
            }).catch(err => {
                console.error('Erreur sauvegarde :', err);
                alert('❌ Erreur lors de la sauvegarde.');
            });
        };
    };
}