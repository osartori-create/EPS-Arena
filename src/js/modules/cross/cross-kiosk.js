// src/js/modules/cross/cross-kiosk.js
// Kiosk paramétrable par URL :
//   eleve.html?mode=cross-podium&course=course1&prof=XXXX
//   eleve.html?mode=cross-classement&course=course1&prof=XXXX
//   eleve.html?mode=cross-classe&prof=XXXX
//   eleve.html?mode=cross-consult&prof=XXXX
//   eleve.html?mode=cross-clic&course=course1&prof=XXXX

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue, push } from '../../core/firebase-service.js';
import { COURSES_DEFAUT, getNiveauFromClasse, formatTemps, getMedaille, calculerNoteEleve, DISTANCE_CONTRAT_M } from './cross-core.js';
import { loadRosterLocal, sauverRosterLocal, effacerRosterLocal, ROSTER_LOCAL_KEY } from './cross-config.js';

let currentCourseId = null;
let currentProfCode = 'DEFAULT';
let currentMode = 'cross-podium';
let rosterLocal = {};
let tvTimer = null;
let tvScrollTimer = null;

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

        // ✅ Élargir le container principal pour les modes kiosk cross
    const mainContainer = document.getElementById('main-container');
    if (mainContainer) {
        mainContainer.classList.remove('max-w-md');
        mainContainer.classList.add('max-w-full', 'w-full');
    }
    const activityScreen = document.getElementById('activity-screen');
    if (activityScreen) {
        activityScreen.classList.remove('max-w-md');
        activityScreen.classList.add('max-w-full', 'w-full', 'p-0');
    }

    const activity = document.getElementById('activity-screen');
    if (activity) activity.classList.remove('hidden');

    let container = document.getElementById('cross-kiosk-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cross-kiosk-container';
        container.className = 'w-full';
        activity.appendChild(container);
    }

    chargerRosterLocal();
    assurerBoutonRoster();
    assurerSelecteurCourse();
    chargerConfig();

         switch (currentMode) {
        case 'cross-podium':     initPodium(container); break;
        case 'cross-classement': initClassement(container); break;
        case 'cross-classe':     initClasse(container); break;
        case 'cross-consult':    initConsult(container); break;
        case 'cross-clic':       initClic(container); break;
        case 'cross-tv':         initTv(container); break;
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
// ROSTER LOCAL + RENDU PAR MODE
// ============================================================
function chargerRosterLocal() {
    rosterLocal = loadRosterLocal();
}

function nomPourDossard(dossard) {
    const r = rosterLocal[String(dossard)];
    if (!r) return '';
    return `${(r.prenom || '').trim()} ${(r.nom || '').trim()}`.trim();
}

function renderCurrentMode() {
    const container = document.getElementById('cross-kiosk-container');
    if (!container) return;
    switch (currentMode) {
        case 'cross-podium': render(); break;
        case 'cross-classement': renderClassement(); break;
        case 'cross-classe': renderClasse(window._arriveesParCourse); break;
        case 'cross-consult': renderConsult(); break;
        case 'cross-clic': renderClic(); break;
        case 'cross-tv': renderTv(); break;
    }
}

function rechargerModeActif() {
    const container = document.getElementById('cross-kiosk-container');
    if (!container) return;
    switch (currentMode) {
        case 'cross-podium': initPodium(container); break;
        case 'cross-classement': initClassement(container); break;
        case 'cross-classe': initClasse(container); break;
        case 'cross-consult': initConsult(container); break;
        case 'cross-clic': initClic(container); break;
        case 'cross-tv': initTv(container); break;
    }
}

const VUES_DISPONIBLES = [
    { id: 'cross-podium',     label: '🏆 Podium' },
    { id: 'cross-classement', label: '📋 Classement' },
    { id: 'cross-classe',     label: '🏫 Par classe' },
    { id: 'cross-tv',         label: '📺 TV' }
];

function assurerSelecteurCourse() {
    if (!document.getElementById('cross-course-selector-style')) {
        const st = document.createElement('style');
        st.id = 'cross-course-selector-style';
        st.textContent = `
            .cross-toolbar { position:fixed; top:10px; left:10px; z-index:9998; display:flex; flex-direction:column; gap:8px; max-width:78vw; }
            .cross-toolbar-row { display:flex; gap:6px; flex-wrap:wrap; }
            .cross-toolbar-label { font-size:10px; font-weight:900; text-transform:uppercase; color:#64748b; margin-bottom:2px; }
            .cross-course-btn, .cross-vue-btn { padding:8px 10px; border-radius:10px; font-weight:900; font-size:12px; border:2px solid #cbd5e1; background:#ffffff; color:#0f172a; cursor:pointer; white-space:nowrap; }
            .cross-course-btn--actif { background:#2563eb; color:#ffffff; border-color:#1d4ed8; }
            .cross-vue-btn--actif { background:#0f766e; color:#ffffff; border-color:#115e59; }
        `;
        document.head.appendChild(st);
    }

    let bar = document.getElementById('cross-course-selector');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'cross-course-selector';
        bar.className = 'cross-toolbar';
        document.body.appendChild(bar);
    }

    bar.innerHTML = `
        <div>
            <div class="cross-toolbar-label">Courses</div>
            <div class="cross-toolbar-row">
                ${COURSES_DEFAUT.map(c => `
                    <button data-course="${c.id}" class="cross-course-btn ${c.id === currentCourseId ? 'cross-course-btn--actif' : ''}">${c.label}</button>
                `).join('')}
            </div>
        </div>
        <div>
            <div class="cross-toolbar-label">Affichage</div>
            <div class="cross-toolbar-row">
                ${VUES_DISPONIBLES.map(v => `
                    <button data-vue="${v.id}" class="cross-vue-btn ${v.id === currentMode ? 'cross-vue-btn--actif' : ''}">${v.label}</button>
                `).join('')}
            </div>
        </div>
    `;

    bar.querySelectorAll('.cross-course-btn').forEach(btn => {
        btn.onclick = () => window.crossKioskChangerCourse(btn.dataset.course);
    });
    bar.querySelectorAll('.cross-vue-btn').forEach(btn => {
        btn.onclick = () => window.crossKioskChangerVue(btn.dataset.vue);
    });
}

