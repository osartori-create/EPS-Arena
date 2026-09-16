// src/js/modules/cross/cross-kiosk.js
// Kiosk paramétrable par URL :
//   eleve.html?mode=cross-podium&course=course1&prof=XXXX
//   eleve.html?mode=cross-classement&course=course1&prof=XXXX
//   eleve.html?mode=cross-classe&prof=XXXX
//   eleve.html?mode=cross-consult&prof=XXXX
//   eleve.html?mode=cross-clic&course=course1&prof=XXXX

import { db, ref, onValue } from '../../core/firebase-service.js';
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
        case 'cross-podium': initPodium(container); break;
        case 'cross-classement': initClassement(container); break;
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