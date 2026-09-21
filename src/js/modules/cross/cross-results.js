// src/js/modules/cross/cross-results.js
// Onglet Résultats : tableau complet, modifications prof, export Excel

import { COURSES_DEFAUT, getNiveauFromClasse, formatTemps, calculerNoteEleve } from './cross-core.js';
import { getTousLesElevesCross, KEYS } from './cross-config.js';
import {
    listenModifications, sauvegarderModification, supprimerModification,
    appliquerModif, getStatutVisuel, STATUTS
} from './cross-modifications.js';

let currentCourseId = 'course1';
let tousLesEleves = {};
let arrivees = {};
let modifications = {};
let elevesMap = {};
let unsubArrivees = null;
let unsubModifs = null;
let unsubGo = null;
let goTimestamp = null;

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initCrossResults(container) {
    if (!container) return;

    currentCourseId = localStorage.getItem(KEYS.COURSE_ACTIVE) || 'course1';

    // Charger le mapping élèves
    const eleves = getTousLesElevesCross();
    elevesMap = {};
    eleves.forEach(e => { elevesMap[e.eleveId] = e; });

    // Construire tousLesEleves : dossard → { nom, prenom, classe, sexe, vma, eleveId }
    tousLesEleves = {};
    const dossards = JSON.parse(localStorage.getItem(KEYS.DOSSARDS) || '{}');
    Object.entries(dossards).forEach(([dossard, eleveId]) => {
        const e = elevesMap[eleveId];
        if (e) {
            tousLesEleves[String(dossard)] = {
                eleveId,
                nom: e.nom,
                prenom: e.prenom,
                classe: e.classe,
                sexe: e.sexe,
                vma: parseFloat(e.vma) || null,
                statut: e.statut || 'present'
            };
        }
    });

    render(container);
    attacherListeners();
}

