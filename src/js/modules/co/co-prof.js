// src/js/modules/co/co-prof.js
// Point d’entrée : sélecteur de mode (Classique / OrientShow)
// Gère la configuration du CO classique (circuits, catégorie active, mode validation, chrono)

import { registerModule } from '../registry.js';
import { initCOInterface, initSortableCO, loadCOAssignments } from './co-interface.js';
import { db, ref, set, onValue } from '../../core/firebase-service.js';

let currentMode = 'classique';
let currentClasse = '';
let circuits = [];
let valMode = 'step';
let activeCategory = '';
let startTime = null;
let endTime = null;

// ============================================================
// SÉLECTEUR DE MODE
// ============================================================
export function initCOModeSelector() {
    const coView = document.getElementById('viewCOSettings');
    if (!coView) {
        console.warn('[CO] viewCOSettings introuvable');
        return;
    }

    // Créer ou récupérer le sélecteur
    let selector = document.getElementById('co-mode-selector');
    if (!selector) {
        selector = document.createElement('div');
        selector.id = 'co-mode-selector';
        selector.className = 'flex gap-2 mb-4 bg-slate-800 p-3 rounded-2xl border border-slate-700';
        selector.innerHTML = `
            <button id="co-mode-classique" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white">🧭 CO classique</button>
            <button id="co-mode-orientshow" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">🏃 OrientShow</button>
        `;
        coView.prepend(selector);
    } else {
        selector.style.display = 'flex';
    }

    // Créer les conteneurs s'ils n'existent pas
    let containerClassique = document.getElementById('co-classique-container');
    if (!containerClassique) {
        containerClassique = document.createElement('div');
        containerClassique.id = 'co-classique-container';
        containerClassique.className = 'space-y-4';
        selector.after(containerClassique);
    }

    let containerOrientShow = document.getElementById('co-orientshow-container');
    if (!containerOrientShow) {
        containerOrientShow = document.createElement('div');
        containerOrientShow.id = 'co-orientshow-container';
        containerOrientShow.className = 'space-y-4';
        containerOrientShow.style.display = 'none';
        containerClassique.after(containerOrientShow);
    }

    // Attacher les événements (éviter les doublons)
    const btnClassique = document.getElementById('co-mode-classique');
    const btnOrient = document.getElementById('co-mode-orientshow');
    const newBtnClassique = btnClassique.cloneNode(true);
    const newBtnOrient = btnOrient.cloneNode(true);
    btnClassique.parentNode.replaceChild(newBtnClassique, btnClassique);
    btnOrient.parentNode.replaceChild(newBtnOrient, btnOrient);

    newBtnClassique.addEventListener('click', () => setCOMode('classique'));
    newBtnOrient.addEventListener('click', () => setCOMode('orientshow'));

    // Appliquer le mode par défaut
    setCOMode('classique');
}
const basePath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/co`;
const configRef = ref(db, `${basePath}/config`); // pour circuits, valMode, activeCategory
const startRef = ref(db, `${basePath}/startTime`);
const endRef = ref(db, `${basePath}/endTime`);
function setCOMode(mode) {
    currentMode = mode;
    const containerClassique = document.getElementById('co-classique-container');
    const containerOrientShow = document.getElementById('co-orientshow-container');

    if (mode === 'classique') {
        if (containerClassique) {
            containerClassique.style.display = '';
            // Vider et reconstruire l'interface classique
            containerClassique.innerHTML = '';
            renderClassiqueConfig(currentClasse, containerClassique);
            // Initialiser les groupes (postesGrid, réserves) après la construction du DOM
            initCOInterface();
            initSortableCO();
            loadCOAssignments();
        }
        if (containerOrientShow) {
            containerOrientShow.style.display = 'none';
            delete containerOrientShow.dataset.initialized;
        }
        const btnClassique = document.getElementById('co-mode-classique');
        const btnOrient = document.getElementById('co-mode-orientshow');
        if (btnClassique) btnClassique.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        if (btnOrient) btnOrient.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
    } else {
        if (containerClassique) {
            containerClassique.style.display = 'none';
            delete containerClassique.dataset.initialized;
        }
        if (containerOrientShow) {
            containerOrientShow.style.display = '';
            delete containerOrientShow.dataset.initialized;
            containerOrientShow.innerHTML = '';
            import('./orientshow/orientshow-prof.js').then(module => {
                if (module.initProf) {
                    module.initProf(currentClasse, containerOrientShow);
                }
            }).catch(err => {
                console.error('[CO] Erreur chargement OrientShow :', err);
            });
        }
        const btnClassique = document.getElementById('co-mode-classique');
        const btnOrient = document.getElementById('co-mode-orientshow');
        if (btnOrient) btnOrient.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        if (btnClassique) btnClassique.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
    }
}

// ============================================================
// RENDU DE LA CONFIGURATION CLASSIQUE
// ============================================================
function renderClassiqueConfig(classe, container) {
    // Écouter les données Firebase pour les circuits, valMode, activeCategory, chrono
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/co/config`);
    const startRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/co/startTime`);
    const endRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/co/endTime`);

    // Écouter la config
    onValue(configRef, (snap) => {
        const data = snap.val() || {};
        circuits = data.circuits ? Object.values(data.circuits) : [];
        valMode = data.valMode || 'step';
        activeCategory = data.activeCategory || '';
        actualiserAffichageClassique(container);
    });

    // Écouter le chrono
    onValue(startRef, (snap) => {
        startTime = snap.val() || null;
        actualiserChrono();
    });
    onValue(endRef, (snap) => {
        endTime = snap.val() || null;
        actualiserChrono();
    });

    // Première construction
    actualiserAffichageClassique(container);
}

