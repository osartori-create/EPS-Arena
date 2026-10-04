// src/js/modules/demi-fond/variantes/rectangle-vitesses/rectangle-vitesses-interface.js
// UI professeur du sous-module "Rectangle des vitesses".
// - Configuration des sous-activités (Régulier / Échauffement)
// - Paramétrage complet des exercices et vitesses
// - Synthèse vocale (voix femme/homme) + signal sonore doux
import { getEtab } from '../../../../core/firebase-service.js';
import { db, ref, set } from '../../../../core/firebase-service.js';
import { getCurrentClasse } from '../../../../core/live-engine.js';
import { getBasePath, getConfigKey } from '../../demifond-common.js';
import {
    SOUS_MODULE_ID, TITRE_AFFICHE, SOUS_ACTIVITES, EXERCICES_DISPONIBLES,
    creerSequenceDefaut, sequenceActive, phraseExercice, estExerciseActif
} from './rectangle-vitesses-core.js';

// Durée de la séquence (18 s) imposée par le dispositif
const DUREE_SIGNAL_INTERVALLE_MS = 18000;
// Durée avant le bip pour lancer l'annonce du prochain contenu + décompte « 3, 2, 1 »
const DUREE_ANNONCE_PREAVIS_MS = 5200;

let currentClasse = '';
let currentContainer = null;

let config = null;

// Moteur voix + signal sonore
let audioCtx = null;
let voixDisponibles = [];
let voixChoisie = null;
let typeVoix = 'femme'; // 'femme' | 'homme'
let sequenceEnCours = false;
let arretDemande = false;
let chronoInterval = null;
let chronoDebut = null;
let totalSequences = 0;

function chargerConfig() {
    const saved = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null');
    return saved || {
        sousActivite: 'regulier',
        dureeSequence: 18,
        nbSequences: 10,
        annonceParole: true,
        volumeSignal: 1,
        typeVoix: 'femme',
        exercices: [...EXERCICES_DISPONIBLES],
        sequence: creerSequenceDefaut()
    };
}

function sauverConfig() {
    localStorage.setItem(getConfigKey(currentClasse, SOUS_MODULE_ID), JSON.stringify(config));
}

export function initRectangleVitessesInterface(container) {
    if (!container) return;
    currentContainer = container;
    currentClasse = getCurrentClasse() || document.getElementById('selectClasse')?.value || '';
    config = chargerConfig();
    typeVoix = config.typeVoix || 'femme';

    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Sélectionnez une classe.</p>';
        return;
    }

    chargerVoix();
    rendre();
}