function attacherListeners() {
    if (unsubArrivees) { unsubArrivees(); unsubArrivees = null; }
    if (unsubModifs) { unsubModifs(); unsubModifs = null; }
    if (unsubGo) { unsubGo(); unsubGo = null; }

    const { db, ref, onValue } = window.__crossFirebase || {};
    if (!db) {
        // Fallback : recharger dynamiquement
        import('../../core/firebase-service.js').then(({ db, ref, onValue }) => {
            window.__crossFirebase = { db, ref, onValue };
            attacherListeners();
        });
        return;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/cross`;

    unsubArrivees = onValue(ref(db, `${basePath}/courses/${currentCourseId}/arrivees`), snap => {
        arrivees = snap.val() || {};
        renderTableau();
    });

    unsubGo = onValue(ref(db, `${basePath}/courses/${currentCourseId}/go`), snap => {
        const go = snap.val();
        goTimestamp = go?.timestamp || null;
        renderTableau();
    });

    unsubModifs = listenModifications(currentCourseId, data => {
        modifications = data;
        renderTableau();
    });
}

// ============================================================
// RENDU
// ============================================================
function render(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <!-- Sélecteur de course + actions -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-3 flex-wrap gap-3">
                    <h3 class="font-black text-blue-400 uppercase text-sm">📊 Résultats & modifications</h3>
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="window.crossResultsExportExcel()"
                                class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400 active:scale-95">
                            📥 Export Excel
                        </button>
                        <button onclick="window.crossResultsResetModifs()"
                                class="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-red-500 active:scale-95">
                            🗑️ Effacer les modifs
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    ${COURSES_DEFAUT.map(c => `
                        <button onclick="window.crossResultsSelect('${c.id}')"
                                class="p-3 rounded-xl font-black text-sm border-2 active:scale-95 transition-all ${c.id === currentCourseId
                                    ? 'bg-blue-600 border-blue-400 text-white'
                                    : 'bg-slate-900 border-slate-700 text-slate-300'}">
                            ${c.label}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Tableau -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div id="cross-results-tableau" class="overflow-x-auto"></div>
            </div>

            <p class="text-xs text-slate-500 text-center">
                💡 Clique sur <strong class="text-slate-300">✏️</strong> pour modifier un élève · Les modifications sont prises en compte dans le classement
            </p>
        </div>
    `;
    renderTableau();
}

function renderTableau() {
    const container = document.getElementById('cross-results-tableau');
    if (!container) return;

    const course = COURSES_DEFAUT.find(c => c.id === currentCourseId);
    if (!course) return;

    // Construire la liste des élèves arrivés avec temps bruts
    const elevesArrives = [];
    const vus = new Set();

    Object.values(arrivees).forEach(arr => {
        if (vus.has(arr.dossard)) return;
        vus.add(arr.dossard);
        const eleve = tousLesEleves[String(arr.dossard)];
        if (!eleve) return;
        let tempsBrut = goTimestamp ? (arr.timestamp - goTimestamp) : null;
        // Détection temps négatif (GO relancé après les arrivées)
        if (tempsBrut !== null && tempsBrut < 0) tempsBrut = -1;
        elevesArrives.push({
            dossard: String(arr.dossard),
            eleve,
            tempsBrut
        });
    });

    // Appliquer les modifications + groupement par niveau + rang
    const parNiveau = {};
    course.niveaux.forEach(n => parNiveau[n] = []);

    elevesArrives.forEach(ea => {
        const modif = modifications[ea.dossard] || null;
        const applique = appliquerModif(ea.tempsBrut, modif);
        const statutVisuel = getStatutVisuel(modif);
        const niveau = getNiveauFromClasse(ea.eleve.classe);
        if (!parNiveau[niveau]) return;

        parNiveau[niveau].push({
            dossard: ea.dossard,
            eleve: ea.eleve,
            tempsBrut: ea.tempsBrut,
            tempsEffectif: applique.tempsEffectif,
            statut: applique.statut,
            statutVisuel,
            commentaire: applique.commentaire,
            penalitePoints: applique.penalitePoints,
            exclu: applique.excluDuClassement,
            aModif: applique.aModif,
            niveau
        });
    });

    // Attribution des rangs (les exclus ne sont pas classés)
    course.niveaux.forEach(niveau => {
        const liste = parNiveau[niveau] || [];
        liste.sort((a, b) => {
            if (a.exclu && !b.exclu) return 1;
            if (!a.exclu && b.exclu) return -1;
            if (a.tempsEffectif === null && b.tempsEffectif === null) return 0;
            if (a.tempsEffectif === null) return 1;
            if (b.tempsEffectif === null) return -1;
            return a.tempsEffectif - b.tempsEffectif;
        });

        const nbClassables = liste.filter(x => !x.exclu && x.tempsEffectif !== null && x.tempsEffectif !== -1).length;
        let rang = 0;
        liste.forEach(item => {
            // ⚠️ Si temps incohérent (-1), on ne classe pas et on ne calcule rien
            if (item.tempsEffectif === -1) {
                item.rangNiveau = null;
                item.nbArrivants = nbClassables;
                item.pourcentageVMA = null;
                item.ptsMotricite = 0;
                item.ptsPerformance = 0;
                item.noteBrute = 0;
                item.noteFinale = 0;
                item.incoherent = true;
                return;
            }

            if (!item.exclu && item.tempsEffectif !== null) {
                rang++;
                item.rangNiveau = rang;
                item.nbArrivants = nbClassables;

                if (item.eleve.vma) {
                    const note = calculerNoteEleve({
                        tempsSec: Math.round(item.tempsEffectif / 1000),
                        vma: item.eleve.vma,
                        rang: item.rangNiveau,
                        nbArrivants: nbClassables
                    });
                    item.pourcentageVMA   = note.pourcentageVMA;
                    item.ptsMotricite     = note.ptsMotricite;
                    item.ptsPerformance   = note.ptsPerformance;
                    item.noteBrute        = note.total;
                } else {
                    item.pourcentageVMA = null;
                    item.ptsMotricite = 0;
                    item.ptsPerformance = 0;
                    item.noteBrute = 0;
                }
                item.noteFinale = Math.max(0, item.noteBrute - item.penalitePoints);
            } else {
                item.rangNiveau = null;
                item.nbArrivants = nbClassables;
                item.pourcentageVMA = null;
                item.ptsMotricite = 0;
                item.ptsPerformance = 0;
                item.noteBrute = 0;
                item.noteFinale = 0;
            }
        });
    });

    // Compter les incohérents
    const tousLesItems = Object.values(parNiveau).flat();
    const nbIncoherents = tousLesItems.filter(i => i.incoherent).length;

    // Bandeau d'avertissement si besoin
    let bandeauAlerte = '';
    if (nbIncoherents > 0) {
        bandeauAlerte = `
            <div class="bg-red-900/40 border-2 border-red-500 p-3 rounded-xl mb-4 text-center">
                <p class="text-red-300 font-bold">⚠️ ${nbIncoherents} temps incohérent(s) détecté(s)</p>
                <p class="text-xs text-red-400 mt-1">
                    Le GO a probablement été relancé après l'enregistrement des arrivées.
                    Fais un <strong>Reset</strong> de la course concernée, ou relance une simulation.
                </p>
            </div>
        `;
    }

    // Afficher
    const niveauxTries = [...course.niveaux].sort((a, b) => parseInt(b) - parseInt(a));

    let html = bandeauAlerte;
    html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">`;

    niveauxTries.forEach(niveau => {
        const liste = parNiveau[niveau] || [];
        const nbClassables = liste.filter(x => !x.exclu && x.tempsEffectif !== null && x.tempsEffectif !== -1).length;

        html += `
            <div>
                <div class="text-center mb-3">
                    <div class="text-3xl font-black text-white">${niveau}e</div>
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">
                        ${nbClassables} classé${nbClassables > 1 ? 's' : ''} · ${liste.length - nbClassables} exclu${liste.length - nbClassables > 1 ? 's' : ''}
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                        <thead>
                            <tr class="text-slate-500 uppercase text-[10px] border-b border-slate-700">
                                <th class="text-left p-1.5">Rang</th>
                                <th class="text-left p-1.5">Dossard</th>
                                <th class="text-left p-1.5">Nom</th>
                                <th class="text-left p-1.5">Classe</th>
                                <th class="text-right p-1.5">Temps</th>
                                <th class="text-right p-1.5">%VMA</th>
                                <th class="text-center p-1.5">Mot.</th>
                                <th class="text-center p-1.5">Perf.</th>
                                <th class="text-center p-1.5">/20</th>
                                <th class="text-center p-1.5">✏️</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (liste.length === 0) {
            html += `<tr><td colspan="10" class="text-center text-slate-500 py-6">Aucune arrivée</td></tr>`;
        } else {
            liste.forEach(item => {
                const statut = STATUTS[item.statutVisuel] || STATUTS.normal;
                const rowStyle = `border-left: 3px solid ${statut.couleur}; background: ${statut.bg};`;

                // Affichage du temps avec gestion de l'incohérence
                let tempsAffiche = '--';
                if (item.incoherent) {
                    tempsAffiche = '⚠️ Incohérent';
                } else if (item.tempsEffectif !== null) {
                    tempsAffiche = formatTemps(Math.round(item.tempsEffectif / 1000));
                }

                const medaille = item.rangNiveau === 1 ? '🥇' : item.rangNiveau === 2 ? '🥈' : item.rangNiveau === 3 ? '🥉' : '';

                html += `
                    <tr class="border-b border-slate-800" style="${rowStyle}">
                        <td class="p-1.5 font-black text-yellow-400">${medaille} ${item.rangNiveau || '—'}</td>
                        <td class="p-1.5 font-mono text-white">#${item.dossard}</td>
                        <td class="p-1.5 text-white">
                            ${item.eleve.prenom} ${item.eleve.nom}
                            ${item.commentaire ? `<div class="text-[10px] text-slate-400 italic">💬 ${item.commentaire}</div>` : ''}
                        </td>
                        <td class="p-1.5 text-slate-400">${item.eleve.classe}</td>
                        <td class="p-1.5 text-right font-mono ${item.incoherent ? 'text-red-400' : 'text-emerald-400'}">${tempsAffiche}</td>
                        <td class="p-1.5 text-right font-mono">${item.pourcentageVMA !== null ? item.pourcentageVMA.toFixed(1) + '%' : '—'}</td>
                        <td class="p-1.5 text-center font-black">${item.ptsMotricite}</td>
                        <td class="p-1.5 text-center font-black">${item.ptsPerformance}</td>
                        <td class="p-1.5 text-center font-black text-base ${item.penalitePoints > 0 ? 'text-orange-400' : 'text-emerald-400'}">
                            ${item.noteFinale}
                            ${item.penalitePoints > 0 ? `<span class="text-[9px] text-orange-300">(-${item.penalitePoints})</span>` : ''}
                        </td>
                        <td class="p-1.5 text-center">
                            <button onclick="window.crossResultsOuvrirModif('${item.dossard}')"
                                    class="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs font-black text-white active:scale-95">
                                ✏️
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table></div></div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}
// ============================================================
// MODALE DE MODIFICATION
// ============================================================
window.crossResultsOuvrirModif = function(dossard) {
    const eleve = tousLesEleves[dossard];
    if (!eleve) return;

    const modif = modifications[dossard] || {};
    const arrivee = Object.values(arrivees).find(a => String(a.dossard) === String(dossard));
    const tempsBrut = arrivee && goTimestamp ? Math.round((arrivee.timestamp - goTimestamp) / 1000) : null;

    const overlay = document.createElement('div');
    overlay.id = 'cross-modif-modal';
    overlay.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
                <div>
                    <h3 class="text-xl font-black text-white">${eleve.prenom} ${eleve.nom}</h3>
                    <p class="text-xs text-slate-400">Dossard #${dossard} · Classe ${eleve.classe} · ${eleve.sexe === 'F' ? 'Fille' : 'Garçon'}</p>
                    ${tempsBrut !== null ? `<p class="text-xs text-slate-500 mt-1">Temps brut : ${formatTemps(tempsBrut)}</p>` : ''}
                </div>
                <button onclick="document.getElementById('cross-modif-modal').remove()"
                        class="bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-black text-white">✖</button>
            </div>

            <div class="space-y-4">
                <!-- Temps modifié -->
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase block mb-1">
                        Temps modifié manuellement (mm:ss)
                    </label>
                    <input type="text" id="modif-temps" placeholder="ex: 12:34"
                           value="${modif.tempsModifie ? formatTemps(Math.round(modif.tempsModifie / 1000)) : ''}"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-center text-lg font-mono">
                    <p class="text-[10px] text-slate-500 mt-1">Utilise ce champ pour corriger un scan manqué. Laisse vide si tu ne modifies pas le temps.</p>
                </div>

                <!-- Pénalité secondes -->
                <div>
                    <label class="text-xs font-bold text-orange-400 uppercase block mb-1">
                        Pénalité de temps (secondes ajoutées)
                    </label>
                    <input type="number" id="modif-penSec" placeholder="ex: 30" min="0" max="600"
                           value="${modif.penaliteSecondes || ''}"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-center text-lg font-mono">
                    <p class="text-[10px] text-slate-500 mt-1">Ex : 30 = +30 secondes au temps.</p>
                </div>

                <!-- Pénalité points -->
                <div>
                    <label class="text-xs font-bold text-orange-400 uppercase block mb-1">
                        Pénalité de points (retrait sur /20)
                    </label>
                    <input type="number" id="modif-penPts" placeholder="ex: 2" min="0" max="20"
                           value="${modif.penalitePoints || ''}"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-center text-lg font-mono">
                </div>

                <!-- Statut -->
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Statut</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="window.crossResultsSetStatut('normal')" id="modif-statut-normal"
                                class="p-3 rounded-xl font-black text-sm border-2 ${(modif.statut || 'normal') === 'normal' ? 'bg-slate-600 border-slate-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}">
                            ✅ Normal
                        </button>
                        <button onclick="window.crossResultsSetStatut('abandon')" id="modif-statut-abandon"
                                class="p-3 rounded-xl font-black text-sm border-2 ${modif.statut === 'abandon' ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}">
                            🚫 Abandon
                        </button>
                        <button onclick="window.crossResultsSetStatut('blessure')" id="modif-statut-blessure"
                                class="p-3 rounded-xl font-black text-sm border-2 ${modif.statut === 'blessure' ? 'bg-pink-600 border-pink-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}">
                            🤕 Blessure
                        </button>
                    </div>
                    <input type="hidden" id="modif-statut-value" value="${modif.statut || 'normal'}">
                </div>

                <!-- Commentaire -->
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Commentaire</label>
                    <textarea id="modif-commentaire" rows="2" placeholder="Note libre..."
                              class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm">${modif.commentaire || ''}</textarea>
                </div>
            </div>

            <div class="flex gap-3 mt-6">
                ${modif.timestamp ? `
                    <button onclick="window.crossResultsSupprimerModif('${dossard}')"
                            class="bg-red-700 hover:bg-red-600 px-4 py-3 rounded-xl font-black text-sm text-white">
                        🗑️ Effacer
                    </button>
                ` : ''}
                <button onclick="window.crossResultsFermerModif()"
                        class="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-black text-white">Annuler</button>
                <button onclick="window.crossResultsSauvegarderModif('${dossard}')"
                        class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-white">💾 Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
};

window.crossResultsSetStatut = function(statut) {
    document.getElementById('modif-statut-value').value = statut;
    ['normal', 'abandon', 'blessure'].forEach(s => {
        const btn = document.getElementById(`modif-statut-${s}`);
        if (!btn) return;
        if (s === statut) {
            const colors = { normal: 'bg-slate-600 border-slate-400', abandon: 'bg-red-600 border-red-400', blessure: 'bg-pink-600 border-pink-400' };
            btn.className = `p-3 rounded-xl font-black text-sm border-2 ${colors[s]} text-white`;
        } else {
            btn.className = 'p-3 rounded-xl font-black text-sm border-2 bg-slate-800 border-slate-700 text-slate-400';
        }
    });
};

window.crossResultsSauvegarderModif = async function(dossard) {
    const tempsStr = document.getElementById('modif-temps').value.trim();
    const penSec = parseInt(document.getElementById('modif-penSec').value) || null;
    const penPts = parseInt(document.getElementById('modif-penPts').value) || null;
    const statut = document.getElementById('modif-statut-value').value;
    const commentaire = document.getElementById('modif-commentaire').value.trim();

    let tempsModifie = null;
    if (tempsStr) {
        // Parse "12:34" ou "12:34.5" ou "754"
        const parts = tempsStr.split(':');
        if (parts.length === 2) {
            const min = parseInt(parts[0]) || 0;
            const sec = parseFloat(parts[1]) || 0;
            tempsModifie = Math.round((min * 60 + sec) * 1000);
        } else if (parts.length === 1) {
            tempsModifie = Math.round(parseFloat(parts[0]) * 1000);
        }
        if (isNaN(tempsModifie)) tempsModifie = null;
    }

    try {
        await sauvegarderModification(currentCourseId, dossard, {
            tempsModifie,
            penaliteSecondes: penSec,
            penalitePoints: penPts,
            statut,
            commentaire
        });
        window.crossResultsFermerModif();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

window.crossResultsFermerModif = function() {
    const modal = document.getElementById('cross-modif-modal');
    if (modal) modal.remove();
};

window.crossResultsSupprimerModif = async function(dossard) {
    if (!confirm('Supprimer toutes les modifications pour cet élève ?')) return;
    try {
        await supprimerModification(currentCourseId, dossard);
        window.crossResultsFermerModif();
    } catch (err) {
        alert('❌ Erreur : ' + err.message);
    }
};

window.crossResultsSelect = function(courseId) {
    currentCourseId = courseId;
    localStorage.setItem(KEYS.COURSE_ACTIVE, courseId);
    arrivees = {};
    modifications = {};
    attacherListeners();
    // Rafraîchir les boutons
    const container = document.getElementById('cross-content');
    if (container) initCrossResults(container);
};

window.crossResultsResetModifs = async function() {
    if (!confirm('⚠️ Effacer TOUTES les modifications prof de cette course ?\n(Les arrivées brutes sont conservées.)')) return;
    if (!confirm('✅ Dernière confirmation ?')) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/cross/courses/${currentCourseId}/modifications`;
    const { db, ref, remove } = await import('../../core/firebase-service.js');
    await remove(ref(db, path));
    alert('✅ Modifications supprimées.');
};

// ============================================================
// EXPORT EXCEL
// ============================================================
window.crossResultsExportExcel = async function() {
    const XLSX = window.XLSX;
    if (!XLSX) {
        alert('❌ SheetJS non chargé. Vérifie libs/xlsx.full.min.js dans maitre.html.');
        return;
    }

    const wb = XLSX.utils.book_new();

    // Une feuille par course
    for (const course of COURSES_DEFAUT) {
        const lignes = await construireLignesCourse(course.id);
        if (lignes.length === 0) continue;

        const aoa = [
            ['Rang', 'Dossard', 'Nom', 'Prénom', 'Classe', 'Niveau', 'Sexe', 'VMA',
             'Temps', '%VMA', 'Pts Motricité', 'Pts Performance', 'Note brute /20',
             'Pénalité pts', 'Note finale /20', 'Statut', 'Commentaire'],
            ...lignes.map(l => [
                l.rang || '',
                l.dossard,
                l.nom,
                l.prenom,
                l.classe,
                l.niveau,
                l.sexe,
                l.vma,
                l.temps,
                l.pctVMA !== null ? Math.round(l.pctVMA * 10) / 10 : '',
                l.ptsMot,
                l.ptsPerf,
                l.noteBrute,
                l.penalitePts || 0,
                l.noteFinale,
                l.statutLabel,
                l.commentaire
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // Largeurs de colonnes
        ws['!cols'] = [
            { wch: 6 }, { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 6 },
            { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
            { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 30 }
        ];

        const sheetName = course.label.replace(/[\[\]\*\?\/\\]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Feuille récap : classement par classe
    const recap = construireRecapClasses();
    if (recap.length > 0) {
        const aoa = [
            ['Rang', 'Classe', 'Niveau', 'Rang moyen', 'Rang moy. Filles', 'Rang moy. Garçons', 'Nb Filles', 'Nb Garçons', 'Effectif'],
            ...recap.map(r => [
                r.rang, r.classe, r.niveau, r.moyenne, r.moyF, r.moyM, r.nbF, r.nbM, r.nbClasses
            ])
        ];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [
            { wch: 6 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Classement classes');
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Cross_Resultats_${dateStr}.xlsx`);
};

// ============================================================
// LECTURE FIREBASE (via onValue onlyOnce — get n'est pas exporté)
// ============================================================
async function lireFirebase(path) {
    const { db, ref, onValue } = await import('../../core/firebase-service.js');
    return new Promise(resolve => {
        onValue(ref(db, path), snap => resolve(snap.val()), { onlyOnce: true });
    });
}

async function chargerDonneesCourse(courseId) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/cross/courses/${courseId}`;

    const [go, arr, modifs] = await Promise.all([
        lireFirebase(`${basePath}/go`),
        lireFirebase(`${basePath}/arrivees`),
        lireFirebase(`${basePath}/modifications`)
    ]);

    return {
        goTs: go?.timestamp || null,
        arrivees: arr || {},
        modifs: modifs || {}
    };
}

// ============================================================
// CALCUL DES LIGNES D'UNE COURSE (avec rangs et notes)
// ============================================================
async function construireLignesCourse(courseId) {
    const { goTs, arrivees, modifs } = await chargerDonneesCourse(courseId);
    const course = COURSES_DEFAUT.find(c => c.id === courseId);
    if (!course) return [];

    // --- Étape 1 : liste des arrivées uniques avec temps bruts ---
    const vus = new Set();
    const items = [];
    Object.values(arrivees).sort((a, b) => a.timestamp - b.timestamp).forEach(a => {
        if (vus.has(a.dossard)) return;
        vus.add(a.dossard);
        const eleve = tousLesEleves[String(a.dossard)];
        if (!eleve) return;
        const niveau = getNiveauFromClasse(eleve.classe);
        if (!course.niveaux.includes(niveau)) return;

        let tempsBrut = goTs ? (a.timestamp - goTs) : null;
        // ✅ Détection temps négatif : GO relancé après les arrivées
        if (tempsBrut !== null && tempsBrut < 0) tempsBrut = -1;

        const modif = modifs[a.dossard] || null;
        const applique = appliquerModif(tempsBrut, modif);
        const statutVisuel = getStatutVisuel(modif);

        items.push({
            dossard: a.dossard,
            eleve,
            niveau,
            tempsBrut,
            tempsEffectif: applique.tempsEffectif,
            statutVisuel,
            statutLabel: STATUTS[statutVisuel]?.label || 'Normal',
            exclu: applique.excluDuClassement,
            commentaire: applique.commentaire,
            penalitePts: applique.penalitePoints,
            modifTemps: modif?.tempsModifie || null,
            penaliteSecondes: modif?.penaliteSecondes || 0
        });
    });

    // --- Étape 2 : groupement par niveau + rangs + notes ---
    const parNiveau = {};
    course.niveaux.forEach(n => parNiveau[n] = []);
    items.forEach(i => parNiveau[i.niveau]?.push(i));

    const result = [];
    course.niveaux.forEach(niveau => {
        const liste = parNiveau[niveau] || [];
        liste.sort((a, b) => {
            if (a.exclu && !b.exclu) return 1;
            if (!a.exclu && b.exclu) return -1;
            if (a.tempsEffectif === null && b.tempsEffectif === null) return 0;
            if (a.tempsEffectif === null) return 1;
            if (b.tempsEffectif === null) return -1;
            return a.tempsEffectif - b.tempsEffectif;
        });

        // ✅ On ne compte que les élèves réellement classables
        const nbClassables = liste.filter(x =>
            !x.exclu && x.tempsEffectif !== null && x.tempsEffectif !== -1
        ).length;
        let rang = 0;

        liste.forEach(item => {
            let noteBrute = 0, ptsMot = 0, ptsPerf = 0, pctVMA = null;
            let rangNiveau = null;
            let incoherent = false;

            // ✅ Cas temps incohérent (-1) : pas de classement, pas de calcul
            if (item.tempsEffectif === -1) {
                incoherent = true;
            } else if (!item.exclu && item.tempsEffectif !== null) {
                rang++;
                rangNiveau = rang;
                if (item.eleve.vma) {
                    const note = calculerNoteEleve({
                        tempsSec: Math.round(item.tempsEffectif / 1000),
                        vma: item.eleve.vma,
                        rang,
                        nbArrivants: nbClassables
                    });
                    pctVMA = note.pourcentageVMA;
                    ptsMot = note.ptsMotricite;
                    ptsPerf = note.ptsPerformance;
                    noteBrute = note.total;
                }
            }

            result.push({
                rang: rangNiveau,
                dossard: item.dossard,
                nom: item.eleve.nom,
                prenom: item.eleve.prenom,
                classe: item.eleve.classe,
                niveau: item.niveau + 'e',
                sexe: item.eleve.sexe,
                vma: item.eleve.vma,
                temps: incoherent
                    ? '⚠️ Incohérent'
                    : (item.tempsEffectif !== null ? formatTemps(Math.round(item.tempsEffectif / 1000)) : '--'),
                pctVMA,
                ptsMot,
                ptsPerf,
                noteBrute,
                penalitePts: item.penalitePts,
                noteFinale: Math.max(0, noteBrute - item.penalitePts),
                statutLabel: incoherent ? 'Incohérent' : item.statutLabel,
                commentaire: item.commentaire,
                penaliteSecondes: item.penaliteSecondes,
                tempsModifie: item.modifTemps,
                incoherent
            });
        });
    });

    // Tri final : niveau décroissant puis rang croissant (incohérents à la fin)
    result.sort((a, b) => {
        const na = parseInt(a.niveau), nb = parseInt(b.niveau);
        if (na !== nb) return nb - na;
        if (a.rang === null && b.rang === null) {
            // Les deux sont non classés : incohérents en dernier
            if (a.incoherent && !b.incoherent) return 1;
            if (!a.incoherent && b.incoherent) return -1;
            return a.nom.localeCompare(b.nom);
        }
        if (a.rang === null) return 1;
        if (b.rang === null) return -1;
        return a.rang - b.rang;
    });

    return result;
}

// ============================================================
// RÉCAP PAR CLASSE (calculé sur les 4 courses)
// ============================================================
async function construireRecapClasses() {
    const rangsParClasse = {};        // { "607": [rangs...] }
    const rangsParClasseSexe = {};    // { "607": { F: [rangs...], M: [rangs...] } }
    const statutsParClasse = {};

    // Charger les 4 courses en parallèle
    const resultats = await Promise.all(
        COURSES_DEFAUT.map(async course => {
            const lignes = await construireLignesCourse(course.id);
            return { course, lignes };
        })
    );

    // Agréger
    resultats.forEach(({ course, lignes }) => {
        lignes.forEach(l => {
            // Ignorer les non-classés (exclus par statut abandon/blessure)
            if (l.rang === null) return;

            const classe = l.classe;
            if (!rangsParClasse[classe]) rangsParClasse[classe] = [];
            rangsParClasse[classe].push(l.rang);

            if (!rangsParClasseSexe[classe]) rangsParClasseSexe[classe] = { F: [], M: [] };
            if (l.sexe === 'F') rangsParClasseSexe[classe].F.push(l.rang);
            if (l.sexe === 'M') rangsParClasseSexe[classe].M.push(l.rang);
        });
    });

    // Compter absents/inaptes par classe (depuis le localStorage)
    getTousLesElevesCross().forEach(e => {
        if (!e.classe) return;
        if (!statutsParClasse[e.classe]) statutsParClasse[e.classe] = { absents: 0, inaptes: 0 };
        if (e.statut === 'absent') statutsParClasse[e.classe].absents++;
        if (e.statut === 'inapte') statutsParClasse[e.classe].inaptes++;
    });

    // Construire la liste
    const recap = Object.entries(rangsParClasse).map(([classe, rangs]) => {
        const moy = rangs.length > 0 ? rangs.reduce((a, b) => a + b, 0) / rangs.length : null;

        const sr = rangsParClasseSexe[classe] || { F: [], M: [] };
        const moyF = sr.F.length > 0 ? sr.F.reduce((a, b) => a + b, 0) / sr.F.length : null;
        const moyM = sr.M.length > 0 ? sr.M.reduce((a, b) => a + b, 0) / sr.M.length : null;

        const stats = statutsParClasse[classe] || { absents: 0, inaptes: 0 };

        return {
            classe,
            niveau: classe.charAt(0),
            moyenne: moy !== null ? Math.round(moy * 10) / 10 : null,
            moyF: moyF !== null ? Math.round(moyF * 10) / 10 : null,
            moyM: moyM !== null ? Math.round(moyM * 10) / 10 : null,
            nbClasses: rangs.length,
            nbF: sr.F.length,
            nbM: sr.M.length,
            nbAbsents: stats.absents,
            nbInaptes: stats.inaptes
        };
    });

    // Tri : par moyenne croissante (plus petit = meilleur)
    recap.sort((a, b) => {
        if (a.moyenne === null && b.moyenne === null) return a.classe.localeCompare(b.classe);
        if (a.moyenne === null) return 1;
        if (b.moyenne === null) return -1;
        return a.moyenne - b.moyenne;
    });
    recap.forEach((r, i) => { r.rang = i + 1; });

    return recap;
}

// ============================================================
// EXPORT EXCEL (patché avec get → onValue onlyOnce)
// ============================================================
window.crossResultsExportExcel = async function() {
    const XLSX = window.XLSX;
    if (!XLSX) {
        alert('❌ SheetJS non chargé. Vérifie libs/xlsx.full.min.js dans maitre.html.');
        return;
    }

    const wb = XLSX.utils.book_new();

    // ---- 1. Une feuille par course ----
    for (const course of COURSES_DEFAUT) {
        const lignes = await construireLignesCourse(course.id);
        if (lignes.length === 0) continue;

        const aoa = [
            ['Rang', 'Dossard', 'Nom', 'Prénom', 'Classe', 'Niveau', 'Sexe', 'VMA',
             'Temps effectif', '%VMA', 'Pts Motricité', 'Pts Performance',
             'Note brute /20', 'Pénalité pts', 'Note finale /20',
             'Pénalité sec', 'Temps modifié', 'Statut', 'Commentaire'],
            ...lignes.map(l => [
                l.rang || '',
                l.dossard,
                l.nom,
                l.prenom,
                l.classe,
                l.niveau,
                l.sexe,
                l.vma || '',
                l.temps,
                l.pctVMA !== null ? Math.round(l.pctVMA * 10) / 10 : '',
                l.ptsMot,
                l.ptsPerf,
                l.noteBrute,
                l.penalitePts || 0,
                l.noteFinale,
                l.penaliteSecondes || '',
                l.tempsModifie ? 'oui' : '',
                l.statutLabel,
                l.commentaire || ''
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [
            { wch: 6 }, { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 6 },
            { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
            { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 30 }
        ];

        const sheetName = course.label.replace(/[\[\]\*\?\/\\:]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // ---- 2. Feuille récap : classement par classe ----
    const recap = await construireRecapClasses();
    if (recap.length > 0) {
        const aoa = [
            ['Rang', 'Classe', 'Niveau', 'Rang moyen', 'Rang moy. Filles', 'Rang moy. Garçons',
             'Nb Filles', 'Nb Garçons', 'Effectif classé', 'Absents', 'Inaptes'],
            ...recap.map(r => [
                r.rang,
                r.classe,
                r.niveau + 'e',
                r.moyenne,
                r.moyF !== null ? r.moyF : '',
                r.moyM !== null ? r.moyM : '',
                r.nbF,
                r.nbM,
                r.nbClasses,
                r.nbAbsents,
                r.nbInaptes
            ])
        ];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [
            { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
            { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Classement classes');
    }

    // ---- 3. Feuille récap : notes moyennes par classe ----
    const notesParClasse = {};
    for (const course of COURSES_DEFAUT) {
        const lignes = await construireLignesCourse(course.id);
        lignes.forEach(l => {
            if (l.rang === null) return;
            if (!notesParClasse[l.classe]) {
                notesParClasse[l.classe] = { notes: [], notesF: [], notesM: [], count: 0 };
            }
            notesParClasse[l.classe].notes.push(l.noteFinale);
            notesParClasse[l.classe].count++;
            if (l.sexe === 'F') notesParClasse[l.classe].notesF.push(l.noteFinale);
            if (l.sexe === 'M') notesParClasse[l.classe].notesM.push(l.noteFinale);
        });
    }

    const notesRecap = Object.entries(notesParClasse).map(([classe, data]) => {
        const moy = data.notes.length > 0 ? data.notes.reduce((a, b) => a + b, 0) / data.notes.length : 0;
        const moyF = data.notesF.length > 0 ? data.notesF.reduce((a, b) => a + b, 0) / data.notesF.length : null;
        const moyM = data.notesM.length > 0 ? data.notesM.reduce((a, b) => a + b, 0) / data.notesM.length : null;
        return {
            classe,
            niveau: classe.charAt(0),
            moyenne: Math.round(moy * 10) / 10,
            moyF: moyF !== null ? Math.round(moyF * 10) / 10 : null,
            moyM: moyM !== null ? Math.round(moyM * 10) / 10 : null,
            nbF: data.notesF.length,
            nbM: data.notesM.length,
            total: data.count
        };
    }).sort((a, b) => {
        if (a.niveau !== b.niveau) return parseInt(b.niveau) - parseInt(a.niveau);
        return b.moyenne - a.moyenne;
    });

    if (notesRecap.length > 0) {
        const aoa = [
            ['Classe', 'Niveau', 'Note moyenne /20', 'Note moy. Filles', 'Note moy. Garçons', 'Nb Filles', 'Nb Garçons', 'Effectif'],
            ...notesRecap.map(r => [
                r.classe, r.niveau + 'e', r.moyenne,
                r.moyF !== null ? r.moyF : '',
                r.moyM !== null ? r.moyM : '',
                r.nbF, r.nbM, r.total
            ])
        ];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [
            { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Notes moyennes classes');
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Cross_Resultats_${dateStr}.xlsx`);
};