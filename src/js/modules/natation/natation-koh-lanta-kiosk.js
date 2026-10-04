// src/js/modules/natation/natation-koh-lanta-kiosk.js
// Mode « Koh Lanta » du module Natation — interface JUGé (kiosk élève).
//
// Écran unique organisé en 4 zones actives autour d'un gros chrono central :
//   🍽️ NAF (coups de bras) · 🪼 Méduses · 🌀 Tunnels · 🛟 Remorquage
// Les 4 zones restent éditables en permanence, même quand le chrono est arrêté.
//
// Score (le plus bas gagne, peut être négatif) :
//   temps(s) + coups + (méduses × 5) − bonus tunnel − bonus remorquage.

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue, set } from '../../core/firebase-service.js';
import {
    calculScoreKohLanta,
    getTunnelCouleur,
    getTunnelInfos,
    getRemorquageInfos,
    formatScoreKohLanta,
    formatTempsKohLanta,
    TUNNEL_BONUS,
    REMORQUAGE_BONUS
} from './natation-koh-lanta-core.js';

let currentClasse = '';
let currentNumero = null;
let nbEleves = 0;
let configListener = null;
let historiqueListener = null;

let chronoRunning = false;
let chronoStart = 0;
let chronoElapsed = 0;
let rafId = null;

// Essai en cours
let attempt = null;

// Historique chargé pour l'élève courant
let historiqueEssais = [];

// Étape : liste | course | confirmation
let step = 'liste';

// État de sélection « sans aide » avant le choix du nombre de remontées
let tunnelTypeTmp = null;
let remonteesTmp = null;

let isSaving = false;

function zonesComplete() {
    return !!attempt
        && attempt.coups >= 1
        && attempt.meduses >= 0
        && attempt.tunnelType !== null
        && attempt.remorquage !== null;
}

// ============================================================
// UTILITAIRES GLOBEAUX
// ============================================================
window.kohLantaChoisirNumero = function(num) {
    if (!num || num < 1 || num > nbEleves) return;
    if (chronoRunning) stopChronoInternal();
    currentNumero = num;
    resetAttempt();
    chargerHistorique(num, () => {
        step = 'course';
        render();
    });
};

window.kohLantaRetourListe = function() {
    if (chronoRunning) stopChronoInternal();
    currentNumero = null;
    resetAttempt();
    step = 'liste';
    render();
};

window.kohLantaDemarrer = function() {
    if (currentNumero === null || chronoRunning) return;
    chronoRunning = true;
    chronoStart = performance.now() - chronoElapsed;
    rafId = requestAnimationFrame(updateChrono);
    render();
};

window.kohLantaArreter = function() {
    if (!chronoRunning) return;
    stopChronoInternal();
    render();
};

window.kohLantaReprendre = function() {
    if (currentNumero === null || chronoRunning) return;
    chronoRunning = true;
    chronoStart = performance.now() - chronoElapsed;
    rafId = requestAnimationFrame(updateChrono);
    render();
};

window.kohLantaRecommencer = function() {
    resetAttempt();
    step = 'course';
    render();
};

window.kohLantaValiderScore = function() {
    if (!zonesComplete()) {
        alert('Renseigne les 4 zones (NAF, Méduses, Tunnels, Remorquage) avant de valider.');
        return;
    }
    if (!attempt.tempsMs || attempt.tempsMs <= 0) {
        alert('Arrête le chrono avant de valider le score.');
        return;
    }
    step = 'confirmation';
    render();
};

// --- NAF ---
window.kohLantaAdjustCoups = function(delta) {
    let val = attempt.coups;
    val = Math.max(1, val + delta);
    attempt.coups = val;
    render();
};

// --- MÉDUSES ---
window.kohLantaAdjustMeduses = function(delta) {
    let val = attempt.meduses;
    val = Math.max(0, val + delta);
    attempt.meduses = val;
    render();
};

// --- TUNNELS ---
window.kohLantaChoisirTunnel = function(type) {
    if (type === 'corde') {
        attempt.tunnelType = 'corde';
        attempt.remontees = null;
        tunnelTypeTmp = null;
        remonteesTmp = null;
    } else if (type === 'sans-aide') {
        tunnelTypeTmp = 'sans-aide';
        remonteesTmp = attempt.remontees ?? null;
        attempt.tunnelType = null; // sera défini quand l'élève choisira le nb de remontées
    }
    render();
};

