// src/js/modules/ppg/ppg-tv.js
// TV : affichage grand écran du classement PPG du jour
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl, getExistingEleves } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { fusionnerBibliotheque, agregerSeance, trierClassement, getAtelierById, getMedaille } from './ppg-core.js';

let unsubs = [];
let cache = {
    bibliotheque: [],
    seances: {},
    observations: {},
    eleves: [],
    elevesMap: {}
};

function getProfBasePath() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}
function elevesParCode(eleves) {
    const map = {};
    eleves.forEach(e => {
        if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) {
            map[String(e.codeAutoEval)] = e;
        }
    });
    return map;
}

export function renderPPGTV() {
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

    cache.eleves = getExistingEleves(classe);
    cache.elevesMap = elevesParCode(cache.eleves);

    unsubs.forEach(u => { try { u(); } catch(e) {} });
    unsubs = [];

    const basePath = `${getProfBasePath()}/${classe}/ppg`;

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => {
        const cfg = snap.val() || {};
        cache.bibliotheque = fusionnerBibliotheque(cfg.ateliers);
        rendre();
    }));
    unsubs.push(onValue(ref(db, `${basePath}/seance`), snap => {
        cache.seances = snap.val() || {};
        rendre();
    }));
    unsubs.push(onValue(ref(db, `${basePath}/observations`), snap => {
        cache.observations = snap.val() || {};
        rendre();
    }));
}

async function rendre() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const today = getTodayDate();
    const seance = cache.seances[today];
    const obsDuJour = cache.observations[today] || {};

    if (!seance || !Array.isArray(seance.ateliers) || seance.ateliers.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#64748b;font-size:2rem;margin-top:40vh;">Pas de séance PPG aujourd\'hui</p>';
        return;
    }

    const ateliersActifs = seance.ateliers
        .map(id => getAtelierById(id, cache.bibliotheque))
        .filter(Boolean);

    const totauxParCode = {};
    Object.entries(obsDuJour).forEach(([code, obs]) => {
        totauxParCode[code] = agregerSeance(obs, ateliersActifs);
    });

    if (Object.keys(totauxParCode).length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#64748b;font-size:2rem;margin-top:40vh;">⏳ En attente des premières saisies...</p>';
        return;
    }

    const classement = trierClassement(totauxParCode, cache.elevesMap, null);

    // Podium
    let podiumHtml = '';
    const top3 = classement.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
        const item = top3[i];
        const eleve = item.eleve;
        const photo = eleve ? await getPhotoUrl(eleve.id) : null;
        const photoHtml = photo
            ? `<img src="${photo}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:5px solid ${i===0?'#facc15':i===1?'#94a3b8':'#d97706'};">`
            : `<div style="width:120px;height:120px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:60px;">👤</div>`;
        const medaille = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const hauteur = i === 0 ? 0 : i === 1 ? 30 : 60;

        podiumHtml += `
            <div style="display:flex;flex-direction:column;align-items:center;margin-top:${hauteur}px;">
                <div style="font-size:3rem;">${medaille}</div>
                ${photoHtml}
                <div style="color:white;font-size:1.4rem;font-weight:900;margin-top:10px;text-align:center;">
                    ${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}
                </div>
                <div style="color:#22c55e;font-size:2.5rem;font-weight:900;">${item.totalPts} pts</div>
            </div>`;
    }

    // Barre d'info ateliers du jour
    const ateliersInfo = ateliersActifs.map(a => `${a.emoji} ${a.label}`).join('  ·  ');

    // Liste après top 3
    const maxPts = Math.max(...classement.map(c => c.totalPts), 1);
    let listeHtml = '';
    for (let i = 3; i < Math.min(classement.length, 20); i++) {
        const item = classement[i];
        const eleve = item.eleve;
        const pct = (item.totalPts / maxPts) * 100;
        const detail = Object.entries(item.parAtelier).map(([aid, d]) => {
            const n = d.niveau ? `N${d.niveau}` : '';
            return `${d.emoji}${d.best}${n}`;
        }).join(' · ');

        listeHtml += `
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
                <div style="min-width:36px;text-align:center;font-size:1.2rem;font-weight:900;color:#94a3b8;">${item.rang}.</div>
                <div style="min-width:240px;color:white;font-weight:700;">
                    ${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}
                </div>
                <div style="min-width:220px;color:#94a3b8;font-size:0.9rem;">${detail}</div>
                <div style="flex:1;background:#1e293b;height:22px;border-radius:11px;overflow:hidden;">
                    <div style="background:linear-gradient(90deg,#3b82f6,#22c55e);width:${pct}%;height:100%;"></div>
                </div>
                <div style="min-width:90px;text-align:right;color:#22c55e;font-size:1.3rem;font-weight:900;">
                    ${item.totalPts} pts
                </div>
            </div>`;
    }

    container.innerHTML = `
        <h1 style="text-align:center;color:#3b82f6;font-size:3rem;font-weight:900;margin-bottom:10px;">🏋️ PPG — Aujourd'hui</h1>
        <p style="text-align:center;color:#94a3b8;font-size:1.2rem;margin-bottom:30px;letter-spacing:2px;">${ateliersInfo}</p>
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:40px;margin-bottom:50px;">
            ${podiumHtml}
        </div>
        <div style="max-width:1400px;margin:0 auto;">
            ${listeHtml}
        </div>
    `;
}