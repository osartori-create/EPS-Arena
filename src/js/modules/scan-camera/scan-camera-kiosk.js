// src/js/modules/scan-camera/scan-camera-kiosk.js
// Kiosk élève : scanne les marqueurs ArUco en direct via la caméra.
// URL : eleve.html?mode=scan-camera&prof=XXX&session=YYY
// RGPD : n'envoie sur Firebase que { markerId, response, ... } (anonyme).

import { db, ref, push, onValue } from '../../core/firebase-service.js';
import {
    decodeMarkerOrientation, orientationToResponse, buildFirebaseResponse, DEFAULT_RESPONSES
} from './scan-camera-core.js';
import { getSessionConfigPath, getResponsesPath } from './scan-camera-config.js';

const CONFIDENCE_THRESHOLD = 3;   // frames consécutives identiques avant validation
const EMIT_COOLDOWN_MS = 1500;    // délai minimal entre deux envois d'un même marqueur
const MAX_FRAME_WIDTH = 480;      // largeur max de la trame analysée (performance)

let profCode = 'DEFAULT';
let sessionId = 'default';
let config = { question: '', responses: DEFAULT_RESPONSES, active: false };
let detector = null;
let stream = null;
let video = null;
let canvas = null;
let ctx = null;
let running = false;
let rafId = null;
let unsubConfig = null;
let confidence = {};  // { markerId: { orientation, count } }
let lastEmit = {};    // { markerId: { response, ts } }

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initScanCameraKiosk(mode, params) {
    profCode = params.get('prof') || localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    sessionId = params.get('session') || 'default';

    masquerChromeEleve();
    elargirConteneur();
    buildUI();
    ecouterConfig();
    demarrerCamera();
}

// ============================================================
// MASQUAGE DU CHROME ÉLÈVE
// ============================================================
function masquerChromeEleve() {
    ['waiting-screen', 'login-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // En-tête (code prof + sélecteur de classe).
    const profInput = document.getElementById('profCodeInput');
    if (profInput && profInput.parentElement && profInput.parentElement.parentElement) {
        profInput.parentElement.parentElement.style.display = 'none';
    }

    ['code-info', 'btn-quit', 'btn-back-terrain'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

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

function elargirConteneur() {
    const main = document.getElementById('main-container');
    if (main) {
        main.classList.remove('max-w-md');
        main.classList.add('max-w-full', 'w-full');
    }
    const activity = document.getElementById('activity-screen');
    if (activity) {
        activity.classList.remove('hidden');
        activity.classList.add('max-w-full', 'w-full');
    }
}

// ============================================================
// INTERFACE
// ============================================================
function buildUI() {
    const activity = document.getElementById('activity-screen');
    if (!activity) return;

    let container = document.getElementById('scancam-kiosk-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'scancam-kiosk-container';
        container.className = 'w-full space-y-4';
        activity.appendChild(container);
    }

    container.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <h2 id="scancam-kiosk-question" class="text-xl font-black text-slate-800">En attente de la question…</h2>
            <span id="scancam-kiosk-statut" class="text-xs font-bold uppercase text-slate-500 whitespace-nowrap">⏳ Initialisation</span>
        </div>
        <div class="relative bg-black rounded-2xl overflow-hidden">
            <canvas id="scancam-video" class="w-full h-auto block"></canvas>
            <div id="scancam-kiosk-error" class="hidden absolute inset-0 flex items-center justify-center p-6 bg-slate-900 text-center"></div>
        </div>
        <div id="scancam-kiosk-last" class="text-center text-2xl font-black text-emerald-600 py-2">—</div>
        <p class="text-[10px] text-slate-400 text-center">Tiens ta carte face à la caméra, la lettre choisie vers le haut.</p>
    `;

    video = document.createElement('video');
    video.autoplay = true;
    video.playsinline = true;
    video.muted = true;
    video.style.display = 'none';
    document.body.appendChild(video);

    canvas = document.getElementById('scancam-video');
    ctx = canvas.getContext('2d');
}

// ============================================================
// CONFIGURATION (Firebase)
// ============================================================
function ecouterConfig() {
    unsubConfig = onValue(ref(db, getSessionConfigPath(sessionId)), (snap) => {
        config = snap.val() || {};
        if (!Array.isArray(config.responses) || config.responses.length !== 4) {
            config.responses = DEFAULT_RESPONSES;
        }
        majUI();
    });
}

function majUI() {
    const question = document.getElementById('scancam-kiosk-question');
    if (question) {
        question.textContent = config.question || 'En attente de la question…';
    }
    const statut = document.getElementById('scancam-kiosk-statut');
    if (statut && config.active === false) {
        statut.textContent = '⏹ Session terminée';
    }
}

// ============================================================
// CAMÉRA
// ============================================================
async function demarrerCamera() {
    if (!window.AR || !window.AR.Detector) {
        showError('Bibliothèque de détection non chargée.<br>Vérifie la présence de libs/cv.js et libs/aruco.js.');
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Caméra indisponible.<br>Ce kiosk nécessite une connexion HTTPS et un navigateur récent.');
        return;
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        });
        video.srcObject = stream;
        await video.play();

        detector = new window.AR.Detector();
        running = true;

        const statut = document.getElementById('scancam-kiosk-statut');
        if (statut) statut.textContent = '🟢 En direct';

        loop();
    } catch (err) {
        console.error('[Scan Caméra] Erreur caméra :', err);
        if (err && err.name === 'NotAllowedError') {
            showError(`Tu as refusé l'accès à la caméra.<br>Autorise la caméra dans les réglages, puis recharge la page.`);
        } else {
            showError(`Caméra indisponible.<br>Vérifie qu'aucune autre app ne l'utilise, puis recharge la page.`);
        }
    }
}

// ============================================================
// BOUCLE DE DÉTECTION
// ============================================================
function loop() {
    if (!running) return;

    if (video.readyState >= video.HAVE_ENOUGH_DATA && ctx && detector) {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        const scale = Math.min(1, MAX_FRAME_WIDTH / w);
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);

        if (canvas.width !== cw) canvas.width = cw;
        if (canvas.height !== ch) canvas.height = ch;

        ctx.drawImage(video, 0, 0, cw, ch);
        const imageData = ctx.getImageData(0, 0, cw, ch);
        const markers = detector.detect(imageData);

        processMarkers(markers);
    }

    rafId = requestAnimationFrame(loop);
}