window.kohLantaChoisirRemontees = function(n) {
    remonteesTmp = n;
    attempt.remontees = n;
    attempt.tunnelType = 'sans-aide';
    tunnelTypeTmp = null;
    render();
};

// --- REMORQUAGE ---
window.kohLantaChoisirRemorquage = function(couleur) {
    attempt.remorquage = couleur;
    render();
};

// --- CONFIRMATION ---
window.kohLantaEnregistrer = function() {
    if (isSaving) return;
    if (!zonesComplete() || !attempt.tempsMs) {
        alert('Informations incomplètes.');
        return;
    }
    enregistrerAttempt();
};

window.kohLantaNouvelEssai = function() {
    resetAttempt();
    step = 'course';
    render();
};

window.kohLantaChangerEleve = function() {
    currentNumero = null;
    resetAttempt();
    step = 'liste';
    render();
};

window.kohLantaRetourConfirmation = function() {
    step = 'course';
    render();
};

window.retourMenuNatationKohLanta = function() {
    if (configListener) { configListener(); configListener = null; }
    if (historiqueListener) { historiqueListener(); historiqueListener = null; }
    if (chronoRunning) stopChronoInternal();
    const container = document.getElementById('natation-module');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
    else location.reload();
};

function stopChronoInternal() {
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (currentNumero !== null && attempt) attempt.tempsMs = chronoElapsed;
}

function resetAttempt() {
    chronoElapsed = 0;
    attempt = {
        tempsMs: null,
        coups: 10,      // proposition de départ à 10 (et valide par défaut)
        meduses: 0,
        tunnelType: null,
        remontees: null,
        remorquage: null
    };
    tunnelTypeTmp = null;
    remonteesTmp = null;
}

function updateChrono() {
    if (!chronoRunning) return;
    chronoElapsed = performance.now() - chronoStart;
    const el = document.getElementById('kl-course-chrono');
    if (el) el.textContent = formatTempsKohLanta(chronoElapsed);
    rafId = requestAnimationFrame(updateChrono);
}

// ============================================================
// INITIALISATION
// ============================================================
export function initNatationKohLantaKiosk(classe) {
    console.log('🏝️ initNatationKohLantaKiosk pour', classe);
    currentClasse = classe;
    currentNumero = null;
    step = 'liste';
    historiqueEssais = [];
    isSaving = false;
    resetAttempt();

    const container = document.getElementById('natation-module');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'block';

    const codeInfo = document.getElementById('code-info');
    if (codeInfo) codeInfo.style.display = 'none';
    const btnQuit = document.getElementById('btn-quit');
    if (btnQuit) btnQuit.style.display = 'none';

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `${getEtab()}/profs/${profCode}/${classe}/natation/config`);
    if (configListener) configListener();
    configListener = onValue(configRef, (snap) => {
        const cfg = snap.val() || {};
        nbEleves = cfg.nbEleves || 0;
        if (nbEleves === 0) {
            const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
            nbEleves = eleves.length > 0 ? eleves.length : 28;
        }
        render();
    });
}

// ============================================================
// CHARGEMENT HISTORIQUE
// ============================================================
function chargerHistorique(numero, callback) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const historiqueRef = ref(db, `${getEtab()}/profs/${profCode}/${currentClasse}/natation-koh-lanta/historique/${numero}`);
    if (historiqueListener) historiqueListener();
    historiqueListener = onValue(historiqueRef, (snap) => {
        const data = snap.val() || [];
        historiqueEssais = Array.isArray(data) ? data : [];
        if (callback) callback();
    }, { onlyOnce: true });
}

// ============================================================
// RENDU PRINCIPAL
// ============================================================
function render() {
    const container = document.getElementById('natation-module');
    if (!container) return;
    container.innerHTML = renderChrome();
}

