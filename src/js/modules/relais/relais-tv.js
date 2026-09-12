// src/js/modules/relais/relais-tv.js
// TV : classement des équipes (10s ou 2 zones)

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { getMeilleurEssaiParPaire, calculerScoreEquipe } from './relais-core.js';

let currentUnsubs = [];

export function renderRelaisTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '10px';
    }
    container.style.height = '90vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#0f172a';
    container.style.overflowY = 'auto';
    container.style.padding = '30px';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Sélectionnez une classe.</p>';
        return;
    }

    currentUnsubs.forEach(u => { try { u(); } catch (e) {} });
    currentUnsubs = [];

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/relais`;

    let config = null, m10 = {}, m2z = {};
    let loaded = 0;

    function tryRender() {
        if (loaded < 3) return;
        const is2Z = config?.sousActivite === 'relais2zones';
        const mesures = is2Z ? m2z : m10;
        renderTV(container, config, mesures, is2Z);
    }

    currentUnsubs.push(onValue(ref(db, `${basePath}/config`), s => { config = s.val(); loaded++; tryRender(); }, { onlyOnce: true }));
    currentUnsubs.push(onValue(ref(db, `${basePath}/mesures-10s`), s => { m10 = s.val() || {}; loaded++; tryRender(); }));
    currentUnsubs.push(onValue(ref(db, `${basePath}/mesures-2zones`), s => { m2z = s.val() || {}; loaded++; tryRender(); }));
}

function renderTV(container, config, mesures, is2Zones) {
    if (!config || !config.groupes) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Configuration non transmise.</p>';
        return;
    }

    const mesuresArray = Object.values(mesures);
    const equipes = [];
    for (const [idx, groupe] of Object.entries(config.groupes)) {
        const mg = mesuresArray.filter(m => String(m.groupeIdx) === String(idx));
        equipes.push({ groupe, score: calculerScoreEquipe(mg), nbPaires: Object.keys(getMeilleurEssaiParPaire(mg)).length });
    }
    equipes.sort((a, b) => b.score - a.score);
    const max = Math.max(...equipes.map(e => e.score), 1);

    let html = `
        <h1 style="text-align:center; color:#3b82f6; font-size:2.5rem; font-weight:900; margin-bottom:10px;">
            ${is2Zones ? '⏱️ Relais 2 zones' : '🏁 Relais 10s'}
        </h1>
        <p style="text-align:center; color:#64748b; margin-bottom:40px;">Classement des équipes</p>
        <div style="display:flex; flex-direction:column; gap:20px; max-width:1200px; margin:0 auto;">
    `;

    equipes.forEach((eq, i) => {
        const pct = (eq.score / max) * 100;
        const medaille = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}.`));
        html += `
            <div style="display:flex; align-items:center; gap:20px;">
                <div style="font-size:2.5rem; min-width:80px; text-align:center;">${medaille}</div>
                <div style="font-size:1.8rem; font-weight:900; color:white; min-width:140px;">Groupe ${eq.groupe.numero}</div>
                <div style="flex:1; background:#1e293b; height:50px; border-radius:25px; overflow:hidden;">
                    <div style="background:linear-gradient(90deg, #facc15, #f97316); width:${pct}%; height:100%; transition:width 0.5s;"></div>
                </div>
                <div style="font-size:2.5rem; font-weight:900; color:#facc15; min-width:120px; text-align:right;">${eq.score.toFixed(1)}</div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}