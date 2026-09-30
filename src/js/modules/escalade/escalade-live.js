// src/js/modules/escalade/escalade-live.js
import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue, remove, update } from '../../core/firebase-service.js';
import { getNomFromCode, getPhotoHtml, getEleveIdFromCode, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { BAREME, coeffToCotation } from './escalade-calculations.js';

let currentUnsub = null;
let currentEscaladeMode = 'classic';
let currentEscaladeClasse = '';

export function setEscaladeMode(mode) {
    currentEscaladeMode = mode;
    if (currentEscaladeClasse) {
        renderEscaladeLive();
    }
}

export function renderEscaladeLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    currentEscaladeClasse = classe;

    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const monteesPath = `${getEtab()}/profs/${profCode}/${classe}/escalade/montees`;
    const validationsPath = `${getEtab()}/profs/${profCode}/${classe}/bloccontest/validations`;
    const configPath = `${getEtab()}/profs/${profCode}/${classe}/bloccontest/config`;

    container.innerHTML = '<p class="text-slate-500 text-center">Chargement...</p>';

    if (currentEscaladeMode === 'classic') {
        const monteesRef = ref(db, monteesPath);
        currentUnsub = onValue(monteesRef, (snap) => {
            const data = snap.val() || {};
            renderClassicLive(container, data, classe);
        });
    } else {
        // Bloc Contest
        const validationsRef = ref(db, validationsPath);
        const configRef = ref(db, configPath);
        
        let config = {};
        let validations = {};
        let loaded = 0;

        function checkAndRender() {
            if (loaded >= 2) {
                renderBlocLive(container, validations, config, classe);
            }
        }

        onValue(configRef, (snap) => {
            config = snap.val() || {};
            loaded++;
            checkAndRender();
        }, { onlyOnce: true });

        currentUnsub = onValue(validationsRef, (snap) => {
            validations = snap.val() || {};
            loaded++;
            checkAndRender();
        });
    }
}

