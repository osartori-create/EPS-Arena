// src/js/modules/eleve/orientshow-kiosk.js
// Kiosk OrientShow pour les élèves

import { listenOrientShowConfig, sendOrientShowPassage } from '../../core/firebase-service.js';

let currentClasse = '';
let matrix = {};
let startTime = null;
let endTime = null;
let selectedColor = '';
let selectedNum = null;
let selectedCircuit = null;
let lastSend = 0;
const COOLDOWN = 30000;

// ============================================================
// INIT
// ============================================================
export function initOrientShowKiosk(classe, code, config) {
    currentClasse = classe;
    
    // Si une config est fournie, on l'utilise
    if (config && config.matrix) {
        console.log('[OrientShow Kiosk] Configuration reçue :', config);
        matrix = config.matrix || {};
        startTime = config.startTime || null;
        endTime = config.endTime || null;
        
        const parts = code.split('_');
        if (parts.length === 2) {
            selectedColor = parts[0];
            selectedNum = parseInt(parts[1]);
        }
        
        renderIdentitySelection();
        renderCircuits();
        updateUIState();
        return;
    }
    
    // Fallback : écouter Firebase
    console.log('[OrientShow Kiosk] Pas de config fournie, écoute Firebase...');
    listenOrientShowConfig(classe, (configData) => {
        if (configData) {
            matrix = configData.matrix || {};
            startTime = configData.startTime || null;
            endTime = configData.endTime || null;
            
            const parts = code.split('_');
            if (parts.length === 2) {
                selectedColor = parts[0];
                selectedNum = parseInt(parts[1]);
            }
            
            renderIdentitySelection();
            renderCircuits();
            updateUIState();
        } else {
            const container = document.getElementById('os-kiosk-container');
            if (container) {
                container.innerHTML = `<div class="text-center py-10 text-slate-400"><p>⏳ En attente de la configuration du professeur...</p></div>`;
            }
        }
    });
}

