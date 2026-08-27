import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { getPerformancePath } from '../../core/firebase-service.js';
import { calculateClimbingPoints, BAREME } from '../../modules/escalade/escalade-calculations.js';
import { BAREME_ESCALADE } from '../../config/constants.js';
import { initEscaladeKiosk, sendEscalade as sendEscaladeAction } from '../../modules/eleve/escalade-kiosk.js';
import { showFeedback, showTeamMountain } from './eleve-actions.js';

const firebaseConfig = { databaseURL: "https://eps-arena-default-rtdb.europe-west1.firebasedatabase.app/" };
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

let selectedClass = "";
let selectedCode = "";
let currentConfig = null;

const classSelect = document.getElementById('class-select');
const waitingScreen = document.getElementById('waiting-screen');
const loginScreen = document.getElementById('login-screen');
const activityScreen = document.getElementById('activity-screen');
const codeList = document.getElementById('code-list');
const activityTitle = document.getElementById('activity-title');
const escaladeModule = document.getElementById('escalade-module');
const coModule = document.getElementById('co-module');
const multiModule = document.getElementById('multi-module');

// Récupération des classes disponibles
const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
const activeClassesRef = ref(db, `etablissements/0680013V/profs/${profCode}/active_classes`);
onValue(activeClassesRef, (snap) => {
    const data = snap.val() || {};
    classSelect.innerHTML = '<option value="">-- Choisir la classe --</option>' + 
        Object.keys(data).map(c => `<option value="${c}">${c}</option>`).join('');
});

classSelect.addEventListener('change', () => {
    selectedClass = classSelect.value;
    if (!selectedClass) return;
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/config`);
    onValue(configRef, (snap) => {
        currentConfig = snap.val();
        if (currentConfig) showLogin();
        else showWaiting();
    });
});

function showWaiting() {
    loginScreen.classList.add('hidden');
    activityScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
}

function showLogin() {
    waitingScreen.classList.add('hidden');
    activityScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    codeList.innerHTML = '';
    const config = currentConfig;
    activityTitle.innerText = "Choisis ton code";
    if (!config) {
        codeList.innerHTML = '<p class="text-red-400 text-center">Aucune activité transmise.<br>Veuillez patienter...</p>';
        return;
    }
    Object.keys(config).forEach(key => {
        if (key === 'activite') return;
        let count = 0;
        if (typeof config[key] === 'number') count = config[key];
        else if (Array.isArray(config[key])) count = config[key].length;
        for (let i = 0; i < count; i++) {
            const code = `${key}${i + 1}`;
            const btn = document.createElement('button');
            btn.className = "bg-blue-600 p-4 rounded-xl font-black text-white text-xl";
            btn.innerText = code;
            btn.onclick = () => selectCode(code);
            codeList.appendChild(btn);
        }
    });
}

function selectCode(code) {
    selectedCode = code;
    document.getElementById('selected-code').innerText = code;
    loginScreen.classList.add('hidden');
    activityScreen.classList.remove('hidden');
    escaladeModule.classList.add('hidden');
    coModule.classList.add('hidden');
    multiModule.classList.add('hidden');
    if (currentConfig.activite === 'escalade') {
        escaladeModule.classList.remove('hidden');
        initEscaladeKiosk(selectedClass, selectedCode);
    } else if (currentConfig.activite === 'co') {
        coModule.classList.remove('hidden');
    } else {
        multiModule.classList.remove('hidden');
    }
}

// ✅ Exposition globale des fonctions (SANS collision !)
window.sendEscalade = sendEscaladeAction;
window.sendBalise = () => { console.log("Balise envoyée"); };
window.startChrono = () => { console.log("Chrono démarré"); };
window.stopChrono = () => { console.log("Chrono arrêté"); };

export function getSelectedClass() { return selectedClass; }
export function getSelectedCode() { return selectedCode; }
export function getDB() { return db; }
export function getConfig() { return currentConfig; }
export function resetToLogin() { showLogin(); }

showWaiting();