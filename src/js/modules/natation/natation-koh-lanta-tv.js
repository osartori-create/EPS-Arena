// src/js/modules/natation/natation-koh-lanta-tv.js
// Écran TV « Koh Lanta » : classement affiché en continu (score croissant).

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';
import {
    calculScoreKohLanta,
    formatScoreKohLanta,
    getTunnelInfos,
    getRemorquageInfos
} from './natation-koh-lanta-core.js';

let currentUnsub = null;

export function renderNatationKohLantaTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '0';
        tvView.style.overflow = 'hidden';
    }

    container.style.height = '100vh';
    container.style.width = '100%';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.background = 'linear-gradient(180deg, #052e2b 0%, #064e3b 100%)';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#6ee7b7; font-size:2rem; margin-top:40vh;">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsub) { currentUnsub(); currentUnsub = null; }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const histoRef = ref(db, `${getEtab()}/profs/${profCode}/${classe}/natation-koh-lanta/historique`);

    const eleves = getExistingEleves(classe);
    const elevesTries = [...eleves].sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    function buildRows(histo = {}) {
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

    async function render(histo) {
        const rows = buildRows(histo);

        if (rows.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#6ee7b7; font-size:2rem; margin-top:40vh;">Aucun résultat pour l\'instant.</p>';
            return;
        }

        const TRACK_HEIGHT_PCT = 70;
        const TOP = 18;
        const BOTTOM = TOP + TRACK_HEIGHT_PCT;

        // Échelle verticale basée sur les scores min/max réels
        const scores = rows.map(r => calculScoreKohLanta(r.best));
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const span = Math.max(1, maxScore - minScore);

        let markersHtml = '';
        for (const r of rows) {
            const s = calculScoreKohLanta(r.best);
            // Le plus bas score en haut
            const pct = ((s - minScore) / span) * 100;
            const topPct = TOP + pct;
            markersHtml += `
                <div class="kl-tv-marker" style="left:0; right:0; top:${topPct}%; position:absolute; display:flex; align-items:center; gap:8px; padding:0 12px;">
                    <div style="width:48px; height:48px; border-radius:50%; overflow:hidden; background:#334155; display:flex; align-items:center; justify-content:center; font-size:24px; border:2px solid #facc15;" class="kl-tv-photo" data-num="${r.numero}">👤</div>
                    <div style="background:rgba(2,44,34,0.85); border:1px solid #facc15; border-radius:12px; padding:6px 12px;">
                        <span style="color:#eafff7; font-weight:900;">#${r.numero}</span>
                        <span style="color:#facc15; font-weight:900; margin-left:10px;">${formatScoreKohLanta(s)}</span>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="position:relative; width:100%; height:100vh; overflow:hidden;">
                <div style="position:absolute; top:8px; left:50%; transform:translateX(-50%); color:#facc15; font-weight:900; font-size:1.6rem; z-index:10; letter-spacing:2px;">🏝️ KOH LANTA — CLASSEMENT</div>
                <div style="position:absolute; top:${TOP - 6}%; left:0; right:0; height:${TRACK_HEIGHT_PCT + 12}%; background:rgba(2,44,34,0.5); border-radius:24px; margin:0 16px;"></div>
                <div style="position:absolute; top:${BOTTOM}%; left:50%; transform:translateX(-50%); color:#6ee7b7; font-weight:900;">score bas = meilleur</div>
                ${markersHtml}
            </div>
        `;

        // Charger les photos
        for (const r of rows) {
            const photoDivs = container.querySelectorAll(`.kl-tv-photo[data-num="${r.numero}"]`);
            if (!photoDivs.length) continue;
            try {
                const url = await getPhotoUrl(r.eleve.id);
                if (url) {
                    photoDivs.forEach(d => { d.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;">`; });
                }
            } catch (e) { /* fallback déjà présent */ }
        }
    }

    currentUnsub = onValue(histoRef, (snap) => {
        render(snap.val() || {});
    });
}