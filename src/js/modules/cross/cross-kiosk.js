// src/js/modules/cross/cross-kiosk.js
// Kiosk paramétrable par URL :
//   eleve.html?mode=cross-podium&course=course1&prof=XXXX
//   eleve.html?mode=cross-classement&course=course1&prof=XXXX
//   eleve.html?mode=cross-classe&prof=XXXX
//   eleve.html?mode=cross-consult&prof=XXXX
//   eleve.html?mode=cross-clic&course=course1&prof=XXXX

import { db, ref, onValue, push } from '../../core/firebase-service.js';
import { COURSES_DEFAUT, getNiveauFromClasse, formatTemps, getMedaille } from './cross-core.js';

let currentCourseId = null;
let currentProfCode = 'DEFAULT';
let currentMode = 'cross-podium';

let unsubGo = null;
let unsubArrivees = null;
let unsubConfig = null;
let unsubCourses = null;

let goTimestamp = null;
let arrivees = {};
let elevesMap = {}; // { dossard: { nom, prenom, classe, sexe, vma, statut } }
let coursesMap = {};
let chronoInterval = null;
let confettiShownForRanks = new Set();

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initCrossKiosk(mode, params) {
    currentMode = mode;
    currentCourseId = params.get('course') || 'course1';
    currentProfCode = params.get('prof') || localStorage.getItem('eps_arena_profCode') || 'DEFAULT';

    console.log('[Cross Kiosk] Init', { mode, course: currentCourseId, prof: currentProfCode });

    // ✅ Masquer TOUT le chrome de l'app élève (header, sélecteurs, boutons)
    masquerChromeEleve();

    const activity = document.getElementById('activity-screen');
    if (activity) activity.classList.remove('hidden');

    let container = document.getElementById('cross-kiosk-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cross-kiosk-container';
        container.className = 'w-full';
        activity.appendChild(container);
    }

    chargerConfig();

         switch (currentMode) {
        case 'cross-podium':     initPodium(container); break;
        case 'cross-classement': initClassement(container); break;
        case 'cross-classe':     initClasse(container); break;
        case 'cross-consult':    initConsult(container); break;
        case 'cross-clic':       initClic(container); break;
        default:
            container.innerHTML = `<p class="text-red-400 p-8">Mode inconnu : ${currentMode}</p>`;
    }
}