function actualiserAffichageClassique(container) {
    if (!container) return;
    // On garde le contenu existant ? On va tout reconstruire ?
    // Pour éviter de perdre les références, on vide et on reconstruit seulement le haut (configuration)
    // On conserve les éléments de groupes (postesGrid, réserves) qui sont ajoutés par co-interface.js
    // On va donc insérer un élément de configuration en haut du conteneur
    // On supprime l'ancien config s'il existe
    const oldConfig = document.getElementById('co-classique-config');
    if (oldConfig) oldConfig.remove();

    const configDiv = document.createElement('div');
    configDiv.id = 'co-classique-config';
    configDiv.className = 'space-y-4 mb-6';

    // HTML de configuration
    let html = '';

    // Mode validation
    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <label class="block text-xs font-bold text-slate-400 uppercase mb-2">Mode de validation élève</label>
            <select id="coValMode" class="bg-slate-900 border-2 border-slate-600 rounded-xl p-2 text-white font-bold outline-none" onchange="coSetValMode(this.value)">
                <option value="step" ${valMode === 'step' ? 'selected' : ''}>⏳ Immédiate (case par case)</option>
                <option value="final" ${valMode === 'final' ? 'selected' : ''}>🏁 À la fin du carton</option>
            </select>
        </div>
    `;

    // Chrono
    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex items-center gap-4">
                <button id="coChronoBtn" onclick="coToggleChrono()" class="bg-emerald-600 px-6 py-3 rounded-xl font-black text-sm text-white border-2 border-emerald-400 active:scale-95 transition-transform">🚀 TOP DÉPART</button>
                <div id="coChronoDisplay" class="hidden text-2xl font-mono font-black text-yellow-400">00:00</div>
            </div>
        </div>
    `;

    // Circuits par catégorie
    const categories = {};
    circuits.forEach(c => {
        if (!categories[c.cat]) categories[c.cat] = [];
        categories[c.cat].push(c);
    });

    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h4 class="font-black text-blue-400 uppercase text-sm">📋 Circuits</h4>
                <button onclick="coAjouterCircuit()" class="bg-blue-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-blue-400 active:scale-95">+ Ajouter circuit</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${Object.keys(categories).length === 0 ? '<p class="text-slate-400 col-span-full text-center">Aucun circuit pour l\'instant.</p>' : ''}
                ${Object.keys(categories).map(cat => {
                    const isActive = (cat === activeCategory);
                    return `
                        <div class="bg-slate-900 p-4 rounded-2xl border-2 ${isActive ? 'border-emerald-500' : 'border-slate-700'}">
                            <div class="flex justify-between items-center mb-3">
                                <h5 class="text-lg font-black text-blue-400">${cat}</h5>
                                <button onclick="coActiverCategorie('${cat}')" class="bg-blue-600 px-3 py-1 rounded-xl font-black text-[10px] text-white border-2 border-blue-400 active:scale-95">
                                    ${isActive ? '🎯 ACTIF' : '🎯 ACTIVER'}
                                </button>
                            </div>
                            ${categories[cat].map(c => `
                                <div class="bg-black p-3 rounded-xl border border-slate-700 mb-2">
                                    <div class="flex justify-between items-center">
                                        <span class="font-black text-sm">${c.nom}</span>
                                        <div class="flex gap-1">
                                            <button onclick="coEditerCircuit(${c.id})" class="bg-slate-700 px-2 py-1 rounded-lg text-[10px] font-black text-white active:scale-95">✏️</button>
                                            <button onclick="coSupprimerCircuit(${c.id})" class="bg-red-700 px-2 py-1 rounded-lg text-[10px] font-black text-white active:scale-95">🗑️</button>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-1 mt-1">
                                        ${c.balises.map(b => `<span class="bg-slate-800 text-xs font-black px-2 py-1 rounded border border-slate-600">${b}</span>`).join('')}
                                    </div>
                                </div>
                            `).join('')}
                            <button onclick="coSupprimerCategorie('${cat}')" class="text-[10px] text-red-400 hover:text-red-300 mt-2">🗑️ Supprimer la catégorie</button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    configDiv.innerHTML = html;
    container.prepend(configDiv);

    // Mettre à jour le chrono
    actualiserChrono();
}

function actualiserChrono() {
    const btn = document.getElementById('coChronoBtn');
    const disp = document.getElementById('coChronoDisplay');
    if (!btn) return;

    if (!startTime) {
        btn.innerText = '🚀 TOP DÉPART';
        btn.className = 'bg-emerald-600 px-6 py-3 rounded-xl font-black text-sm text-white border-2 border-emerald-400 active:scale-95 transition-transform animate-pulse';
        if (disp) disp.classList.add('hidden');
    } else if (!endTime) {
        btn.innerText = '🛑 STOP SÉANCE';
        btn.className = 'bg-red-600 px-6 py-3 rounded-xl font-black text-sm text-white border-2 border-red-400 active:scale-95 transition-transform';
        if (disp) {
            disp.classList.remove('hidden');
            clearInterval(window.coChronoInterval);
            window.coChronoInterval = setInterval(() => {
                const s = Math.floor((Date.now() - startTime) / 1000);
                const min = String(Math.floor(s / 60)).padStart(2, '0');
                const sec = String(s % 60).padStart(2, '0');
                disp.innerText = `${min}:${sec}`;
            }, 1000);
        }
    } else {
        btn.innerText = '⏱️ TERMINÉ';
        btn.className = 'bg-slate-700 px-6 py-3 rounded-xl font-black text-sm text-white border-2 border-slate-500 active:scale-95 transition-transform';
        if (disp) {
            disp.classList.remove('hidden');
            clearInterval(window.coChronoInterval);
        }
    }
}

// ============================================================
// FONCTIONS GLOBALES POUR LES ACTIONS PROF
// ============================================================
window.coAjouterCircuit = function() {
    const cat = prompt('Catégorie (ex: Forêt, Étoiles) :');
    if (!cat) return;
    const nom = prompt('Nom du circuit (ex: 1, Rouge) :');
    if (!nom) return;
    const balises = prompt('Liste des balises (ex: 31, 34*, 42) :');
    if (!balises) return;

    const newCircuit = {
        id: Date.now(),
        cat: cat.trim(),
        nom: nom.trim(),
        balises: balises.split(',').map(b => b.trim())
    };

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/config/circuits/${newCircuit.id}`);
    set(configRef, newCircuit);
};

window.coEditerCircuit = function(id) {
    const circ = circuits.find(c => c.id === id);
    if (!circ) return;
    const nouvellesBalises = prompt(`Modifier les balises du circuit "${circ.nom}" :`, circ.balises.join(', '));
    if (nouvellesBalises === null) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/config/circuits/${id}/balises`);
    set(configRef, nouvellesBalises.split(',').map(b => b.trim()));
};

window.coSupprimerCircuit = function(id) {
    if (!confirm('Supprimer ce circuit définitivement ?')) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/config/circuits/${id}`);
    set(configRef, null);
};

window.coSupprimerCategorie = function(cat) {
    if (!confirm(`Supprimer toute la catégorie "${cat}" et ses circuits ?`)) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/config/circuits`);
    // On va filtrer côté client
    const idsASupprimer = circuits.filter(c => c.cat === cat).map(c => c.id);
    idsASupprimer.forEach(id => {
        const refCircuit = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/config/circuits/${id}`);
        set(refCircuit, null);
    });
};

