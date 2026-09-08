// src/js/modules/escalade/escalade-live.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getNomFromCode, getPhotoHtml, getEleveIdFromCode, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { BAREME, coeffToCotation } from './escalade-calculations.js';

let currentUnsub = null;
let currentMode = 'classic';

export function renderEscaladeLive(mode) {
    // Si mode est fourni, on l'utilise, sinon on lit localStorage
    currentMode = mode || localStorage.getItem('escalade_mode') || 'classic';
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    const savedMode = localStorage.getItem('escalade_mode') || 'classic';
    currentMode = savedMode;

    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const monteesPath = `etablissements/0680013V/profs/${profCode}/${classe}/escalade/montees`;
    const validationsPath = `etablissements/0680013V/profs/${profCode}/${classe}/bloccontest/validations`;
    const configPath = `etablissements/0680013V/profs/${profCode}/${classe}/bloccontest/config`;

    container.innerHTML = '<p class="text-slate-500 text-center">Chargement...</p>';

    if (currentMode === 'classic') {
        const monteesRef = ref(db, monteesPath);
        currentUnsub = onValue(monteesRef, (snap) => {
            const data = snap.val() || {};
            renderClassicLive(container, data, classe);
        });
    } else {
        const validationsRef = ref(db, validationsPath);
        const configRef = ref(db, configPath);
        
        let config = {};
        let validations = {};
        let loaded = 0;

        function checkAndRender() {
            if (loaded >= 2) {
                renderBlocLive(container, validations, config, classe);
            }
        }

        onValue(configRef, (snap) => {
            config = snap.val() || {};
            loaded++;
            checkAndRender();
        }, { onlyOnce: true });

        currentUnsub = onValue(validationsRef, (snap) => {
            validations = snap.val() || {};
            loaded++;
            checkAndRender();
        });
    }
}

function renderClassicLive(container, data, classe) {
    const entries = Object.values(data).reverse();

    if (entries.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center">Aucune montée pour l\'instant.</p>';
        return;
    }

    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade (Cliquez pour le bilan)</h3><div class="space-y-2">`;
    
    // On utilise Promise.all car getPhotoHtml est async
    const promises = entries.slice(0, 20).map(async m => {
        const code = `${m.groupe}${m.role}`;
        const nom = getNomFromCode(code, classe);
        const photoHtml = await getPhotoHtml(code, classe);
        
        return `<div onclick="openBilan('${code}')" class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between cursor-pointer hover:border-blue-500">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <span class="font-bold text-white">${nom}</span>
                </div>
                <span class="text-emerald-400 font-black">${m.points ? m.points.toFixed(1) : m.hauteur}m</span>
            </div>`;
    });

    Promise.all(promises).then(results => {
        html += results.join('');
        html += `</div>`;
        container.innerHTML = html;
    });

    // openBilan (inchangé)
    window.openBilan = async function(code) {
        const allData = data;
        const mesMontees = Object.values(allData).filter(m => `${m.groupe}${m.role}` === code);
        const nom = getNomFromCode(code, classe);
        
        let photoUrl = null;
        const eleveId = getEleveIdFromCode(code, classe);
        if (eleveId) photoUrl = await getPhotoUrl(eleveId);
        
        const photoHtml = photoUrl 
            ? `<img src="${photoUrl}" class="w-32 h-32 rounded-full object-cover border-4 border-slate-500">` 
            : `<div class="w-32 h-32 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;

        const nbMontees = mesMontees.length;
        const distanceTotale = mesMontees.reduce((sum, m) => sum + (m.hauteur || 0), 0);
        
        let coeffTotal = 0, hauteurTotal = 0;
        mesMontees.forEach(m => {
            const coeff = BAREME[m.cotation] || 1;
            coeffTotal += coeff * (m.hauteur || 0);
            hauteurTotal += m.hauteur || 0;
        });
        const coeffMoyen = hauteurTotal > 0 ? (coeffTotal / hauteurTotal) : 0;
        const difficultMoyenne = coeffToCotation(coeffMoyen);
        
        const nbTops = mesMontees.filter(m => m.hauteur >= 9).length;
        const validations = {};
        mesMontees.forEach(m => {
            if (!validations[m.cotation]) validations[m.cotation] = new Set();
            validations[m.cotation].add(m.voie_num);
        });
        const plusGrandeDif = Object.keys(validations)
            .filter(cot => validations[cot].size >= 2)
            .sort((a, b) => (BAREME[b] || 1) - (BAREME[a] || 1))[0] || 'Aucune';

        const modalHtml = `
        <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-50" id="bilanModal">
            <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 w-full max-w-md">
                <div class="flex flex-col items-center mb-4">
                    ${photoHtml}
                    <h3 class="text-2xl font-black text-white mt-3">${nom}</h3>
                    <p class="text-slate-400">Code : ${code}</p>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-slate-400">Nombre de montées</span><span class="font-black text-white">${nbMontees}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Distance cumulée</span><span class="font-black text-emerald-400">${distanceTotale} m</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Nombre de Tops</span><span class="font-black text-yellow-400">${nbTops}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Difficulté moyenne</span><span class="font-black text-blue-400">${difficultMoyenne}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Plus grande difficulté validée (2 voies)</span><span class="font-black text-blue-400">${plusGrandeDif}</span></div>
                </div>
                <button onclick="document.getElementById('bilanModal').remove()" class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-bold text-white">Fermer</button>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };
}

function renderBlocLive(container, validations, config, classe) {
    const validationsList = Object.values(validations);
    const blocs = config.blocs || [];

    if (validationsList.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center">Aucune validation Bloc Contest pour l\'instant.</p>';
        return;
    }

    const scores = {};
    validationsList.forEach(v => {
        if (!scores[v.eleveId]) scores[v.eleveId] = 0;
        scores[v.eleveId] += v.valeurAuMoment || 0;
    });

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    
    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Bloc Contest - Classement</h3><div class="space-y-2">`;
    
    const sorted = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

    // Ici on utilise async/await dans une IIFE car on est dans une fonction synchrone
    (async () => {
        let items = [];
        for (const [eleveId, score] of sorted) {
            const eleve = eleves.find(e => e.id === eleveId);
            const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : eleveId;
            const photoHtml = await getPhotoHtml(eleveId, classe);
            items.push(`<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between">
                    <div class="flex items-center gap-3">
                        ${photoHtml}
                        <span class="font-bold text-white">${nom}</span>
                    </div>
                    <span class="text-yellow-400 font-black">${score} pts</span>
                </div>`);
        }
        html += items.join('');
        html += `</div>`;
        container.innerHTML = html;
    })();
}