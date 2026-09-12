// src/js/ui/eleve/eleve-app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { getPerformancePath } from '../../core/firebase-service.js';
import { calculateClimbingPoints, BAREME } from '../../modules/escalade/escalade-calculations.js';
import { BAREME_ESCALADE } from '../../config/constants.js';
import { initEscaladeKiosk, sendEscalade as sendEscaladeAction } from '../../modules/eleve/escalade-kiosk.js';
import { showFeedback, showTeamMountain } from './eleve-actions.js';
import { initBadmintonKiosk } from '../../modules/badminton/badminton-dispatcher.js';
import { initOrientShowKiosk } from '../../modules/eleve/orientshow-kiosk.js';
import { initTournoi } from '../../modules/tournoi/tournoi-dispatcher.js';
import { initBlocKiosk, cleanupBlocKiosk } from '../../modules/escalade/escalade-kiosk-blocs.js';
import { initNatationKiosk } from '../../modules/natation/natation-kiosk.js';
import { initRelaisKiosk, cleanupRelaisKiosk } from '../../modules/relais/relais-kiosk.js';
import { initGrillesKiosk, cleanupGrillesKiosk } from '../../modules/grilles/grilles-kiosk.js';

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
const natationModule = document.getElementById('natation-module');
const relaisModule = document.getElementById('relais-module');
const grillesModule = document.getElementById('grilles-module');

