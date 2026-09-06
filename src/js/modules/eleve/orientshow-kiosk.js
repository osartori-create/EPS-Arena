// src/js/modules/eleve/orientshow-kiosk.js
// Kiosk OrientShow – version élève (inspirée de vos fichiers originaux)
// Architecture Firebase EPS‑Arena : orientshow/config + orientshow/passages

import { db, ref, onValue, push } from '../../core/firebase-service.js';

let currentClasse = '';
let currentCode = '';          // ex: "NOIR_1"
let matrix = {};
let startTime = null;
let endTime = null;
let sessions = {};             // Validations déjà faites par l'élève
let configListener = null;
let sessionsListener = null;
let audioCtx = null;

// État local
let selectedCircuit = null;
let lastSend = 0;
const COOLDOWN = 30000;        // 30s entre deux validations

// ============================================================
// INITIALISATION
// ============================================================
export function initOrientShowKiosk(classe, code, config) {
    currentClasse = classe;
    currentCode = code;

    // 1. Écouter la configuration (matrix, startTime, endTime)
    if (configListener) {
        configListener.off();
        configListener = null;
    }
    const configRef = ref(db, `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}/${classe}/orientshow/config`);
    configListener = onValue(configRef, (snap) => {
        const data = snap.val() || {};
        matrix = data.matrix || {};
        startTime = data.startTime || null;
        endTime = data.endTime || null;
        // Si la config est chargée, on charge les sessions
        if (Object.keys(matrix).length > 0) {
            chargerSessions();
        } else {
            // Attendre la config
            const container = document.getElementById('os-kiosk-container');
            if (container) {
                container.innerHTML = '<div class="text-center py-10 text-slate-400"><p>⏳ En attente de la configuration du professeur...</p></div>';
            }
        }
    });

    // 2. Si une config est passée en paramètre (fallback), on l'utilise directement
    if (config && config.matrix) {
        matrix = config.matrix || {};
        startTime = config.startTime || null;
        endTime = config.endTime || null;
        if (Object.keys(matrix).length > 0) {
            chargerSessions();
        }
    }

    // 3. Initialiser l'audio (au premier clic)
    document.addEventListener('click', initAudio, { once: true });
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTone(freq, duration, type = 'sine') {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* ignorer les erreurs audio */ }
}

