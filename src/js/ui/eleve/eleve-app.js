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

const firebaseConfig = { databaseURL: "https://eps-arena-default-rtdb.europe-west1.firebasedatabase.app/" };
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

let selectedClass = "";
let selectedCode = "";
let currentConfig = null;
let currentConfigListener = null;
let arcathlonConfigListener = null;

const classSelect = document.getElementById('class-select');
const waitingScreen = document.getElementById('waiting-screen');
const loginScreen = document.getElementById('login-screen');
const activityScreen = document.getElementById('activity-screen');
const codeList = document.getElementById('code-list');
const activityTitle = document.getElementById('activity-title');
const escaladeModule = document.getElementById('escalade-module');
const coModule = document.getElementById('co-module');
const multiModule = document.getElementById('multi-module');
const osModule = document.getElementById('orientshow-module');
const badmintonModule = document.getElementById('badminton-module');

export function initApp() {
    currentConfig = null;
    showWaiting();

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
        classSelect.innerHTML = '<option value="">-- Choisir la classe --</option>' + 
            Object.keys(data).map(c => `<option value="${c}">${c}</option>`).join('');
    });

    classSelect.addEventListener('change', () => {
        selectedClass = classSelect.value;
        if (!selectedClass) return;

        if (currentConfigListener) {
            currentConfigListener();
            currentConfigListener = null;
        }
        if (arcathlonConfigListener) {
            arcathlonConfigListener();
            arcathlonConfigListener = null;
        }

        const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/config`);
        currentConfigListener = onValue(configRef, (snap) => {
            const config = snap.val();
            console.log('[eleve] Config principale reçue :', config);
            if (config && config.activite) {
                currentConfig = config;
                if (config.activite === 'arcathlon') {
                    console.log('[eleve] Activité Arcathlon détectée (config principale)');
                    showLoginArcathlon();
                } else if (['escalade', 'co', 'orientshow', 'badminton', 'multi'].includes(config.activite)) {
                    currentConfig = config;
                    showLogin();
                } else {
                    showWaiting();
                }
            } else {
                // Vérifier si une config Arcathlon existe
                const arcConfigRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/arcathlon/config`);
                if (arcathlonConfigListener) arcathlonConfigListener();
                arcathlonConfigListener = onValue(arcConfigRef, (snap) => {
                    const arcConfig = snap.val();
                    console.log('[eleve] Config Arcathlon (sous-chemin) reçue :', arcConfig ? 'présente' : 'absente');
                    if (arcConfig && Object.keys(arcConfig).length > 0) {
                        currentConfig = { activite: 'arcathlon' };
                        console.log('[eleve] Activité Arcathlon détectée via sous-chemin');
                        showLoginArcathlon();
                    } else {
                        showWaiting();
                    }
                }, { onlyOnce: true });
            }
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
    
    if (!config || Object.keys(config).length === 0) {
        codeList.innerHTML = '<p class="text-red-400 text-center">Aucune activité transmise.<br>Veuillez patienter...</p>';
        return;
    }

    // SPÉCIAL BADMINTON
    if (config.activite === 'badminton') {
        loginScreen.classList.add('hidden');
        activityScreen.classList.remove('hidden');
        escaladeModule.classList.add('hidden');
        coModule.classList.add('hidden');
        multiModule.classList.add('hidden');
        if (osModule) osModule.classList.add('hidden');
        document.getElementById('code-info').classList.add('hidden');
        document.getElementById('btn-quit').classList.add('hidden');
        document.getElementById('btn-back-terrain').classList.remove('hidden');
        document.getElementById('main-container').classList.remove('max-w-md');
        document.getElementById('main-container').classList.add('max-w-7xl');
        badmintonModule.classList.remove('hidden');
        console.log('Lancement Badminton pour classe :', selectedClass);
        initBadmintonKiosk(selectedClass);
        return;
    }

    // Pour les autres activités (escalade, co, multi, orientshow)
    badmintonModule.classList.add('hidden');
    document.getElementById('code-info').classList.remove('hidden');
    document.getElementById('btn-quit').classList.remove('hidden');
    document.getElementById('btn-back-terrain').classList.add('hidden');

    Object.keys(config).forEach(key => {
        if (key === 'activite' || key === 'matrice' || key === 'startTime' || key === 'endTime') return;
        let count = 0;
        if (typeof config[key] === 'number') count = config[key];
        else if (Array.isArray(config[key])) count = config[key].length;
        for (let i = 0; i < count; i++) {
            const code = `${key}${i + 1}`;
            const btn = document.createElement('button');
            btn.className = "bg-blue-600 p-4 rounded-xl font-black text-white text-xl active:scale-95 transition-transform";
            btn.innerText = code;
            btn.onclick = () => selectCode(code);
            codeList.appendChild(btn);
        }
    });
}