// ============================================================
// RENDU PRINCIPAL
// ============================================================
function rendre() {
    if (!currentContainer) return;

    let html = '';

    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex justify-between items-center flex-wrap gap-2">
                <h3 class="font-black text-blue-400 uppercase text-sm">🟦 ${TITRE_AFFICHE} — Configuration</h3>
                <span class="text-xs text-slate-400">${sequenceActive(config.sequence).length} séquence(s)</span>
            </div>
        </div>
    `;

    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-xs mb-3">📐 Le dispositif</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-slate-900 p-4 rounded-xl border border-slate-700 text-center">
                    <div class="text-5xl mb-3">🟦</div>
                    <p class="font-black text-white text-lg">1 plot tous les 5 m</p>
                    <p class="text-xs text-slate-400">Séquences de 18 s · 1 plot = 1 km/h</p>
                </div>
                <div class="bg-slate-900 p-4 rounded-xl border border-slate-700">
                    <p class="text-xs text-slate-400"><strong class="text-white">Règle :</strong> nombre de plots franchis en 18 s = vitesse en km/h.</p>
                    <p class="text-xs text-slate-400 mt-2">L'élève compte à haute voix ses plots et doit tomber juste, sans s'arrêter ni piétiner.</p>
                </div>
            </div>
        </div>
    `;

    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-xs mb-3">🎯 Sous-activité à transmettre au kiosk</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${boutonSousActivite('regulier')}
                ${boutonSousActivite('echauffement')}
            </div>
        </div>
    `;

    html += config.sousActivite === 'echauffement' ? blocEchauffement() : blocRegulier();
    html += blocVoix();

    html += `
        <div class="bg-slate-900 p-4 rounded-2xl border-2 border-blue-500/40 flex items-center justify-between flex-wrap gap-3">
            <div class="text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">⏱️ Temps total</div>
                <div id="rv-chrono" class="text-3xl font-mono font-black text-white">0:00</div>
            </div>
            <div class="text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">🔁 Séquence</div>
                <div id="rv-progression" class="text-3xl font-black text-yellow-400">0/${totalSequences || 0}</div>
            </div>
        </div>
    `;

    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-3">
            <div class="flex flex-wrap gap-2">
                <button onclick="window.rectangleTesterAudio()" class="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">
                    🔊 Tester la voix
                </button>
                <button onclick="window.rectangleLancer()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-base uppercase text-white active:scale-95">
                    🚀 Lancer la séance
                </button>
                <button onclick="window.rectangleArreter()" class="bg-red-600 hover:bg-red-500 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">
                    🛑 Stop
                </button>
            </div>
            <button onclick="window.rectangleTransmettre()" class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-base uppercase tracking-widest text-white active:scale-[0.98]">
                📡 Transmettre au kiosk élève
            </button>
        </div>
    `;

    currentContainer.innerHTML = html;
    if (config.sousActivite === 'echauffement') rendreSequence();
    actualiserCompterInitial();
}

function boutonSousActivite(id) {
    const actif = config.sousActivite === id;
    const s = SOUS_ACTIVITES[id];
    return `
        <button onclick="window.rectangleSetSousActivite('${id}')"
                class="p-4 rounded-xl font-black text-sm border-2 text-left active:scale-95 transition-all ${actif ? 'border-blue-500 bg-blue-900/40 text-white ring-2 ring-blue-400' : 'border-slate-600 text-slate-300'}">
            <div class="text-xl mb-1">${s.icone} ${s.label}</div>
            <div class="text-[10px] font-normal opacity-80">${id === 'regulier' ? 'Course continue 3 min, signal sonore toutes les 18 s' : 'Échauffement progressif A → Z, exercices + vitesses modifiables'}</div>
        </button>
    `;
}

function blocRegulier() {
    return `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-xs mb-3">🎯 Régulier sur 3 minutes</h4>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                    <label class="block font-bold text-slate-400 uppercase mb-1">Durée séquence (s)</label>
                    <input type="number" id="rvRegDuree" value="${config.dureeSequence}" min="5" max="60"
                           class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
                </div>
                <div>
                    <label class="block font-bold text-slate-400 uppercase mb-1">Nb séquences</label>
                    <input type="number" id="rvRegNb" value="${config.nbSequences}" min="1" max="60"
                           class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
                </div>
                <div>
                    <label class="block font-bold text-slate-400 uppercase mb-1">Durée totale</label>
                    <div class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center font-black">
                        ${config.dureeSequence * config.nbSequences} s
                    </div>
                </div>
            </div>
            <p class="text-[10px] text-slate-500 mt-3">Chaque séquence = 18 s de course continue. L'élève compte ses plots et recommence à zéro à chaque signal sonore.</p>
        </div>
    `;
}

function blocEchauffement() {
    return `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex justify-between items-center flex-wrap gap-2 mb-3">
                <h4 class="font-black text-blue-400 uppercase text-xs">🔥 Fiche d'échauffement (A → Z)</h4>
                <button onclick="window.rectangleAjouterExercice()" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-[10px] uppercase text-white active:scale-95">
                    ➕ Nouvel exercice
                </button>
            </div>
            <p class="text-[10px] text-slate-500 mb-3">Chaque lettre = une séquence de 18 s. Les lignes vides sont ignorées. Les courses identiques qui se suivent forment un enchaînement annoncé une seule fois.</p>
            <div id="rv-sequence" class="space-y-2"></div>
        </div>
    `;
}

