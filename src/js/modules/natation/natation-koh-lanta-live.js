// src/js/modules/natation/natation-koh-lanta-live.js
// Classement Live professeur pour le mode « Koh Lanta ».
// Tri par score croissant (le plus bas gagne, peut être négatif).

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { normaliserKohLanta, archiver } from '../../services/archive-service.js';
import { calculScoreKohLanta, formatScoreKohLanta, getTunnelInfos, getRemorquageInfos } from './natation-koh-lanta-core.js';

let currentUnsub = null;
let historiqueData = {};

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

// ============================================================
// RENDU
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

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const histoRef = ref(db, `${getEtab()}/profs/${profCode}/${classe}/natation-koh-lanta/historique`);

    const eleves = getExistingEleves(classe);
    const elevesTries = [...eleves].sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

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
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
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