// ============================================================
// SPÉCIAL ARCATHLON : sélection équipe → PIN → maillot
// ============================================================
function showLoginArcathlon() {
    waitingScreen.classList.add('hidden');
    loginScreen.classList.add('hidden');
    activityScreen.classList.remove('hidden');

    // Cacher les autres modules
    escaladeModule.classList.add('hidden');
    coModule.classList.add('hidden');
    multiModule.classList.add('hidden');
    if (osModule) osModule.classList.add('hidden');
    badmintonModule.classList.add('hidden');

    document.getElementById('code-info').classList.add('hidden');
    document.getElementById('btn-quit').classList.add('hidden');
    document.getElementById('btn-back-terrain').classList.remove('hidden');

    let arcModule = document.getElementById('arcathlon-module');
    if (!arcModule) {
        arcModule = document.createElement('div');
        arcModule.id = 'arcathlon-module';
        arcModule.className = 'space-y-4 module';
        activityScreen.appendChild(arcModule);
    }
    arcModule.classList.remove('hidden');

    // Étape 1 : afficher les équipes disponibles
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const arcConfigRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/arcathlon/config`);
    onValue(arcConfigRef, (snap) => {
        const arcConfig = snap.val();
        const equipes = arcConfig?.equipes || {};
        let html = `<div class="text-center py-6"><h2 class="text-2xl font-black text-white mb-4">Choisis ton équipe</h2><div class="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-md mx-auto">`;
        let hasEquipes = false;
        for (const [eqId, eqData] of Object.entries(equipes)) {
            const membres = eqData.membres || [];
            const presents = membres.filter(m => !m.absent && !m.inapte);
            if (presents.length === 0) continue;
            hasEquipes = true;
            html += `<button class="bg-blue-600 p-4 rounded-xl font-black text-white text-xl active:scale-95 transition-transform" onclick="window.selectEquipeArcathlon('${eqId}')">${eqId}</button>`;
        }
        if (!hasEquipes) {
            html = '<p class="text-red-400 text-center">Aucune équipe disponible avec des membres présents.</p>';
        } else {
            html += '</div></div>';
        }
        arcModule.innerHTML = html;
    }, { onlyOnce: true });

    // Fonctions globales pour les étapes
    window.selectEquipeArcathlon = (equipeId) => {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const arcConfigRef2 = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/arcathlon/config`);
        onValue(arcConfigRef2, (snap) => {
            const arcConfig = snap.val();
            const equipes = arcConfig?.equipes || {};
            const eqData = equipes[equipeId];
            if (!eqData) {
                alert('Équipe introuvable.');
                return;
            }
            const pin = eqData.pin || '000';
            // Étape 2 : saisie du PIN
            arcModule.innerHTML = `
                <div class="text-center py-6">
                    <h2 class="text-2xl font-black text-white mb-2">Équipe ${equipeId}</h2>
                    <p class="text-sm text-slate-400 mb-4">Entrez le code PIN (3 chiffres)</p>
                    <div id="pinDisplay" class="bg-slate-950 border-2 border-slate-700 w-48 h-14 rounded-xl flex items-center justify-center text-3xl font-mono tracking-[0.6em] mb-4 text-emerald-400 shadow-inner mx-auto"></div>
                    <div class="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                        ${[1,2,3,4,5,6,7,8,9].map(n => `<button onclick="window.addPinArcathlon(${n})" class="bg-slate-800 w-16 h-16 rounded-xl text-2xl font-black active:bg-blue-600">${n}</button>`).join('')}
                        <button onclick="window.clearPinArcathlon()" class="bg-red-950 text-red-400 w-16 h-16 rounded-xl text-xs font-black uppercase border border-red-800 active:bg-red-800">Effacer</button>
                        <button onclick="window.addPinArcathlon(0)" class="bg-slate-800 w-16 h-16 rounded-xl text-2xl font-black active:bg-blue-600">0</button>
                        <button onclick="window.validatePinArcathlon('${equipeId}')" class="bg-emerald-600 text-white w-16 h-16 rounded-xl text-xs font-black uppercase border-2 border-emerald-400 active:bg-emerald-700">OK</button>
                    </div>
                    <button onclick="window.retourChoixEquipeArcathlon()" class="mt-6 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                        ← Changer d'équipe
                    </button>
                </div>
            `;

            let inputPin = '';
            window.addPinArcathlon = (num) => {
                if (inputPin.length < 3) {
                    inputPin += num;
                    document.getElementById('pinDisplay').textContent = '•'.repeat(inputPin.length);
                }
            };
            window.clearPinArcathlon = () => {
                inputPin = '';
                document.getElementById('pinDisplay').textContent = '';
            };
            window.validatePinArcathlon = (eqId) => {
                if (inputPin === pin) {
                    // Étape 3 : choisir le maillot
                    const membres = eqData.membres || [];
                    const presents = membres.filter(m => !m.absent && !m.inapte);
                    let html = `<div class="text-center py-6"><h2 class="text-2xl font-black text-white mb-4">Choisis ton maillot</h2><div class="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-md mx-auto">`;
                    presents.forEach(m => {
                        const code = `${eqId}_${m.maillot}`;
                        html += `<button class="bg-blue-600 p-4 rounded-xl font-black text-white text-xl active:scale-95 transition-transform" onclick="window.selectMaillotArcathlon('${code}')">${m.maillot}</button>`;
                    });
                    if (presents.length === 0) {
                        html = '<p class="text-red-400 text-center">Aucun maillot disponible.</p>';
                    } else {
                        html += '</div></div>';
                    }
                    arcModule.innerHTML = html;
                } else {
                    alert('❌ Code PIN incorrect.');
                    window.clearPinArcathlon();
                }
            };
            window.retourChoixEquipeArcathlon = () => {
                // Revenir à l'étape 1
                showLoginArcathlon();
            };
        }, { onlyOnce: true });
    };

    window.selectMaillotArcathlon = (code) => {
        selectedCode = code;
        arcModule.innerHTML = '<div class="text-center py-10 text-slate-400"><p>Chargement...</p></div>';
        import('../../modules/arcathlon/arcathlon-kiosk.js')
            .then(m => {
                m.initArcathlonKiosk(selectedClass, selectedCode);
            })
            .catch(err => {
                console.error('Erreur chargement Arcathlon :', err);
                arcModule.innerHTML = `
                    <div class="text-center py-10 text-red-400">
                        <p>❌ Erreur de chargement du module.</p>
                        <p class="text-xs text-slate-500 mt-2">${err.message}</p>
                        <button onclick="window.retourClasseArcathlon()" class="mt-4 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                            ← Retour
                        </button>
                    </div>
                `;
            });
    };

    window.retourClasseArcathlon = () => {
        activityScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        if (arcModule) arcModule.classList.add('hidden');
        showLogin();
    };
}

