// src/js/ui/eleve/eleve-app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { getPerformancePath } from '../../core/firebase-service.js';
import { calculateClimbingPoints, BAREME } from '../../modules/escalade/escalade-calculations.js';
import { BAREME_ESCALADE } from '../../config/constants.js';
import { initEscaladeKiosk, sendEscalade as sendEscaladeAction } from '../../modules/eleve/escalade-kiosk.js';
import { showFeedback, showTeamMountain } from './eleve-actions.js';
import { initBadmintonKiosk } from '../../modules/badminton/badminton-kiosk.js';
import { initOrientShowKiosk, validateOSPassage } from '../../modules/eleve/orientshow-kiosk.js';

const badmintonModule = document.getElementById('badminton-module');
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
const osModule = document.getElementById('orientshow-module'); // Nouveau

// FONCTION D'INITIALISATION (EXPORTÉE)
export function initApp() {
    const profCodeInput = document.getElementById('profCodeInput');
    let profCode = profCodeInput ? profCodeInput.value.trim() : '';
    if (!profCode) profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    if (profCodeInput) {
        profCodeInput.value = profCode;
        profCodeInput.addEventListener('change', () => {
            localStorage.setItem('eps_arena_profCode', profCodeInput.value.trim());
            location.reload();
        });
    }
    localStorage.setItem('eps_arena_profCode', profCode);
    console.log('[eleve] profCode utilisé :', profCode);

    const activeClassesRef = ref(db, `etablissements/0680013V/profs/${profCode}/active_classes`);
    onValue(activeClassesRef, (snap) => {
        const data = snap.val() || {};
        console.log('[eleve] Données active_classes reçues :', data);
        classSelect.innerHTML = '<option value="">-- Choisir la classe --</option>' + 
            Object.keys(data).map(c => `<option value="${c}">${c}</option>`).join('');
    });

    classSelect.addEventListener('change', () => {
        selectedClass = classSelect.value;
        console.log('[eleve] Classe sélectionnée :', selectedClass);
        if (!selectedClass) return;
        const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/config`);
        onValue(configRef, (snap) => {
            currentConfig = snap.val();
            console.log('[eleve] Config reçue :', currentConfig);
            if (currentConfig) showLogin();
            else showWaiting();
        });
    });

    showWaiting();
}

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

    // --- SPÉCIAL BADMINTON : On saute la sélection de codes et on lance l'assistant ---
    if (config.activite === 'badminton') {
        loginScreen.classList.add('hidden'); // Cache l'écran de login
        activityScreen.classList.remove('hidden'); // Affiche l'activité
        const badmintonModule = document.getElementById('badminton-module');
        badmintonModule.classList.remove('hidden');
        initBadmintonKiosk(selectedClass); // Lance l'assistant (Terrain -> Joueur)
        return;
    }

    // --- AUTRES ACTIVITÉS (Escalade, CO, etc. - Code actuel) ---
    Object.keys(config).forEach(key => {
        if (key === 'activite' || key === 'matrice' || key === 'startTime' || key === 'endTime') return;
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
    badmintonModule.classList.add('hidden');
    if (osModule) osModule.classList.add('hidden');

     if (currentConfig.activite === 'badminton') {
    document.getElementById('code-info').classList.add('hidden');
    document.getElementById('btn-quit').classList.add('hidden');
    document.getElementById('btn-back-terrain').classList.remove('hidden');
} else {
    document.getElementById('code-info').classList.remove('hidden');
    document.getElementById('btn-quit').classList.remove('hidden');
    document.getElementById('btn-back-terrain').classList.add('hidden');
}

    if (currentConfig.activite === 'escalade') {
        escaladeModule.classList.remove('hidden');
        initEscaladeKiosk(selectedClass, selectedCode);
    } else if (currentConfig.activite === 'co') {
        coModule.classList.remove('hidden');
        // initCOKiosk(selectedClass, selectedCode); // si créé
    } else if (currentConfig.activite === 'orientshow') {
        if (osModule) {
            osModule.classList.remove('hidden');
            // Initialiser le kiosque avec la classe et le code
            initOrientShowKiosk(selectedClass, selectedCode);
        } else {
            console.warn("Module OrientShow non trouvé dans le DOM");
        }
    } else {
        multiModule.classList.remove('hidden');
    }
}

// Exposition globale des fonctions
window.sendEscalade = sendEscaladeAction;
window.sendBalise = () => { console.log("Balise envoyée"); };
window.startChrono = () => { console.log("Chrono démarré"); };
window.stopChrono = () => { console.log("Chrono arrêté"); };
window.validateOSPassage = validateOSPassage; // Pour le bouton de validation

export function getSelectedClass() { return selectedClass; }
export function getSelectedCode() { return selectedCode; }
export function getDB() { return db; }
export function getConfig() { return currentConfig; }
export function resetToLogin() { showLogin(); }