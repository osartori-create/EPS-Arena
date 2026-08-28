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
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`);
    currentConfigUnsub = onValue(configRef, (snap) => {
        configData = snap.val() || {};
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

export function getLocalMapping(classe = currentClasse) {
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${classe}`) || '{}');
    return mapping;
}

export function getEleveIdFromCode(code) {
    // Format 1 : Plat ("504_A1") -> recherche directe
    const cleComplete = `${currentClasse}_${code}`;
    const localMap = getLocalMapping();
    if (localMap[cleComplete]) return localMap[cleComplete];

    // Format 2 : Imbriqué ("504_A" -> ["ID1", "ID2"])
    const match = code.match(/^([A-Z]+)(\d+)$/);
    if (match) {
        const lettre = match[1];
        const index = parseInt(match[2]) - 1;
        const cleImbriquee = `${currentClasse}_${lettre}`;
        if (localMap[cleImbriquee] && Array.isArray(localMap[cleImbriquee])) {
            if (localMap[cleImbriquee][index]) return localMap[cleImbriquee][index];
        }
    }

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
        try {
            const url = await getPhotoUrl(eleveId);
            if (url) return `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`;
        } catch (e) { /* Ignorer les erreurs de photo */ }
    }
    return `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
}
export function setLocalMapping(classe, mapping) {
    const key = `eps_arena_local_mapping_${classe}`;
    localStorage.setItem(key, JSON.stringify(mapping));
}
