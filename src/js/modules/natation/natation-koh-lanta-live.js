// src/js/modules/natation/natation-koh-lanta-live.js
// Classement Live professeur pour le mode « Koh Lanta ».
// Tri par score croissant (le plus bas gagne, peut être négatif).
// Chaque ligne ouvre une fiche détaillée (toutes les réalisations, modifiables).

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue, set } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { normaliserKohLanta, archiver } from '../../services/archive-service.js';
import {
    calculScoreKohLanta,
    formatScoreKohLanta,
    formatTempsKohLanta,
    getTunnelCouleur,
    getTunnelInfos,
    getRemorquageInfos
} from './natation-koh-lanta-core.js';

let currentUnsub = null;
let historiqueData = {};
let elevesTries = [];

// ============================================================
// EXPORT CSV
// ============================================================
window.exportKohLantaLiveCSV = function() {
    const classe = getCurrentClasse();
    if (!classe) { alert('Sélectionnez une classe.'); return; }

    const eleves = getExistingEleves(classe);
    const elevesTries = [...eleves].sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    const rows = buildRows(historiqueData, elevesTries);

    let csv = '\uFEFF"N°";"Nom de famille";"Prénom";"Meilleur score";"Temps (s)";"Coups";"Méduses";"Tunnel";"Remorquage";"Nb essais"\n';
    rows.forEach(r => {
        csv += `"${r.numero}";"${r.eleve.nom || ''}";"${r.eleve.prenom || ''}";"${r.best ? formatScoreKohLanta(calculScoreKohLanta(r.best)) : ''}";"${r.best ? (r.best.tempsMs / 1000).toFixed(1) : ''}";"${r.best?.coups ?? ''}";"${r.best?.meduses ?? ''}";"${r.best ? getTunnelInfos(r.best.tunnelType, r.best.remontees).label : ''}";"${r.best ? getRemorquageInfos(r.best.remorquage).label : ''}";"${r.nbEssais}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Natation_KohLanta_Live_${classe}.csv`;
    link.click();
};

// ============================================================
// ARCHIVAGE GRIST (repli Excel local)
// ============================================================
window.exporterKohLantaVersGrist = async function() {
    const classe = getCurrentClasse();
    if (!classe) { alert('Sélectionnez une classe.'); return; }

    const eleves = getExistingEleves(classe);
    const elevesTries = [...eleves].sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    const lignes = normaliserKohLanta(classe, historiqueData, elevesTries);
    if (lignes.length === 0) { alert('Aucun résultat à archiver.'); return; }

    try {
        const resultat = await archiver('Natation Koh Lanta', classe, lignes);
        const message = resultat.cible === 'grist'
            ? `✅ ${resultat.nb} résultat(s) archivé(s) dans Grist.`
            : `💾 Grist non configuré/inaccessible — export Excel local (${resultat.nb} ligne(s)) généré.`;
        alert(message);
    } catch (err) {
        console.error('[archive] Erreur :', err);
        alert('❌ Erreur lors de l\'archivage : ' + err.message);
    }
};

function buildRows(histo = {}, elevesTries) {
    const rows = [];
    for (const [numero, essais] of Object.entries(histo)) {
        if (!Array.isArray(essais) || essais.length === 0) continue;
        const index = parseInt(numero, 10) - 1;
        const eleve = elevesTries[index];
        if (!eleve) continue;

        const best = essais.reduce((acc, e) => {
            const s = calculScoreKohLanta(e);
            if (acc === null || s < calculScoreKohLanta(acc)) return e;
            return acc;
        }, null);

        rows.push({ numero, eleve, best, nbEssais: essais.length });
    }
    rows.sort((a, b) => calculScoreKohLanta(a.best) - calculScoreKohLanta(b.best));
    return rows;
}

function getEssais(numero) {
    const essais = historiqueData[numero];
    return Array.isArray(essais) ? essais : [];
}

// ============================================================
// RENDU PRINCIPAL
// ============================================================
export function renderNatationKohLantaLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    if (currentUnsub) { currentUnsub(); currentUnsub = null; }

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    historiqueData = {};
    elevesTries = [...getExistingEleves(classe)].sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const histoRef = ref(db, `${getEtab()}/profs/${profCode}/${classe}/natation-koh-lanta/historique`);

    async function render() {
        const rows = buildRows(historiqueData, elevesTries);
        if (rows.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-center">Aucun résultat pour l\'instant.</p>';
            return;
        }

        let html = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-black text-yellow-400 uppercase text-sm">🏝️ Classement Koh Lanta (score bas = meilleur)</h3>
                <div class="flex gap-2">
                    <button onclick="window.exporterKohLantaVersGrist()"
                            class="bg-emerald-600 px-3 py-1.5 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">
                        🗄️ Archiver Grist
                    </button>
                    <button onclick="window.exportKohLantaLiveCSV()"
                            class="bg-indigo-600 px-3 py-1.5 rounded-xl font-black text-xs text-white border-2 border-indigo-400 active:scale-95">
                        📥 Export CSV
                    </button>
                </div>
            </div>
            <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        `;

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const best = r.best;
            const score = formatScoreKohLanta(calculScoreKohLanta(best));
            const tunnel = getTunnelInfos(best.tunnelType, best.remontees);
            const remorquage = getRemorquageInfos(best.remorquage);
            const photo = await getPhotoUrl(r.eleve.id);
            const photoHtml = photo
                ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`
                : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;

            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

            html += `
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 cursor-pointer hover:border-blue-500 transition-all"
                     onclick="window.ouvrirFicheKohLanta('${r.numero}')">
                    <div class="w-8 text-center font-black text-yellow-400">${medal}</div>
                    ${photoHtml}
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-white truncate">${r.eleve.prenom} ${r.eleve.nom}</div>
                        <div class="text-xs text-slate-400">N° ${r.numero} · ${r.nbEssais} essai(s)</div>
                        <div class="text-[11px] text-slate-400 truncate">
                            ⏱️ ${(best.tempsMs / 1000).toFixed(1)}s · 🍽️ ${best.coups} · 🪼 ${best.meduses} · 🌀 ${tunnel.label} · 🛟 ${remorquage.label}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm text-slate-500">Score</div>
                        <div class="text-2xl font-black text-yellow-400">${score}</div>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;
    }

    currentUnsub = onValue(histoRef, (snap) => {
        historiqueData = snap.val() || {};
        render();
    });
}

// ============================================================
// FICHE ÉLÈVE (toutes les réalisations + modification/suppression)
// ============================================================
window.ouvrirFicheKohLanta = function(numero) {
    const index = parseInt(numero, 10) - 1;
    const eleve = elevesTries[index];
    if (!eleve) { alert('Élève non trouvé.'); return; }

    const essais = getEssais(numero);
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';

    function renderModal() {
        const essaisNow = getEssais(numero);
        let blocHistorique = '<p class="text-slate-500 text-center">Aucune réalisation enregistrée.</p>';
        if (essaisNow.length > 0) {
            blocHistorique = `<div class="space-y-2 max-h-60 overflow-y-auto">${essaisNow.map((e, idx) => {
                const s = calculScoreKohLanta(e);
                const t = getTunnelInfos(e.tunnelType, e.remontees);
                const r = getRemorquageInfos(e.remorquage);
                return `
                    <div class="bg-slate-800 p-2 rounded-lg flex items-center gap-2 text-xs">
                        <span class="text-slate-400 w-12">Essai ${idx + 1}</span>
                        <span class="text-yellow-400 font-bold w-24">${formatScoreKohLanta(s)}</span>
                        <span class="text-slate-300 flex-1 truncate">
                            ⏱️ ${(e.tempsMs / 1000).toFixed(1)}s · 🍽️ ${e.coups} · 🪼 ${e.meduses} · 🌀 ${t.label} · 🛟 ${r.label}
                        </span>
                        <button onclick="window.modifierEssaiKohLanta('${numero}', ${idx})"
                                class="bg-blue-600 text-white px-2 py-1 rounded font-black">✏️</button>
                        <button onclick="window.supprimerEssaiKohLanta('${numero}', ${idx})"
                                class="bg-red-600 text-white px-2 py-1 rounded font-black">🗑️</button>
                    </div>
                `;
            }).join('')}</div>`;
        }

        modal.innerHTML = `
            <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-white">${eleve.prenom} ${eleve.nom}</h3>
                    <button onclick="this.closest('.fixed').remove()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white">✖</button>
                </div>
                <div class="text-4xl font-black text-yellow-400 text-center mb-4">#${numero}</div>
                <p class="text-xs font-bold text-slate-400 uppercase mb-2">📊 Toutes les réalisations</p>
                ${blocHistorique}
            </div>
        `;
    }

    renderModal();
    document.body.appendChild(modal);
};

window.modifierEssaiKohLanta = function(numero, index) {
    const essais = getEssais(numero);
    if (index < 0 || index >= essais.length) { alert('Essai introuvable.'); return; }
    const e = essais[index];

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h4 class="text-lg font-black text-white text-center mb-4">✏️ Modifier l'essai ${index + 1}</h4>
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Temps (secondes)</label>
                    <input type="number" id="kl-edit-temps" value="${(e.tempsMs / 1000).toFixed(1)}" step="0.1" min="0"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-xl font-black text-center">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Coups de bras</label>
                    <input type="number" id="kl-edit-coups" value="${e.coups}" min="1"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-xl font-black text-center">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Méduses touchées</label>
                    <input type="number" id="kl-edit-meduses" value="${e.meduses ?? 0}" min="0"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-xl font-black text-center">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Tunnel</label>
                    <select id="kl-edit-tunnel" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white">
                        <option value="corde" ${e.tunnelType === 'corde' ? 'selected' : ''}>🪢 Corde (−5s)</option>
                        <option value="sans-aide" ${e.tunnelType === 'sans-aide' ? 'selected' : ''}>🫧 Sans aide</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Remontées</label>
                    <select id="kl-edit-remontees" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white">
                        ${[0, 1, 2, 3, 4].map(n => `<option value="${n}" ${(e.remontees ?? 0) === n ? 'selected' : ''}>${n === 4 ? '4+' : n} remontée${n > 1 ? 's' : ''}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Remorquage</label>
                    <select id="kl-edit-remorquage" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white">
                        <option value="vert" ${e.remorquage === 'vert' ? 'selected' : ''}>🟢 Cerceau (−5s)</option>
                        <option value="orange" ${e.remorquage === 'orange' ? 'selected' : ''}>🟠 Mannequin (−10s)</option>
                        <option value="rouge" ${e.remorquage === 'rouge' ? 'selected' : ''}>🔴 Mannequin + clapot (−15s)</option>
                    </select>
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button onclick="this.closest('.fixed').remove()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white text-sm">Annuler</button>
                <button onclick="window.sauvegarderEssaiKohLanta('${numero}', ${index})" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm">💾 Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.sauvegarderEssaiKohLanta = function(numero, index) {
    const temps = parseFloat(document.getElementById('kl-edit-temps')?.value.replace(',', '.'));
    const coups = parseInt(document.getElementById('kl-edit-coups')?.value);
    const meduses = parseInt(document.getElementById('kl-edit-meduses')?.value);
    const tunnelType = document.getElementById('kl-edit-tunnel')?.value;
    const remontees = parseInt(document.getElementById('kl-edit-remontees')?.value);
    const remorquage = document.getElementById('kl-edit-remorquage')?.value;

    if (isNaN(temps) || temps <= 0 || isNaN(coups) || coups < 1 || isNaN(meduses) || meduses < 0) {
        alert('Valeurs invalides.');
        return;
    }

    const essais = getEssais(numero);
    if (index < 0 || index >= essais.length) { alert('Essai introuvable.'); return; }

    const nouvelEssai = {
        ...essais[index],
        tempsMs: Math.round(temps * 1000),
        coups,
        meduses,
        tunnelType,
        remontees: tunnelType === 'corde' ? null : remontees,
        remorquage,
        score: Math.round(calculScoreKohLanta({
            tempsMs: Math.round(temps * 1000), coups, meduses, tunnelType,
            remontees: tunnelType === 'corde' ? null : remontees, remorquage
        }) * 100) / 100,
        timestamp: Date.now()
    };
    essais[index] = nouvelEssai;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const histoRef = ref(db, `${getEtab()}/profs/${profCode}/${getCurrentClasse()}/natation-koh-lanta/historique/${numero}`);
    set(histoRef, essais).then(() => {
        historiqueData[numero] = essais;
        document.querySelectorAll('.fixed').forEach(el => el.remove());
        window.ouvrirFicheKohLanta(numero);
    }).catch(err => alert('❌ Erreur : ' + err.message));
};

window.supprimerEssaiKohLanta = function(numero, index) {
    if (!confirm(`Supprimer l'essai ${index + 1} ?`)) return;
    const essais = getEssais(numero);
    if (index < 0 || index >= essais.length) { alert('Essai introuvable.'); return; }
    essais.splice(index, 1);

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const histoRef = ref(db, `${getEtab()}/profs/${profCode}/${getCurrentClasse()}/natation-koh-lanta/historique/${numero}`);
    set(histoRef, essais).then(() => {
        historiqueData[numero] = essais;
        document.querySelectorAll('.fixed').forEach(el => el.remove());
        window.ouvrirFicheKohLanta(numero);
    }).catch(err => alert('❌ Erreur : ' + err.message));
};