// src/js/modules/cross/cross-course.js
// Onglet Course : sélection course, GO, scans live, arrêt, reset

import { db, ref, onValue, push, set, remove } from '../../core/firebase-service.js';
import {
    getCrossBasePath, getCrossConfig,
    getClassesParticipantes, getStatutsCross,
    KEYS
} from './cross-config.js';
import {
    normaliserScan, getNiveauFromClasse, formatTemps, getMedaille, COURSES_DEFAUT
} from './cross-core.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { startScanListener, stopScanListener, refocusScanInput } from './cross-scan.js';

let currentCourseId = null;
let arriveesListener = null;
let goListener = null;
let tousLesEleves = {}; // { dossard: { eleveId, nom, prenom, classe, sexe, vma, statut } }
let arriveesActuelles = {};

// ============================================================
// INITIALISATION
// ============================================================
export function initCrossCourse(container) {
    if (!container) return;

    // Charge le mapping dossard → élève
    chargerMappingEleves();

    // Détermine la course active (localStorage ou course1)
    currentCourseId = localStorage.getItem(KEYS.COURSE_ACTIVE) || 'course1';

    render(container);
}

function chargerMappingEleves() {
    tousLesEleves = {};
    const statuts = getStatutsCross();
    const classes = getClassesParticipantes();
    const dossards = JSON.parse(localStorage.getItem(KEYS.DOSSARDS) || '{}');

    // Pour chaque dossard → récupère l'élève
    Object.entries(dossards).forEach(([dossard, eleveId]) => {
        // Trouve la classe de cet élève
        for (const classe of classes) {
            const eleves = getExistingEleves(classe);
            const e = eleves.find(x => x.id === eleveId);
            if (e) {
                tousLesEleves[dossard] = {
                    eleveId: e.id,
                    nom: e.nom,
                    prenom: e.prenom,
                    classe: classe,
                    sexe: e.sexe,
                    vma: parseFloat(e.vma) || null,
                    statut: statuts[e.id] || 'present'
                };
                break;
            }
        }
    });
}

