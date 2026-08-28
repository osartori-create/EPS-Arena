// src/js/modules/eleve/orientshow-kiosk.js

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

export function initOrientShowKiosk(classe, code) {
    currentClasse = classe;
    // code est le code identité (ex: "NOIR_1")
    const parts = code.split('_');
    if (parts.length === 2) {
        selectedColor = parts[0];
        selectedNum = parseInt(parts[1]);
        // Mettre en surbrillance les boutons correspondants
        document.querySelector(`.os-color-btn[data-color="${selectedColor}"]`)?.classList.add('border-blue-500');
        document.querySelector(`.os-num-btn[data-num="${selectedNum}"]`)?.classList.add('border-blue-500');
    }
    // Écouter la config
    listenOrientShowConfig(classe, (config) => {
        if (config) {
            matrix = config.matrix || {};
            startTime = config.startTime || null;
            endTime = config.endTime || null;
            updateUIState();
            // Afficher les circuits
            renderCircuits();
        }
    });
    // Rendre les boutons de sélection (couleur + numéro) si pas déjà fait
    renderIdentitySelection();
}

function renderIdentitySelection() {
    const container = document.getElementById('os-identity-selector');
    if (!container) return;
    // On ne refait pas le rendu si déjà fait
    if (container.children.length > 0) return;
    let html = `<div class="grid grid-cols-5 gap-2">`;
    ['NOIR','ROUGE','BLEU','VERT','JAUNE'].forEach(col => {
        html += `<button class="os-color-btn bg-slate-700 p-4 rounded-xl font-black text-xs uppercase border-2 border-transparent" data-color="${col}" onclick="window.selectOSColor('${col}')">${col}</button>`;
    });
    html += `</div><div class="grid grid-cols-5 gap-2 mt-2">`;
    for (let i = 1; i <= 10; i++) {
        html += `<button class="os-num-btn bg-slate-700 p-4 rounded-xl font-black text-lg border-2 border-transparent" data-num="${i}" onclick="window.selectOSNum(${i})">${i}</button>`;
    }
    html += `</div>`;
    container.innerHTML = html;

    // Pré-sélection si code déjà connu
    if (selectedColor) {
        document.querySelector(`.os-color-btn[data-color="${selectedColor}"]`)?.classList.add('border-blue-500');
    }
    if (selectedNum) {
        document.querySelector(`.os-num-btn[data-num="${selectedNum}"]`)?.classList.add('border-blue-500');
    }
}

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

function renderCircuits() {
    const container = document.getElementById('os-circuit-grid');
    if (!container) return;
    let html = `<div class="grid grid-cols-4 gap-2">`;
    for (let c = 1; c <= 12; c++) {
        html += `<button class="os-circuit-btn bg-slate-700 p-4 rounded-xl font-black text-sm border-2 border-transparent" data-circuit="${c}" onclick="window.selectOSCircuit(${c})">C${c}</button>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

window.selectOSCircuit = function(circuit) {
    selectedCircuit = circuit;
    document.querySelectorAll('.os-circuit-btn').forEach(b => b.classList.remove('border-blue-500'));
    document.querySelector(`.os-circuit-btn[data-circuit="${circuit}"]`)?.classList.add('border-blue-500');
    document.getElementById('os-letters-input').classList.remove('hidden');
};

window.validateOSPassage = function() {
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
        // Réinitialiser les champs
        document.getElementById('os-l1').value = '';
        document.getElementById('os-l2').value = '';
    }).catch(err => alert('Erreur envoi : ' + err.message));
};

function showFeedback(score) {
    const icon = score === 5 ? '🏆' : (score === 2 ? '🆗' : '❌');
    const color = score === 5 ? '#065f46' : (score === 2 ? '#9a3412' : '#991b1b');
    // Utiliser un toast ou une alerte
    alert(`${icon} Score : +${score} pts`);
}

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