function processMarkers(markers) {
    const decoded = (markers || [])
        .map(m => ({
            markerId: m.id,
            orientation: decodeMarkerOrientation(m.corners),
            corners: m.corners
        }))
        .filter(d => d.orientation >= 0);

    const vus = new Set();
    decoded.forEach(d => {
        vus.add(d.markerId);

        const prev = confidence[d.markerId];
        if (prev && prev.orientation === d.orientation) {
            prev.count++;
        } else {
            confidence[d.markerId] = { orientation: d.orientation, count: 1 };
        }

        if (confidence[d.markerId].count >= CONFIDENCE_THRESHOLD) {
            emettre(d.markerId, d.orientation);
        }
    });

    Object.keys(confidence).forEach(id => {
        if (!vus.has(Number(id))) delete confidence[id];
    });

    dessinerOverlay(decoded);
}

function emettre(markerId, orientation) {
    if (config.active === false) return; // session arrêtée : on n'envoie plus rien
    const response = orientationToResponse(orientation, config.responses);
    if (!response) return;

    const key = String(markerId);
    const now = Date.now();
    const prev = lastEmit[key];
    if (prev && prev.response === response && (now - prev.ts) < EMIT_COOLDOWN_MS) {
        return;
    }
    lastEmit[key] = { response, ts: now };

    push(ref(db, getResponsesPath(sessionId)), buildFirebaseResponse({ markerId, response, sessionId }))
        .catch(err => console.error('[Scan Caméra] Envoi Firebase impossible :', err));

    const el = document.getElementById('scancam-kiosk-last');
    if (el) el.textContent = `N° ${markerId} → ${response}`;
}

function dessinerOverlay(decoded) {
    if (!ctx) return;
    decoded.forEach(d => {
        const c = d.corners;
        if (!c || c.length < 4) return;

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c[0].x, c[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y);
        ctx.closePath();
        ctx.stroke();

        const response = orientationToResponse(d.orientation, config.responses);
        if (response) {
            const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4;
            const cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(response, cx, cy);
        }
    });
}

function showError(html) {
    const zone = document.getElementById('scancam-kiosk-error');
    if (zone) {
        zone.innerHTML = `<p class="text-slate-200 text-sm font-bold">${html}</p>`;
        zone.classList.remove('hidden');
    }
    const statut = document.getElementById('scancam-kiosk-statut');
    if (statut) statut.textContent = '❌ Caméra indisponible';
}

// ============================================================
// NETTOYAGE
// ============================================================
export function cleanupScanCameraKiosk() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (unsubConfig) unsubConfig();

    if (video) video.remove();

    const container = document.getElementById('scancam-kiosk-container');
    if (container) container.remove();
}
