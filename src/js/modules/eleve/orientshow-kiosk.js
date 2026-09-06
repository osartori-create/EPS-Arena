// src/js/modules/eleve/orientshow-kiosk.js
// Kiosk OrientShow (version élève) – inspiré de vos fichiers originaux

import { db, ref, onValue, push, set, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentCode = '';          // ex: "NOIR_1"
let currentEleveId = '';      // ex: "NOIR_1" (ou un ID unique)
let matrix = {};
let sessions = {};
let listener = null;
let audioCtx = null;

// État local
let selectedCircuit = null;
let antiCheat = {};

// ============================================================
// INITIALISATION
// ============================================================
export function initOrientShowKiosk(classe, code) {
    currentClasse = classe;
    currentCode = code;
    currentEleveId = code; // On utilise le code comme identifiant unique (NOIR_1)

    // 1. Récupérer la matrice des codes
    const matrixRef = ref(db, 'settings/matrix');
    onValue(matrixRef, (snap) => {
        matrix = snap.val() || {};
        // Si la matrice est vide, on utilise une matrice par défaut
        if (Object.keys(matrix).length === 0) {
            matrix = getDefaultMatrix();
        }
        // Une fois la matrice chargée, on peut afficher l'interface
        chargerSessions();
    });

    // 2. Initialiser l'audio (au premier clic)
    document.addEventListener('click', initAudio, { once: true });
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTone(freq, duration, type = 'sine') {
    if (!audioCtx) return;
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
}

// ============================================================
// CHARGEMENT DES SESSIONS (validations)
// ============================================================
function chargerSessions() {
    // Nettoyer l'ancien listener
    if (listener) {
        listener.off();
        listener = null;
    }

    const sessionsRef = ref(db, `sessions/${currentClasse}/${currentEleveId}`);
    listener = onValue(sessionsRef, (snap) => {
        sessions = snap.val() || {};
        afficherInterface();
    });
}

// ============================================================
// AFFICHAGE DE L'INTERFACE
// ============================================================
function afficherInterface() {
    const container = document.getElementById('os-kiosk-container');
    if (!container) {
        console.error('Conteneur os-kiosk-container introuvable');
        return;
    }

    // On calcule le total des points
    let totalPoints = 0;
    const validations = {};
    for (let i = 1; i <= 12; i++) {
        const key = `C${i}`;
        if (sessions[key]) {
            totalPoints += sessions[key].score || 0;
            validations[i] = sessions[key];
        } else {
            validations[i] = null;
        }
    }

    // Récupérer la couleur et le numéro pour l'affichage
    const [color, num] = currentCode.split('_');
    const colorClasses = {
        NOIR: 'bg-black text-white',
        ROUGE: 'bg-red-600 text-white',
        BLEU: 'bg-blue-600 text-white',
        VERT: 'bg-green-600 text-white',
        JAUNE: 'bg-yellow-500 text-black'
    };
    const bgColor = colorClasses[color] || 'bg-slate-700 text-white';

    // Construction du HTML
    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-2xl font-black ${bgColor}">
                        ${num}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-slate-400">${color}</div>
                        <div class="text-xl font-black text-white">${currentCode}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xs text-slate-400">Score</div>
                    <div class="text-3xl font-black text-emerald-400">${totalPoints} pts</div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-3 mb-4">
    `;

    for (let i = 1; i <= 12; i++) {
        const val = validations[i];
        let statusClass = 'bg-slate-700 hover:bg-slate-600';
        let statusText = `C${i}`;
        let disabled = '';
        let onclick = `onclick="window.selectCircuit(${i})"`;

        if (val) {
            const pts = val.score || 0;
            if (pts === 5) {
                statusClass = 'bg-emerald-600 hover:bg-emerald-700';
                statusText = `C${i} ✅`;
                disabled = 'opacity-70 cursor-default';
                onclick = ''; // pas de clic
            } else if (pts === 2) {
                statusClass = 'bg-orange-500 hover:bg-orange-600';
                statusText = `C${i} 🆗`;
                disabled = 'opacity-70 cursor-default';
                onclick = '';
            } else {
                statusClass = 'bg-red-600 hover:bg-red-700';
                statusText = `C${i} ❌`;
                disabled = 'opacity-70 cursor-default';
                onclick = '';
            }
        }

        html += `
            <button id="btnCircuit${i}" 
                    class="circuit-btn ${statusClass} rounded-xl p-4 font-black text-white text-xl border-2 border-slate-600 ${disabled} transition-all active:scale-95"
                    ${onclick ? `onclick="${onclick}"` : 'disabled'}
                    data-circuit="${i}">
                ${statusText}
            </button>
        `;
    }

    html += `
        </div>

        <!-- Zone de saisie (visible uniquement si un circuit est sélectionné) -->
        <div id="saisieZone" class="hidden bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="text-center mb-4">
                <span class="text-sm text-slate-400">Circuit sélectionné :</span>
                <span id="selectedCircuitLabel" class="text-2xl font-black text-white ml-2"></span>
            </div>
            <div class="flex justify-center items-center gap-6 mb-4">
                <input type="text" id="l1" class="input-box w-16 h-16 text-center text-4xl font-black uppercase bg-slate-900 border-2 border-slate-600 rounded-xl outline-none focus:border-blue-500" maxlength="1" oninput="this.value=this.value.toUpperCase(); if(this.value) document.getElementById('l2').focus()">
                <input type="text" id="l2" class="input-box w-16 h-16 text-center text-4xl font-black uppercase bg-slate-900 border-2 border-slate-600 rounded-xl outline-none focus:border-blue-500" maxlength="1" oninput="this.value=this.value.toUpperCase()">
            </div>
            <div class="flex gap-4">
                <button onclick="window.annulerSaisie()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white active:scale-95">Annuler</button>
                <button onclick="window.validerCircuit()" class="flex-1 bg-blue-600 py-3 rounded-xl font-black text-white active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.5)]">Valider</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Exposer les fonctions globalement pour les onclick
    window.selectCircuit = selectCircuit;
    window.annulerSaisie = annulerSaisie;
    window.validerCircuit = validerCircuit;
}

// ============================================================
// SÉLECTION D'UN CIRCUIT
// ============================================================
function selectCircuit(circuitId) {
    // Vérifier si déjà validé
    const key = `C${circuitId}`;
    if (sessions[key]) {
        alert('Ce circuit a déjà été validé.');
        return;
    }

    selectedCircuit = circuitId;
    document.getElementById('selectedCircuitLabel').innerText = `C${circuitId}`;
    document.getElementById('saisieZone').classList.remove('hidden');
    document.getElementById('l1').value = '';
    document.getElementById('l2').value = '';
    document.getElementById('l1').focus();
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
    const key = `C${selectedCircuit}`;
    if (sessions[key]) {
        alert('Ce circuit a déjà été validé.');
        annulerSaisie();
        return;
    }

    const l1 = document.getElementById('l1').value.toUpperCase();
    const l2 = document.getElementById('l2').value.toUpperCase();
    if (!l1 && !l2) {
        alert('Saisissez au moins une lettre.');
        return;
    }

    // Anti‑triche : 30s entre deux validations pour le même élève
    const now = Date.now();
    const diff = (now - (antiCheat[currentEleveId] || 0)) / 1000;
    if (diff < 30) {
        alert(`⏳ Trop rapide ! Attends encore ${Math.ceil(30 - diff)}s.`);
        return;
    }

    // Récupérer la couleur et la matrice
    const [color] = currentCode.split('_');
    const codeVerite = matrix[selectedCircuit]?.[color] || [];

    // Calcul du score (identique à vos fichiers)
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
    const sessionRef = ref(db, `sessions/${currentClasse}/${currentEleveId}/${key}`);
    set(sessionRef, { score: pts, realTime: Date.now() })
        .then(() => {
            antiCheat[currentEleveId] = Date.now();
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
    const container = document.getElementById('os-kiosk-container');
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-8 text-center transition-all';

    const icon = pts === 5 ? '🏆' : (pts === 2 ? '🆗' : '❌');
    const color = pts === 5 ? '#065f46' : (pts === 2 ? '#9a3412' : '#991b1b');
    overlay.style.backgroundColor = color;

    overlay.innerHTML = `
        <div class="text-8xl mb-4">${icon}</div>
        <div class="text-6xl font-black text-white mb-2">+${pts} PTS</div>
        <button onclick="this.parentElement.remove()" class="mt-8 px-12 py-4 bg-white/10 border-2 border-white rounded-2xl text-white font-black text-xl active:scale-95 transition-transform">
            SUIVANT ➔
        </button>
    `;
    document.body.appendChild(overlay);
}

// ============================================================
// MATRICE PAR DÉFAUT (si Firebase est vide)
// ============================================================
function getDefaultMatrix() {
    return {
        1: { NOIR: ['D','Q'], ROUGE: ['O','U'], BLEU: ['Y','A'], VERT: ['E','R'], JAUNE: ['N','K'] },
        2: { NOIR: ['E','X'], ROUGE: ['X','Y'], BLEU: ['T','L'], VERT: ['R','O'], JAUNE: ['A','L'] },
        3: { NOIR: ['C','L'], ROUGE: ['H','U'], BLEU: ['I','B'], VERT: ['O','I'], JAUNE: ['T','E'] },
        4: { NOIR: ['R','V'], ROUGE: ['E','E'], BLEU: ['C','R'], VERT: ['T','N'], JAUNE: ['O','I'] },
        5: { NOIR: ['A','B'], ROUGE: ['J','O'], BLEU: ['O','U'], VERT: ['N','E'], JAUNE: ['C','S'] },
        6: { NOIR: ['F','M'], ROUGE: ['I','E'], BLEU: ['C','R'], VERT: ['U','O'], JAUNE: ['S','U'] },
        7: { NOIR: ['G','H'], ROUGE: ['U','A'], BLEU: ['E','C'], VERT: ['U','H'], JAUNE: ['X','E'] },
        8: { NOIR: ['I','J'], ROUGE: ['V','E'], BLEU: ['R','A'], VERT: ['E','N'], JAUNE: ['S','S'] },
        9: { NOIR: ['K','N'], ROUGE: ['R','Y'], BLEU: ['A','L'], VERT: ['F','O'], JAUNE: ['T','N'] },
        10: { NOIR: ['O','S'], ROUGE: ['C','E'], BLEU: ['E','I'], VERT: ['A','Z'], JAUNE: ['N','E'] },
        11: { NOIR: ['P','T'], ROUGE: ['A','U'], BLEU: ['L','Y'], VERT: ['U','A'], JAUNE: ['D','U'] },
        12: { NOIR: ['U','W'], ROUGE: ['L','I'], BLEU: ['T','N'], VERT: ['R','C'], JAUNE: ['A','H'] }
    };
}

// ============================================================
// NETTOYAGE
// ============================================================
export function cleanupOrientShowKiosk() {
    if (listener) {
        listener.off();
        listener = null;
    }
}