function blocVoix() {
    const optionsVoix = `
        <option value="femme" ${config.typeVoix === 'femme' ? 'selected' : ''}>👩 Femme</option>
        <option value="homme" ${config.typeVoix === 'homme' ? 'selected' : ''}>👨 Homme (grave)</option>
    `;

    return `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-xs mb-3">🔊 Synthèse vocale & signal sonore</h4>
            <div class="grid grid-cols-2 gap-3 text-xs">
                <label class="flex items-center gap-2 font-bold text-slate-300 cursor-pointer">
                    <input type="checkbox" id="rvAnnonceParole" ${config.annonceParole ? 'checked' : ''} class="w-4 h-4"> Annoncer les consignes à la voix
                </label>
                <div>
                    <label class="block font-bold text-slate-400 uppercase mb-1">Voix</label>
                    <select id="rvTypeVoix" onchange="window.rectangleSetTypeVoix(this.value)"
                            class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold text-sm">
                        ${optionsVoix}
                    </select>
                </div>
            </div>
            <div class="mt-4">
                <label class="block font-bold text-slate-400 uppercase mb-1 text-xs">Volume du signal sonore</label>
                <div class="flex items-center gap-3">
                    <input type="range" id="rvVolumeSignal" min="0" max="100" value="${Math.round((config.volumeSignal ?? 1) * 100)}" class="flex-1">
                    <span id="rvVolumeSignalLabel" class="text-xs text-slate-300 font-black w-10 text-right">${Math.round((config.volumeSignal ?? 1) * 100)}%</span>
                </div>
            </div>
        </div>
    `;
}

function rendreSequence() {
    const cont = document.getElementById('rv-sequence');
    if (!cont) return;

    const exercices = config.exercices || EXERCICES_DISPONIBLES;
    let html = '';

    config.sequence.forEach((item, idx) => {
        const options = exercices.map(e => `<option value="${e.id}" ${e.id === item.exercice ? 'selected' : ''}>${e.label}</option>`).join('');
        const actif = estExerciseActif(item);
        const vitesse = item.vitesse;
        html += `
            <div class="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border ${actif ? 'border-slate-700' : 'border-slate-800 opacity-60'}">
                <div class="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">${item.lettre}</div>
                <select onchange="window.rectangleSetExercice(${idx}, this.value)" class="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-white text-sm">
                    <option value="">— vide —</option>
                    ${options}
                </select>
                <div class="flex items-center gap-1">
                    <input type="number" value="${vitesse}" onchange="window.rectangleSetVitesse(${idx}, this.value)"
                           class="w-16 bg-slate-800 border border-slate-600 rounded-lg p-2 text-white text-center text-sm" min="0" max="30">
                    <span class="text-[10px] text-slate-500">km/h</span>
                </div>
            </div>
        `;
    });

    cont.innerHTML = html;
}

// ============================================================
// RÉCUPÉRATION DES PARAMÈTRES SAISIS
// ============================================================
function lireChamps() {
    const duree = parseInt(document.getElementById('rvRegDuree')?.value) || 18;
    const nb = parseInt(document.getElementById('rvRegNb')?.value) || 10;
    const annonce = document.getElementById('rvAnnonceParole')?.checked !== false;
    const volumeSignal = parseInt(document.getElementById('rvVolumeSignal')?.value) || 100;
    const typeVoixSaisi = document.getElementById('rvTypeVoix')?.value || 'femme';
    return { duree, nb, annonce, volumeSignal, typeVoix: typeVoixSaisi };
}

function syncVolumeSignal() {
    const input = document.getElementById('rvVolumeSignal');
    const label = document.getElementById('rvVolumeSignalLabel');
    if (input && label) label.textContent = input.value + '%';
}

// ============================================================
// ACTIONS
// ============================================================
window.rectangleSetSousActivite = function(id) {
    if (!config) return;
    config.sousActivite = id;
    const champs = lireChamps();
    config.dureeSequence = champs.duree;
    config.nbSequences = champs.nb;
    config.annonceParole = champs.annonce;
    config.volumeSignal = champs.volumeSignal / 100;
    config.typeVoix = champs.typeVoix;
    typeVoix = champs.typeVoix;
    appliquerVoix();
    sauverConfig();
    rendre();
};