function renderClassicLive(container, data, classe) {
    const entries = Object.values(data).reverse();

    if (entries.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center">Aucune montée pour l\'instant.</p>';
        return;
    }

    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade (Cliquez pour le bilan)</h3><div class="space-y-2">`;
    
    const promises = entries.slice(0, 20).map(async m => {
        const code = `${m.groupe}${m.role}`;
        const nom = getNomFromCode(code, classe);
        const photoHtml = await getPhotoHtml(code, classe);
        
        return `<div onclick="openBilan('${code}')" class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between cursor-pointer hover:border-blue-500">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <span class="font-bold text-white">${nom}</span>
                </div>
                <span class="text-emerald-400 font-black">${m.points ? m.points.toFixed(1) : m.hauteur}m</span>
            </div>`;
    });

    Promise.all(promises).then(results => {
        html += results.join('');
        html += `</div>`;
        container.innerHTML = html;
    });

    window.openBilan = async function(code) {
        const allData = data;
        const entrees = Object.entries(allData).filter(([, m]) => `${m.groupe}${m.role}` === code);
        const mesMontees = entrees.map(([, m]) => m);
        const nom = getNomFromCode(code, classe);
        
        let photoUrl = null;
        const eleveId = getEleveIdFromCode(code, classe);
        if (eleveId) photoUrl = await getPhotoUrl(eleveId);
        
        const photoHtml = photoUrl 
            ? `<img src="${photoUrl}" class="w-24 h-24 rounded-full object-cover border-4 border-slate-500">` 
            : `<div class="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;

        const nbMontees = mesMontees.length;
        const distanceTotale = mesMontees.reduce((sum, m) => sum + (m.hauteur || 0), 0);
        
        let coeffTotal = 0, hauteurTotal = 0;
        mesMontees.forEach(m => {
            const coeff = BAREME[m.cotation] || 1;
            coeffTotal += coeff * (m.hauteur || 0);
            hauteurTotal += m.hauteur || 0;
        });
        const coeffMoyen = hauteurTotal > 0 ? (coeffTotal / hauteurTotal) : 0;
        const difficultMoyenne = coeffToCotation(coeffMoyen);
        
        const nbTops = mesMontees.filter(m => m.hauteur >= 9).length;
        const validations = {};
        mesMontees.forEach(m => {
            if (!validations[m.cotation]) validations[m.cotation] = new Set();
            validations[m.cotation].add(m.voie_num);
        });
        const plusGrandeDif = Object.keys(validations)
            .filter(cot => validations[cot].size >= 2)
            .sort((a, b) => (BAREME[b] || 1) - (BAREME[a] || 1))[0] || 'Aucune';

        // Liste des réalisations avec modification / suppression
        let realisationsHtml = '<div class="space-y-2 max-h-48 overflow-y-auto">';
        if (entrees.length === 0) {
            realisationsHtml += '<p class="text-xs text-slate-500 italic">Aucune montée.</p>';
        } else {
            entrees.slice().sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0)).forEach(([key, m]) => {
                realisationsHtml += `
                    <div class="bg-slate-900 p-2 rounded-lg border border-slate-700 flex items-center gap-2">
                        <span class="text-lg">${m.hauteur >= 9 ? '✅' : '❌'}</span>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-white truncate">${m.cotation || '—'} · Voie ${m.voie_num || '—'}</div>
                            <div class="text-[10px] text-slate-400">${m.hauteur || 0}m · ${m.reussie ? 'Réussie' : (m.hauteur >= 9 ? 'Top' : 'Échec')}</div>
                        </div>
                        <button onclick="window.editMonteeClassic('${key}')" class="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white px-2 py-1 rounded text-[10px] font-black">✏️</button>
                        <button onclick="window.deleteMonteeClassic('${key}', '${code}')" class="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white px-2 py-1 rounded text-[10px] font-black">🗑️</button>
                    </div>
                `;
            });
        }
        realisationsHtml += '</div>';

        const modalHtml = `
        <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-50" id="bilanModal">
            <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div class="flex items-center gap-4 mb-4">
                    ${photoHtml}
                    <div>
                        <h3 class="text-2xl font-black text-white">${nom}</h3>
                        <p class="text-slate-400">Code : ${code}</p>
                    </div>
                    <button onclick="document.getElementById('bilanModal').remove()" class="ml-auto bg-slate-700 px-3 py-1.5 rounded-xl font-bold text-white">✕</button>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div class="bg-slate-900 p-3 rounded-xl text-center"><div class="text-[10px] text-slate-400 uppercase">Montées</div><div class="text-xl font-black text-white">${nbMontees}</div></div>
                    <div class="bg-slate-900 p-3 rounded-xl text-center"><div class="text-[10px] text-slate-400 uppercase">Distance</div><div class="text-xl font-black text-emerald-400">${distanceTotale} m</div></div>
                    <div class="bg-slate-900 p-3 rounded-xl text-center"><div class="text-[10px] text-slate-400 uppercase">Tops</div><div class="text-xl font-black text-yellow-400">${nbTops}</div></div>
                    <div class="bg-slate-900 p-3 rounded-xl text-center"><div class="text-[10px] text-slate-400 uppercase">Difficulté moy.</div><div class="text-xl font-black text-blue-400">${difficultMoyenne}</div></div>
                </div>
                <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 mb-3">
                    <div class="flex justify-between"><span class="text-slate-400 text-sm">Plus grande difficulté validée</span><span class="font-black text-blue-400 text-sm">${plusGrandeDif}</span></div>
                </div>
                <h4 class="font-bold text-slate-300 uppercase text-xs mb-2">🧗 Réalisations (${nbMontees})</h4>
                ${realisationsHtml}
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    // Modification / suppression d'une montée (depuis le live)
    window.deleteMonteeClassic = async function(key) {
        if (!confirm('🗑️ Supprimer cette montée ?')) return;
        const monteesPath = `${getEtab()}/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}/${classe}/escalade/montees`;
        try {
            await remove(ref(db, `${monteesPath}/${key}`));
            document.getElementById('bilanModal')?.remove();
        } catch (err) {
            console.error(err);
            alert('❌ Erreur suppression : ' + err.message);
        }
    };

    window.editMonteeClassic = function(key) {
        const entry = Object.entries(data).find(([k]) => k === key);
        if (!entry) return;
        const m = entry[1];

        const modal = document.createElement('div');
        modal.id = 'edit-montee-classic-modal';
        modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50';
        modal.innerHTML = `
            <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
                <h3 class="text-xl font-black text-white mb-4">✏️ Modifier la montée</h3>
                <p class="text-xs text-slate-400 mb-4">${m.cotation || '—'} · Voie ${m.voie_num || '—'}</p>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Hauteur atteinte (m)</label>
                        <input type="number" id="edit-montee-hauteur" value="${m.hauteur || 0}" min="0" max="9" step="1"
                               class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-center text-xl font-black">
                    </div>
                    <button onclick="window.saveMonteeClassic('${key}')" class="w-full bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">💾 Enregistrer</button>
                    <button onclick="document.getElementById('edit-montee-classic-modal').remove()" class="w-full bg-slate-700 py-2 rounded-xl font-black text-white text-sm active:scale-95">Annuler</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    window.saveMonteeClassic = async function(key) {
        const input = document.getElementById('edit-montee-hauteur');
        const hauteur = input ? parseInt(input.value, 10) : 0;
        const hauteurSafe = isNaN(hauteur) ? 0 : Math.max(0, Math.min(9, hauteur));

        // Recalcule les points : hauteur * coeff de la cotation.
        const entry = Object.entries(data).find(([k]) => k === key);
        const cotation = entry ? entry[1].cotation : null;
        const coeff = BAREME[cotation] || 1;
        const points = hauteurSafe * coeff;

        const monteesPath = `${getEtab()}/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}/${classe}/escalade/montees`;
        try {
            await update(ref(db, `${monteesPath}/${key}`), { hauteur: hauteurSafe, points, reussie: hauteurSafe >= 9 });
            document.getElementById('edit-montee-classic-modal')?.remove();
            document.getElementById('bilanModal')?.remove();
        } catch (err) {
            console.error(err);
            alert('❌ Erreur modification : ' + err.message);
        }
    };
}