function selectCode(code) {
    selectedCode = code;
    document.getElementById('selected-code').innerText = code;
    loginScreen.classList.add('hidden');
    activityScreen.classList.remove('hidden');
    
    escaladeModule.classList.add('hidden');
    coModule.classList.add('hidden');
    multiModule.classList.add('hidden');
    if (osModule) osModule.classList.add('hidden');
    badmintonModule.classList.add('hidden');

    if (currentConfig.activite === 'escalade') {
        escaladeModule.classList.remove('hidden');
        initEscaladeKiosk(selectedClass, selectedCode);
    } else if (currentConfig.activite === 'co') {
        coModule.classList.remove('hidden');
    } else if (currentConfig.activite === 'orientshow') {
        if (osModule) {
            osModule.classList.remove('hidden');
            initOrientShowKiosk(selectedClass, selectedCode);
        }
    } else if (currentConfig.activite === 'arcathlon') {
        // Cas de secours (si on arrive ici via un appel direct)
        let arcModule = document.getElementById('arcathlon-module');
        if (!arcModule) {
            arcModule = document.createElement('div');
            arcModule.id = 'arcathlon-module';
            arcModule.className = 'hidden space-y-4 module';
            activityScreen.appendChild(arcModule);
        }
        arcModule.classList.remove('hidden');
        arcModule.innerHTML = '<div class="text-center py-10 text-slate-400"><p>Chargement...</p></div>';
        import('../../modules/arcathlon/arcathlon-kiosk.js')
            .then(m => {
                m.initArcathlonKiosk(selectedClass, selectedCode);
            })
            .catch(err => {
                console.error('Erreur chargement Arcathlon :', err);
                arcModule.innerHTML = `
                    <div class="text-center py-10 text-red-400">
                        <p>❌ Erreur de chargement du module.</p>
                        <button onclick="window.resetToLogin()" class="mt-4 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                            ← Retour
                        </button>
                    </div>
                `;
            });
    } else {
        multiModule.classList.remove('hidden');
    }
}

// Exposition globale
window.sendEscalade = sendEscaladeAction;
window.sendBalise = () => { console.log("Balise envoyée"); };
window.startChrono = () => { console.log("Chrono démarré"); };
window.stopChrono = () => { console.log("Chrono arrêté"); };
window.validateOSPassage = validateOSPassage;
window.resetToLogin = resetToLogin;

export function getSelectedClass() { return selectedClass; }
export function getSelectedCode() { return selectedCode; }
export function getDB() { return db; }
export function getConfig() { return currentConfig; }
export function resetToLogin() { showLogin(); }