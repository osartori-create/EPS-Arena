// src/js/ui/prof/live.js
import { listenToActivityData, ref, onValue } from '../../core/firebase-service.js';
import { db } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentUnsub = null;
let currentClasse = "";
let configData = {};
let allEscaladeData = {}; // On garde en mémoire les données brutes pour le bilan

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
        renderLiveData();
    });
}

function startListening() {
    if (currentUnsub) currentUnsub();
    if (!currentClasse) return;

    currentUnsub = listenToActivityData(currentClasse, (type, data) => {
        if (type === 'escalade') allEscaladeData = data;
        renderLiveData(type, data);
    });
}

function getStudentsMap() {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const map = {};
    eleves.forEach(e => { map[e.id] = `${e.prenom} ${e.nom}`; });
    return map;
}

function getLocalMapping() {
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    return mapping;
}

function getEleveIdFromCode(code) {
    if (code.length < 2) return null;
    const lettre = code.slice(0, 1);
    const index = parseInt(code.slice(1)) - 1; 
    
    const localMap = getLocalMapping();
    const key = `${currentClasse}_${lettre}`;
    
    if (localMap[key] && localMap[key][index]) return localMap[key][index];
    return null;
}

function getNomFromCode(code) {
    const eleveId = getEleveIdFromCode(code);
    if (eleveId) {
        const studentsMap = getStudentsMap();
        if (studentsMap[eleveId]) return studentsMap[eleveId];
    }
    return code;
}