window.crossKioskChangerVue = function(vueId) {
    if (!vueId || vueId === currentMode) return;
    currentMode = vueId;

    try {
        const params = new URLSearchParams(window.location.search);
        params.set('mode', vueId);
        window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    } catch (e) { /* ignore */ }

    rechargerModeActif();
    assurerSelecteurCourse();
};

window.crossKioskChangerCourse = function(courseId) {
    if (!courseId || courseId === currentCourseId) return;
    currentCourseId = courseId;

    // Met à jour l'URL sans recharger (pratique si l'utilisateur recharge l'iPad).
    try {
        const params = new URLSearchParams(window.location.search);
        params.set('course', courseId);
        window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    } catch (e) { /* ignore */ }

    rechargerModeActif();
    assurerSelecteurCourse();
};

function assurerBoutonRoster() {
    let btn = document.getElementById('cross-roster-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'cross-roster-btn';
        btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:#0891b2;color:#fff;font-weight:900;padding:8px 12px;border-radius:10px;font-size:12px;border:2px solid #22d3ee;';
        document.body.appendChild(btn);
    }
    const hasRoster = Object.keys(rosterLocal).length > 0;
    btn.textContent = hasRoster ? `📇 ${Object.keys(rosterLocal).length} noms` : '📇 Charger roster';
    btn.onclick = () => {
        if (hasRoster) {
            if (!confirm('Retirer le roster local (noms masqués) ?')) return;
            effacerRosterLocal();
            rosterLocal = {};
            btn.textContent = '📇 Charger roster';
            rechargerModeActif();
        } else {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.onchange = (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        sauverRosterLocal(data);
                        rosterLocal = loadRosterLocal();
                        btn.textContent = `📇 ${Object.keys(rosterLocal).length} noms`;
                        rechargerModeActif();
                    } catch (err) {
                        alert('❌ Fichier roster invalide : ' + err.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }
    };
}

// ============================================================
// CHARGEMENT CONFIG
// ============================================================
function chargerConfig() {
    const basePath = `${getEtab()}/profs/${currentProfCode}/cross`;

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
        renderCurrentMode();
    });

    // Chargement des élèves (dossard → { classe, sexe, vma, statut })
    if (unsubConfig) unsubConfig();
    unsubConfig = onValue(ref(db, `${basePath}/config/eleves`), snap => {
        elevesMap = snap.val() || {};
        renderCurrentMode();
    });
}

