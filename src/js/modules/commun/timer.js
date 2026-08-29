// src/js/modules/commun/timer.js

let intervalId = null;
let isRunning = false;
let currentSeries = 0;
let currentPhase = 'work'; // work, rest, finished
let remaining = 0;
let totalSeries = 4;
let workTime = 30;
let restTime = 15;
let audioCtx = null;

// --- SONS GÉNÉRÉS (API Web Audio) ---
function playTone(freq, duration = 0.2, type = 'sine') {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playStartSound() { playTone(880, 0.3, 'square'); }
function playRestSound() { playTone(440, 0.2, 'square'); }
function playWorkSound() { playTone(660, 0.2, 'square'); }
function playEndSound() {
    playTone(523, 0.5, 'sine');
    setTimeout(() => playTone(659, 0.5, 'sine'), 200);
    setTimeout(() => playTone(784, 1, 'sine'), 400);
}

// --- INITIALISATION / PRÉRÉGLAGES ---
export function initIntervalTimer() {
    const presets = JSON.parse(localStorage.getItem('eps_arena_timer_presets') || '{}');
    const select = document.getElementById('timer-presets');
    select.innerHTML = '<option value="">-- Préréglages --</option>';
    Object.keys(presets).forEach(name => {
        select.innerHTML += `<option value="${name}">${name}</option>`;
    });
    resetTimer();
}

export function savePreset() {
    const name = prompt("Nom du chrono :");
    if (!name) return;
    const work = parseInt(document.getElementById('timer-work').value) || 30;
    const rest = parseInt(document.getElementById('timer-rest').value) || 15;
    const series = parseInt(document.getElementById('timer-series').value) || 4;
    
    const presets = JSON.parse(localStorage.getItem('eps_arena_timer_presets') || '{}');
    presets[name] = { work, rest, series };
    localStorage.setItem('eps_arena_timer_presets', JSON.stringify(presets));
    initIntervalTimer();
    alert("✅ Chrono enregistré !");
}

export function loadPreset() {
    const select = document.getElementById('timer-presets');
    const name = select.value;
    if (!name) return alert("Choisissez un préréglage.");
    const presets = JSON.parse(localStorage.getItem('eps_arena_timer_presets') || '{}');
    const preset = presets[name];
    if (preset) {
        document.getElementById('timer-work').value = preset.work;
        document.getElementById('timer-rest').value = preset.rest;
        document.getElementById('timer-series').value = preset.series;
        alert(`✅ Préréglage "${name}" chargé !`);
    }
}

export function deletePreset() {
    const select = document.getElementById('timer-presets');
    const name = select.value;
    if (!name) return alert("Choisissez un préréglage.");
    if (!confirm(`Supprimer "${name}" ?`)) return;
    const presets = JSON.parse(localStorage.getItem('eps_arena_timer_presets') || '{}');
    delete presets[name];
    localStorage.setItem('eps_arena_timer_presets', JSON.stringify(presets));
    initIntervalTimer();
}

// --- LOGIQUE DU CHRONO ---
export function startTimer() {
    workTime = parseInt(document.getElementById('timer-work').value) || 30;
    restTime = parseInt(document.getElementById('timer-rest').value) || 15;
    totalSeries = parseInt(document.getElementById('timer-series').value) || 4;
    if (totalSeries < 1) totalSeries = 1;

    document.getElementById('tools-settings').classList.add('hidden');
    document.getElementById('tools-timer').classList.remove('hidden');
    document.getElementById('tools-finished').classList.add('hidden');

    currentSeries = 1;
    currentPhase = 'work';
    remaining = workTime;
    
    document.getElementById('timer-phase').innerText = "TRAVAIL";
    document.getElementById('timer-phase').className = "text-4xl font-black uppercase tracking-widest mb-4 text-emerald-400";
    
    updateDisplay();
    playStartSound();
    
    intervalId = setInterval(tick, 1000);
    isRunning = true;
}

function tick() {
    remaining--;
    updateDisplay();
    
    if (remaining <= 0) {
        if (currentPhase === 'work') {
            // Fin du travail : si c'était la dernière série, on termine
            if (currentSeries >= totalSeries) {
                finishTimer();
                return;
            }
            currentPhase = 'rest';
            remaining = restTime;
            playRestSound();
            document.getElementById('timer-phase').innerText = "REPOS";
            document.getElementById('timer-phase').className = "text-4xl font-black uppercase tracking-widest mb-4 text-amber-400";
        } else {
            // Fin du repos : on passe à la série suivante
            currentSeries++;
            currentPhase = 'work';
            remaining = workTime;
            playWorkSound();
            document.getElementById('timer-phase').innerText = "TRAVAIL";
            document.getElementById('timer-phase').className = "text-4xl font-black uppercase tracking-widest mb-4 text-emerald-400";
        }
    }
}

function updateDisplay() {
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    const display = document.getElementById('timer-display');
    display.innerText = `${m}:${s}`;
    
    // Couleur différente selon la phase
    display.className = "text-[25vh] leading-none font-black tabular-nums drop-shadow-2xl " + (currentPhase === 'work' ? "text-emerald-400" : "text-amber-400");

    // Affichage Série X/Y
    document.getElementById('timer-series-display').innerText = `Série ${currentSeries} / ${totalSeries}`;
}

function finishTimer() {
    clearInterval(intervalId);
    isRunning = false;
    playEndSound();
    
    document.getElementById('tools-timer').classList.add('hidden');
    document.getElementById('tools-finished').classList.remove('hidden');
}

export function stopTimer() {
    clearInterval(intervalId);
    isRunning = false;
    resetTimer();
}

export function resetTimer() {
    clearInterval(intervalId);
    isRunning = false;
    
    document.getElementById('tools-finished').classList.add('hidden');
    document.getElementById('tools-timer').classList.add('hidden');
    document.getElementById('tools-settings').classList.remove('hidden');
}

export function backToSettings() {
    resetTimer();
}