async function getPhotoHtml(code) {
    const eleveId = getEleveIdFromCode(code);
    if (eleveId) {
        const url = await getPhotoUrl(eleveId);
        if (url) return `<img src="${url}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-500">`;
    }
    return `<div class="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
}

async function renderLiveData(type, data) {
    const container = document.getElementById('live-content');
    if (!container) return;

    let html = '';

    if (type === 'escalade') {
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade (Cliquez pour le bilan)</h3>`;
        html += `<div class="space-y-2">`;
        for (const m of entries) {
            const code = `${m.groupe}${m.role}`;
            const nom = getNomFromCode(code);
            const photoHtml = await getPhotoHtml(code);
            const hauteur = m.hauteur ? `${m.hauteur}m` : 'Top';
            
            html += `<div onclick="openBilan('${code}')" class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between cursor-pointer hover:border-blue-500">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <div>
                        <span class="font-bold text-white">${nom}</span>
                        <span class="text-xs text-slate-400 ml-2 block">Voie ${m.voie_num} - ${hauteur}</span>
                    </div>
                </div>
                <span class="text-emerald-400 font-black">${m.points}m</span>
            </div>`;
        }
        html += `</div>`;
    }
    else if (type === 'co') {
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧭 Validations CO</h3>`;
        html += `<div class="space-y-2">`;
        for (const v of entries) {
            const nom = getNomFromCode(v.code);
            const photoHtml = await getPhotoHtml(v.code);
            html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <span class="font-bold text-white">${nom}</span>
                </div>
                <span class="text-blue-400 font-black">Balise ${v.balise}</span>
            </div>`;
        }
        html += `</div>`;
    }
    else if (type === 'multi') {
        const entries = Object.values(data).reverse();
        html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">⏱️ Chronos Multi</h3>`;
        html += `<div class="space-y-2">`;
        for (const p of entries) {
            const nom = getNomFromCode(p.code);
            const photoHtml = await getPhotoHtml(p.code);
            html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <span class="font-bold text-white">${nom}</span>
                </div>
                <span class="text-yellow-400 font-black">${p.temps}</span>
            </div>`;
        }
        html += `</div>`;
    }

    container.innerHTML = html;

    // On expose la fonction openBilan pour le onclick
    window.openBilan = function(code) {
        const eleveId = getEleveIdFromCode(code);
        const nom = getNomFromCode(code);
        
        // Calculs statistiques
        const toutesMontées = Object.values(allEscaladeData).filter(m => `${m.groupe}${m.role}` === code);
        
        const nbVoies = toutesMontées.length;
        const distanceTotale = toutesMontées.reduce((sum, m) => sum + (m.hauteur || 0), 0);
        const nbTops = toutesMontées.filter(m => m.hauteur >= 9).length;
        const distanceMoyenne = nbVoies > 0 ? distanceTotale / nbVoies : 0;
        
        // Difficulté moyenne (pondérée par hauteur)
        const bareme = { "4a": 1, "4b": 1.1, "4c": 1.2, "5a": 1.3, "5b": 1.4, "5c": 1.5, "6a": 1.6, "6b": 1.8, "6c": 2 };
        let coeffTotal = 0, hauteurTotal = 0;
        toutesMontées.forEach(m => {
            const coeff = bareme[m.cotation] || 1;
            coeffTotal += coeff * (m.hauteur || 0);
            hauteurTotal += m.hauteur || 0;
        });
        const coeffMoyen = hauteurTotal > 0 ? (coeffTotal / hauteurTotal) : 0;
        
        // Conversion du coefficient en cotation
        const difficulteMoyenne = coeffToCotation(coeffMoyen);
        
        // Plus grande difficulté validée (2 voies différentes)
        const validéDeuxVoies = {};
        toutesMontées.forEach(m => {
            const key = m.cotation;
            if (!validéDeuxVoies[key]) validéDeuxVoies[key] = new Set();
            validéDeuxVoies[key].add(m.voie_num);
        });
        
        const plusGrandeDifValidée = Object.keys(validéDeuxVoies)
            .filter(cot => validéDeuxVoies[cot].size >= 2)
            .sort((a, b) => (bareme[b] || 1) - (bareme[a] || 1))[0] || 'Aucune';
        
        // Récupérer la photo
        getPhotoHtml(code).then(photoHtml => {
            // Affichage de la modale
            const modalHtml = `
            <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-50" id="bilanModal">
                <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 w-full max-w-md">
                    <div class="flex flex-col items-center mb-4">
                        ${photoHtml}
                        <h3 class="text-2xl font-black text-white mt-3">${nom}</h3>
                        <p class="text-slate-400">Code : ${code}</p>
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between"><span class="text-slate-400">Nombre de voies</span><span class="font-black text-white">${nbVoies}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Distance cumulée</span><span class="font-black text-emerald-400">${distanceTotale} m</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Distance moyenne</span><span class="font-black text-white">${distanceMoyenne.toFixed(1)} m</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Nombre de Tops</span><span class="font-black text-yellow-400">${nbTops}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Difficulté moyenne</span><span class="font-black text-blue-400">${difficulteMoyenne}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Plus grande difficulté validée (2 voies)</span><span class="font-black text-blue-400">${plusGrandeDifValidée}</span></div>
                    </div>
                    <button onclick="document.getElementById('bilanModal').remove()" class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-bold text-white">Fermer</button>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        });
    };
    
    // Fonction pour convertir un coefficient en cotation (échelle linéaire)
    function coeffToCotation(coeff) {
        const echelle = [
            { cotation: '4a', coeff: 1.0 },
            { cotation: '4b', coeff: 1.1 },
            { cotation: '4c', coeff: 1.2 },
            { cotation: '5a', coeff: 1.3 },
            { cotation: '5b', coeff: 1.4 },
            { cotation: '5c', coeff: 1.5 },
            { cotation: '6a', coeff: 1.6 },
            { cotation: '6b', coeff: 1.8 },
            { cotation: '6c', coeff: 2.0 }
        ];
        
        let closest = echelle[0];
        let minDiff = Math.abs(coeff - echelle[0].coeff);
        for (let i = 1; i < echelle.length; i++) {
            const diff = Math.abs(coeff - echelle[i].coeff);
            if (diff < minDiff) {
                minDiff = diff;
                closest = echelle[i];
            }
        }
        return closest.cotation;
    }
}

// Export CSV
window.exportResultsLive = function() {
    if (!currentClasse) return alert("Sélectionnez une classe.");

    const studentsMap = getStudentsMap();
    const localMap = getLocalMapping();

    let csv = "\uFEFFNom;Type;Valeur\n";

    // On lit le DOM pour exporter les données déjà affichées
    const rows = document.querySelectorAll('#live-content .bg-slate-800');
    rows.forEach(row => {
        const nameSpan = row.querySelector('.text-white');
        const valueSpan = row.querySelector('span:last-child');

        const name = nameSpan ? nameSpan.innerText : '';
        const value = valueSpan ? valueSpan.innerText : '';

        // On tente de retrouver le code depuis le nom (si mapping dispo)
        // Ceci est une simplification, le mieux est de stocker les données brutes en mémoire.
        // Pour l'instant on exporte ce qui est visible.
        csv += `${name};Performance;${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Live_${currentClasse}.csv`;
    a.click();
};