// ============================================================
// AFFICHAGE DE LA SÉLECTION D'IDENTITÉ
// ============================================================
function renderIdentitySelection() {
    const container = document.getElementById('os-identity-selector');
    if (!container) return;
    if (container.children.length > 0) return;
    
    let html = `<div class="grid grid-cols-5 gap-2">`;
    ['NOIR','ROUGE','BLEU','VERT','JAUNE'].forEach(col => {
        const active = col === selectedColor ? 'border-blue-500' : 'border-transparent';
        html += `<button class="os-color-btn bg-slate-700 p-4 rounded-xl font-black text-xs uppercase border-2 ${active}" data-color="${col}" onclick="window.selectOSColor('${col}')">${col}</button>`;
    });
    html += `</div><div class="grid grid-cols-5 gap-2 mt-2">`;
    for (let i = 1; i <= 10; i++) {
        const active = i === selectedNum ? 'border-blue-500' : 'border-transparent';
        html += `<button class="os-num-btn bg-slate-700 p-4 rounded-xl font-black text-lg border-2 ${active}" data-num="${i}" onclick="window.selectOSNum(${i})">${i}</button>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// ============================================================
// AFFICHAGE DES CIRCUITS
// ============================================================
function renderCircuits() {
    const container = document.getElementById('os-circuit-grid');
    if (!container) return;
    
    if (!matrix || Object.keys(matrix).length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center">⏳ En attente de la matrice des circuits...</p>';
        return;
    }
    
    let html = `<div class="grid grid-cols-4 gap-2">`;
    for (let c = 1; c <= 12; c++) {
        const active = c === selectedCircuit ? 'border-blue-500' : 'border-transparent';
        html += `<button class="os-circuit-btn bg-slate-700 p-4 rounded-xl font-black text-sm border-2 ${active}" data-circuit="${c}" onclick="window.selectOSCircuit(${c})">C${c}</button>`;
    }
    html += `</div>`;
    container.innerHTML = html;
    
    if (!startTime) {
        container.innerHTML += '<p class="text-center text-slate-400 mt-4">⏳ En attente du départ du professeur...</p>';
    } else if (endTime) {
        container.innerHTML += '<p class="text-center text-red-400 mt-4">⏱️ La course est terminée.</p>';
    } else {
        container.innerHTML += '<p class="text-center text-emerald-400 mt-4">🏃 Course en cours !</p>';
    }
}

// ============================================================
// MISE À JOUR DE L'ÉTAT
// ============================================================
function updateUIState() {
    const state = document.getElementById('courseState');
    if (!state) return;
    if (!startTime) {
        state.innerText = '⏳ En attente du départ...';
    } else if (!endTime) {
        state.innerText = '🏃‍♂️ Course en cours !';
    } else {
        state.innerText = '🛑 Course terminée.';
    }
}

// ============================================================
// ACTIONS GLOBALES (pour les onclick)
// ============================================================
window.selectOSColor = function(color) {
    selectedColor = color;
    document.querySelectorAll('.os-color-btn').forEach(b => b.classList.remove('border-blue-500'));
    document.querySelector(`.os-color-btn[data-color="${color}"]`)?.classList.add('border-blue-500');
};

window.selectOSNum = function(num) {
    selectedNum = num;
    document.querySelectorAll('.os-num-btn').forEach(b => b.classList.remove('border-blue-500'));
    document.querySelector(`.os-num-btn[data-num="${num}"]`)?.classList.add('border-blue-500');
};

window.selectOSCircuit = function(circuit) {
    selectedCircuit = circuit;
    document.querySelectorAll('.os-circuit-btn').forEach(b => b.classList.remove('border-blue-500'));
    document.querySelector(`.os-circuit-btn[data-circuit="${circuit}"]`)?.classList.add('border-blue-500');
    document.getElementById('os-letters-input').classList.remove('hidden');
};

// ✅ Export nommé de validateOSPassage pour l'importer dans eleve-app.js
export function validateOSPassage() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    if (!selectedColor || !selectedNum) return alert('Choisissez votre identité (couleur + numéro).');
    if (!selectedCircuit) return alert('Choisissez un circuit.');
    if (!startTime || endTime) return alert('La course n\'est pas active.');

    const l1 = document.getElementById('os-l1').value.toUpperCase();
    const l2 = document.getElementById('os-l2').value.toUpperCase();
    if (!l1 && !l2) return alert('Saisissez au moins une lettre.');

    const now = Date.now();
    if (now - lastSend < COOLDOWN) {
        const wait = Math.ceil((COOLDOWN - (now - lastSend)) / 1000);
        return alert(`⏳ Attendez encore ${wait}s.`);
    }

    // Calcul du score
    const truth = matrix[selectedCircuit]?.[selectedColor] || ['', ''];
    let score = 0;
    let truthCopy = [...truth];
    if (l1 && truthCopy.includes(l1)) { score += 2.5; truthCopy = truthCopy.filter(l => l !== l1); }
    if (l2 && truthCopy.includes(l2)) { score += 2.5; truthCopy = truthCopy.filter(l => l !== l2); }
    score = Math.floor(score === 5 ? 5 : (score > 0 ? 2 : 0));

    const code = `${selectedColor}_${selectedNum}`;
    sendOrientShowPassage(currentClasse, {
        code,
        circuit: selectedCircuit,
        lettres: [l1, l2],
        score,
        timestamp: now
    }).then(() => {
        lastSend = now;
        showFeedback(score);
        document.getElementById('os-l1').value = '';
        document.getElementById('os-l2').value = '';
    }).catch(err => alert('Erreur envoi : ' + err.message));
}

// Attacher à window pour les onclick HTML
window.validateOSPassage = validateOSPassage;

function showFeedback(score) {
    const icon = score === 5 ? '🏆' : (score === 2 ? '🆗' : '❌');
    const color = score === 5 ? '#065f46' : (score === 2 ? '#9a3412' : '#991b1b');
    alert(`${icon} Score : +${score} pts`);
}

// Nettoyage éventuel
export function cleanupOrientShowKiosk() {
    // Rien pour l'instant
}