window.rectangleSetTypeVoix = function(voix) {
    typeVoix = voix;
    config.typeVoix = voix;
    appliquerVoix();
    sauverConfig();
    if (config.annonceParole) initAudioCtx();
};

window.rectangleSetExercice = function(idx, exerciceId) {
    if (!config?.sequence?.[idx]) return;
    config.sequence[idx].exercice = exerciceId;
    sauverConfig();
    rendreSequence();
    actualiserCompterInitial();
};

window.rectangleSetVitesse = function(idx, value) {
    if (!config?.sequence?.[idx]) return;
    config.sequence[idx].vitesse = Number(value) || 0;
    sauverConfig();
};

window.rectangleAjouterExercice = function() {
    const label = prompt('Nom du nouvel exercice ?');
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!id) return alert('Nom invalide.');
    if (config.exercices.find(e => e.id === id)) return alert('Cet exercice existe déjà.');
    config.exercices.push({ id, label: label.trim() });
    sauverConfig();
    rendre();
};

// ============================================================
// TRANSMISSION
// ============================================================
window.rectangleTransmettre = async function() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const champs = lireChamps();

    const payload = {
        sousModule: SOUS_MODULE_ID,
        sousActivite: config.sousActivite,
        dureeSequence: champs.duree,
        nbSequences: champs.nb,
        annonceParole: champs.annonce,
        volumeSignal: champs.volumeSignal / 100,
        typeVoix: champs.typeVoix,
        exercices: config.exercices || EXERCICES_DISPONIBLES,
        sequence: config.sousActivite === 'echauffement' ? config.sequence : []
    };

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    try {
        await set(ref(db, `${getBasePath(currentClasse)}/config`), payload);
        await set(ref(db, `${getEtab()}/profs/${profCode}/${currentClasse}/config`), { activite: 'demi-fond' });
        await set(ref(db, `${getEtab()}/profs/${profCode}/active_classes/${currentClasse}`), true);
        alert(`✅ Sous-activité « ${SOUS_ACTIVITES[config.sousActivite].label} » transmise au kiosk.\nLes élèves pourront saisir leur bilan à la fin.`);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

// ============================================================
// VOIX + SIGNAL SONORE (uniquement tablette prof)
// ============================================================
function initAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx?.state === 'suspended') audioCtx.resume();
}

function chargerVoix() {
    if (!('speechSynthesis' in window)) return;
    const setVoices = () => {
        voixDisponibles = speechSynthesis.getVoices().filter(v => v.lang?.toLowerCase().startsWith('fr'));
        appliquerVoix();
    };
    setVoices();
    speechSynthesis.onvoiceschanged = setVoices;
}

function detecterVoixPreferee(type) {
    const voixFR = voixDisponibles.filter(v => v.lang?.toLowerCase().startsWith('fr'));
    if (voixFR.length === 0) return null;

    const contient = (arr, mots) => arr.find(v => mots.some(m => v.name.toLowerCase().includes(m)));

    if (type === 'homme') {
        const masculine = contient(voixFR, ['male', 'homme', 'thomas', 'daniel', 'paul', 'louis', 'george', 'olivier', 'guillaume']);
        if (masculine) return masculine;
        return voixFR.length > 1 ? voixFR[1] : voixFR[0];
    }

    const feminine = contient(voixFR, ['female', 'femme', 'amelie', 'audrey', 'claire', 'sophie', 'marie', 'virginie', 'julie', 'siri']);
    if (feminine) return feminine;
    return voixFR[0];
}

function appliquerVoix() {
    voixChoisie = detecterVoixPreferee(typeVoix);
}