// ============================================================
// CHARGEMENT DES SESSIONS (validations de l'élève)
// ============================================================
function chargerSessions() {
    if (sessionsListener) {
        sessionsListener.off();
        sessionsListener = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/orientshow/passages`;
    const sessionsRef = ref(db, path);
    sessionsListener = onValue(sessionsRef, (snap) => {
        const data = snap.val() || {};
        // Filtrer les validations de cet élève
        sessions = {};
        Object.keys(data).forEach(key => {
            const passage = data[key];
            if (passage.code === currentCode) {
                sessions[key] = passage;
            }
        });
        afficherInterface();
    });
}

// ============================================================
// AFFICHAGE DE L'INTERFACE
// ============================================================
function afficherInterface() {
    const container = document.getElementById('os-kiosk-container');
    if (!container) {
        console.warn('Conteneur os-kiosk-container introuvable');
        return;
    }

    // Vérifier si la course est active (startTime présent et endTime absent)
    const isActive = startTime && !endTime;

    // Calculer le total des points
    let totalPoints = 0;
    const validations = {};
    for (let i = 1; i <= 12; i++) {
        const circuit = `C${i}`;
        const found = Object.values(sessions).find(s => s.circuit === i);
        if (found) {
            totalPoints += found.score || 0;
            validations[i] = found;
        } else {
            validations[i] = null;
        }
    }

    // Récupérer la couleur et le numéro
    const [color, num] = currentCode.split('_');
    const colorClasses = {
        NOIR: 'bg-black text-white border-slate-600',
        ROUGE: 'bg-red-600 text-white border-red-900',
        BLEU: 'bg-blue-600 text-white border-blue-900',
        VERT: 'bg-green-600 text-white border-green-900',
        JAUNE: 'bg-yellow-500 text-black border-yellow-700'
    };
    const bgColor = colorClasses[color] || 'bg-slate-700 text-white border-slate-600';

    // État de la course
    let statusHtml = '';
    if (!startTime) {
        statusHtml = '<div class="text-center text-slate-400 text-sm mb-4">⏳ En attente du départ du professeur...</div>';
    } else if (endTime) {
        statusHtml = '<div class="text-center text-red-400 text-sm mb-4">⏱️ La course est terminée.</div>';
    } else {
        statusHtml = '<div class="text-center text-emerald-400 text-sm mb-4">🏃 Course en cours !</div>';
    }

    // Construction du HTML
    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-14 h-14 rounded-full border-2 flex items-center justify-center text-3xl font-black ${bgColor}">
                        ${num}
                    </div>
                    <div>
                        <div class="text-xs font-bold text-slate-400 uppercase">${color}</div>
                        <div class="text-xl font-black text-white">${currentCode}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xs text-slate-400 uppercase font-bold">Score</div>
                    <div class="text-3xl font-black text-yellow-400">${totalPoints}</div>
                </div>
            </div>
        </div>

        ${statusHtml}

        <div class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
    `;

    for (let i = 1; i <= 12; i++) {
        const val = validations[i];
        let statusClass = 'bg-slate-700 hover:bg-slate-600';
        let statusText = `C${i}`;
        let disabled = '';
        let onclick = `onclick="window.selectCircuit(${i})"`;

        if (val) {
            const pts = val.score || 0;
            if (pts >= 5) {
                statusClass = 'bg-emerald-600 border-emerald-400';
                statusText = `C${i} ✅`;
                disabled = 'opacity-60 cursor-default';
                onclick = '';
            } else if (pts >= 2) {
                statusClass = 'bg-orange-500 border-orange-400';
                statusText = `C${i} 🆗`;
                disabled = 'opacity-60 cursor-default';
                onclick = '';
            } else {
                statusClass = 'bg-red-600 border-red-400';
                statusText = `C${i} ❌`;
                disabled = 'opacity-60 cursor-default';
                onclick = '';
            }
        }

        html += `
            <button id="btnCircuit${i}" 
                    class="circuit-btn ${statusClass} rounded-xl p-4 font-black text-white text-lg border-2 ${!disabled ? 'border-slate-600 hover:scale-105' : 'border-slate-500'} transition-all active:scale-95 ${disabled}"
                    data-circuit="${i}"
                    ${onclick ? `onclick="${onclick}"` : 'disabled'}>
                ${statusText}
            </button>
        `;
    }

    html += `
        </div>

        <!-- Zone de saisie -->
        <div id="saisieZone" class="hidden bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="text-center mb-3">
                <span class="text-sm text-slate-400">Circuit sélectionné :</span>
                <span id="selectedCircuitLabel" class="text-2xl font-black text-white ml-2"></span>
            </div>
            <div class="flex justify-center items-center gap-6 mb-4">
                <input type="text" id="l1" class="input-box w-16 h-16 text-center text-4xl font-black uppercase bg-slate-900 border-2 border-slate-600 rounded-xl outline-none focus:border-blue-500 text-white" maxlength="1" oninput="this.value=this.value.toUpperCase(); if(this.value) document.getElementById('l2').focus()">
                <input type="text" id="l2" class="input-box w-16 h-16 text-center text-4xl font-black uppercase bg-slate-900 border-2 border-slate-600 rounded-xl outline-none focus:border-blue-500 text-white" maxlength="1" oninput="this.value=this.value.toUpperCase()">
            </div>
            <div class="flex gap-4">
                <button onclick="window.annulerSaisie()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white active:scale-95">Annuler</button>
                <button onclick="window.validerCircuit()" class="flex-1 bg-blue-600 py-3 rounded-xl font-black text-white active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.4)]">Valider</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Exposer les fonctions globalement
    window.selectCircuit = selectCircuit;
    window.annulerSaisie = annulerSaisie;
    window.validerCircuit = validerCircuit;
}

// ============================================================
// SÉLECTION D'UN CIRCUIT
// ============================================================
function selectCircuit(circuitId) {
    // Vérifier si déjà validé
    const found = Object.values(sessions).find(s => s.circuit === circuitId);
    if (found) {
        alert('Ce circuit a déjà été validé.');
        return;
    }

    // Vérifier que la course est active
    if (!startTime || endTime) {
        alert('La course n\'est pas active.');
        return;
    }

    selectedCircuit = circuitId;
    document.getElementById('selectedCircuitLabel').innerText = `C${circuitId}`;
    document.getElementById('saisieZone').classList.remove('hidden');
    document.getElementById('l1').value = '';
    document.getElementById('l2').value = '';
    setTimeout(() => document.getElementById('l1').focus(), 100);
}

function annulerSaisie() {
    selectedCircuit = null;
    document.getElementById('saisieZone').classList.add('hidden');
    document.getElementById('l1').value = '';
    document.getElementById('l2').value = '';
}

// ============================================================
// VALIDATION D'UN CIRCUIT
// ============================================================
function validerCircuit() {
    if (!selectedCircuit) {
        alert('Sélectionnez d\'abord un circuit.');
        return;
    }

    // Vérifier si déjà validé (sécurité)
    const found = Object.values(sessions).find(s => s.circuit === selectedCircuit);
    if (found) {
        alert('Ce circuit a déjà été validé.');
        annulerSaisie();
        return;
    }

    // Vérifier la course
    if (!startTime || endTime) {
        alert('La course n\'est pas active.');
        annulerSaisie();
        return;
    }

    const l1 = document.getElementById('l1').value.toUpperCase();
    const l2 = document.getElementById('l2').value.toUpperCase();
    if (!l1 && !l2) {
        alert('Saisissez au moins une lettre.');
        return;
    }

    // Anti‑triche : cooldown
    const now = Date.now();
    if (now - lastSend < COOLDOWN) {
        const wait = Math.ceil((COOLDOWN - (now - lastSend)) / 1000);
        alert(`⏳ Trop rapide ! Attends encore ${wait}s.`);
        return;
    }

    // Récupérer la couleur
    const [color] = currentCode.split('_');

    // Calcul du score avec la matrice
    const codeVerite = matrix[selectedCircuit]?.[color] || [];
    let pts = 0;
    let truth = [...codeVerite];

    if (l1 !== '') {
        const idx1 = truth.indexOf(l1);
        if (idx1 !== -1) { pts += 2.5; truth.splice(idx1, 1); }
    }
    if (l2 !== '') {
        const idx2 = truth.indexOf(l2);
        if (idx2 !== -1) { pts += 2.5; truth.splice(idx2, 1); }
    }
    pts = Math.floor(pts === 5 ? 5 : (pts > 0 ? 2 : 0));

    // Son de feedback
    if (pts === 5) playTone(880, 0.3, 'sine');
    else if (pts === 2) playTone(440, 0.2, 'sine');
    else playTone(150, 0.4, 'sawtooth');

    // Enregistrer dans Firebase
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const passagesRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/orientshow/passages`);

    const passageData = {
        code: currentCode,
        circuit: selectedCircuit,
        lettres: [l1, l2],
        score: pts,
        timestamp: now
    };

    push(passagesRef, passageData)
        .then(() => {
            lastSend = now;
            afficherFeedback(pts);
            annulerSaisie();
        })
        .catch(err => {
            console.error('Erreur enregistrement :', err);
            alert('Erreur lors de la validation. Réessayez.');
        });
}