function renderBlocLive(container, validations, config, classe) {
    const validationsList = Object.values(validations);
    const blocs = config.blocs || [];

    if (validationsList.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center">Aucune validation Bloc Contest pour l\'instant.</p>';
        return;
    }

    const scores = {};
    validationsList.forEach(v => {
        const id = v.eleveId || v.code;
        if (!id) return;
        if (!scores[id]) scores[id] = 0;
        scores[id] += v.valeurAuMoment || 0;
    });

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    
    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Bloc Contest - Classement (cliquez pour la fiche)</h3><div class="space-y-2">`;
    
    const sorted = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

    (async () => {
        let items = [];
        for (const [eleveId, score] of sorted) {
            let eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) eleve = eleves.find(e => String(e.codeAutoEval) === String(eleveId));
            const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : `Code ${eleveId}`;

            let photoUrl = null;
            if (eleve) { try { photoUrl = await getPhotoUrl(eleve.id); } catch (e) {} }
            const photoHtml = photoUrl
                ? `<img src="${photoUrl}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`
                : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">👤</div>`;

            const safeId = eleve?.id || eleveId;
            items.push(`<div onclick="window.openFicheBloc('${String(safeId).replace(/'/g, "\\'")}')" class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between cursor-pointer hover:border-orange-500">
                    <div class="flex items-center gap-3">
                        ${photoHtml}
                        <span class="font-bold text-white">${nom}</span>
                    </div>
                    <span class="text-yellow-400 font-black">${score} pts</span>
                </div>`);
        }
        html += items.join('');
        html += `</div>`;
        container.innerHTML = html;

        // Fiche élève Bloc Contest
        window.openFicheBloc = async function(id) {
            const eleve = eleves.find(e => e.id === id) || eleves.find(e => String(e.codeAutoEval) === String(id));
            const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : `#${id}`;

            const mesValidations = Object.entries(validations).filter(([, v]) => (v.eleveId || v.code) === id);

            let photoUrl = null;
            if (eleve) { try { photoUrl = await getPhotoUrl(eleve.id); } catch (e) {} }
            const photoHtml = photoUrl
                ? `<img src="${photoUrl}" class="w-20 h-20 rounded-full object-cover border-4 border-slate-500">`
                : `<div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;

            let listeHtml = '<div class="space-y-2 max-h-48 overflow-y-auto">';
            if (mesValidations.length === 0) {
                listeHtml += '<p class="text-xs text-slate-500 italic">Aucune validation.</p>';
            } else {
                mesValidations.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0)).forEach(([key, v]) => {
                    const bloc = (config.blocs || []).find(b => b.id === v.blocId) || {};
                    const blockLabel = bloc.label || v.blocId || '—';
                    listeHtml += `
                        <div class="bg-slate-900 p-2 rounded-lg border border-slate-700 flex items-center gap-2">
                            <span class="text-lg">${v.reussite ? '✅' : '❌'}</span>
                            <div class="flex-1 min-w-0">
                                <div class="text-xs font-bold text-white">${blockLabel}</div>
                                <div class="text-[10px] text-slate-400">${v.valeurAuMoment || 0} pts</div>
                            </div>
                            <button onclick="window.deleteValidationBloc('${key}')" class="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white px-2 py-1 rounded text-[10px] font-black">🗑️</button>
                        </div>
                    `;
                });
            }
            listeHtml += '</div>';

            const modal = document.createElement('div');
            modal.id = 'fiche-bloc-modal';
            modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50';
            modal.innerHTML = `
                <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <div class="flex items-center gap-4 mb-4">
                        ${photoHtml}
                        <div>
                            <h3 class="text-2xl font-black text-white">${nom}</h3>
                            <p class="text-slate-400">Total : ${scores[id] || 0} pts</p>
                        </div>
                        <button onclick="document.getElementById('fiche-bloc-modal').remove()" class="ml-auto bg-slate-700 px-3 py-1.5 rounded-xl font-bold text-white">✕</button>
                    </div>
                    <h4 class="font-bold text-slate-300 uppercase text-xs mb-2">🧱 Validations (${mesValidations.length})</h4>
                    ${listeHtml}
                </div>
            `;
            document.body.appendChild(modal);
        };

        window.deleteValidationBloc = async function(key) {
            if (!confirm('🗑️ Supprimer cette validation ?')) return;
            const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
            const validationsPath = `${getEtab()}/profs/${profCode}/${classe}/bloccontest/validations`;
            try {
                await remove(ref(db, `${validationsPath}/${key}`));
                document.getElementById('fiche-bloc-modal')?.remove();
            } catch (err) {
                console.error(err);
                alert('❌ Erreur suppression : ' + err.message);
            }
        };
    })();
}
