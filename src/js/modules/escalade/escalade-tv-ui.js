// src/js/modules/escalade/escalade-tv-ui.js
// TV Escalade : photos individuelles des élèves + défilement latéral.
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentUnsub = null;
let currentEscaladeMode = 'classic';
let currentEscaladeClasse = '';

export function setEscaladeMode(mode) {
    currentEscaladeMode = mode;
    if (currentEscaladeClasse) {
        renderEscaladeTV();
    }
}

export async function renderEscaladeTV() {
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
    container.style.overflowX = 'auto';
    container.style.overflowY = 'hidden';
    container.style.padding = '30px 20px';
    container.style.display = 'block';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">Sélectionnez une classe.</p>';
        return;
    }

    currentEscaladeClasse = classe;

    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const monteesPath = `etablissements/0680013V/profs/${profCode}/${classe}/escalade/montees`;
    const validationsPath = `etablissements/0680013V/profs/${profCode}/${classe}/bloccontest/validations`;
    const configPath = `etablissements/0680013V/profs/${profCode}/${classe}/bloccontest/config`;

    container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente des performances...</p>';

    if (currentEscaladeMode === 'classic') {
        const monteesRef = ref(db, monteesPath);
        currentUnsub = onValue(monteesRef, async (snap) => {
            const montees = snap.val() || {};
            await renderClassicTV(container, montees, classe);
        });
    } else {
        const validationsRef = ref(db, validationsPath);
        const configRef = ref(db, configPath);
        let config = {};
        let validations = {};
        let loaded = 0;
        function checkAndRender() {
            if (loaded >= 2) renderBlocTV(container, validations, config, classe);
        }
        onValue(configRef, (snap) => { config = snap.val() || {}; loaded++; checkAndRender(); }, { onlyOnce: true });
        currentUnsub = onValue(validationsRef, (snap) => { validations = snap.val() || {}; loaded++; checkAndRender(); });
    }
}

// Résout l'identifiant local d'un élève à partir de sa lettre de groupe et de son rôle.
function resolveEleveId(classe, lettre, role) {
    const localMapping = getLocalMapping(classe) || {};
    const cleTableau = `${classe}_${lettre}`;
    if (localMapping[cleTableau] && Array.isArray(localMapping[cleTableau])) {
        const index = (parseInt(role, 10) || 1) - 1;
        if (index >= 0 && localMapping[cleTableau][index]) return localMapping[cleTableau][index];
    }
    if (localMapping[`${classe}_${lettre}${role}`]) return localMapping[`${classe}_${lettre}${role}`];
    return null;
}

async function photoHtml(eleveId, taille = 72, bordure = '#3b82f6') {
    if (!eleveId) {
        return `<div style="width:${taille}px;height:${taille}px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:${Math.round(taille/2)}px;border:3px solid ${bordure};">👤</div>`;
    }
    let url = null;
    try { url = await getPhotoUrl(eleveId); } catch (e) {}
    if (url) {
        return `<img src="${url}" style="width:${taille}px;height:${taille}px;border-radius:50%;object-fit:cover;border:3px solid ${bordure};">`;
    }
    return `<div style="width:${taille}px;height:${taille}px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:${Math.round(taille/2)}px;border:3px solid ${bordure};">👤</div>`;
}