// ============================================================
// MASQUAGE DU CHROME ÉLÈVE
// ============================================================
function masquerChromeEleve() {
    // Écrans de login/attente
    ['waiting-screen', 'login-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Header (code prof, sélecteur classe)
    const header = document.getElementById('eleve-header');
if (header) header.style.display = 'none';

    // Autres éléments à cacher (au cas où)
    ['code-info', 'btn-quit', 'btn-back-terrain'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Masquer tous les modules connus
    ['escalade-module', 'co-module', 'multi-module', 'orientshow-module',
     'badminton-module', 'natation-module', 'relais-module', 'grilles-module',
     'demi-fond-module', 'ppg-module', 'tournoi-module', 'arcathlon-module',
     'bloc-kiosk-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });
}
// ============================================================
// CHARGEMENT CONFIG
// ============================================================
function chargerConfig() {
    const basePath = `etablissements/0680013V/profs/${currentProfCode}/cross`;

    // Chargement des courses
    if (unsubCourses) unsubCourses();
    unsubCourses = onValue(ref(db, `${basePath}/config/courses`), snap => {
        const data = snap.val();
        coursesMap = {};
        if (data) {
            if (Array.isArray(data)) {
                data.forEach(c => { coursesMap[c.id] = c; });
            } else {
                coursesMap = data;
            }
        }
        render();
    });

    // Chargement des élèves (dossard → { classe, sexe, vma, statut })
    if (unsubConfig) unsubConfig();
    unsubConfig = onValue(ref(db, `${basePath}/config/eleves`), snap => {
        elevesMap = snap.val() || {};
        render();
    });
}

// ============================================================
// PODIUM
// ============================================================
function initPodium(container) {
    const basePath = `etablissements/0680013V/profs/${currentProfCode}/cross`;

    // GO
    if (unsubGo) unsubGo();
    unsubGo = onValue(ref(db, `${basePath}/courses/${currentCourseId}/go`), snap => {
        const go = snap.val();
        goTimestamp = go?.timestamp || null;
        demarrerChrono();
        render();
    });

    // Arrivées
    if (unsubArrivees) unsubArrivees();
    unsubArrivees = onValue(ref(db, `${basePath}/courses/${currentCourseId}/arrivees`), snap => {
        arrivees = snap.val() || {};
        render();
    });

    render();
}

// ============================================================
// RENDU
// ============================================================
function render() {
    const container = document.getElementById('cross-kiosk-container');
    if (!container) return;

    const course = coursesMap[currentCourseId] || COURSES_DEFAUT.find(c => c.id === currentCourseId);
    if (!course) {
        container.innerHTML = `<div class="text-center py-20 text-slate-400 text-2xl">⏳ En attente de la configuration...</div>`;
        return;
    }

    // Calcule les classements par niveau
    const arriveesTriees = Object.entries(arrivees)
        .map(([id, a]) => ({ id, ...a }))
        .sort((a, b) => a.timestamp - b.timestamp);

    const parNiveau = {};
    course.niveaux.forEach(n => { parNiveau[n] = []; });

    const vus = new Set();
        arriveesTriees.forEach(arr => {
        if (vus.has(arr.dossard)) return;
        vus.add(arr.dossard);
        const eleve = elevesMap[String(arr.dossard)];
        if (!eleve) return;
        if (eleve.statut && eleve.statut !== 'present') return;
        const niveau = getNiveauFromClasse(eleve.classe);
        if (!parNiveau[niveau]) return;
        parNiveau[niveau].push({
            dossard: arr.dossard,
            classe: eleve.classe
            // ✅ plus de nom/prenom
        });
    });

    const enCours = !!goTimestamp;
    const chronoStr = enCours
        ? formatTemps(Math.floor((Date.now() - goTimestamp) / 1000))
        : '--:--';

    // Détermine le label de la course
    const niveauxLabel = course.niveaux.map(n => `${n}e`).join(' + ');
    const sexeLabel = course.sexe === 'F' ? 'Filles' : 'Garçons';

    container.innerHTML = `
        <style>
            .cross-podium-body { background: #0f172a; min-height: 100vh; }
            .cross-podium-card {
                background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
                border: 2px solid #334155;
            }
            .cross-medal-gold   { background: linear-gradient(180deg, #facc15, #d97706); }
            .cross-medal-silver { background: linear-gradient(180deg, #cbd5e1, #64748b); }
            .cross-medal-bronze { background: linear-gradient(180deg, #d97706, #92400e); }
            .cross-step { transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        </style>

        <div class="cross-podium-body flex flex-col">
            <!-- Bandeau course + chrono -->
            <div class="bg-slate-900 border-b-4 border-emerald-500 p-6 flex justify-between items-center flex-wrap gap-4">
                <div>
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Cross</div>
                    <div class="text-4xl font-black text-white">${niveauxLabel} ${sexeLabel}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Chrono</div>
                    <div id="cross-kiosk-chrono" class="text-6xl font-mono font-black ${enCours ? 'text-emerald-400' : 'text-slate-600'}">${chronoStr}</div>
                </div>
            </div>

            <!-- Zone podiums -->
            <div class="flex-1 p-6">
                ${enCours ? renderPodiums(parNiveau, course) : renderAttente()}
            </div>
        </div>
    `;
}

function renderAttente() {
    return `
        <div class="flex flex-col items-center justify-center py-32">
            <div class="text-8xl mb-6 animate-pulse">⏳</div>
            <div class="text-4xl font-black text-slate-400">En attente du départ...</div>
            <div class="text-xl text-slate-500 mt-3">Le prof va lancer la course</div>
        </div>
    `;
}

function renderPodiums(parNiveau, course) {
    const niveaux = course.niveaux;

    return `
        <div class="grid grid-cols-1 md:grid-cols-${niveaux.length} gap-6 max-w-7xl mx-auto">
            ${niveaux.map(n => renderPodiumNiveau(n, parNiveau[n] || [])).join('')}
        </div>
    `;
}

function renderPodiumNiveau(niveau, arrives) {
    const top3 = [arrives[0] || null, arrives[1] || null, arrives[2] || null];

    return `
        <div class="cross-podium-card rounded-3xl p-6">
            <div class="text-center mb-6">
                <div class="text-5xl font-black text-white">${niveau}e</div>
                <div class="text-xs uppercase text-slate-500 font-bold tracking-widest mt-1">${arrives.length} arrivant${arrives.length > 1 ? 's' : ''}</div>
            </div>

            <!-- Podium 2-1-3 -->
            <div class="flex items-end justify-center gap-4 min-h-[320px]">
                ${renderMarche(top3[1], 'silver', 2, 120)}
                ${renderMarche(top3[0], 'gold',   1, 180)}
                ${renderMarche(top3[2], 'bronze', 3, 80)}
            </div>
        </div>
    `;
}

function renderMarche(eleve, medaille, place, hauteurPx) {
    const medalEmoji = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
    const bgClass = `cross-medal-${medaille}`;

    if (!eleve) {
        return `
            <div class="flex flex-col items-center" style="width: 30%;">
                <div class="text-5xl mb-2 opacity-30">${medalEmoji}</div>
                <div class="w-full rounded-t-xl ${bgClass} opacity-30 flex items-end justify-center text-white text-4xl font-black pb-2"
                     style="height: ${hauteurPx}px;">—</div>
            </div>
        `;
    }

    // ✅ RGPD : affiche uniquement dossard + classe (pas de nom)
    return `
        <div class="flex flex-col items-center cross-step" style="width: 30%;">
            <div class="text-5xl mb-2">${medalEmoji}</div>
            <div class="text-center mb-2 min-h-[60px]">
                <div class="text-4xl font-black text-white leading-tight">#${eleve.dossard}</div>
                <div class="text-sm font-bold text-slate-400 uppercase">${eleve.classe}</div>
            </div>
            <div class="w-full rounded-t-xl ${bgClass} flex flex-col items-center justify-end text-white pb-3 shadow-xl"
                 style="height: ${hauteurPx}px;">
                <div class="text-5xl font-black">${place}</div>
            </div>
        </div>
    `;
}

// ============================================================
// CHRONO LIVE
// ============================================================
function demarrerChrono() {
    if (chronoInterval) clearInterval(chronoInterval);
    if (!goTimestamp) return;

    chronoInterval = setInterval(() => {
        const el = document.getElementById('cross-kiosk-chrono');
        if (!el || !goTimestamp) return;
        el.textContent = formatTemps(Math.floor((Date.now() - goTimestamp) / 1000));
    }, 500);
}

// ============================================================
// MODE CONSULTATION — Flux live par niveau (20 dernières arrivées)
// ============================================================
const CONSULT_LIMIT = 20;
const DISTANCE_CONSULT_M = 2500;

function initConsult(container) {
    const basePath = `etablissements/0680013V/profs/${currentProfCode}/cross`;

    if (unsubGo) unsubGo();
    unsubGo = onValue(ref(db, `${basePath}/courses/${currentCourseId}/go`), snap => {
        const go = snap.val();
        goTimestamp = go?.timestamp || null;
        demarrerChronoConsult();
        renderConsult();
    });

    if (unsubArrivees) unsubArrivees();
    unsubArrivees = onValue(ref(db, `${basePath}/courses/${currentCourseId}/arrivees`), snap => {
        arrivees = snap.val() || {};
        renderConsult();
    });

    renderConsult();
}

function renderConsult() {
    const container = document.getElementById('cross-kiosk-container');
    if (!container) return;

    const course = coursesMap[currentCourseId] || COURSES_DEFAUT.find(c => c.id === currentCourseId);
    if (!course) {
        container.innerHTML = `<div class="text-center py-20 text-slate-400 text-2xl">⏳ En attente de la configuration...</div>`;
        return;
    }

    // Trie par timestamp croissant
    const arriveesTriees = Object.entries(arrivees)
        .map(([id, a]) => ({ id, ...a }))
        .sort((a, b) => a.timestamp - b.timestamp);

    const enCours = !!goTimestamp;
    const chronoStr = enCours
        ? formatTemps(Math.floor((Date.now() - goTimestamp) / 1000))
        : '--:--';

    // Pour chaque niveau : garde les CONSULT_LIMIT dernières
    const parNiveau = {};
    course.niveaux.forEach(n => { parNiveau[n] = []; });

    const vus = new Set();
    arriveesTriees.forEach(arr => {
        if (vus.has(arr.dossard)) return;
        vus.add(arr.dossard);
        const eleve = elevesMap[String(arr.dossard)];
        if (!eleve) return;
        if (eleve.statut && eleve.statut !== 'present') return;
        const niveau = getNiveauFromClasse(eleve.classe);
        if (!parNiveau[niveau]) return;

        // Calcule vitesse sur 2500 m
        let vitesseKmh = null;
        if (goTimestamp && arr.timestamp > goTimestamp) {
            const tempsS = (arr.timestamp - goTimestamp) / 1000;
            if (tempsS > 0) {
                vitesseKmh = (DISTANCE_CONSULT_M / tempsS) * 3.6;
            }
        }

        parNiveau[niveau].push({
            dossard: arr.dossard,
            classe: eleve.classe,
            vitesse: vitesseKmh,
            timestamp: arr.timestamp
        });
    });

    // Ne garde que les CONSULT_LIMIT derniers de chaque niveau
    Object.keys(parNiveau).forEach(n => {
        parNiveau[n] = parNiveau[n].slice(-CONSULT_LIMIT);
    });

    const niveauxLabel = course.niveaux.map(n => `${n}e`).join(' + ');
    const sexeLabel = course.sexe === 'F' ? 'Filles' : 'Garçons';

    container.innerHTML = `
        <style>
            .consult-body { background: #0f172a; min-height: 100vh; }
            .consult-col { display: flex; flex-direction: column; }
            .consult-row {
                display: grid;
                grid-template-columns: 90px 90px 1fr 110px;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                background: #1e293b;
                border-radius: 12px;
                margin-bottom: 6px;
                border-left: 4px solid #334155;
                transition: all 0.3s ease;
            }
            .consult-row--recent {
                border-left-color: #22c55e;
                background: linear-gradient(90deg, #14532d30 0%, #1e293b 60%);
                animation: consultPulse 1s ease-out;
            }
            .consult-row--no-time { opacity: 0.5; }
            @keyframes consultPulse {
                0% { transform: scale(0.95); background: #22c55e40; }
                100% { transform: scale(1); background: #14532d30; }
            }
            .consult-dossard { font-family: monospace; font-weight: 900; color: #facc15; font-size: 1.4rem; }
            .consult-classe  { font-weight: 900; color: #94a3b8; font-size: 1.2rem; text-align: center; }
            .consult-vit     { font-weight: 900; color: #22c55e; font-size: 1.3rem; text-align: right; font-family: monospace; }
            .consult-vit--slow { color: #f59e0b; }
            .consult-vit--very-slow { color: #ef4444; }
            .consult-empty { color: #475569; text-align: center; padding: 40px 0; font-style: italic; }
        </style>

        <div class="consult-body flex flex-col">
            <!-- Bandeau titre + chrono -->
            <div class="bg-slate-900 border-b-4 border-emerald-500 px-6 py-3 flex justify-between items-center flex-wrap gap-3">
                <div class="flex items-center gap-4">
                    <div>
                        <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Cross</div>
                        <div class="text-3xl font-black text-white">${niveauxLabel} ${sexeLabel}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Chrono</div>
                    <div id="cross-consult-chrono" class="text-5xl font-mono font-black ${enCours ? 'text-emerald-400' : 'text-slate-600'}">${chronoStr}</div>
                </div>
            </div>

            <!-- Deux colonnes -->
            <div class="flex-1 grid grid-cols-2 gap-4 p-4">
                ${course.niveaux.map(niveau => renderConsultColonne(niveau, parNiveau[niveau] || [], enCours)).join('')}
            </div>
        </div>
    `;
}

function renderConsultColonne(niveau, arrives, enCours) {
    // Les plus récents EN BAS : on garde l'ordre tel quel (croissant par timestamp)
    // Les anciens en haut → si trop de lignes, on enlève en haut (slice(-N) déjà fait)

    const rowsHtml = arrives.length === 0
        ? `<div class="consult-empty">En attente des premiers arrivés...</div>`
        : arrives.map((e, idx) => {
            const isRecent = idx === arrives.length - 1;

            // Formatage vitesse
            let vitHtml = '—';
            let vitClass = '';
            if (e.vitesse !== null && e.vitesse !== undefined) {
                vitHtml = e.vitesse.toFixed(1) + ' <span style="font-size:0.7em;opacity:0.6">km/h</span>';
                if (e.vitesse < 7) vitClass = 'consult-vit--very-slow';
                else if (e.vitesse < 9) vitClass = 'consult-vit--slow';
            } else {
                vitClass = 'consult-row--no-time';
            }

            return `
                <div class="consult-row ${isRecent ? 'consult-row--recent' : ''} ${!e.vitesse ? 'consult-row--no-time' : ''}">
                    <span class="consult-dossard">#${e.dossard}</span>
                    <span class="consult-classe">${e.classe}</span>
                    <span></span>
                    <span class="consult-vit ${vitClass}">${vitHtml}</span>
                </div>
            `;
        }).join('');

    return `
        <div class="consult-col bg-slate-900/50 rounded-2xl p-3">
            <div class="text-center mb-3">
                <div class="text-4xl font-black text-white">${niveau}e</div>
                <div class="text-xs uppercase text-slate-500 font-bold tracking-widest mt-1">
                    ${arrives.length} / ${CONSULT_LIMIT} affiché${arrives.length > 1 ? 's' : ''}
                </div>
            </div>
            <div class="flex-1 overflow-y-auto">
                ${rowsHtml}
            </div>
        </div>
    `;
}

// Chrono live pour le mode consultation
let chronoConsultInterval = null;
function demarrerChronoConsult() {
    if (chronoConsultInterval) clearInterval(chronoConsultInterval);
    if (!goTimestamp) return;
    chronoConsultInterval = setInterval(() => {
        const el = document.getElementById('cross-consult-chrono');
        if (!el || !goTimestamp) return;
        el.textContent = formatTemps(Math.floor((Date.now() - goTimestamp) / 1000));
    }, 500);
}
// ============================================================
// MODE CLASSEMENT — tous les élèves triés par temps
// ============================================================
function initClassement(container) {
    const basePath = `etablissements/0680013V/profs/${currentProfCode}/cross`;

    if (unsubGo) unsubGo();
    unsubGo = onValue(ref(db, `${basePath}/courses/${currentCourseId}/go`), snap => {
        const go = snap.val();
        goTimestamp = go?.timestamp || null;
        demarrerChronoClassement();
        renderClassement();
    });

    if (unsubArrivees) unsubArrivees();
    unsubArrivees = onValue(ref(db, `${basePath}/courses/${currentCourseId}/arrivees`), snap => {
        arrivees = snap.val() || {};
        renderClassement();
    });

    renderClassement();
}

function renderClassement() {
    const container = document.getElementById('cross-kiosk-container');
    if (!container) return;

    const course = coursesMap[currentCourseId] || COURSES_DEFAUT.find(c => c.id === currentCourseId);
    if (!course) {
        container.innerHTML = `<div class="text-center py-20 text-slate-400 text-2xl">⏳ En attente de la configuration...</div>`;
        return;
    }

    const arriveesTriees = Object.entries(arrivees)
        .map(([id, a]) => ({ id, ...a }))
        .sort((a, b) => a.timestamp - b.timestamp);

    const enCours = !!goTimestamp;
    const chronoStr = enCours
        ? formatTemps(Math.floor((Date.now() - goTimestamp) / 1000))
        : '--:--';

    // Construire la liste avec rang GLOBAL
    const vus = new Set();
    const liste = [];
    arriveesTriees.forEach(arr => {
        if (vus.has(arr.dossard)) return;
        vus.add(arr.dossard);
        const eleve = elevesMap[String(arr.dossard)];
        if (!eleve) return;
        if (eleve.statut && eleve.statut !== 'present') return;
        const niveau = getNiveauFromClasse(eleve.classe);
        const tempsSec = goTimestamp ? Math.floor((arr.timestamp - goTimestamp) / 1000) : null;
        liste.push({
            dossard: arr.dossard,
            classe: eleve.classe,
            niveau: niveau,
            tempsSec: tempsSec,
            rangGlobal: liste.length + 1
        });
    });

    const niveauxLabel = course.niveaux.map(n => `${n}e`).join(' + ');
    const sexeLabel = course.sexe === 'F' ? 'Filles' : 'Garçons';

    container.innerHTML = `
        <style>
            .classement-body { background: #0f172a; min-height: 100vh; }
            .classement-row {
                display: grid;
                grid-template-columns: 70px 100px 80px 1fr 100px;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                background: #1e293b;
                border-radius: 12px;
                margin-bottom: 6px;
                border-left: 4px solid #334155;
            }
            .classement-row--top { border-left-color: #facc15; background: linear-gradient(90deg, #78350f20 0%, #1e293b 60%); }
            .classement-row--top3 { border-left-color: #22c55e; }
        </style>

        <div class="classement-body flex flex-col">
            <div class="bg-slate-900 border-b-4 border-emerald-500 px-6 py-4 flex justify-between items-center">
                <div>
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Cross · Classement</div>
                    <div class="text-3xl font-black text-white">${niveauxLabel} ${sexeLabel}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Chrono</div>
                    <div id="cross-classement-chrono" class="text-4xl font-mono font-black ${enCours ? 'text-emerald-400' : 'text-slate-600'}">${chronoStr}</div>
                </div>
            </div>

            <div class="p-4 flex-1 overflow-y-auto">
                ${liste.length === 0 ? `<div class="text-center py-20 text-slate-500 text-2xl">⏳ En attente des premiers arrivés...</div>` : `
                    <div class="max-w-5xl mx-auto">
                        ${liste.map(item => `
                            <div class="classement-row ${item.rangGlobal <= 10 ? 'classement-row--top' : (item.rangGlobal <= 3 ? 'classement-row--top3' : '')}">
                                <span class="text-2xl font-black text-yellow-400 text-center">${getMedaille(item.rangGlobal)}</span>
                                <span class="text-lg font-mono font-black text-white">#${item.dossard}</span>
                                <span class="text-sm font-bold text-slate-400 text-center">${item.niveau}e</span>
                                <span class="text-sm font-bold text-slate-300">Classe ${item.classe}</span>
                                <span class="text-lg font-mono font-black text-emerald-400 text-right">${item.tempsSec !== null ? formatTemps(item.tempsSec) : '--'}</span>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
}

let chronoClassementInterval = null;
function demarrerChronoClassement() {
    if (chronoClassementInterval) clearInterval(chronoClassementInterval);
    if (!goTimestamp) return;
    chronoClassementInterval = setInterval(() => {
        const el = document.getElementById('cross-classement-chrono');
        if (!el || !goTimestamp) return;
        el.textContent = formatTemps(Math.floor((Date.now() - goTimestamp) / 1000));
    }, 500);
}

// ============================================================
// MODE PAR CLASSE — classement des classes par moyenne des rangs
// ============================================================
function initClasse(container) {
    const basePath = `etablissements/0680013V/profs/${currentProfCode}/cross`;

    // On doit charger les arrivées des 4 courses
    const arriveesParCourse = {};

    if (unsubCourses) unsubCourses();
    unsubCourses = onValue(ref(db, `${basePath}/config/courses`), snap => {
        const data = snap.val();
        coursesMap = {};
        if (data) {
            if (Array.isArray(data)) data.forEach(c => { coursesMap[c.id] = c; });
            else coursesMap = data;
        }
        renderClasse();
    });

    if (unsubConfig) unsubConfig();
    unsubConfig = onValue(ref(db, `${basePath}/config/eleves`), snap => {
        elevesMap = snap.val() || {};
        renderClasse();
    });

    if (unsubArrivees) unsubArrivees();
    unsubArrivees = onValue(ref(db, `${basePath}/courses`), snap => {
        const all = snap.val() || {};
        Object.keys(all).forEach(cid => {
            arriveesParCourse[cid] = all[cid]?.arrivees || {};
        });
        renderClasse(arriveesParCourse);
    });

    window._arriveesParCourse = arriveesParCourse;
    renderClasse(arriveesParCourse);
}

function renderClasse(arriveesParCourse) {
    const container = document.getElementById('cross-kiosk-container');
    if (!container) return;

    const courses = Object.values(coursesMap).length > 0
        ? Object.values(coursesMap)
        : COURSES_DEFAUT;

    // Calcul du classement par classe
    const rangsParClasse = {};
    const statsParClasse = {};

    courses.forEach(course => {
        const arriveesCourse = arriveesParCourse?.[course.id] || {};
        const arriveesTriees = Object.values(arriveesCourse)
            .sort((a, b) => a.timestamp - b.timestamp);

        // Regrouper par niveau pour calculer les rangs catégorie
        const parNiveau = {};
        course.niveaux.forEach(n => parNiveau[n] = []);

        const vus = new Set();
        arriveesTriees.forEach(arr => {
            if (vus.has(arr.dossard)) return;
            vus.add(arr.dossard);
            const eleve = elevesMap[String(arr.dossard)];
            if (!eleve) return;
            if (eleve.statut && eleve.statut !== 'present') return;
            const niveau = getNiveauFromClasse(eleve.classe);
            if (!parNiveau[niveau]) return;
            parNiveau[niveau].push({
                dossard: arr.dossard,
                classe: eleve.classe
            });
        });

        // Attribution des rangs + agrégation par classe
        Object.entries(parNiveau).forEach(([niveau, liste]) => {
            liste.forEach((item, idx) => {
                if (!rangsParClasse[item.classe]) rangsParClasse[item.classe] = [];
                rangsParClasse[item.classe].push(idx + 1);
            });
        });
    });

    // Comptage des absents/inaptes par classe
    Object.values(elevesMap).forEach(e => {
        if (!e.classe) return;
        if (!statsParClasse[e.classe]) statsParClasse[e.classe] = { absents: 0, inaptes: 0 };
        if (e.statut === 'absent') statsParClasse[e.classe].absents++;
        if (e.statut === 'inapte') statsParClasse[e.classe].inaptes++;
    });

    const classement = Object.entries(rangsParClasse).map(([classe, rangs]) => {
        const moy = rangs.reduce((a, b) => a + b, 0) / rangs.length;
        const stats = statsParClasse[classe] || { absents: 0, inaptes: 0 };
        return {
            classe,
            niveau: classe.charAt(0),
            moyenne: Math.round(moy * 10) / 10,
            nbClasses: rangs.length,
            nbAbsents: stats.absents,
            nbInaptes: stats.inaptes
        };
    }).sort((a, b) => a.moyenne - b.moyenne);

    classement.forEach((c, idx) => { c.rang = idx + 1; });

    const totalArrivees = Object.values(arriveesParCourse || {}).reduce((sum, c) => sum + Object.keys(c).length, 0);
    const enCours = totalArrivees > 0;

    container.innerHTML = `
        <style>
            .classe-body { background: #0f172a; min-height: 100vh; }
            .classe-row {
                display: grid;
                grid-template-columns: 90px 100px 140px 1fr 100px;
                align-items: center;
                gap: 12px;
                padding: 12px 20px;
                background: #1e293b;
                border-radius: 12px;
                margin-bottom: 8px;
                border-left: 4px solid #334155;
            }
            .classe-row--gold { border-left-color: #facc15; background: linear-gradient(90deg, #78350f30 0%, #1e293b 60%); }
            .classe-row--silver { border-left-color: #94a3b8; }
            .classe-row--bronze { border-left-color: #d97706; }
        </style>

        <div class="classe-body flex flex-col">
            <div class="bg-slate-900 border-b-4 border-emerald-500 px-6 py-4 flex justify-between items-center">
                <div>
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Cross · Classement par classe</div>
                    <div class="text-3xl font-black text-white">${classement.length} classe${classement.length > 1 ? 's' : ''} classée${classement.length > 1 ? 's' : ''}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Arrivées totales</div>
                    <div class="text-4xl font-mono font-black ${enCours ? 'text-emerald-400' : 'text-slate-600'}">${totalArrivees}</div>
                </div>
            </div>

            <div class="p-6 flex-1 overflow-y-auto">
                ${classement.length === 0 ? `<div class="text-center py-20 text-slate-500 text-2xl">⏳ En attente des résultats...</div>` : `
                    <div class="max-w-5xl mx-auto">
                        <div class="classe-row" style="background: #0f172a; border-left-color: transparent; font-weight: 900; color: #64748b; text-transform: uppercase; font-size: 0.75rem;">
                            <span>Rang</span>
                            <span>Classe</span>
                            <span class="text-center">Niveau</span>
                            <span>Moyenne des rangs catégorie</span>
                            <span class="text-right">Élèves</span>
                        </div>
                        ${classement.map(c => {
                            const cls = c.rang === 1 ? 'classe-row--gold' : c.rang === 2 ? 'classe-row--silver' : c.rang === 3 ? 'classe-row--bronze' : '';
                            const medaille = c.rang === 1 ? '🥇' : c.rang === 2 ? '🥈' : c.rang === 3 ? '🥉' : `${c.rang}.`;
                            return `
                                <div class="classe-row ${cls}">
                                    <span class="text-2xl font-black text-yellow-400">${medaille}</span>
                                    <span class="text-2xl font-black text-white">${c.classe}</span>
                                    <span class="text-center text-sm font-bold text-slate-400">${c.niveau}e</span>
                                    <span class="text-2xl font-mono font-black text-emerald-400">${c.moyenne}</span>
                                    <span class="text-right text-sm">
                                        <span class="text-white font-bold">${c.nbClasses}</span>
                                        ${c.nbAbsents > 0 ? `<span class="text-red-400 ml-1">(${c.nbAbsents}A)</span>` : ''}
                                        ${c.nbInaptes > 0 ? `<span class="text-amber-400 ml-1">(${c.nbInaptes}I)</span>` : ''}
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <p class="text-center text-xs text-slate-500 mt-4">
                        Moyenne = rang moyen dans la catégorie (niveau). Plus petit = meilleur.
                    </p>
                `}
            </div>
        </div>
    `;
}

// ============================================================
// MODE CLIC — backup manuel (bouton énorme)
// ============================================================
function initClic(container) {
    const basePath = `etablissements/0680013V/profs/${currentProfCode}/cross`;

    if (unsubGo) unsubGo();
    unsubGo = onValue(ref(db, `${basePath}/courses/${currentCourseId}/go`), snap => {
        const go = snap.val();
        goTimestamp = go?.timestamp || null;
        renderClic();
    });

    if (unsubArrivees) unsubArrivees();
    unsubArrivees = onValue(ref(db, `${basePath}/courses/${currentCourseId}/arrivees`), snap => {
        arrivees = snap.val() || {};
        renderClic();
    });

    renderClic();
}

function renderClic() {
    const container = document.getElementById('cross-kiosk-container');
    if (!container) return;

    const enCours = !!goTimestamp;
    const nbArrivees = Object.keys(arrivees).length;
    const chronoStr = enCours
        ? formatTemps(Math.floor((Date.now() - goTimestamp) / 1000))
        : '--:--';

    container.innerHTML = `
        <div class="min-h-screen flex flex-col bg-slate-900">
            <div class="bg-slate-800 border-b-4 border-emerald-500 p-6 flex justify-between items-center">
                <div>
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Cross · Clic backup</div>
                    <div class="text-3xl font-black text-white">${nbArrivees} arrivant${nbArrivees > 1 ? 's' : ''}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-slate-500 font-bold tracking-widest">Chrono</div>
                    <div class="text-5xl font-mono font-black ${enCours ? 'text-emerald-400' : 'text-slate-600'}">${chronoStr}</div>
                </div>
            </div>

            <div class="flex-1 flex flex-col items-center justify-center p-8">
                ${!enCours ? `
                    <div class="text-center">
                        <div class="text-8xl mb-6 animate-pulse">⏳</div>
                        <div class="text-4xl font-black text-slate-400">En attente du départ...</div>
                        <div class="text-xl text-slate-500 mt-3">Le prof va lancer la course</div>
                    </div>
                ` : `
                    <button id="clic-btn" onclick="window.crossKioskClic()"
                            class="w-72 h-72 md:w-96 md:h-96 rounded-full bg-gradient-to-br from-red-500 to-red-700
                                   shadow-[0_0_80px_rgba(239,68,68,0.6)] active:scale-95 transition-transform
                                   border-8 border-red-300 flex items-center justify-center">
                        <span class="text-6xl md:text-7xl font-black text-white tracking-wider">CLIC</span>
                    </button>
                    <p class="text-center text-slate-400 mt-8 text-lg max-w-md">
                        Tape une fois par élève qui franchit la ligne (si la douchette ne marche pas).
                    </p>
                `}
            </div>

            ${enCours ? `
                <div class="bg-slate-800 p-4 border-t-2 border-slate-700">
                    <p class="text-center text-xs text-slate-500">
                        Les clics sont enregistrés côté élève et comptés côté prof.
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

window.crossKioskClic = async () => {
    if (!goTimestamp) return;

    const btn = document.getElementById('clic-btn');
    if (btn) {
        btn.style.opacity = '0.5';
        setTimeout(() => { btn.style.opacity = '1'; }, 200);
    }

    // Vibration feedback si supporté
    if (navigator.vibrate) navigator.vibrate(50);

    const basePath = `etablissements/0680013V/profs/${currentProfCode}/cross`;
    try {
        await push(ref(db, `${basePath}/courses/${currentCourseId}/clics`), {
            timestamp: Date.now(),
            source: 'kiosk-clic'
        });
    } catch (err) {
        console.error('[Clic] Erreur :', err);
    }
};