function renderChrome() {
    const steps = [
        { id: 'liste', label: 'Nageur' },
        { id: 'course', label: 'Course' },
        { id: 'confirmation', label: '🏆 Score' }
    ];
    const currentIdx = steps.findIndex(s => s.id === step);

    const stepHtml = steps.map((s, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return `
            <div class="flex-1 text-center px-1">
                <div class="h-1.5 rounded-full mb-1 ${isActive ? 'bg-yellow-400' : (isDone ? 'bg-emerald-400' : 'bg-emerald-900')}"></div>
                <span class="text-[10px] font-black ${isActive ? 'text-yellow-300' : 'text-emerald-500'}">${s.label}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="w-full min-h-screen" style="background: linear-gradient(180deg, #052e2b 0%, #064e3b 100%); color:#eafff7; padding:12px; display:flex; flex-direction:column;">
            <div class="flex items-center justify-between mb-3 px-1">
                <h2 class="text-2xl md:text-3xl font-black" style="color:#facc15;">🏝️ KOH LANTA</h2>
                <span class="text-sm font-black px-2 py-1 rounded-lg" style="background:#022c22; color:#6ee7b7;">NATATION</span>
            </div>
            <div class="flex gap-1 mb-3 px-1">${stepHtml}</div>
            ${renderStepContent()}
        </div>
    `;
}

function renderStepContent() {
    if (step === 'liste') return renderListe();
    if (step === 'course') return renderCourse();
    if (step === 'confirmation') return renderConfirmation();
    return renderListe();
}

// --- LISTE DES NAGEURS ---
function renderListe() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const histoRef = ref(db, `${getEtab()}/profs/${profCode}/${currentClasse}/natation-koh-lanta/historique`);

    let html = `
        <p class="text-xl md:text-2xl font-black text-center mb-4" style="color:#eafff7;">Choisis ton numéro d'aventurier</p>
        <div class="flex-1 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3 max-w-6xl mx-auto w-full content-start" id="kl-num-grid">
            <span class="col-span-full text-center" style="color:#6ee7b7;">Chargement…</span>
        </div>
        <div class="mt-6 text-center">
            <button onclick="window.retourMenuNatationKohLanta()"
                    class="bg-slate-600 text-white px-10 py-4 rounded-2xl font-black text-lg active:scale-95 transition-all">
                ← Retour
            </button>
        </div>
    `;

    onValue(histoRef, (snap) => {
        const histo = snap.val() || {};
        const grid = document.getElementById('kl-num-grid');
        if (!grid) return;
        let cells = '';
        for (let i = 1; i <= nbEleves; i++) {
            const aDone = histo[i] && Array.isArray(histo[i]) && histo[i].length > 0;
            const bg = aDone
                ? 'linear-gradient(135deg, #059669, #047857)'
                : 'linear-gradient(135deg, #2563eb, #1d4ed8)';
            cells += `
                <button class="rounded-2xl font-black text-3xl md:text-4xl text-white border-4 active:scale-95 transition-all shadow-lg hover:scale-105 touch-manipulation"
                        style="background:${bg}; border-color:#eafff7; min-height:72px;"
                        onclick="window.kohLantaChoisirNumero(${i})">
                    ${i}${aDone ? ' ✅' : ''}
                </button>
            `;
        }
        grid.innerHTML = cells;
    }, { onlyOnce: true });

    return html;
}

// --- COURSE : 4 zones actives + chrono central ---
function renderCourse() {
    const running = chronoRunning;
    const timeStr = running
        ? formatTempsKohLanta(chronoElapsed)
        : (attempt.tempsMs ? formatTempsKohLanta(attempt.tempsMs) : '00:00.0');

    const nafDone = attempt.coups >= 1;
    const medDone = attempt.meduses >= 0;
    const tunDone = attempt.tunnelType !== null;
    const remDone = attempt.remorquage !== null;

    function cardStyle(done) {
        return `background:#022c22; border:3px solid ${done ? '#34d399' : '#64748b'};`;
    }

    // ── Zone NAF ────────────────────────────────
    const nafZone = `
        <div class="rounded-2xl p-3" style="${cardStyle(nafDone)}">
            <div class="font-black text-lg" style="color:#fca5a5;">🍽️ NAF</div>
            <div class="text-[11px] mb-2" style="color:#a7f3d0;">coups de bras sur 12,5 m</div>
            <div class="flex items-center justify-center gap-2">
                <button onclick="window.kohLantaAdjustCoups(-1)"
                        class="w-14 h-14 rounded-xl text-3xl font-black text-white active:scale-95 touch-manipulation"
                        style="background:#475569;">−</button>
                <span class="text-4xl font-black w-16 text-center" style="color:#facc15;">${attempt.coups}</span>
                <button onclick="window.kohLantaAdjustCoups(1)"
                        class="w-14 h-14 rounded-xl text-3xl font-black text-white active:scale-95 touch-manipulation"
                        style="background:#475569;">+</button>
            </div>
        </div>
    `;

    // ── Zone Méduses ────────────────────────────
    const jelly = Array.from({ length: Math.min(attempt.meduses, 12) }, () => '<span class="text-xl">🪼</span>').join('');
    const medusesZone = `
        <div class="rounded-2xl p-3" style="${cardStyle(medDone)}">
            <div class="font-black text-lg" style="color:#fca5a5;">🪼 Méduses</div>
            <div class="text-[11px] mb-2" style="color:#a7f3d0;">1 méduse = +5″</div>
            <div class="flex items-center justify-center gap-2">
                <button onclick="window.kohLantaAdjustMeduses(-1)"
                        class="w-14 h-14 rounded-xl text-3xl font-black text-white active:scale-95 touch-manipulation"
                        style="background:#475569;">−</button>
                <span class="text-4xl font-black w-16 text-center" style="color:#fca5a5;">${attempt.meduses}</span>
                <button onclick="window.kohLantaAdjustMeduses(1)"
                        class="w-14 h-14 rounded-xl text-3xl font-black text-white active:scale-95 touch-manipulation"
                        style="background:#475569;">+</button>
            </div>
            <div class="flex flex-wrap justify-center gap-0.5 min-h-6 mt-1">${jelly}</div>
            <div class="text-center text-sm font-bold" style="color:#facc15;">+${attempt.meduses * 5} s</div>
        </div>
    `;

    // ── Zone Tunnels ───────────────────────────
    const showRemontees = tunnelTypeTmp === 'sans-aide' || attempt.tunnelType === 'sans-aide';
    const cordeSelected = attempt.tunnelType === 'corde';
    const remonteesButtons = [
        { n: 0, c: 'rouge', label: '0' },
        { n: 1, c: 'rouge', label: '1' },
        { n: 2, c: 'orange', label: '2' },
        { n: 3, c: 'orange', label: '3' },
        { n: 4, c: 'vert', label: '4+' }
    ].map(r => {
        const sel = attempt.tunnelType === 'sans-aide' && attempt.remontees === r.n;
        const bg = { rouge: '#dc2626', orange: '#ea580c', vert: '#059669' }[r.c];
        return `
            <button onclick="window.kohLantaChoisirRemontees(${r.n})"
                    class="py-2 rounded-xl text-lg font-black text-white active:scale-95 touch-manipulation border-2"
                    style="background:${bg}; border-color:${sel ? '#facc15' : 'transparent'};">${r.label}</button>
        `;
    }).join('');

    let tunnelBody = `
        <div class="grid grid-cols-2 gap-2">
            <button onclick="window.kohLantaChoisirTunnel('corde')"
                    class="py-3 rounded-xl font-black text-base text-white active:scale-95 touch-manipulation border-2"
                    style="background:#059669; border-color:${cordeSelected ? '#facc15' : 'transparent'};">🪢 CORDE</button>
            <button onclick="window.kohLantaChoisirTunnel('sans-aide')"
                    class="py-3 rounded-xl font-black text-base text-white active:scale-95 touch-manipulation border-2"
                    style="background:#ea580c; border-color:${showRemontees && !cordeSelected ? '#facc15' : 'transparent'};">🫧 SANS AIDE</button>
        </div>
    `;
    if (showRemontees) {
        tunnelBody += `
            <div class="text-[11px] mt-2 mb-1" style="color:#a7f3d0;">Remontées :</div>
            <div class="grid grid-cols-5 gap-1">${remonteesButtons}</div>
        `;
    }
    const tunLabel = tunDone ? getTunnelInfos(attempt.tunnelType, attempt.remontees).label : 'à choisir';
    const tunnelsZone = `
        <div class="rounded-2xl p-3" style="${cardStyle(tunDone)}">
            <div class="font-black text-lg" style="color:#a7f3d0;">🌀 Tunnels</div>
            <div class="text-[11px] mb-2" style="color:#6ee7b7;">${tunDone ? '✓ ' + tunLabel : tunLabel}</div>
            ${tunnelBody}
        </div>
    `;

    // ── Zone Remorquage ───────────────────────
    const remOptions = [
        { c: 'vert', emoji: '⭕', label: 'Cerceau', bonus: REMORQUAGE_BONUS.vert, bg: '#059669' },
        { c: 'orange', emoji: '🛟', label: 'Mannequin', bonus: REMORQUAGE_BONUS.orange, bg: '#ea580c' },
        { c: 'rouge', emoji: '🌊', label: 'Mannequin + clapot', bonus: REMORQUAGE_BONUS.rouge, bg: '#dc2626' }
    ].map(o => {
        const sel = attempt.remorquage === o.c;
        return `
            <button onclick="window.kohLantaChoisirRemorquage('${o.c}')"
                    class="py-2 rounded-xl font-black text-sm text-white active:scale-95 touch-manipulation border-2"
                    style="background:${o.bg}; border-color:${sel ? '#facc15' : 'transparent'};">
                ${o.emoji} ${o.label}<br><span class="text-xs font-bold">−${o.bonus} s</span>
            </button>
        `;
    }).join('');
    const remorquageZone = `
        <div class="rounded-2xl p-3" style="${cardStyle(remDone)}">
            <div class="font-black text-lg" style="color:#a7f3d0;">🛟 Remorquage</div>
            <div class="text-[11px] mb-2" style="color:#6ee7b7;">${remDone ? '✓ ' + getRemorquageInfos(attempt.remorquage).label : 'à choisir'}</div>
            <div class="grid grid-cols-1 gap-2">${remOptions}</div>
        </div>
    `;

    // ── Chrono central + actions ─────────────
    let chronoControls = '';
    if (running) {
        chronoControls = `
            <button onclick="window.kohLantaArreter()"
                    class="w-full py-6 rounded-2xl font-black text-3xl text-white active:scale-95 touch-manipulation"
                    style="background:#dc2626;">⏹ ARRIVÉE</button>
            <p class="text-center text-xs font-bold mt-1" style="color:#6ee7b7;">Le chrono tourne — les zones restent modifiables.</p>
        `;
    } else if (!attempt.tempsMs) {
        chronoControls = `
            <button onclick="window.kohLantaDemarrer()"
                    class="w-full py-6 rounded-2xl font-black text-3xl text-white active:scale-95 touch-manipulation"
                    style="background:#059669;">▶ TOP DÉPART</button>
        `;
    } else {
        chronoControls = `
            <button onclick="window.kohLantaValiderScore()"
                    class="w-full py-5 rounded-2xl font-black text-2xl text-white active:scale-95 touch-manipulation"
                    style="background:#059669;">✅ VALIDER LE SCORE</button>
            <div class="flex gap-2 mt-2">
                <button onclick="window.kohLantaReprendre()"
                        class="flex-1 py-3 rounded-xl font-black text-base text-white active:scale-95 touch-manipulation"
                        style="background:#2563eb;">▶ Reprendre</button>
                <button onclick="window.kohLantaRecommencer()"
                        class="flex-1 py-3 rounded-xl font-black text-base text-white active:scale-95 touch-manipulation"
                        style="background:#475569;">↺ Refaire</button>
            </div>
        `;
    }

    return `
        <div class="flex-1 flex flex-col w-full max-w-4xl mx-auto">
            <div class="flex items-center justify-center gap-4 mb-2">
                <span class="text-xl font-black" style="color:#6ee7b7;">N°</span>
                <span class="text-5xl font-black" style="color:#facc15;">${currentNumero}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                ${nafZone}
                ${medusesZone}
            </div>

            <div class="rounded-2xl p-3 mb-3" style="background:#022c22; border:2px solid #facc15; text-align:center;">
                <div id="kl-course-chrono" class="text-5xl md:text-6xl font-black tabular-nums" style="color:#facc15;">${timeStr}</div>
                <div class="mt-2">${chronoControls}</div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                ${tunnelsZone}
                ${remorquageZone}
            </div>

            <button onclick="window.kohLantaRetourListe()"
                    class="w-full py-4 rounded-2xl font-black text-lg text-white active:scale-95 touch-manipulation"
                    style="background:#164e63;">← Retour à la liste</button>
        </div>
    `;
}

// --- CONFIRMATION ---
function renderConfirmation() {
    const tunnel = getTunnelInfos(attempt.tunnelType, attempt.remontees);
    const remorquage = getRemorquageInfos(attempt.remorquage);
    const score = calculScoreKohLanta(attempt);

    const meilleur = historiqueEssais.length > 0
        ? Math.min(...historiqueEssais.map(e => calculScoreKohLanta(e)))
        : null;

    const t = attempt.tempsMs ? (attempt.tempsMs / 1000).toFixed(1) : '--';

    return `
        <div class="flex-1 flex flex-col items-center justify-center">
            <div class="w-full max-w-2xl rounded-3xl p-6 md:p-8" style="background:#022c22; border:2px solid #065f46;">
                <div class="flex items-center justify-center gap-6 mb-4">
                    <span class="text-2xl md:text-3xl font-black" style="color:#6ee7b7;">N°</span>
                    <span class="text-6xl md:text-8xl font-black" style="color:#facc15;">${currentNumero}</span>
                </div>

                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div class="rounded-2xl p-3 text-center" style="background:#064e3b;">
                        <p class="text-xs" style="color:#a7f3d0;">⏱️ Temps</p>
                        <p class="text-2xl font-black" style="color:#facc15;">${t} s</p>
                    </div>
                    <div class="rounded-2xl p-3 text-center" style="background:#064e3b;">
                        <p class="text-xs" style="color:#a7f3d0;">🍽️ Coups NAF</p>
                        <p class="text-2xl font-black" style="color:#facc15;">${attempt.coups}</p>
                    </div>
                    <div class="rounded-2xl p-3 text-center" style="background:#064e3b;">
                        <p class="text-xs" style="color:#a7f3d0;">🪼 Méduses</p>
                        <p class="text-2xl font-black" style="color:#fca5a5;">${attempt.meduses} (+${attempt.meduses * 5}s)</p>
                    </div>
                    <div class="rounded-2xl p-3 text-center" style="background:#064e3b;">
                        <p class="text-xs" style="color:#a7f3d0;">🌀 Tunnel</p>
                        <p class="text-lg font-black" style="color:#a7f3d0;">${tunnel.label}</p>
                        <p class="text-sm font-bold" style="color:#facc15;">−${tunnel.bonus} s</p>
                    </div>
                </div>

                <div class="rounded-2xl p-3 text-center mb-3" style="background:#064e3b;">
                    <p class="text-xs" style="color:#a7f3d0;">🛟 Remorquage</p>
                    <p class="text-lg font-black" style="color:#a7f3d0;">${remorquage.label}</p>
                    <p class="text-sm font-bold" style="color:#facc15;">−${remorquage.bonus} s</p>
                </div>

                <div class="rounded-2xl p-4 text-center mb-4" style="background:#022c22; border:2px solid #facc15;">
                    <p class="text-sm" style="color:#a7f3d0;">Score final (le plus bas gagne)</p>
                    <p class="text-6xl md:text-7xl font-black" style="color:#facc15;">${formatScoreKohLanta(score)}</p>
                    ${meilleur !== null ? `<p class="text-sm font-bold mt-1" style="color:#6ee7b7;">🥇 Meilleur score : ${formatScoreKohLanta(meilleur)}</p>` : ''}
                </div>

                <div class="flex flex-col gap-4">
                    <button onclick="window.kohLantaEnregistrer()"
                            class="w-full py-6 rounded-2xl font-black text-2xl text-white active:scale-95 transition-all"
                            style="background:#059669;">💾 ENREGISTRER L'ESSAI</button>
                    <button onclick="window.kohLantaRetourConfirmation()"
                            class="w-full py-4 rounded-2xl font-black text-lg text-white active:scale-95 transition-all"
                            style="background:#164e63;">← Retour à la course</button>
                    <button onclick="window.retourMenuNatationKohLanta()"
                            class="w-full py-4 rounded-2xl font-black text-lg text-white active:scale-95 transition-all"
                            style="background:#475569;">← Retour liste</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// ENREGISTREMENT FIREBASE
// ============================================================
function enregistrerAttempt() {
    if (isSaving) return;
    isSaving = true;

    const numero = currentNumero;
    const score = calculScoreKohLanta(attempt);
    const nouvelEssai = {
        tempsMs: attempt.tempsMs,
        coups: attempt.coups,
        meduses: attempt.meduses,
        tunnelType: attempt.tunnelType,
        remontees: attempt.remontees ?? null,
        remorquage: attempt.remorquage,
        score: Math.round(score * 100) / 100,
        timestamp: Date.now()
    };

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const historiqueRef = ref(db, `${getEtab()}/profs/${profCode}/${currentClasse}/natation-koh-lanta/historique/${numero}`);

    onValue(historiqueRef, (snap) => {
        let historique = snap.val() || [];
        if (!Array.isArray(historique)) historique = [];

        historique = historique.filter(h => !(
            Math.abs(h.tempsMs - nouvelEssai.tempsMs) < 1 &&
            h.coups === nouvelEssai.coups &&
            h.meduses === nouvelEssai.meduses
        ));

        historique.push(nouvelEssai);
        if (historique.length > 20) historique.shift();

        set(historiqueRef, historique).then(() => {
            isSaving = false;
            historiqueEssais = historique;
            afficherFeedbackSauvegarde(numero, score);
        }).catch(err => {
            console.error('Erreur sauvegarde Koh Lanta :', err);
            alert('❌ Erreur lors de la sauvegarde.');
            isSaving = false;
        });
    }, { onlyOnce: true });
}

function afficherFeedbackSauvegarde(numero, score) {
    const container = document.getElementById('natation-module');
    if (!container) return;
    const meilleur = Math.min(...historiqueEssais.map(e => calculScoreKohLanta(e)));

    container.innerHTML = `
        <div class="w-full min-h-screen" style="background: linear-gradient(180deg, #052e2b 0%, #064e3b 100%); color:#eafff7; padding:16px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div class="w-full max-w-2xl rounded-3xl p-6 md:p-8 text-center" style="background:#022c22; border:2px solid #facc15;">
                <div class="text-7xl mb-4">🏆</div>
                <h2 class="text-3xl md:text-4xl font-black mb-4" style="color:#facc15;">Essai enregistré !</h2>
                <p class="text-xl mb-2" style="color:#eafff7;">Nageur N° ${numero}</p>
                <div class="rounded-2xl p-4 mb-6" style="background:#064e3b;">
                    <p class="text-xs" style="color:#a7f3d0;">Score final</p>
                    <p class="text-6xl font-black" style="color:#facc15;">${formatScoreKohLanta(score)}</p>
                    <p class="text-lg font-bold mt-1" style="color:#6ee7b7;">🥇 Meilleur : ${formatScoreKohLanta(meilleur)}</p>
                </div>
                <div class="flex flex-col gap-4">
                    <button onclick="window.kohLantaNouvelEssai()"
                            class="w-full py-6 rounded-2xl font-black text-2xl text-white active:scale-95 transition-all"
                            style="background:#2563eb;">🔄 NOUVEL ESSAI</button>
                    <button onclick="window.kohLantaChangerEleve()"
                            class="w-full py-6 rounded-2xl font-black text-2xl text-white active:scale-95 transition-all"
                            style="background:#059669;">👤 CHANGER DE NAGEUR</button>
                    <button onclick="window.retourMenuNatationKohLanta()"
                            class="w-full py-4 rounded-2xl font-black text-lg text-white active:scale-95 transition-all"
                            style="background:#475569;">← Retour menu</button>
                </div>
            </div>
        </div>
    `;
}