async function renderClassicTV(container, montees, classe) {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    // Agrège le score par élève (code = groupe + rôle).
    const scores = {}; // { code: { eleveId, score, lettre, role } }
    Object.values(montees).forEach(m => {
        const code = `${m.groupe}${m.role}`;
        if (!scores[code]) {
            scores[code] = {
                eleveId: resolveEleveId(classe, m.groupe, m.role),
                score: 0,
                lettre: m.groupe,
                role: m.role
            };
        }
        scores[code].score += Number(m.points || m.hauteur || 0);
    });

    const classement = Object.entries(scores)
        .map(([code, s]) => ({ code, ...s }))
        .sort((a, b) => b.score - a.score);

    if (classement.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente des performances...</p>';
        return;
    }

    const maxScore = Math.max(...classement.map(s => s.score), 1);

    const cards = [];
    for (const s of classement) {
        const eleve = eleves.find(e => e.id === s.eleveId);
        const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : `Code ${s.lettre}${s.role}`;
        const pct = Math.round((s.score / maxScore) * 100);
        const medaille = s.code === classement[0].code ? '🥇' : s.code === classement[1].code ? '🥈' : s.code === classement[2].code ? '🥉' : '';

        cards.push(`
            <div style="flex-shrink:0; width:150px; display:flex; flex-direction:column; align-items:center; padding:12px; background:#1e293b; border-radius:16px; border:2px solid #334155;">
                <div style="position:relative;">
                    ${await photoHtml(s.eleveId, 72, '#3b82f6')}
                    ${medaille ? `<div style="position:absolute; top:-6px; right:-6px; font-size:28px;">${medaille}</div>` : ''}
                </div>
                <div style="color:white; font-weight:800; font-size:14px; margin-top:8px; text-align:center; line-height:1.1;">${nom}</div>
                <div style="color:#94a3b8; font-size:11px; margin-top:2px; font-weight:700;">${s.lettre} · poste ${s.role}</div>
                <div style="width:100%; background:#0f172a; height:10px; border-radius:5px; overflow:hidden; margin-top:8px;">
                    <div style="background:linear-gradient(90deg,#3b82f6,#22c55e); width:${pct}%; height:100%;"></div>
                </div>
                <div style="color:#facc15; font-size:20px; font-weight:900; margin-top:4px;">${s.score.toFixed(0)} m</div>
            </div>
        `);
    }

    container.innerHTML = `
        <h1 style="text-align:center; color:#3b82f6; font-size:2.4rem; font-weight:900; margin-bottom:24px;">🧗 Escalade — Classement</h1>
        <div style="display:flex; gap:14px; overflow-x:auto; padding-bottom:10px;">
            ${cards.join('')}
        </div>
    `;
}

async function renderBlocTV(container, validations, config, classe) {
    const validationsList = Object.values(validations);
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    const scores = {};
    validationsList.forEach(v => {
        const id = v.eleveId || v.code;
        if (!id) return;
        if (!scores[id]) scores[id] = 0;
        scores[id] += v.valeurAuMoment || 0;
    });

    const classement = Object.entries(scores)
        .map(([eleveId, score]) => ({ eleveId, score }))
        .sort((a, b) => b.score - a.score);

    if (classement.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">Aucun score.</p>';
        return;
    }

    const maxScore = Math.max(...classement.map(c => c.score), 1);

    const cards = [];
    for (let i = 0; i < classement.length; i++) {
        const { eleveId, score } = classement[i];
        let eleve = eleves.find(e => e.id === eleveId);
        if (!eleve) eleve = eleves.find(e => String(e.codeAutoEval) === String(eleveId));
        const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : `Code ${eleveId}`;
        const pct = Math.round((score / maxScore) * 100);
        const medaille = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';

        cards.push(`
            <div style="flex-shrink:0; width:150px; display:flex; flex-direction:column; align-items:center; padding:12px; background:#1e293b; border-radius:16px; border:2px solid #334155;">
                <div style="position:relative;">
                    ${await photoHtml(eleve?.id || null, 72, '#f97316')}
                    ${medaille ? `<div style="position:absolute; top:-6px; right:-6px; font-size:28px;">${medaille}</div>` : ''}
                </div>
                <div style="color:white; font-weight:800; font-size:14px; margin-top:8px; text-align:center; line-height:1.1;">${nom}</div>
                <div style="width:100%; background:#0f172a; height:10px; border-radius:5px; overflow:hidden; margin-top:8px;">
                    <div style="background:linear-gradient(90deg,#f97316,#eab308); width:${pct}%; height:100%;"></div>
                </div>
                <div style="color:#facc15; font-size:20px; font-weight:900; margin-top:4px;">${score} pts</div>
            </div>
        `);
    }

    container.innerHTML = `
        <h1 style="text-align:center; color:#f97316; font-size:2.4rem; font-weight:900; margin-bottom:24px;">🧗 Bloc Contest — Classement</h1>
        <div style="display:flex; gap:14px; overflow-x:auto; padding-bottom:10px;">
            ${cards.join('')}
        </div>
    `;
}