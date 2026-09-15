// src/js/modules/tournoi/variantes/atp/atp-tv.js
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse } from '../../tournoi-core.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { recalculerTout, trierClassement, BAREME_DEFAUT } from './atp-core.js';

let unsubs = [];

export function renderTV() {
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

    unsubs.forEach(u => { try { u(); } catch(e) {} });
    unsubs = [];

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseATP = `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/atp`;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const elevesMap = {};
    eleves.forEach(e => {
        if (e.codeAutoEval) elevesMap[String(e.codeAutoEval)] = e;
    });

    let matchs = {};
    let config = {};

    async function render() {
        const bareme = (config.bareme && config.bareme.length > 0) ? config.bareme : BAREME_DEFAUT;
        const codes = eleves.map(e => String(e.codeAutoEval)).filter(Boolean);
        const joueurs = recalculerTout(codes, matchs, bareme);
        const classement = trierClassement(joueurs, elevesMap);

        const top = classement.slice(0, 20);
        const maxPts = Math.max(...top.map(t => t.points), 1);

        // Podium
        let podiumHtml = '';
        const top3 = top.slice(0, 3);
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
                    <div style="color:#facc15;font-size:2.5rem;font-weight:900;">${item.points} pts</div>
                </div>`;
        }

        // Liste
        let listeHtml = '';
        for (let i = 3; i < top.length; i++) {
            const item = top[i];
            const eleve = item.eleve;
            const photo = eleve ? await getPhotoUrl(eleve.id) : null;
            const photoHtml = photo
                ? `<img src="${photo}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">`
                : `<div style="width:44px;height:44px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;">👤</div>`;
            const pct = (item.points / maxPts) * 100;

            listeHtml += `
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
                    <div style="min-width:36px;text-align:center;font-size:1.2rem;font-weight:900;color:#94a3b8;">${item.rang}.</div>
                    ${photoHtml}
                    <div style="min-width:220px;color:white;font-weight:700;">
                        ${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}
                    </div>
                    <div style="flex:1;background:#1e293b;height:22px;border-radius:11px;overflow:hidden;">
                        <div style="background:linear-gradient(90deg,#3b82f6,#22c55e);width:${pct}%;height:100%;"></div>
                    </div>
                    <div style="min-width:90px;text-align:right;color:#facc15;font-size:1.3rem;font-weight:900;">
                        ${item.points} pts
                    </div>
                </div>`;
        }

        container.innerHTML = `
            <h1 style="text-align:center;color:#3b82f6;font-size:3rem;font-weight:900;margin-bottom:30px;">🎾 Tournoi ATP</h1>
            <div style="display:flex;justify-content:center;align-items:flex-end;gap:40px;margin-bottom:50px;">
                ${podiumHtml}
            </div>
            <div style="max-width:1400px;margin:0 auto;">
                ${listeHtml}
            </div>
        `;
    }

    const u1 = onValue(ref(db, `${baseATP}/matchs`), snap => {
        matchs = snap.val() || {};
        render();
    });
    const u2 = onValue(ref(db, `${baseATP}/config`), snap => {
        config = snap.val() || {};
        render();
    });

    unsubs.push(u1, u2);
}