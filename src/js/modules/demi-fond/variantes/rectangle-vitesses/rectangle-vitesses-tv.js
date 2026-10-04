// src/js/modules/demi-fond/variantes/rectangle-vitesses/rectangle-vitesses-tv.js
// TV grand écran : classement des bilans (vitesse + RPE).
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getPhotoUrl, getExistingEleves } from '../../../../services/admin-service.js';
import { getCurrentClasse } from '../../../../core/live-engine.js';
import { getBasePath } from '../../demifond-common.js';

let unsubs = [];
let config = null;
let observations = {};

function elevesParCode(eleves) {
    const map = {};
    eleves.forEach(e => {
        if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) {
            map[String(e.codeAutoEval)] = e;
        }
    });
    return map;
}

export function renderRectangleVitessesTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '0';
    }
    container.style.height = '100vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#0f172a';
    container.style.overflowY = 'auto';
    container.style.padding = '30px';

    const classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    if (!classe) {
        container.innerHTML = '<p style="text-align:center;color:#64748b;">Sélectionnez une classe.</p>';
        return;
    }

    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];

    const basePath = getBasePath(classe);

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => {
        config = snap.val() || null;
        rendre();
    }));

    unsubs.push(onValue(ref(db, `${basePath}/observations/rectangle-vitesses`), snap => {
        observations = snap.val() || {};
        rendre();
    }));

    rendre();
}

async function rendre() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    if (!config || config.sousModule !== 'rectangle-vitesses') {
        container.innerHTML = '<p style="text-align:center;color:#64748b;">Sous-module non transmis.</p>';
        return;
    }

    const classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    const elevesMap = elevesParCode(getExistingEleves(classe));
    const titreSousActivite = config.sousActivite === 'echauffement'
        ? 'Fiche d’échauffement'
        : 'Régulier sur 3 minutes';

    const entrees = Object.values(observations).sort((a, b) => b.vitesse - a.vitesse);

    if (entrees.length === 0) {
        container.innerHTML = `<h1 style="text-align:center;color:#3b82f6;font-size:3rem;font-weight:900;">🟦 Rectangle des vitesses</h1><p style="text-align:center;color:#94a3b8;font-size:1.5rem;">${titreSousActivite}</p><p style="text-align:center;color:#64748b;font-size:1.2rem;margin-top:40vh;">En attente des bilans...</p>`;
        return;
    }

    let lignesHtml = '';
    for (const obs of entrees) {
        const eleve = elevesMap[String(obs.code)];
        const photo = eleve ? await getPhotoUrl(eleve.id) : null;
        const photoHtml = photo
            ? `<img src="${photo}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:3px solid #475569;">`
            : `<div style="width:70px;height:70px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:31px;">👤</div>`;

        const rpe = obs.rpe;
        const rpeCouleur = rpe <= 3 ? '#22c55e' : (rpe <= 5 ? '#eab308' : (rpe <= 7 ? '#f97316' : '#ef4444'));
        const pct = (obs.vitesse / 25) * 100;

        lignesHtml += `
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
                ${photoHtml}
                <div style="min-width:260px;color:white;font-weight:700;">
                    ${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + obs.code}
                    <span style="color:#94a3b8;font-size:0.85rem;"> · #${obs.code}</span>
                </div>
                <div style="flex:1;background:#1e293b;height:26px;border-radius:13px;overflow:hidden;">
                    <div style="background:linear-gradient(90deg,#3b82f6,#22c55e);width:${pct}%;height:100%;"></div>
                </div>
                <div style="min-width:110px;text-align:right;color:#22c55e;font-size:1.5rem;font-weight:900;">${obs.vitesse} km/h</div>
                <div style="min-width:90px;text-align:center;color:${rpeCouleur};font-weight:900;font-size:1.3rem;">RPE ${rpe}</div>
            </div>`;
    }

    container.innerHTML = `
        <h1 style="text-align:center;color:#3b82f6;font-size:3rem;font-weight:900;margin-bottom:10px;">🟦 Rectangle des vitesses</h1>
        <p style="text-align:center;color:#94a3b8;font-size:1.2rem;margin-bottom:30px;letter-spacing:2px;">${titreSousActivite}</p>
        <div style="max-width:1300px;margin:0 auto;">${lignesHtml}</div>
    `;
}

export function cleanupRectangleVitessesTV() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];
}