function sonMarqueur() {
    initAudioCtx();
    if (!audioCtx) return;

    const volume = Math.max(0, Math.min(1, config?.volumeSignal ?? 1));
    if (volume <= 0) return;

    try {
        const now = audioCtx.currentTime;
        const jouerNote = (freq, debut, duree) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'triangle';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.0001, now + debut);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.7 * volume), now + debut + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + debut + duree);
            o.connect(g);
            g.connect(audioCtx.destination);
            o.start(now + debut);
            o.stop(now + debut + duree + 0.05);
        };
        jouerNote(880, 0, 0.4);
        jouerNote(1174.66, 0.12, 0.5);
    } catch (e) {}
}

function parler(texte) {
    return new Promise(resolve => {
        if (!config?.annonceParole || !('speechSynthesis' in window)) {
            resolve();
            return;
        }
        try {
            const u = new SpeechSynthesisUtterance(texte);
            u.lang = 'fr-FR';
            if (voixChoisie) u.voice = voixChoisie;
            u.volume = 1;
            u.rate = 1.0;
            u.pitch = typeVoix === 'homme' ? 0.65 : 1.05;
            const fin = () => {
                u.onend = u.onerror = null;
                resolve();
            };
            u.onend = fin;
            u.onerror = fin;
            speechSynthesis.speak(u);
        } catch (e) {
            resolve();
        }
    });
}

