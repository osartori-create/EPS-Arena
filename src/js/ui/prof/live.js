// src/js/ui/prof/live.js
import { listenToActivityData, ref, onValue } from '../../core/firebase-service.js';
import { db } from '../../core/firebase-service.js';
import { calculerStatsGlobales } from '../../modules/escalade/escalade-controller.js';

let currentUnsub = null;
let currentClasse = "";
let configData = {};

export function initLiveUI() {
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
    if (!currentClasse) return;
    const configRef = ref(db, `${currentClasse}/config`);
    onValue(configRef, (snap) => {
        configData = snap.val() || {};
        renderLiveData(); // On relance le rendu si la config change
    });
}

function startListening() {
    if (currentUnsub) currentUnsub();
    if (!currentClasse) return;

    currentUnsub = listenToActivityData(currentClasse, (type, data) => {
        renderLiveData(type, data);
    });
}

// Récupère la liste des élèves locaux pour mapper les codes aux noms (RGPD)
function getStudentsMap() {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const map = {};
    eleves.forEach(e => { map[e.id] = `${e.prenom} ${e.nom}`; });
    return map;
}

// Rendu des tableaux
function renderLiveData(type, data) {
    const container = document.getElementById('live-content');
    if (!container) return;

    const studentsMap = getStudentsMap();
    let html = '';

    // Fonction pour retrouver le nom à partir d'un code (A1, B2...)
    function getNomFromCode(code) {
        // On regarde dans la config multi : configData["A"] = ["id1", "id2"] -> code "A1" = index 0
        if (configData.activite === 'multi') {
            const lettre = code.slice(0, 1);
            const num = parseInt(code.slice(1)) - 1;
            if (configData[lettre] && configData[lettre][num]) {
                const id = configData[lettre][num];
                return studentsMap[id] || id;
            }
        }
        // Pour l'escalade, les codes sont directement clés ? (Ex: A1 comme clé) ?
        // On aura un mapping différent, mais pour l'instant on retourne le code si rien n'est trouvé.
        return code;
    }

    if (type === 'escalade') {
        // ... (reste identique, mais utilisez getNomFromCode(m.groupe + m.role))
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade</h3>`;
        html += `<div class="space-y-2">`;
        entries.forEach(m => {
            const code = `${m.groupe}${m.role}`;
            const nom = getNomFromCode(code);
            html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                <span class="font-bold text-white">${nom}</span>
                <span class="text-emerald-400 font-black">${m.points}m</span>
            </div>`;
        });
        html += `</div>`;
    }
    else if (type === 'co') {
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧭 Validations CO</h3>`;
        html += `<div class="space-y-2">`;
        entries.forEach(v => {
            const nom = getNomFromCode(v.code);
            html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                <span class="font-bold text-white">${nom}</span>
                <span class="text-blue-400 font-black">Balise ${v.balise}</span>
            </div>`;
        });
        html += `</div>`;
    }
    else if (type === 'multi') {
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">⏱️ Chronos Multi</h3>`;
        html += `<div class="space-y-2">`;
        entries.forEach(p => {
            const nom = getNomFromCode(p.code);
            html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                <span class="font-bold text-white">${nom}</span>
                <span class="text-yellow-400 font-black">${p.temps}</span>
            </div>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}