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

        // Nettoyer les anciens écouteurs
        if (currentConfigListener) {
            currentConfigListener();
            currentConfigListener = null;
        }
        if (arcathlonConfigListener) {
            arcathlonConfigListener();
            arcathlonConfigListener = null;
        }

        // Écouter la configuration principale
        const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/config`);
        currentConfigListener = onValue(configRef, (snap) => {
            const config = snap.val();
            console.log('[eleve] Config principale reçue :', config);
            if (config && config.activite) {
                currentConfig = config;
                if (config.activite === 'arcathlon') {
                    // Si l'activité est déjà détectée via la config principale
                    console.log('[eleve] Activité Arcathlon détectée (config principale)');
                    showLogin();
                } else if (['escalade', 'co', 'orientshow', 'badminton', 'multi'].includes(config.activite)) {
                    // Pour les autres activités
                    currentConfig = config;
                    showLogin();
                } else {
                    showWaiting();
                }
            } else {
                // Si la config principale ne contient pas encore d'activité,
                // on vérifie si une config Arcathlon existe dans le sous-chemin
                const arcConfigRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/arcathlon/config`);
                if (arcathlonConfigListener) arcathlonConfigListener();
                arcathlonConfigListener = onValue(arcConfigRef, (snap) => {
                    const arcConfig = snap.val();
                    console.log('[eleve] Config Arcathlon (sous-chemin) reçue :', arcConfig ? 'présente' : 'absente');
                    if (arcConfig && Object.keys(arcConfig).length > 0) {
                        // On simule une config Arcathlon pour l'affichage
                        currentConfig = { activite: 'arcathlon' };
                        console.log('[eleve] Activité Arcathlon détectée via sous-chemin');
                        showLogin();
                    } else {
                        // Sinon, on reste en attente
                        showWaiting();
                    }
                }, { onlyOnce: true }); // On écoute une seule fois pour ne pas surcharger
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

    // SPÉCIAL ARCATHLON
    if (config.activite === 'arcathlon') {
        loginScreen.classList.add('hidden');
        activityScreen.classList.remove('hidden');

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
            arcModule.className = 'hidden space-y-4 module';
            activityScreen.appendChild(arcModule);
        }
        arcModule.classList.remove('hidden');

        // Récupérer les équipes depuis Firebase (sous-chemin)
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const arcConfigRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/arcathlon/config`);
        onValue(arcConfigRef, (snap) => {
            const arcConfig = snap.val();
            console.log('[eleve] Chargement des équipes Arcathlon :', arcConfig);
            const equipes = arcConfig?.equipes || {};
            let html = '';
            let hasCodes = false;
            for (const [eqId, eqData] of Object.entries(equipes)) {
                const membres = eqData.membres || [];
                for (const m of membres) {
                    if (m.absent || m.inapte) continue;
                    const code = `${eqId}_${m.maillot}`;
                    html += `<button class="bg-blue-600 p-4 rounded-xl font-black text-white text-xl active:scale-95 transition-transform" onclick="window.selectArcathlonCode('${code}')">${code}</button>`;
                    hasCodes = true;
                }
            }
            if (!hasCodes) {
                html = '<p class="text-red-400 text-center">Aucun maillot disponible dans votre équipe.<br>Contactez votre professeur.</p>';
            }
            arcModule.innerHTML = `
                <div class="text-center py-6">
                    <h2 class="text-2xl font-black text-white mb-4">Choisis ton maillot</h2>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-md mx-auto">
                        ${html}
                    </div>
                    <button onclick="window.retourClasseArcathlon()" class="mt-6 bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                        ← Changer de classe
                    </button>
                </div>
            `;
        }, { onlyOnce: true });

        window.selectArcathlonCode = (code) => {
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

// Exposition globale pour les boutons HTML
window.sendEscalade = sendEscaladeAction;
window.sendBalise = () => { console.log("Balise envoyée"); };
window.startChrono = () => { console.log("Chrono démarré"); };
window.stopChrono = () => { console.log("Chrono arrêté"); };
window.validateOSPassage = validateOSPassage;
window.resetToLogin = resetToLogin;

// Exportations pour les modules
export function getSelectedClass() { return selectedClass; }
export function getSelectedCode() { return selectedCode; }
export function getDB() { return db; }
export function getConfig() { return currentConfig; }
export function resetToLogin() { showLogin(); }