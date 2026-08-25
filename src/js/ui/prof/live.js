import { listenToActivityData } from '../../core/firebase-service.js';

let currentUnsub = null;
let currentClasse = "";

export function initLiveUI() {
    const select = document.getElementById('selectClasse');
    if (select) {
        select.addEventListener('change', () => {
            const newClasse = select.value;
            if (newClasse !== currentClasse) {
                currentClasse = newClasse;
                startListening();
            }
        });
    }
}

function startListening() {
    if (currentUnsub) currentUnsub();
    if (!currentClasse) return;

    currentUnsub = listenToActivityData(currentClasse, (type, data) => {
        renderLiveData(type, data);
    });
}

// Récupère la correspondance ID -> Code depuis la config locale (stockée lors de la génération)
function getStudentCodeMap() {
    // On utilise la config CO ou Escalade pour retrouver qui est qui
    const coConfig = JSON.parse(localStorage.getItem(`eps_arena_co_assignments_${currentClasse}`) || '{}');
    const escConfig = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${currentClasse}`) || '{}');
    
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const map = {}; // id -> nom
    
    // On construit d'abord la map des noms
    eleves.forEach(e => {
        map[e.id] = `${e.prenom} ${e.nom}`;
    });

    // On construit ensuite une map code -> id
    const codeMap = {};
    
    // Pour la CO
    Object.keys(coConfig).forEach(poste => {
        if (coConfig[poste] && Array.isArray(coConfig[poste])) {
            coConfig[poste].forEach(id => {
                codeMap[poste] = id;
            });
        }
    });

    // Pour l'escalade
    Object.keys(escConfig).forEach(groupe => {
        if (escConfig[groupe] && Array.isArray(escConfig[groupe])) {
            escConfig[groupe].forEach((id, index) => {
                const code = `${groupe}${index + 1}`;
                codeMap[code] = id;
            });
        }
    });

    return { map, codeMap };
}

function renderLiveData(type, data) {
    const container = document.getElementById('live-content');
    if (!container) return;

    const { map, codeMap } = getStudentCodeMap();
    let html = '';

    if (type === 'escalade') {
        const entries = Object.values(data).reverse();
        html += '<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade</h3>';
        html += '<div class="space-y-2">';
        entries.forEach(m => {
            const code = `${m.groupe}${m.role}`;
            const id = codeMap[code];
            const nom = id ? map[id] : code;
            html += `
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                    <div>
                        <span class="font-bold text-white">${nom}</span>
                        <span class="text-xs text-slate-400 ml-2">Voie ${m.voie_num} (${m.couleur})</span>
                    </div>
                    <span class="font-black text-emerald-400">${m.points}m</span>
                </div>
            `;
        });
        html += '</div>';
    } else if (type === 'co') {
        const entries = Object.values(data).reverse();
        html += '<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧭 Validations CO</h3>';
        html += '<div class="space-y-2">';
        entries.forEach(v => {
            const id = codeMap[v.code];
            const nom = id ? map[id] : v.code;
            html += `
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                    <span class="font-bold text-white">${nom}</span>
                    <span class="text-blue-400 font-black">Balise ${v.balise}</span>
                </div>
            `;
        });
        html += '</div>';
    } else if (type === 'multi') {
        const entries = Object.values(data).reverse();
        html += '<h3 class="font-black text-blue-400 uppercase text-sm mb-2">⏱️ Chronos Multi</h3>';
        html += '<div class="space-y-2">';
        entries.forEach(p => {
            const id = codeMap[p.code];
            const nom = id ? map[id] : p.code;
            html += `
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                    <span class="font-bold text-white">${nom}</span>
                    <span class="text-yellow-400 font-black">${p.temps}</span>
                </div>
            `;
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

window.exportResultsLive = function() {
    if (!currentClasse) return alert("Sélectionnez une classe.");
    const rows = document.querySelectorAll('#live-content .bg-slate-800');
    let csv = "\uFEFFNom;Type;Valeur\n";
    rows.forEach(row => {
        const name = row.querySelector('.font-bold')?.innerText || '';
        const value = row.querySelector('span:last-child')?.innerText || '';
        csv += `${name};Performance;${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Live_${currentClasse}.csv`;
    a.click();
};