const codeInfo = document.getElementById('code-info');
const btnQuit = document.getElementById('btn-quit');
const btnBackTerrain = document.getElementById('btn-back-terrain');

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
                } else if (config.activite === 'natation') {
                    console.log('[eleve] Activité Natation détectée');
                    masquerElementsCO();
                    showLoginNatation();
                } else if (config.activite === 'relais') {
                    console.log('[eleve] Activité Relais détectée');
                    masquerElementsCO();
                    showLoginRelais();
                } else if (config.activite === 'grilles') {
                    console.log('[eleve] Activité Auto-évaluation détectée');
                    masquerElementsCO();
                    showLoginGrilles();
                } else if (['escalade', 'co', 'orientshow', 'badminton', 'multi', 'tournoi', 'bloccontest'].includes(config.activite)) {
                    currentConfig = config;
                    afficherElementsCO();
                    showLogin();
                } else {
                    showWaiting();
                }
            } else {
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

// ============================================================
// MASQUAGE / AFFICHAGE DES ÉLÉMENTS CO
// ============================================================
function masquerElementsCO() {
    if (codeInfo) codeInfo.style.display = 'none';
    if (btnQuit) btnQuit.style.display = 'none';
    if (btnBackTerrain) btnBackTerrain.style.display = 'none';
}

function afficherElementsCO() {
    if (codeInfo) codeInfo.style.display = '';
    if (btnQuit) btnQuit.style.display = '';
    if (btnBackTerrain) btnBackTerrain.style.display = 'none';
}

function masquerTousLesModules() {
    if (escaladeModule) escaladeModule.classList.add('hidden');
    if (coModule) coModule.classList.add('hidden');
    if (multiModule) multiModule.classList.add('hidden');
    if (osModule) osModule.classList.add('hidden');
    if (badmintonModule) badmintonModule.classList.add('hidden');
    if (natationModule) natationModule.classList.add('hidden');
    if (relaisModule) relaisModule.classList.add('hidden');
    if (grillesModule) grillesModule.classList.add('hidden');
}

// ============================================================
// ÉCRANS
// ============================================================
function showWaiting() {
    loginScreen.classList.add('hidden');
    activityScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    afficherElementsCO();
}

function showLogin() {
    setContainerWidth(false);
    afficherElementsCO();
    
    loginScreen.classList.remove('hidden');
    activityScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    codeList.innerHTML = '';
    const config = currentConfig;
    activityTitle.innerText = "Choisis ton code";
    
    if (!config || Object.keys(config).length === 0) {
        codeList.innerHTML = '<p class="text-red-400 text-center">Aucune activité transmise.<br>Veuillez patienter...</p>';
        return;
    }

    // SPÉCIAL BADMINTON
    if (config.activite === 'badminton') {
        setContainerWidth(true);
        loginScreen.classList.add('hidden');
        activityScreen.classList.remove('hidden');
        masquerTousLesModules();
        codeInfo.classList.add('hidden');
        btnQuit.classList.add('hidden');
        btnBackTerrain.classList.remove('hidden');
        document.getElementById('main-container').classList.remove('max-w-md');
        document.getElementById('main-container').classList.add('max-w-7xl');
        badmintonModule.classList.remove('hidden');
        console.log('Lancement Badminton pour classe :', selectedClass);
        initBadmintonKiosk(selectedClass);
        return;
    }

    // SPÉCIAL TOURNOI
    if (config.activite === 'tournoi') {
        setContainerWidth(true);
        loginScreen.classList.add('hidden');
        activityScreen.classList.remove('hidden');
        masquerTousLesModules();
        codeInfo.classList.add('hidden');
        btnQuit.classList.add('hidden');
        btnBackTerrain.classList.add('hidden');
        document.getElementById('main-container').classList.remove('max-w-md');
        document.getElementById('main-container').classList.add('max-w-7xl');

        let tournoiModule = document.getElementById('tournoi-module');
        if (!tournoiModule) {
            tournoiModule = document.createElement('div');
            tournoiModule.id = 'tournoi-module';
            tournoiModule.className = 'space-y-4 module';
            activityScreen.appendChild(tournoiModule);
        }
        tournoiModule.classList.remove('hidden');
        console.log('🏆 Lancement Tournoi pour classe :', selectedClass);
        initTournoi(selectedClass, config.mode || 'elimination');
        return;
    }

    // SPÉCIAL BLOC CONTEST
    if (config.activite === 'bloccontest') {
        loginScreen.classList.remove('hidden');
        activityScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        codeList.innerHTML = '';
        activityTitle.innerText = "Choisis ton code";

        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const blocConfigRef = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/bloccontest/config`);
        onValue(blocConfigRef, (snap) => {
            const blocConfig = snap.val();
            if (blocConfig && blocConfig.groupes) {
                const groupes = blocConfig.groupes;
                Object.keys(groupes).forEach(lettre => {
                    const membres = groupes[lettre] || [];
                    membres.forEach((eleveId, index) => {
                        const code = `${lettre}${index + 1}`;
                        const btn = document.createElement('button');
                        btn.className = "bg-blue-600 p-4 rounded-xl font-black text-white text-xl active:scale-95 transition-transform";
                        btn.innerText = code;
                        btn.onclick = () => {
                            selectedCode = code;
                            document.getElementById('selected-code').innerText = code;
                            loginScreen.classList.add('hidden');
                            activityScreen.classList.remove('hidden');
                            masquerTousLesModules();
                            let blocContainer = document.getElementById('bloc-kiosk-container');
                            if (!blocContainer) {
                                blocContainer = document.createElement('div');
                                blocContainer.id = 'bloc-kiosk-container';
                                blocContainer.className = 'space-y-4 module';
                                activityScreen.appendChild(blocContainer);
                            }
                            blocContainer.style.display = 'block';
                            blocContainer.classList.remove('hidden');
                            import('../../modules/escalade/escalade-kiosk-blocs.js').then(module => {
                                module.initBlocKiosk(selectedClass, code);
                            }).catch(err => {
                                console.error('Erreur chargement Bloc Kiosk :', err);
                                blocContainer.innerHTML = `<div class="text-center py-10 text-red-400"><p>❌ Erreur de chargement du module.</p></div>`;
                            });
                        };
                        codeList.appendChild(btn);
                    });
                });
            } else {
                codeList.innerHTML = '<p class="text-slate-400 text-center">⏳ En attente de la configuration du professeur...</p>';
            }
        }, { onlyOnce: true });
        return;
    }

    // SPÉCIAL ORIENTSHOW
    if (config.activite === 'orientshow') {
        loginScreen.classList.remove('hidden');
        activityScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        codeList.innerHTML = '';
        activityTitle.innerText = "Choisis ton code";

        const couleurs = ['NOIR', 'ROUGE', 'BLEU', 'VERT', 'JAUNE'];
        const colorMap = {
            NOIR: 'bg-black text-white border-slate-600',
            ROUGE: 'bg-red-600 text-white border-red-900',
            BLEU: 'bg-blue-600 text-white border-blue-900',
            VERT: 'bg-green-600 text-white border-green-900',
            JAUNE: 'bg-yellow-500 text-black border-yellow-700'
        };
        let hasCodes = false;
        couleurs.forEach(couleur => {
            const count = config[couleur];
            if (count && typeof count === 'number' && count > 0) {
                hasCodes = true;
                const colorClass = colorMap[couleur] || 'bg-slate-700 text-white border-slate-600';
                for (let i = 1; i <= count; i++) {
                    const code = `${couleur}_${i}`;
                    const btn = document.createElement('button');
                    btn.className = `w-16 h-16 rounded-full border-2 ${colorClass} font-black text-2xl flex items-center justify-center transition-transform active:scale-95 hover:scale-105`;
                    btn.textContent = i;
                    btn.dataset.code = code;
                    btn.onclick = () => {
                        selectedCode = code;
                        document.getElementById('selected-code').innerText = code;
                        loginScreen.classList.add('hidden');
                        activityScreen.classList.remove('hidden');
                        masquerTousLesModules();
                        if (osModule) {
                            osModule.classList.remove('hidden');
                            osModule.style.display = 'block';
                            import('../../modules/eleve/orientshow-kiosk.js').then(module => {
                                module.initOrientShowKiosk(selectedClass, code, currentConfig);
                            }).catch(err => {
                                console.error('Erreur chargement OrientShow Kiosk :', err);
                                osModule.innerHTML = `<div class="text-center py-10 text-red-400"><p>❌ Erreur de chargement du module.</p></div>`;
                            });
                        }
                    };
                    codeList.appendChild(btn);
                }
            }
        });
        if (!hasCodes) {
            codeList.innerHTML = '<p class="text-slate-400 text-center">⏳ En attente de la configuration du professeur...</p>';
        }
        return;
    }

    // SPÉCIAL CO
    if (config.activite === 'co') {
        loginScreen.classList.remove('hidden');
        activityScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        codeList.innerHTML = '';
        activityTitle.innerText = "Choisis ton code";

        const letters = ['A','B','C','D','E','F'];
        letters.forEach(l => {
            for (let i = 1; i <= 6; i++) {
                const code = `${l}${i}`;
                const btn = document.createElement('button');
                btn.className = "bg-blue-600 p-4 rounded-xl font-black text-white text-xl active:scale-95 transition-transform";
                btn.innerText = code;
                btn.onclick = () => {
                    selectedCode = code;
                    document.getElementById('selected-code').innerText = code;
                    loginScreen.classList.add('hidden');
                    activityScreen.classList.remove('hidden');
                    masquerTousLesModules();
                    coModule.classList.remove('hidden');
                    coModule.style.display = 'block';
                    import('../../modules/co/co-kiosk.js').then(module => {
                        module.initCoKiosk(selectedClass, code);
                    }).catch(err => {
                        console.error('Erreur CO kiosk :', err);
                        coModule.innerHTML = `<div class="text-center py-10 text-red-400"><p>❌ Erreur de chargement du module.</p></div>`;
                    });
                };
                codeList.appendChild(btn);
            }
        });
        return;
    }

    // AUTRES ACTIVITÉS (escalade, multi)
    masquerTousLesModules();
    codeInfo.classList.remove('hidden');
    btnQuit.classList.remove('hidden');
    btnBackTerrain.classList.add('hidden');

    const ignoreKeys = ['activite', 'matrice', 'startTime', 'endTime', 'matrix', 'nbCircuits', 'nbCouleurs'];
    Object.keys(config).forEach(key => {
        if (ignoreKeys.includes(key)) return;
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
// SPÉCIAL NATATION
// ============================================================
function showLoginNatation() {
    loginScreen.classList.add('hidden');
    activityScreen.classList.remove('hidden');
    waitingScreen.classList.add('hidden');

    setContainerWidth(true);
    masquerTousLesModules();

    if (natationModule) {
        natationModule.classList.remove('hidden');
        natationModule.style.display = 'block';
        initNatationKiosk(selectedClass);
    } else {
        console.warn('Conteneur natation-module introuvable');
    }

    masquerElementsCO();
}

// ============================================================
// SPÉCIAL RELAIS
// ============================================================
function showLoginRelais() {
    loginScreen.classList.add('hidden');
    activityScreen.classList.remove('hidden');
    waitingScreen.classList.add('hidden');

    setContainerWidth(true);
    masquerTousLesModules();

    if (relaisModule) {
        relaisModule.classList.remove('hidden');
        relaisModule.style.display = 'block';
        initRelaisKiosk(selectedClass, '');
    } else {
        console.warn('Conteneur relais-module introuvable');
    }

    masquerElementsCO();
}

// ============================================================
// SPÉCIAL GRILLES (auto-évaluation)
// ============================================================
function showLoginGrilles() {
    loginScreen.classList.add('hidden');
    activityScreen.classList.remove('hidden');
    waitingScreen.classList.add('hidden');

    setContainerWidth(true);
    masquerTousLesModules();

    if (grillesModule) {
        grillesModule.classList.remove('hidden');
        grillesModule.style.display = 'block';
        initGrillesKiosk(selectedClass);
    } else {
        console.error('[eleve] Conteneur grilles-module introuvable !');
    }

    masquerElementsCO();
}

// ============================================================
// SPÉCIAL ARCATHLON
// ============================================================
function showLoginArcathlon() {
    waitingScreen.classList.add('hidden');
    loginScreen.classList.add('hidden');
    activityScreen.classList.remove('hidden');

    masquerTousLesModules();
    codeInfo.classList.add('hidden');
    btnQuit.classList.add('hidden');
    btnBackTerrain.classList.remove('hidden');

    let arcModule = document.getElementById('arcathlon-module');
    if (!arcModule) {
        arcModule = document.createElement('div');
        arcModule.id = 'arcathlon-module';
        arcModule.className = 'space-y-4 module';
        activityScreen.appendChild(arcModule);
    }
    arcModule.classList.remove('hidden');

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

    window.selectEquipeArcathlon = (equipeId) => {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const arcConfigRef2 = ref(db, `etablissements/0680013V/profs/${profCode}/${selectedClass}/arcathlon/config`);
        onValue(arcConfigRef2, (snap) => {
            const arcConfig = snap.val();
            const equipes = arcConfig?.equipes || {};
            const eqData = equipes[equipeId];
            if (!eqData) { alert('Équipe introuvable.'); return; }
            const pin = eqData.pin || '000';
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
            window.retourChoixEquipeArcathlon = () => { showLoginArcathlon(); };
        }, { onlyOnce: true });
    };

    window.selectMaillotArcathlon = (code) => {
        selectedCode = code;
        arcModule.innerHTML = '<div class="text-center py-10 text-slate-400"><p>Chargement...</p></div>';
        import('../../modules/arcathlon/arcathlon-kiosk.js')
            .then(m => { m.initArcathlonKiosk(selectedClass, selectedCode); })
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

// ============================================================
// SÉLECTION D'UN CODE
// ============================================================
function selectCode(code) {
    selectedCode = code;
    document.getElementById('selected-code').innerText = code;
    loginScreen.classList.add('hidden');
    activityScreen.classList.remove('hidden');

    masquerTousLesModules();

    if (currentConfig.activite === 'escalade') {
        escaladeModule.classList.remove('hidden');
        initEscaladeKiosk(selectedClass, selectedCode);
    }
    else if (currentConfig.activite === 'co') {
        coModule.classList.remove('hidden');
        console.log('CO kiosk à implémenter');
    }
    else if (currentConfig.activite === 'orientshow') {
        if (osModule) {
            osModule.classList.remove('hidden');
            osModule.style.display = 'block';
            import('../../modules/eleve/orientshow-kiosk.js').then(module => {
                module.initOrientShowKiosk(selectedClass, code, currentConfig);
            }).catch(err => {
                console.error('Erreur chargement OrientShow Kiosk :', err);
                osModule.innerHTML = `<div class="text-center py-10 text-red-400"><p>❌ Erreur de chargement du module.</p></div>`;
            });
        }
    }
    else if (currentConfig.activite === 'arcathlon') {
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
            .then(m => { m.initArcathlonKiosk(selectedClass, selectedCode); })
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
    }
    else if (currentConfig.activite === 'bloccontest') {
        let blocContainer = document.getElementById('bloc-kiosk-container');
        if (!blocContainer) {
            blocContainer = document.createElement('div');
            blocContainer.id = 'bloc-kiosk-container';
            blocContainer.className = 'space-y-4 module';
            activityScreen.appendChild(blocContainer);
        }
        blocContainer.style.display = 'block';
        blocContainer.classList.remove('hidden');
        import('../../modules/escalade/escalade-kiosk-blocs.js').then(module => {
            module.initBlocKiosk(selectedClass, code);
        }).catch(err => {
            console.error('Erreur chargement Bloc Kiosk :', err);
            blocContainer.innerHTML = `<div class="text-center py-10 text-red-400"><p>❌ Erreur de chargement du module.</p></div>`;
        });
    }
    else if (currentConfig.activite === 'natation') {
        if (natationModule) {
            natationModule.classList.remove('hidden');
            natationModule.style.display = 'block';
            masquerElementsCO();
            initNatationKiosk(selectedClass);
        }
    }
    else if (currentConfig.activite === 'relais') {
        if (relaisModule) {
            relaisModule.classList.remove('hidden');
            relaisModule.style.display = 'block';
            masquerElementsCO();
            initRelaisKiosk(selectedClass, '');
        }
    }
    else if (currentConfig.activite === 'grilles') {
        if (grillesModule) {
            grillesModule.classList.remove('hidden');
            grillesModule.style.display = 'block';
            masquerElementsCO();
            initGrillesKiosk(selectedClass);
        }
    }
    else {
        multiModule.classList.remove('hidden');
    }
}

// ============================================================
// EXPOSITION GLOBALE
// ============================================================
window.sendEscalade = sendEscaladeAction;
window.sendBalise = () => { console.log("Balise envoyée"); };
window.startChrono = () => { console.log("Chrono démarré"); };
window.stopChrono = () => { console.log("Chrono arrêté"); };
window.resetToLogin = resetToLogin;

// ============================================================
// EXPORTS
// ============================================================
export function getSelectedClass() { return selectedClass; }
export function getSelectedCode() { return selectedCode; }
export function getDB() { return db; }
export function getConfig() { return currentConfig; }

export function resetToLogin() {
    setContainerWidth(false);

    selectedCode = '';
    document.getElementById('selected-code').innerText = '--';

    if (osModule) {
        osModule.style.display = 'none';
        osModule.innerHTML = '';
    }
    if (natationModule) {
        natationModule.style.display = 'none';
        natationModule.innerHTML = '';
    }
    if (relaisModule) {
        relaisModule.style.display = 'none';
        relaisModule.innerHTML = '';
    }
    if (grillesModule) {
        grillesModule.style.display = 'none';
        grillesModule.innerHTML = '';
    }

    if (typeof cleanupGrillesKiosk === 'function') cleanupGrillesKiosk();
    if (typeof cleanupRelaisKiosk === 'function') cleanupRelaisKiosk();

    import('../../modules/eleve/orientshow-kiosk.js').then(module => {
        if (module.cleanupOrientShowKiosk) module.cleanupOrientShowKiosk();
    }).catch(() => {});

    afficherElementsCO();
    showLogin();
}

// ============================================================
// GESTION DE LA LARGEUR DU CONTENEUR
// ============================================================
const mainContainer = document.getElementById('main-container');

function setContainerWidth(wide) {
    if (!mainContainer) return;
    if (wide) {
        mainContainer.classList.remove('max-w-md');
        mainContainer.classList.add('max-w-7xl');
        mainContainer.classList.add('w-full');
        mainContainer.classList.add('px-4');
    } else {
        mainContainer.classList.remove('max-w-7xl', 'w-full', 'px-4');
        mainContainer.classList.add('max-w-md');
    }
}