function parlerLance(texte) {
    // Lancer la voix sans attendre sa fin (pour ne pas décaler les bips).
    if (!config?.annonceParole || !('speechSynthesis' in window)) return;
    try {
        const u = new SpeechSynthesisUtterance(texte);
        u.lang = 'fr-FR';
        if (voixChoisie) u.voice = voixChoisie;
        u.volume = 1;
        u.rate = 1.0;
        u.pitch = typeVoix === 'homme' ? 0.65 : 1.05;
        speechSynthesis.speak(u);
    } catch (e) {}
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function annulerParole() {
    if ('speechSynthesis' in window) {
        try { speechSynthesis.cancel(); } catch (e) {}
    }
}

// ============================================================
// PLAN DE SÉANCE (détection des enchaînements de courses)
// ============================================================
function construirePlan() {
    const seq = sequenceActive(config.sequence);
    const plan = [];
    let i = 0;
    while (i < seq.length) {
        const item = seq[i];
        if (item.exercice === 'course') {
            let j = i;
            while (j < seq.length && seq[j].exercice === 'course' && seq[j].vitesse === item.vitesse) {
                j++;
            }
            plan.push({ chain: j - i > 1, count: j - i, item });
            i = j;
        } else {
            plan.push({ chain: false, count: 1, item });
            i++;
        }
    }
    return plan;
}

function libelleEntree(entry) {
    if (entry.chain) {
        return `Enchaînement de ${entry.count} courses à ${Math.round(entry.item.vitesse)} kilomètres heure`;
    }
    return phraseExercice(entry.item, config.exercices);
}

// Construit la liste plate des segments de 18 s.
// Un enchaînement de N courses => N segments. Seul le premier segment
// d'une entrée porte une annonce ; les suivants sont des segments de continuation.
function construireSegments() {
    if (config.sousActivite === 'regulier') {
        return Array.from({ length: config.nbSequences }, () => ({ annonce: null }));
    }

    const plan = construirePlan();
    const segments = [];
    plan.forEach(entry => {
        for (let c = 0; c < entry.count; c++) {
            const annonce = c === 0 ? `${entry.item.lettre}. ${libelleEntree(entry)}` : null;
            segments.push({ annonce });
        }
    });
    return segments;
}

// ============================================================
// CHRONO + COMPTEUR
// ============================================================
function demarrerChrono() {
    arreterChrono();
    chronoDebut = Date.now();
    chronoInterval = setInterval(() => {
        const el = document.getElementById('rv-chrono');
        if (!el) return;
        const sec = Math.floor((Date.now() - chronoDebut) / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }, 500);
}

function arreterChrono() {
    if (chronoInterval) {
        clearInterval(chronoInterval);
        chronoInterval = null;
    }
    chronoDebut = null;
}

function majProgression(courante) {
    const el = document.getElementById('rv-progression');
    if (el) el.textContent = `${Math.min(courante, totalSequences)}/${totalSequences}`;
}

function actualiserCompterInitial() {
    totalSequences = config.sousActivite === 'echauffement'
        ? sequenceActive(config.sequence).reduce((acc, e) => acc + 1, 0)
        : config.nbSequences;
    // Pour l'échauffement, le nombre réel de segments = nombre de séquences actives.
    if (config.sousActivite === 'echauffement') {
        totalSequences = construireSegments().length;
    }
    const el = document.getElementById('rv-progression');
    if (el) el.textContent = `0/${totalSequences}`;
}

// ============================================================
// LANCEMENT — horloge unique, bips espacés exactement de 18 s
// ============================================================
async function lancerSegments() {
    const segments = construireSegments();
    const n = segments.length;
    totalSequences = n;
    if (n === 0) {
        alert("Aucune séquence à lancer.");
        return;
    }

    // Annonce AVANT le rythme (bloquante, sans contrainte de cadence)
    if (config.sousActivite === 'regulier') {
        await parler('Régulier sur trois minutes. Courez et comptez vos plots à chaque signal sonore.');
    } else if (segments[0].annonce) {
        await parler(segments[0].annonce);
    }

    // 3 secondes entre la fin de la consigne et le premier signal
    await sleep(3000);
    sonMarqueur();      // signal de départ du segment 1
    demarrerChrono();   // chrono démarre au premier signal
    majProgression(1);

    for (let k = 0; k < n; k++) {
        // Pendant le segment courant (index k), préparer l'annonce du suivant
        // sans bloquer la cadence. Le prochain bip aura lieu exactement
        // dans DUREE_SIGNAL_INTERVALLE_MS, quel que soit l'état de la voix.
        if (k + 1 < n && segments[k + 1].annonce) {
            const texte = segments[k + 1].annonce;
            const delai = Math.max(0, DUREE_SIGNAL_INTERVALLE_MS - DUREE_ANNONCE_PREAVIS_MS);
            setTimeout(() => {
                if (!arretDemande) {
                    annulerParole();
                    parlerLance(texte);
                }
            }, delai);
        }

        await sleep(DUREE_SIGNAL_INTERVALLE_MS);
        if (arretDemande) break;

        // Couper toute parole en cours pour que le signal soit net et à l'heure.
        annulerParole();
        sonMarqueur();
        if (k + 2 <= n) majProgression(k + 2);
    }
}

window.rectangleTesterAudio = async function() {
    if (!config) return;
    const champs = lireChamps();
    config.annonceParole = champs.annonce;
    config.volumeSignal = champs.volumeSignal / 100;
    config.typeVoix = champs.typeVoix;
    typeVoix = champs.typeVoix;
    appliquerVoix();
    initAudioCtx();
    await parler('Test de la voix. Le rectangle des vitesses est prêt.');
    sonMarqueur();
};

window.rectangleArreter = function() {
    arretDemande = true;
    sequenceEnCours = false;
    annulerParole();
    arreterChrono();
};

window.rectangleLancer = async function() {
    if (!config) return alert('Config introuvable.');
    if (sequenceEnCours) return alert('Une séance est déjà en cours.');

    const champs = lireChamps();
    config.dureeSequence = champs.duree;
    config.nbSequences = champs.nb;
    config.annonceParole = champs.annonce;
    config.volumeSignal = champs.volumeSignal / 100;
    config.typeVoix = champs.typeVoix;
    typeVoix = champs.typeVoix;
    appliquerVoix();
    sauverConfig();

    initAudioCtx();
    sequenceEnCours = true;
    arretDemande = false;

    try {
        await lancerSegments();
        annulerParole();
        if (!arretDemande) await parler('Séance terminée. Bravo !');
    } finally {
        sequenceEnCours = false;
        arretDemande = false;
        annulerParole();
        arreterChrono();
    }
};

// Liaison du slider de volume
document.addEventListener('input', (e) => {
    if (e.target?.id === 'rvVolumeSignal') syncVolumeSignal();
});