// ============================================================
// PODIUM
// ============================================================
function initPodium(container) {
    const basePath = `${getEtab()}/profs/${currentProfCode}/cross`;

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
            classe: eleve.classe,
            timestamp: arr.timestamp
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
            .cross-podium-body { background: #f8fafc; min-height: 100vh; }
            .cross-podium-card {
                background: #ffffff;
                border: 2px solid #d1d5db;
                box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            }
            .cross-medal-gold   { background: linear-gradient(180deg, #fbbf24, #d97706); }
            .cross-medal-silver { background: linear-gradient(180deg, #cbd5e1, #64748b); }
            .cross-medal-bronze { background: linear-gradient(180deg, #f59e0b, #92400e); }
            .cross-step { transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        </style>

        <div class="cross-podium-body flex flex-col">
            <!-- Bandeau course + chrono -->
            <div class="bg-white border-b-4 border-emerald-500 p-6 flex justify-between items-center flex-wrap gap-4 shadow-sm">
                <div>
                    <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">Cross</div>
                    <div class="text-4xl font-black text-gray-900">${niveauxLabel} ${sexeLabel}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">Chrono</div>
                    <div id="cross-kiosk-chrono" class="text-6xl font-mono font-black ${enCours ? 'text-emerald-600' : 'text-gray-400'}">${chronoStr}</div>
                </div>
            </div>

            <!-- Zone podiums -->
            <div class="flex-1 p-6">
                ${enCours ? renderPodiums(parNiveau, course) + renderClassementCategorie(parNiveau, course) : renderAttente()}
            </div>
        </div>
    `;
}

function renderAttente() {
    return `
        <div class="flex flex-col items-center justify-center py-32">
            <div class="text-8xl mb-6 animate-pulse">⏳</div>
            <div class="text-4xl font-black text-gray-700">En attente du départ...</div>
            <div class="text-xl text-gray-500 mt-3">Le prof va lancer la course</div>
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

function renderClassementCategorie(parNiveau, course) {
    const blocs = course.niveaux.map(niveau => {
        const liste = parNiveau[niveau] || [];
        let rows = '';
        if (liste.length === 0) {
            rows = `<div class="cat-row cat-row--empty">En attente...</div>`;
        } else {
            rows = liste.map((item, idx) => {
                const place = idx + 1;
                const medaille = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}.`;
                const libelle = nomPourDossard(item.dossard);
                const temps = goTimestamp ? formatTemps(Math.max(0, Math.round((item.timestamp - goTimestamp) / 1000))) : '--:--';
                return `
                    <div class="cat-row">
                        <span class="cat-place">${medaille}</span>
                        <span class="cat-dossard">#${item.dossard}</span>
                        <span class="cat-nom">${libelle || ''}</span>
                        <span class="cat-classe">${item.classe}</span>
                        <span class="cat-temps">${temps}</span>
                    </div>
                `;
            }).join('');
        }
        return `
            <div class="cat-col">
                <div class="cat-title">${niveau}e — ${liste.length} arrivant${liste.length > 1 ? 's' : ''}</div>
                ${rows}
            </div>
        `;
    }).join('');

    return `
        <style>
            .cat-block { margin-top: 24px; max-width: 1100px; margin-left: auto; margin-right: auto; }
            .cat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
            .cat-col { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
            .cat-title { font-weight: 900; color: #2563eb; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em; margin-bottom: 8px; }
            .cat-row { display: grid; grid-template-columns: 46px 70px 1fr 60px 70px; align-items: center; gap: 6px; padding: 6px 8px; background: #ffffff; border-bottom: 1px solid #f1f5f9; border-left: 3px solid #e5e7eb; font-size: 0.85rem; }
            .cat-row--empty { color: #9ca3af; padding: 12px; text-align: center; }
            .cat-place { font-weight: 900; color: #d97706; }
            .cat-dossard { font-family: monospace; font-weight: 900; color: #111827; }
            .cat-nom { color: #1f2937; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .cat-classe { color: #6b7280; font-weight: 900; text-align: center; }
            .cat-temps { font-family: monospace; font-weight: 900; color: #16a34a; text-align: right; }
        </style>
        <div class="cat-block">
            <div class="cat-grid">${blocs}</div>
        </div>
    `;
}

function renderPodiumNiveau(niveau, arrives) {
    const top3 = [arrives[0] || null, arrives[1] || null, arrives[2] || null];

    return `
        <div class="cross-podium-card rounded-3xl p-6">
            <div class="text-center mb-6">
                <div class="text-5xl font-black text-gray-900">${niveau}e</div>
                <div class="text-xs uppercase text-gray-500 font-bold tracking-widest mt-1">${arrives.length} arrivant${arrives.length > 1 ? 's' : ''}</div>
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

    // Dossard + nom (le nom est lu depuis le roster local, jamais Firebase).
    const libelle = nomPourDossard(eleve.dossard);
    return `
        <div class="flex flex-col items-center cross-step" style="width: 30%;">
            <div class="text-5xl mb-2">${medalEmoji}</div>
            <div class="text-center mb-2 min-h-[80px]">
                <div class="text-4xl font-black text-gray-900 leading-tight">#${eleve.dossard}</div>
                ${libelle ? `<div class="text-base font-bold text-gray-700 leading-tight mt-1">${libelle}</div>` : ''}
                <div class="text-sm font-bold text-gray-500 uppercase">${eleve.classe}</div>
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
const DISTANCE_CONSULT_M = DISTANCE_CONTRAT_M;   // 2400 m

function initConsult(container) {
    const basePath = `${getEtab()}/profs/${currentProfCode}/cross`;

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

        // Calcule vitesse sur la distance de contrat (2400 m)
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
            .consult-body { background: #f8fafc; min-height: 100vh; }
            .consult-col { display: flex; flex-direction: column; }
            .consult-row {
                display: grid;
                grid-template-columns: 90px 90px 1fr 110px;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                margin-bottom: 6px;
                border-left: 4px solid #cbd5e1;
                transition: all 0.3s ease;
            }
            .consult-row--recent {
                border-left-color: #16a34a;
                background: #ecfdf5;
                animation: consultPulse 1s ease-out;
            }
            .consult-row--no-time { opacity: 0.5; }
            @keyframes consultPulse {
                0% { transform: scale(0.95); background: #bbf7d0; }
                100% { transform: scale(1); background: #ecfdf5; }
            }
            .consult-dossard { font-family: monospace; font-weight: 900; color: #d97706; font-size: 1.4rem; }
            .consult-classe  { font-weight: 900; color: #6b7280; font-size: 1.2rem; text-align: center; }
            .consult-vit     { font-weight: 900; color: #16a34a; font-size: 1.3rem; text-align: right; font-family: monospace; }
            .consult-vit--slow { color: #d97706; }
            .consult-vit--very-slow { color: #dc2626; }
            .consult-empty { color: #475569; text-align: center; padding: 40px 0; font-style: italic; }
        </style>

        <div class="consult-body flex flex-col">
            <!-- Bandeau titre + chrono -->
            <div class="bg-white border-b-4 border-emerald-500 px-6 py-3 flex justify-between items-center flex-wrap gap-3 shadow-sm">
                <div class="flex items-center gap-4">
                    <div>
                        <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">Cross</div>
                        <div class="text-3xl font-black text-gray-900">${niveauxLabel} ${sexeLabel}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">Chrono</div>
                    <div id="cross-consult-chrono" class="text-5xl font-mono font-black ${enCours ? 'text-emerald-600' : 'text-gray-400'}">${chronoStr}</div>
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

            const libelle = nomPourDossard(e.dossard);
            return `
                <div class="consult-row ${isRecent ? 'consult-row--recent' : ''} ${!e.vitesse ? 'consult-row--no-time' : ''}">
                    <span class="consult-dossard">#${e.dossard}</span>
                    <span class="consult-classe">${e.classe}</span>
                    <span class="text-gray-700 text-xs">${libelle || ''}</span>
                    <span class="consult-vit ${vitClass}">${vitHtml}</span>
                </div>
            `;
        }).join('');

    return `
        <div class="consult-col bg-white rounded-2xl p-3 border border-gray-200">
            <div class="text-center mb-3">
                <div class="text-4xl font-black text-gray-900">${niveau}e</div>
                <div class="text-xs uppercase text-gray-500 font-bold tracking-widest mt-1">
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
    const basePath = `${getEtab()}/profs/${currentProfCode}/cross`;

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

    // ============================================================
    // Groupement par niveau + attribution des rangs de catégorie
    // ============================================================
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
        const tempsSec = goTimestamp ? Math.floor((arr.timestamp - goTimestamp) / 1000) : null;
        parNiveau[niveau].push({
            dossard: arr.dossard,
            classe: eleve.classe,
            sexe: eleve.sexe,
            vma: parseFloat(eleve.vma) || null,
            niveau: niveau,
            tempsSec: tempsSec
        });
    });

    // Calcul des notes pour chaque niveau
    course.niveaux.forEach(niveau => {
        const liste = parNiveau[niveau] || [];
        const nbArrivants = liste.length;
        liste.forEach((item, idx) => {
            item.rangNiveau = idx + 1;
            item.nbArrivants = nbArrivants;
            if (item.tempsSec && item.vma) {
                const note = calculerNoteEleve({
                    tempsSec: item.tempsSec,
                    vma: item.vma,
                    rang: item.rangNiveau,
                    nbArrivants: nbArrivants
                });
                item.pourcentageVMA = note.pourcentageVMA;
                item.ptsMotricite   = note.ptsMotricite;
                item.ptsPerformance = note.ptsPerformance;
                item.noteTotale     = note.total;
            } else {
                item.pourcentageVMA = null;
                item.ptsMotricite = 0;
                item.ptsPerformance = 0;
                item.noteTotale = 0;
            }
        });
    });

    const niveauxLabel = course.niveaux.map(n => `${n}e`).join(' + ');
    const sexeLabel = course.sexe === 'F' ? 'Filles' : 'Garçons';

    // Niveaux triés en ordre décroissant : 6e avant 5e, ou 4e avant 3e
    const niveauxTries = [...course.niveaux].sort((a, b) => parseInt(b) - parseInt(a));

    container.innerHTML = `
        <style>
            .cl-body { background: #f8fafc; min-height: 100vh; width: 100%; }
            .cl-row {
                display: grid;
                grid-template-columns: 55px minmax(140px, 1fr) 65px 70px 65px 50px 50px 55px;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                margin-bottom: 4px;
                border-left: 4px solid #cbd5e1;
                font-size: 0.85rem;
            }
            .cl-row--top { border-left-color: #f59e0b; background: #fffbeb; }
            .cl-row--header {
                background: #f1f5f9;
                border-left-color: transparent;
                color: #64748b;
                font-weight: 900;
                text-transform: uppercase;
                font-size: 0.62rem;
                letter-spacing: 0.03em;
            }
            .cl-num { font-family: ui-monospace, monospace; font-weight: 900; }
            @media (max-width: 900px) {
                .cl-row { grid-template-columns: 40px minmax(110px,1fr) 45px 55px 55px 40px 40px 50px; gap: 4px; padding: 6px 8px; font-size: 0.72rem; }
            }
        </style>

        <div class="cl-body flex flex-col">
            <div class="bg-white border-b-4 border-emerald-500 px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">Cross · Classement</div>
                    <div class="text-3xl font-black text-gray-900">${niveauxLabel} ${sexeLabel}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">Chrono</div>
                    <div id="cross-classement-chrono" class="text-4xl font-mono font-black ${enCours ? 'text-emerald-600' : 'text-gray-400'}">${chronoStr}</div>
                </div>
            </div>

            <div class="p-4 flex-1 overflow-y-auto">
                ${Object.values(parNiveau).every(l => l.length === 0) ? `
                    <div class="text-center py-20 text-gray-500 text-2xl">⏳ En attente des premiers arrivés...</div>
                ` : `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">

                        ${niveauxTries.map(niveau => {
                            const liste = parNiveau[niveau] || [];
                            return `
                                <div>
                                    <div class="text-center mb-3">
                                        <div class="text-4xl font-black text-gray-900">${niveau}e</div>
                                        <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">
                                            ${liste.length} arrivant${liste.length > 1 ? 's' : ''}
                                        </div>
                                    </div>

                                    <div class="cl-row cl-row--header">
                                        <span>Place</span>
                                        <span>Dossard</span>
                                        <span>Classe</span>
                                        <span class="text-right">Temps</span>
                                        <span class="text-right">%VMA</span>
                                        <span class="text-center">Mot.</span>
                                        <span class="text-center">Perf.</span>
                                        <span class="text-center">/20</span>
                                    </div>

                                    ${liste.length === 0 ? `
                                        <div class="text-center py-8 text-gray-500 text-sm">En attente...</div>
                                    ` : liste.map(item => {
                                        const isTop = item.rangNiveau <= 3;
                                        const rowCls = isTop ? 'cl-row--top' : '';

                                        const pctColor = item.pourcentageVMA === null ? 'text-gray-500'
                                            : item.pourcentageVMA >= 75 ? 'text-emerald-600'
                                            : item.pourcentageVMA >= 70 ? 'text-lime-600'
                                            : item.pourcentageVMA >= 60 ? 'text-yellow-600'
                                            : item.pourcentageVMA >= 50 ? 'text-orange-600'
                                            : 'text-red-600';

                                        const motColor = item.ptsMotricite >= 13 ? 'text-emerald-600'
                                            : item.ptsMotricite >= 10 ? 'text-lime-600'
                                            : item.ptsMotricite >= 6  ? 'text-yellow-600'
                                            : item.ptsMotricite >= 3  ? 'text-orange-600'
                                            : 'text-red-600';

                                        const perfColor = item.ptsPerformance >= 5 ? 'text-emerald-600'
                                            : item.ptsPerformance >= 3 ? 'text-yellow-600'
                                            : 'text-orange-600';

                                        const noteColor = item.noteTotale >= 16 ? 'text-emerald-600'
                                            : item.noteTotale >= 12 ? 'text-lime-600'
                                            : item.noteTotale >= 8  ? 'text-yellow-600'
                                            : item.noteTotale >= 4  ? 'text-orange-600'
                                            : 'text-red-600';

                                        const medaille = item.rangNiveau === 1 ? '🥇'
                                                       : item.rangNiveau === 2 ? '🥈'
                                                       : item.rangNiveau === 3 ? '🥉' : '';

                                        const libelle = nomPourDossard(item.dossard);

                                        return `
                                            <div class="cl-row ${rowCls}">
                                                <span class="text-base font-black text-amber-600 flex items-center gap-1">
                                                    ${medaille}${medaille ? '' : item.rangNiveau}
                                                </span>
                                                <span class="cl-num text-base text-gray-900">#${item.dossard}${libelle ? ` <span class="block text-xs font-bold text-gray-700 truncate">${libelle}</span>` : ''}</span>
                                                <span class="font-bold text-gray-600">${item.classe}</span>
                                                <span class="cl-num text-sm text-emerald-600 text-right">${item.tempsSec !== null ? formatTemps(item.tempsSec) : '--'}</span>
                                                <span class="cl-num text-sm ${pctColor} text-right">${item.pourcentageVMA !== null ? item.pourcentageVMA.toFixed(1) + '%' : '—'}</span>
                                                <span class="text-center font-black ${motColor}">${item.ptsMotricite}</span>
                                                <span class="text-center font-black ${perfColor}">${item.ptsPerformance}</span>
                                                <span class="text-center font-black text-base ${noteColor}">${item.noteTotale}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `;
                        }).join('')}

                    </div>
                    <p class="text-center text-xs text-gray-500 mt-6 max-w-3xl mx-auto">
                        <strong class="text-gray-600">Mot.</strong> = points motricité /13 ·
                        <strong class="text-gray-600">Perf.</strong> = points performance /7 ·
                        <strong class="text-gray-600">/20</strong> = motricité + performance
                    </p>
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
    const basePath = `${getEtab()}/profs/${currentProfCode}/cross`;

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

    // ============================================================
    // Agrégation : rangs par classe, global ET par sexe
    // ============================================================
    const rangsParClasse = {};       // { "607": [rangs...] }
    const rangsParClasseSexe = {};   // { "607": { F: [rangs...], M: [rangs...] } }
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
                classe: eleve.classe,
                sexe: eleve.sexe || null
            });
        });

        // Attribution des rangs + agrégation
        Object.entries(parNiveau).forEach(([niveau, liste]) => {
            liste.forEach((item, idx) => {
                const rang = idx + 1;

                // Rang global (tous sexes confondus, dans la catégorie du niveau)
                if (!rangsParClasse[item.classe]) rangsParClasse[item.classe] = [];
                rangsParClasse[item.classe].push(rang);

                // Rang par sexe
                if (!rangsParClasseSexe[item.classe]) {
                    rangsParClasseSexe[item.classe] = { F: [], M: [] };
                }
                if (item.sexe === 'F') rangsParClasseSexe[item.classe].F.push(rang);
                if (item.sexe === 'M') rangsParClasseSexe[item.classe].M.push(rang);
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

    // ============================================================
    // Construction du classement
    // ============================================================
    const classement = Object.entries(rangsParClasse).map(([classe, rangs]) => {
        const moy = rangs.length > 0
            ? rangs.reduce((a, b) => a + b, 0) / rangs.length
            : null;

        const sexeRangs = rangsParClasseSexe[classe] || { F: [], M: [] };
        const moyF = sexeRangs.F.length > 0
            ? sexeRangs.F.reduce((a, b) => a + b, 0) / sexeRangs.F.length
            : null;
        const moyM = sexeRangs.M.length > 0
            ? sexeRangs.M.reduce((a, b) => a + b, 0) / sexeRangs.M.length
            : null;

        const stats = statsParClasse[classe] || { absents: 0, inaptes: 0 };
        return {
            classe,
            niveau: classe.charAt(0),
            moyenne: moy !== null ? Math.round(moy * 10) / 10 : null,
            moyenneF: moyF !== null ? Math.round(moyF * 10) / 10 : null,
            moyenneM: moyM !== null ? Math.round(moyM * 10) / 10 : null,
            nbClasses: rangs.length,
            nbF: sexeRangs.F.length,
            nbM: sexeRangs.M.length,
            nbAbsents: stats.absents,
            nbInaptes: stats.inaptes
        };
    });

    // Tri : par moyenne globale, les classes sans moyenne à la fin
    classement.sort((a, b) => {
        if (a.moyenne === null && b.moyenne === null) return a.classe.localeCompare(b.classe);
        if (a.moyenne === null) return 1;
        if (b.moyenne === null) return -1;
        return a.moyenne - b.moyenne;
    });
    classement.forEach((c, idx) => { c.rang = idx + 1; });

    const totalArrivees = Object.values(arriveesParCourse || {}).reduce(
        (sum, c) => sum + Object.keys(c).length, 0
    );
    const enCours = totalArrivees > 0;

    // ============================================================
    // Rendu
    // ============================================================
    container.innerHTML = `
        <style>
            .classe-body { background: #f8fafc; min-height: 100vh; width: 100%; }
            .classe-row {
                display: grid;
                grid-template-columns: 90px 130px 90px 140px 140px 140px 1fr;
                align-items: center;
                gap: 16px;
                padding: 14px 24px;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                margin-bottom: 8px;
                border-left: 4px solid #cbd5e1;
            }
            .classe-row--gold   { border-left-color: #f59e0b; background: #fffbeb; }
            .classe-row--silver { border-left-color: #9ca3af; background: #f9fafb; }
            .classe-row--bronze { border-left-color: #d97706; background: #fff7ed; }
            .classe-row--header {
                background: #f1f5f9;
                border-left-color: transparent;
                color: #64748b;
                font-weight: 900;
                text-transform: uppercase;
                font-size: 0.75rem;
                letter-spacing: 0.1em;
            }
            .classe-avg { font-family: ui-monospace, monospace; font-weight: 900; font-size: 1.5rem; }
            .classe-avg--global  { color: #16a34a; }
            .classe-avg--filles  { color: #db2777; }
            .classe-avg--garcons { color: #2563eb; }
            @media (max-width: 900px) {
                .classe-row { grid-template-columns: 60px 90px 60px 100px 100px 100px 1fr; gap: 8px; padding: 10px 14px; }
                .classe-avg { font-size: 1.1rem; }
            }
        </style>

        <div class="classe-body flex flex-col">
            <div class="bg-white border-b-4 border-emerald-500 px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">Cross · Classement par classe</div>
                    <div class="text-3xl font-black text-gray-900">
                        ${classement.length} classe${classement.length > 1 ? 's' : ''} classée${classement.length > 1 ? 's' : ''}
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xs uppercase text-gray-500 font-bold tracking-widest">Arrivées totales</div>
                    <div class="text-4xl font-mono font-black ${enCours ? 'text-emerald-600' : 'text-gray-400'}">${totalArrivees}</div>
                </div>
            </div>

            <div class="p-4 md:p-6 flex-1 overflow-y-auto w-full">
                ${classement.length === 0 ? `<div class="text-center py-20 text-gray-500 text-2xl">⏳ En attente des résultats...</div>` : `
                    <div class="w-full">
                        <div class="classe-row classe-row--header">
                            <span>Rang</span>
                            <span>Classe</span>
                            <span class="text-center">Niveau</span>
                            <span class="text-center">Rang moyen</span>
                            <span class="text-center">👩 Filles</span>
                            <span class="text-center">👦 Garçons</span>
                            <span class="text-right">Effectif</span>
                        </div>
                        ${classement.map(c => {
                            const cls = c.rang === 1 ? 'classe-row--gold'
                                      : c.rang === 2 ? 'classe-row--silver'
                                      : c.rang === 3 ? 'classe-row--bronze' : '';
                            const medaille = c.rang === 1 ? '🥇' : c.rang === 2 ? '🥈' : c.rang === 3 ? '🥉' : `${c.rang}.`;

                            const fmtMoy = (v) => v !== null ? v.toFixed(1) : '—';

                            return `
                                <div class="classe-row ${cls}">
                                    <span class="text-2xl font-black text-amber-600">${medaille}</span>
                                    <span class="text-2xl font-black text-gray-900">${c.classe}</span>
                                    <span class="text-center text-sm font-bold text-gray-500">${c.niveau}e</span>
                                    <span class="classe-avg classe-avg--global text-center">${fmtMoy(c.moyenne)}</span>
                                    <span class="classe-avg classe-avg--filles text-center">
                                        ${fmtMoy(c.moyenneF)}
                                        <span class="block text-[10px] text-slate-500 font-normal">${c.nbF} filles</span>
                                    </span>
                                    <span class="classe-avg classe-avg--garcons text-center">
                                        ${fmtMoy(c.moyenneM)}
                                        <span class="block text-[10px] text-slate-500 font-normal">${c.nbM} garçons</span>
                                    </span>
                                    <span class="text-right text-sm">
                                        <span class="text-gray-900 font-bold">${c.nbClasses}</span>
                                        ${c.nbAbsents > 0 ? `<span class="text-red-600 ml-1" title="Absents">(${c.nbAbsents}A)</span>` : ''}
                                        ${c.nbInaptes > 0 ? `<span class="text-amber-600 ml-1" title="Inaptes">(${c.nbInaptes}I)</span>` : ''}
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <p class="text-center text-xs text-gray-500 mt-6 max-w-2xl mx-auto">
                        Moyenne = rang moyen dans la catégorie de niveau.
                        <strong class="text-gray-600">Plus petit = meilleur.</strong>
                        Les colonnes Filles/Garçons affinent selon le sexe.
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
    const basePath = `${getEtab()}/profs/${currentProfCode}/cross`;

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

// ============================================================
// MODE TV — défilement vertical continu (type TV ATP)
// ============================================================
function initTv(container) {
    const basePath = `${getEtab()}/profs/${currentProfCode}/cross`;

    if (unsubGo) unsubGo();
    unsubGo = onValue(ref(db, `${basePath}/courses/${currentCourseId}/go`), snap => {
        const go = snap.val();
        goTimestamp = go?.timestamp || null;
        demarrerChronoTv();
    });

    if (unsubArrivees) unsubArrivees();
    unsubArrivees = onValue(ref(db, `${basePath}/courses/${currentCourseId}/arrivees`), snap => {
        arrivees = snap.val() || {};
        renderTv();
    });

    renderTv();
}

function demarrerChronoTv() {
    if (tvTimer) clearInterval(tvTimer);
    const update = () => {
        const el = document.getElementById('cross-tv-chrono');
        if (el && goTimestamp) el.textContent = formatTemps(Math.floor((Date.now() - goTimestamp) / 1000));
    };
    update();
    tvTimer = setInterval(update, 500);
}

function renderTv() {
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
        const tempsSec = goTimestamp ? Math.max(0, Math.round((arr.timestamp - goTimestamp) / 1000)) : null;
        const libelle = nomPourDossard(arr.dossard);
        parNiveau[niveau].push({ dossard: arr.dossard, classe: eleve.classe, tempsSec, libelle });
    });

    const niveauxLabel = course.niveaux.map(n => `${n}e`).join(' + ');
    const sexeLabel = course.sexe === 'F' ? 'Filles' : 'Garçons';
    const enCours = !!goTimestamp;
    const chronoStr = enCours ? formatTemps(Math.floor((Date.now() - goTimestamp) / 1000)) : '--:--';

    const renderRows = () => {
        const niveaux = course.niveaux;
        const listes = niveaux.map(niveau => parNiveau[niveau] || []);
        const maxRows = Math.max(0, ...listes.map(l => l.length));

        let html = `
            <div class="tvs-row tvs-row--header">
                <span class="tvs-place">Place</span>
                ${niveaux.map(niveau => `<span class="tvs-head-cell">${niveau}e</span>`).join('')}
            </div>
        `;

        if (maxRows === 0) {
            html += `<div class="tvs-row tvs-row--empty">En attente des premiers arrivés...</div>`;
        } else {
            for (let i = 0; i < maxRows; i++) {
                const place = i + 1;
                const medaille = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}.`;

                html += `
                    <div class="tvs-row">
                        <span class="tvs-place">${medaille}</span>
                        ${listes.map(liste => {
                            const item = liste[i];
                            if (!item) return `<span class="tvs-cell tvs-cell--empty">—</span>`;
                            return `
                                <span class="tvs-cell">
                                    <span class="tvs-dossard">#${item.dossard}</span>
                                    <span class="tvs-nom">${item.libelle || ''}</span>
                                    <span class="tvs-classe">${item.classe}</span>
                                    <span class="tvs-temps">${item.tempsSec !== null ? formatTemps(item.tempsSec) : '--:--'}</span>
                                </span>
                            `;
                        }).join('')}
                    </div>
                `;
            }
        }

        return html;
    };

    const rowsHtml = renderRows();

    container.innerHTML = `
        <style>
            .tv-body { background:#f8fafc; min-height:100vh; overflow:hidden; display:flex; flex-direction:column; }
            .tv-header { background:#ffffff; border-bottom:4px solid #16a34a; padding:16px 24px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
            .tv-liste { flex:1; overflow:hidden; position:relative; padding:16px; }
            .tv-scroller { display:flex; flex-direction:column; gap:6px; animation:crossTvScroll 60s linear infinite; }
            .tvs-row { display:grid; grid-template-columns: 54px 1fr 1fr; gap:8px; align-items:center; }
            .tvs-row--header { font-weight:900; text-transform:uppercase; color:#64748b; font-size:0.7rem; letter-spacing:0.03em; padding:0 4px; }
            .tvs-row--empty { color:#9ca3af; padding:12px; text-align:center; }
            .tvs-head-cell { text-align:center; }
            .tvs-place { font-weight:900; color:#d97706; font-size:1.2rem; }
            .tvs-cell { display:flex; gap:8px; align-items:center; background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; }
            .tvs-cell--empty { color:#9ca3af; justify-content:center; }
            .tvs-dossard { font-family:monospace; font-weight:900; color:#111827; font-size:1.2rem; }
            .tvs-nom { color:#1f2937; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .tvs-classe { color:#6b7280; font-weight:900; text-align:center; }
            .tvs-temps { font-family:monospace; font-weight:900; color:#16a34a; text-align:right; margin-left:auto; }
            @keyframes crossTvScroll { 0% { transform:translateY(0); } 100% { transform:translateY(-50%); } }
        </style>
        <div class="tv-body">
            <div class="tv-header">
                <div>
                    <div class="text-xs uppercase tracking-widest font-bold text-gray-500">Cross · Consultation TV</div>
                    <div class="text-3xl font-black text-gray-900">${niveauxLabel} ${sexeLabel}</div>
                </div>
                <div id="cross-tv-chrono" class="text-5xl font-mono font-black ${enCours ? 'text-emerald-600' : 'text-gray-400'}">${chronoStr}</div>
            </div>
            <div class="tv-liste">
                <div class="tv-scroller" id="cross-tv-scroller">
                    ${rowsHtml}
                    ${rowsHtml}
                </div>
            </div>
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

    const basePath = `${getEtab()}/profs/${currentProfCode}/cross`;
    try {
        await push(ref(db, `${basePath}/courses/${currentCourseId}/clics`), {
            timestamp: Date.now(),
            source: 'kiosk-clic'
        });
    } catch (err) {
        console.error('[Clic] Erreur :', err);
    }
};