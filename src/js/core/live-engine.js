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
    const configRef = ref(db, `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}/${currentClasse}/config`);
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