window.coActiverCategorie = function(cat) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const catRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/config/activeCategory`);
    set(catRef, cat);
};

window.coSetValMode = function(mode) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const modeRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/config/valMode`);
    set(modeRef, mode);
};

window.coToggleChrono = function() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const startRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/startTime`);
    const endRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/endTime`);

    if (!startTime) {
        set(startRef, Date.now());
    } else if (!endTime) {
        if (confirm('Arrêter la séance ?')) {
            set(endRef, Date.now());
        }
    } else {
        if (confirm('Réinitialiser le chrono ?')) {
            set(startRef, null);
            set(endRef, null);
        }
    }
};

// ============================================================
// FONCTIONS D’INITIALISATION (exposées pour le registre)
// ============================================================
export function initProf(classe) {
    currentClasse = classe;
    initCOModeSelector();
}

export function initKiosk(classe, code) {
    if (currentMode === 'classique') {
        // Le kiosk classique sera importé ici
        import('./classique/classique-kiosk.js').then(module => {
            if (module.initKiosk) module.initKiosk(classe, code);
        });
    } else {
        import('./orientshow/orientshow-kiosk.js').then(module => {
            if (module.initKiosk) module.initKiosk(classe, code);
        });
    }
}

export async function generateTeams(classe) {
    if (currentMode === 'classique') {
        const module = await import('./classique/classique-prof.js');
        if (module.generateTeams) return module.generateTeams(classe);
    } else {
        const module = await import('./orientshow/orientshow-prof.js');
        if (module.generateTeams) return module.generateTeams(classe);
    }
    alert('Aucune génération définie pour ce mode.');
}

