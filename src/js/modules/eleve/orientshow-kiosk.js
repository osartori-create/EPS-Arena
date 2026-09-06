// src/js/modules/eleve/orientshow-kiosk.js
// Kiosk OrientShow – version élève (inspirée de vos fichiers originaux)
// ✅ Ajout d’un bouton Retour et masquage de l’affichage du code en double

import { db, ref, onValue, push } from '../../core/firebase-service.js';

let currentClasse = '';
let currentCode = '';          // ex: "NOIR_1"
let matrix = {};
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

    // Masquer le panneau "Code sélectionné" pour éviter le doublon
    const codeInfo = document.getElementById('code-info');
    if (codeInfo) codeInfo.style.display = 'none';

    const container = document.getElementById('orientshow-module');
    if (!container) {
        console.error('Conteneur orientshow-module introuvable');
        return;
    }
    container.innerHTML = '';

    // 1. Écouter la configuration (matrix uniquement)
    if (configListener) {
        configListener();
        configListener = null;
    }
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/orientshow/config`);
    configListener = onValue(configRef, (snap) => {
        const data = snap.val() || {};
        matrix = data.matrix || {};
        if (Object.keys(matrix).length > 0) {
            chargerSessions();
        } else {
            container.innerHTML = '<div class="text-center py-10 text-slate-400"><p>⏳ En attente de la configuration du professeur...</p></div>';
        }
    });

    // 2. Si une config est passée en paramètre
    if (config && config.matrix) {
        matrix = config.matrix || {};
        if (Object.keys(matrix).length > 0) {
            chargerSessions();
        }
    }

    // 3. Audio
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
    } catch (e) {}
}

// ============================================================
// CHARGEMENT DES SESSIONS
// ============================================================
function chargerSessions() {
    if (sessionsListener) {
        sessionsListener();
        sessionsListener = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/orientshow/passages`;
    const sessionsRef = ref(db, path);
    sessionsListener = onValue(sessionsRef, (snap) => {
        const data = snap.val() || {};
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
    const container = document.getElementById('orientshow-module');
    if (!container) return;
    container.innerHTML = '';

    // Calcul des points
    let totalPoints = 0;
    const validations = {};
    for (let i = 1; i <= 12; i++) {
        const found = Object.values(sessions).find(s => s.circuit === i);
        if (found) {
            totalPoints += found.score || 0;
            validations[i] = found;
        } else {
            validations[i] = null;
        }
    }

    // Couleur et numéro
    const [color, num] = currentCode.split('_');
    const colorClasses = {
        NOIR: 'bg-black text-white border-slate-600',
        ROUGE: 'bg-red-600 text-white border-red-900',
        BLEU: 'bg-blue-600 text-white border-blue-900',
        VERT: 'bg-green-600 text-white border-green-900',
        JAUNE: 'bg-yellow-500 text-black border-yellow-700'
    };
    const bgColor = colorClasses[color] || 'bg-slate-700 text-white border-slate-600';

    // En‑tête (info élève + score) – avec la pastille de couleur
    const headerDiv = document.createElement('div');
    headerDiv.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4';
    headerDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-14 h-14 rounded-full border-2 flex items-center justify-center text-3xl font-black ${bgColor}">${num}</div>
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
    `;
    container.appendChild(headerDiv);

    // Message informatif
    const infoDiv = document.createElement('div');
    infoDiv.className = 'text-center text-sm text-slate-400 mb-4';
    infoDiv.textContent = '🎯 Sélectionne un circuit et saisis les deux lettres.';
    container.appendChild(infoDiv);

    // Grille des circuits
    const gridDiv = document.createElement('div');
    gridDiv.className = 'grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4';
    container.appendChild(gridDiv);

    for (let i = 1; i <= 12; i++) {
        const btn = document.createElement('button');
        btn.className = 'circuit-btn rounded-xl p-4 font-black text-white text-lg border-2 transition-all active:scale-95';
        btn.dataset.circuit = i;

        const val = validations[i];
        if (val) {
            const pts = val.score || 0;
            if (pts >= 5) {
                btn.className += ' bg-emerald-600 border-emerald-400';
                btn.textContent = `C${i} ✅`;
                btn.disabled = true;
            } else if (pts >= 2) {
                btn.className += ' bg-orange-500 border-orange-400';
                btn.textContent = `C${i} 🆗`;
                btn.disabled = true;
            } else {
                btn.className += ' bg-red-600 border-red-400';
                btn.textContent = `C${i} ❌`;
                btn.disabled = true;
            }
        } else {
            btn.className += ' bg-slate-700 border-slate-600 hover:border-blue-500';
            btn.textContent = `C${i}`;
            btn.addEventListener('click', () => selectCircuit(i));
        }
        gridDiv.appendChild(btn);
    }

    // Zone de saisie (cachée par défaut)
    const saisieDiv = document.createElement('div');
    saisieDiv.id = 'saisieZone';
    saisieDiv.className = 'hidden bg-slate-800 p-4 rounded-2xl border border-slate-700';
    saisieDiv.innerHTML = `
        <div class="text-center mb-3">
            <span class="text-sm text-slate-400">Circuit sélectionné :</span>
            <span id="selectedCircuitLabel" class="text-2xl font-black text-white ml-2"></span>
        </div>
        <div class="flex justify-center items-center gap-6 mb-4">
            <input type="text" id="l1" class="input-box w-16 h-16 text-center text-4xl font-black uppercase bg-slate-900 border-2 border-slate-600 rounded-xl outline-none focus:border-blue-500 text-white" maxlength="1" oninput="this.value=this.value.toUpperCase(); if(this.value) document.getElementById('l2').focus()">
            <input type="text" id="l2" class="input-box w-16 h-16 text-center text-4xl font-black uppercase bg-slate-900 border-2 border-slate-600 rounded-xl outline-none focus:border-blue-500 text-white" maxlength="1" oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="flex gap-4">
            <button id="btnAnnulerSaisie" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white active:scale-95">Annuler</button>
            <button id="btnValiderCircuit" class="flex-1 bg-blue-600 py-3 rounded-xl font-black text-white active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.4)]">Valider</button>
        </div>
    `;
    container.appendChild(saisieDiv);

    // Bouton Retour (pour revenir au choix du code)
    const footerDiv = document.createElement('div');
    footerDiv.className = 'mt-4 text-center';
    const backBtn = document.createElement('button');
    backBtn.className = 'bg-slate-700 px-6 py-3 rounded-xl font-black text-white text-sm active:scale-95 transition-transform';
    backBtn.textContent = '← Retour choix du code';
    backBtn.addEventListener('click', () => {
        // Nettoyer les écouteurs
        cleanupOrientShowKiosk();
        // Cacher le module
        const container = document.getElementById('orientshow-module');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        // Rétablir l'affichage du panneau "Code sélectionné"
        const codeInfo = document.getElementById('code-info');
        if (codeInfo) codeInfo.style.display = '';
        // Appeler resetToLogin pour revenir à la grille des codes
        if (typeof window.resetToLogin === 'function') {
            window.resetToLogin();
        } else {
            // Fallback : recharger la page
            location.reload();
        }
    });
    footerDiv.appendChild(backBtn);
    container.appendChild(footerDiv);

    // Attacher les événements aux boutons de saisie (s'ils existent déjà, on les remplace)
    const annulerBtn = document.getElementById('btnAnnulerSaisie');
    const validerBtn = document.getElementById('btnValiderCircuit');
    if (annulerBtn) annulerBtn.addEventListener('click', annulerSaisie);
    if (validerBtn) validerBtn.addEventListener('click', validerCircuit);
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

    selectedCircuit = circuitId;
    const saisieZone = document.getElementById('saisieZone');
    document.getElementById('selectedCircuitLabel').textContent = `C${circuitId}`;
    saisieZone.classList.remove('hidden');
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

    // Vérifier si déjà validé
    const found = Object.values(sessions).find(s => s.circuit === selectedCircuit);
    if (found) {
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

    // Anti‑triche
    const now = Date.now();
    if (now - lastSend < COOLDOWN) {
        const wait = Math.ceil((COOLDOWN - (now - lastSend)) / 1000);
        alert(`⏳ Trop rapide ! Attends encore ${wait}s.`);
        return;
    }

    // Calcul du score
    const [color] = currentCode.split('_');
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

    // Son
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
        <button class="btn-fermer-feedback px-12 py-4 bg-white/10 border-2 border-white rounded-2xl text-white font-black text-xl active:scale-95 transition-transform">
            SUIVANT ➔
        </button>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.btn-fermer-feedback').addEventListener('click', () => {
        overlay.remove();
    });
}

// ============================================================
// NETTOYAGE
// ============================================================
export function cleanupOrientShowKiosk() {
    if (configListener) {
        configListener();
        configListener = null;
    }
    if (sessionsListener) {
        sessionsListener();
        sessionsListener = null;
    }
}