// ============================================================
// FEEDBACK
// ============================================================
function afficherFeedback(pts) {
    // Récupérer le score total actuel
    let total = 0;
    Object.values(sessions).forEach(s => { total += s.score || 0; });
    total += pts;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-8 text-center transition-all';

    const icon = pts === 5 ? '🏆' : (pts === 2 ? '🆗' : '❌');
    const bgColor = pts === 5 ? '#065f46' : (pts === 2 ? '#9a3412' : '#991b1b');

    overlay.innerHTML = `
        <div class="text-8xl mb-4">${icon}</div>
        <div class="text-5xl font-black text-white mb-2">+${pts} PTS</div>
        <div class="text-xl font-bold text-yellow-400 mb-8">TOTAL : ${total} PTS</div>
        <button onclick="this.parentElement.remove()" class="px-12 py-4 bg-white/10 border-2 border-white rounded-2xl text-white font-black text-xl active:scale-95 transition-transform">
            SUIVANT ➔
        </button>
    `;
    document.body.appendChild(overlay);
}

// ============================================================
// NETTOYAGE
// ============================================================
export function cleanupOrientShowKiosk() {
    if (configListener) {
        configListener.off();
        configListener = null;
    }
    if (sessionsListener) {
        sessionsListener.off();
        sessionsListener = null;
    }
}