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
    const configRef = ref(db, `${currentClasse}/config`);
    currentConfigUnsub = onValue(configRef, (snap) => {
        configData = snap.val() || {};
        // On notifie les modules que la config a changé
        window.dispatchEvent(new CustomEvent('live-config-updated', { detail: configData }));
    });
}

function startListening() {
    if (currentUnsub) currentUnsub();
    allEscaladeData = {};
    if (!currentClasse) return;

    currentUnsub = listenToActivityData(currentClasse, (type, data) => {
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

export function getEleveIdFromCode(code) {
    if (code.length < 2) return null;
    const lettre = code.slice(0, 1);
    const index = parseInt(code.slice(1)) - 1; 
    const localMap = getLocalMapping();
    const key = `${currentClasse}_${lettre}`;
    if (localMap[key] && localMap[key][index]) return localMap[key][index];
    return null;
}

export function getNomFromCode(code) {
    const eleveId = getEleveIdFromCode(code);
    if (eleveId) {
        const studentsMap = getStudentsMap();
        if (studentsMap[eleveId]) return studentsMap[eleveId];
    }
    return code;
}

export async function getPhotoHtml(code) {
    const eleveId = getEleveIdFromCode(code);
    if (eleveId) {
        const url = await getPhotoUrl(eleveId);
        if (url) return `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`;
    }
    return `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
}

export function coeffToCotation(coeff) {
    const echelle = [
        { cotation: '4a', coeff: 1.0 },
        { cotation: '4b', coeff: 1.1 },
        { cotation: '4c', coeff: 1.2 },
        { cotation: '5a', coeff: 1.3 },
        { cotation: '5b', coeff: 1.4 },
        { cotation: '5c', coeff: 1.5 },
        { cotation: '6a', coeff: 1.6 },
        { cotation: '6b', coeff: 1.8 },
        { cotation: '6c', coeff: 2.0 }
    ];
    let closest = echelle[0];
    let minDiff = Math.abs(coeff - echelle[0].coeff);
    for (let i = 1; i < echelle.length; i++) {
        const diff = Math.abs(coeff - echelle[i].coeff);
        if (diff < minDiff) { minDiff = diff; closest = echelle[i]; }
    }
    return closest.cotation;
}