// ============================================================
// RENDU PRINCIPAL
// ============================================================
function render(container) {
    const config = getCrossConfig();
    const course = COURSES_DEFAUT.find(c => c.id === currentCourseId);

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Sélecteur de course -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h3 class="font-black text-blue-400 uppercase text-sm mb-3">🏃 Course active</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    ${COURSES_DEFAUT.map(c => `
                        <button onclick="window.crossCourseSelect('${c.id}')"
                                class="p-3 rounded-xl font-black text-sm border-2 active:scale-95 transition-all ${c.id === currentCourseId
                                    ? 'bg-blue-600 border-blue-400 text-white'
                                    : 'bg-slate-900 border-slate-700 text-slate-300'}">
                            ${c.label}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Contrôles GO / Arrivée -->
            <div id="cross-course-controls" class="bg-slate-800 p-5 rounded-2xl border-2 border-emerald-500/40">
                <div id="cross-course-status" class="text-center mb-4">
                    <p class="text-slate-400 text-sm">Chargement...</p>
                </div>
            </div>

            <!-- Zone de scan manuel (backup) -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-2">
                    🎯 Saisie manuelle d'un dossard (si la douchette ne marche pas)
                </label>
                <div class="flex gap-2">
                    <input type="number" id="cross-manual-input"
                           placeholder="N° dossard"
                           class="flex-1 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-2xl font-black text-center"
                           onkeydown="if(event.key==='Enter'){window.crossCourseManualScan(this.value);this.value='';}">
                    <button onclick="window.crossCourseManualScan(document.getElementById('cross-manual-input').value);document.getElementById('cross-manual-input').value='';"
                            class="bg-emerald-600 hover:bg-emerald-500 px-6 rounded-xl font-black text-white">
                        ✅ Ajouter
                    </button>
                </div>
            </div>

            <!-- Liste des arrivées en direct -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-black text-blue-400 uppercase text-sm">📋 Arrivées en direct</h3>
                    <div class="flex gap-2">
                        <span id="cross-course-count" class="text-xs text-slate-400 font-bold">0 arrivant</span>
                        <button onclick="window.crossCourseExportCSV()" class="bg-indigo-600 px-3 py-1 rounded-lg text-xs font-black text-white">📥 CSV</button>
                    </div>
                </div>
                <div id="cross-course-list" class="max-h-[60vh] overflow-y-auto space-y-1">
                    <p class="text-slate-500 text-center py-6">Aucune arrivée pour l'instant.</p>
                </div>
            </div>
        </div>
    `;

    attacherListenersFirebase();
    demarrerEcouteScan();
}

// ============================================================
// ÉCOUTE FIREBASE
// ============================================================
function attacherListenersFirebase() {
    if (arriveesListener) { arriveesListener(); arriveesListener = null; }
    if (goListener) { goListener(); goListener = null; }

    const basePath = getCrossBasePath();
    const arriveesRef = ref(db, `${basePath}/courses/${currentCourseId}/arrivees`);
    const goRef = ref(db, `${basePath}/courses/${currentCourseId}/go`);

    arriveesListener = onValue(arriveesRef, snap => {
        arriveesActuelles = snap.val() || {};
        afficherArrivees();
    });

    goListener = onValue(goRef, snap => {
        const go = snap.val();
        afficherControles(go);
    });
}

// ============================================================
// CONTRÔLES GO / ARRÊT
// ============================================================
function afficherControles(go) {
    const container = document.getElementById('cross-course-controls');
    if (!container) return;

    const course = COURSES_DEFAUT.find(c => c.id === currentCourseId);
    const enCours = go && go.timestamp;
    const nbArrivees = Object.keys(arriveesActuelles).length;

    const elapsed = enCours ? Math.floor((Date.now() - go.timestamp) / 1000) : 0;

    container.innerHTML = `
        <div class="text-center mb-4">
            <div class="text-xs font-bold text-slate-400 uppercase">Course</div>
            <div class="text-3xl font-black text-white mb-1">${course?.label || '—'}</div>
            <div class="text-xs text-slate-400">${course?.niveaux.map(n => n + 'e').join(' + ')} · ${course?.sexe === 'F' ? 'Filles' : 'Garçons'}</div>
        </div>

        ${enCours ? `
            <div class="text-center py-3 mb-4 bg-emerald-900/30 rounded-2xl border-2 border-emerald-500">
                <div class="text-xs font-bold text-emerald-400 uppercase">⏱️ Course en cours</div>
                <div class="text-4xl font-mono font-black text-emerald-300 mt-1">${formatTemps(elapsed)}</div>
                <div class="text-xs text-slate-400 mt-1">${nbArrivees} arrivant${nbArrivees > 1 ? 's' : ''}</div>
            </div>
            <div class="flex gap-2">
                <button onclick="window.crossCourseArreter()" class="flex-1 bg-red-600 hover:bg-red-500 py-4 rounded-2xl font-black text-white text-lg">
                    ⏹ Arrêter la course
                </button>
                <button onclick="window.crossCourseReset()" class="bg-slate-700 hover:bg-slate-600 px-6 py-4 rounded-2xl font-black text-sm text-white">
                    🗑️ Reset
                </button>
            </div>
        ` : `
            <button onclick="window.crossCourseGo()" class="w-full bg-emerald-600 hover:bg-emerald-500 py-6 rounded-2xl font-black text-white text-2xl active:scale-95 transition-all">
                🚀 GO
            </button>
            ${nbArrivees > 0 ? `
                <button onclick="window.crossCourseReset()" class="w-full mt-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm text-white">
                    🗑️ Effacer les ${nbArrivees} arrivées
                </button>
            ` : ''}
        `}
    `;
}

// ============================================================
// AFFICHAGE LIVE DES ARRIVÉES
// ============================================================
function afficherArrivees() {
    const container = document.getElementById('cross-course-list');
    const countEl = document.getElementById('cross-course-count');
    if (!container) return;

    const arriveesTriees = Object.entries(arriveesActuelles)
        .map(([id, a]) => ({ id, ...a }))
        .sort((a, b) => a.timestamp - b.timestamp);

    if (countEl) countEl.textContent = `${arriveesTriees.length} arrivant${arriveesTriees.length > 1 ? 's' : ''}`;

    if (arriveesTriees.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-6">Aucune arrivée pour l\'instant.</p>';
        return;
    }

    // Détermine les rangs par niveau
    const parNiveau = {};
    const course = COURSES_DEFAUT.find(c => c.id === currentCourseId);
    course?.niveaux.forEach(n => parNiveau[n] = 0);

    container.innerHTML = arriveesTriees.map((arr, idx) => {
        const eleve = tousLesEleves[String(arr.dossard)];
        if (!eleve) {
            return `
                <div class="bg-red-900/30 p-3 rounded-lg border border-red-500 text-sm">
                    <span class="font-black text-red-300">Dossard ${arr.dossard}</span>
                    <span class="text-slate-300 ml-2">— Élève non associé</span>
                </div>
            `;
        }

        const niveau = getNiveauFromClasse(eleve.classe);
        if (niveau && parNiveau[niveau] !== undefined) parNiveau[niveau]++;
        const rangNiveau = parNiveau[niveau] || 0;

        return `
            <div class="bg-slate-900 p-3 rounded-lg border border-slate-700 flex items-center gap-3">
                <span class="text-xl font-black text-yellow-400 min-w-[40px] text-center">${rangNiveau}</span>
                <span class="text-xs font-black text-slate-500 bg-slate-800 px-2 py-1 rounded">#${arr.dossard}</span>
                <div class="flex-1">
                    <div class="font-bold text-white">${eleve.prenom} ${eleve.nom}</div>
                    <div class="text-xs text-slate-400">${eleve.classe} · ${eleve.sexe}</div>
                </div>
                <button onclick="window.crossCourseSupprimer('${arr.id}')" class="bg-red-900/50 hover:bg-red-800 px-2 py-1 rounded text-xs font-black text-red-300">🗑️</button>
            </div>
        `;
    }).join('');
}

// ============================================================
// ÉCOUTE DOUCHETTE
// ============================================================
function demarrerEcouteScan() {
    startScanListener((brut) => {
        const candidats = normaliserScan(brut);
        // On prend le premier candidat qui matche un élève connu
        for (const dossard of candidats) {
            if (tousLesEleves[dossard]) {
                enregistrerArrivee(dossard);
                return;
            }
        }
        // Aucun match : on affiche une alerte visuelle
        afficherErreurScan(brut);
    });
}

function afficherErreurScan(brut) {
    const container = document.getElementById('cross-course-controls');
    if (!container) return;
    const ancien = document.getElementById('cross-scan-error');
    if (ancien) ancien.remove();
    const div = document.createElement('div');
    div.id = 'cross-scan-error';
    div.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-2xl font-black shadow-2xl z-50';
    div.textContent = `⚠️ Dossard "${brut}" inconnu`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
}

// ============================================================
// ENREGISTREMENT D'UNE ARRIVÉE
// ============================================================
async function enregistrerArrivee(dossard) {
    // Anti-doublon : déjà scanné ?
    const deja = Object.values(arriveesActuelles).find(a => String(a.dossard) === String(dossard));
    if (deja) {
        afficherToast(`⚠️ Dossard ${dossard} déjà enregistré`, 'amber');
        return;
    }

    const eleve = tousLesEleves[String(dossard)];
    if (eleve.statut !== 'present') {
        afficherToast(`⚠️ ${eleve.prenom} est ${eleve.statut}`, 'amber');
        return;
    }

    const basePath = getCrossBasePath();
    const arriveesRef = ref(db, `${basePath}/courses/${currentCourseId}/arrivees`);
    await push(arriveesRef, {
        dossard: String(dossard),
        timestamp: Date.now(),
        source: 'pc'
    });

    afficherToast(`✅ ${eleve.prenom} ${eleve.nom} (${eleve.classe})`, 'emerald');
    refocusScanInput();
}

function afficherToast(msg, couleur = 'emerald') {
    const div = document.createElement('div');
    div.className = `fixed top-4 right-4 bg-${couleur}-600 text-white px-6 py-3 rounded-2xl font-black shadow-2xl z-50`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1500);
}

// ============================================================
// ACTIONS GLOBALES
// ============================================================
window.crossCourseSelect = (courseId) => {
    currentCourseId = courseId;
    localStorage.setItem(KEYS.COURSE_ACTIVE, courseId);
    const container = document.getElementById('viewCross');
    if (container) initCrossCourse(container);
};

window.crossCourseGo = async () => {
    const basePath = getCrossBasePath();
    const goRef = ref(db, `${basePath}/courses/${currentCourseId}/go`);
    await set(goRef, {
        timestamp: Date.now(),
        profCode: localStorage.getItem('eps_arena_profCode') || 'DEFAULT'
    });
    refocusScanInput();
};

window.crossCourseArreter = () => {
    if (!confirm('Arrêter la course en cours ?')) return;
    stopScanListener();
    afficherControles(null);
    alert('Course arrêtée. Tu peux consulter les résultats.');
};

window.crossCourseReset = async () => {
    if (!confirm('⚠️ Effacer TOUTES les arrivées de cette course ?')) return;
    if (!confirm('✅ Dernière confirmation ?')) return;
    const basePath = getCrossBasePath();
    await remove(ref(db, `${basePath}/courses/${currentCourseId}/arrivees`));
    await remove(ref(db, `${basePath}/courses/${currentCourseId}/go`));
    refocusScanInput();
};

window.crossCourseManualScan = (val) => {
    if (!val) return;
    const dossard = String(val).replace(/\D/g, '');
    if (!dossard) return;
    if (!tousLesEleves[dossard]) {
        alert(`Dossard "${dossard}" inconnu.`);
        return;
    }
    enregistrerArrivee(dossard);
};

window.crossCourseSupprimer = async (id) => {
    if (!confirm('Supprimer cette arrivée ?')) return;
    const basePath = getCrossBasePath();
    await remove(ref(db, `${basePath}/courses/${currentCourseId}/arrivees/${id}`));
};

window.crossCourseExportCSV = () => {
    const arriveesTriees = Object.values(arriveesActuelles).sort((a, b) => a.timestamp - b.timestamp);
    if (arriveesTriees.length === 0) return alert('Aucune arrivée à exporter.');

    const parNiveau = {};
    const course = COURSES_DEFAUT.find(c => c.id === currentCourseId);
    course?.niveaux.forEach(n => parNiveau[n] = 0);

    let csv = '\uFEFF"Dossard";"Nom";"Prénom";"Classe";"Sexe";"VMA";"Niveau";"Rang";"Timestamp"\n';
    arriveesTriees.forEach(arr => {
        const eleve = tousLesEleves[String(arr.dossard)];
        if (!eleve) return;
        const niveau = getNiveauFromClasse(eleve.classe);
        parNiveau[niveau] = (parNiveau[niveau] || 0) + 1;
        csv += `"${arr.dossard}";"${eleve.nom}";"${eleve.prenom}";"${eleve.classe}";"${eleve.sexe}";"${eleve.vma || ''}";"${niveau}";"${parNiveau[niveau]}";"${new Date(arr.timestamp).toISOString()}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Cross_${currentCourseId}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
};