// src/js/core/live-engine.js
import { listenToActivityData, ref, onValue } from './firebase-service.js';
import { db } from './firebase-service.js';
import { getPhotoUrl } from '../services/admin-service.js';

let currentClasse = "";
let currentUnsub = null;
let currentConfigUnsub = null;
let configData = {};
let allEscaladeData = {};

export function initLiveEngine() {
    const select = document.getElementById('selectClasse');

    // Initialisation au chargement avec la classe actuelle
    if (select && select.value) {
        currentClasse = select.value;
        startListening();
        loadConfig();
    }

    if (select) {
        select.addEventListener('change', () => {
            const newClasse = select.value;
            if (newClasse !== currentClasse) {
                currentClasse = newClasse;
                startListening();
                loadConfig();
            }
        });
    }
}

async function loadConfig() {
    if (currentConfigUnsub) currentConfigUnsub();
    if (!currentClasse) return;
    configData = {};
    const configRef = ref(db, `${currentClasse}/config`); // Chemin pour la config
    currentConfigUnsub = onValue(configRef, (snap) => {
        configData = snap.val() || {};
        // Debug : Vérifie quelle config est reçue
        console.log("📡 Config reçue dans live-engine :", configData);
        window.dispatchEvent(new CustomEvent('live-config-updated', { detail: configData }));
    });
}

function startListening() {
    if (currentUnsub) currentUnsub();
    allEscaladeData = {};
    if (!currentClasse) return;
    currentUnsub = listenToActivityData(currentClasse, (type, data) => {
        // Debug : Vérifie quelles données arrivent
        console.log(`📡 Données reçues pour ${type} :`, Object.keys(data).length, "performances");
        if (type === 'escalade') allEscaladeData = data;
        window.dispatchEvent(new CustomEvent('live-data-updated', { detail: { type, data } }));
    });
}

export function getCurrentClasse() { return currentClasse; }
export function getConfigData() { return configData; }
export function getEscaladeData() { return allEscaladeData; }

export function getStudentsMap() {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const map = {};
    eleves.forEach(e => { map[e.id] = `${e.prenom} ${e.nom}`; });
    return map;
}

export function getLocalMapping() {
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    return mapping;
}