export async function transmettre(classe) {
    if (currentMode === 'classique') {
        const module = await import('./classique/classique-prof.js');
        if (module.transmettre) return module.transmettre(classe);
    } else {
        const module = await import('./orientshow/orientshow-prof.js');
        if (module.transmettre) return module.transmettre(classe);
    }
    alert('Aucune transmission définie pour ce mode.');
}

export function renderLive(classe) {
    if (currentMode === 'classique') {
        import('./co-live.js').then(module => {
            const data = window.lastLiveData || {};
            module.renderCOLive(data);
        });
    } else {
        import('./orientshow/orientshow-live.js').then(module => {
            module.renderOrientShowLive();
        });
    }
}

export function renderTV(classe) {
    if (currentMode === 'classique') {
        console.log('[CO] TV classique non disponible');
    } else {
        import('./orientshow/orientshow-tv.js').then(module => {
            module.renderOrientShowTV();
        });
    }
}

// ============================================================
// EXPOSITION DES FONCTIONS GLOBALES (compatibilité HTML)
// ============================================================
window.initCOModeSelector = initCOModeSelector;

// ============================================================
// ENREGISTREMENT DU MODULE
// ============================================================
registerModule({
    id: 'co',
    label: '🧭 Course d\'orientation',
    icon: '🧭',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV,
    isDefault: false,
    cleanup: () => {
        console.log('[CO] Nettoyage effectué');
    }
});

export default {
    id: 'co',
    label: '🧭 Course d\'orientation',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV
};