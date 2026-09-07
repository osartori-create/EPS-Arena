// src/js/modules/natation/natation-live.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';

let currentUnsubTemps = null;
let currentUnsubCoups = null;

function calculIndice(tempsMs, nbCoups) {
    if (tempsMs === null || nbCoups === null || tempsMs <= 0 || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

function getNiveau(indice) {
    if (indice === null || indice === undefined || isNaN(indice)) {
        return { couleur: 'bg-slate-600', label: '--' };
    }
    if (indice >= 4.0) return { couleur: 'bg-emerald-500', label: 'Excellent' };
    if (indice >= 3.5) return { couleur: 'bg-yellow-500', label: 'Satisfaisant' };
    if (indice >= 3.0) return { couleur: 'bg-orange-500', label: 'Fragile' };
    return { couleur: 'bg-red-500', label: 'À besoins' };
}

export function renderNatationLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsubTemps) currentUnsubTemps();
    if (currentUnsubCoups) currentUnsubCoups();

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/temps`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/coups`);
    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    let tempsData = {};
    let coupsData = {};

    // Fonction de rendu asynchrone
    async function render() {
        const results = [];
        for (const [eleveId, tempsMs] of Object.entries(tempsData)) {
            const eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) continue;
            const coups = coupsData[eleveId] || null;
            const indice = calculIndice(tempsMs, coups);
            const niveau = indice !== null ? getNiveau(indice) : { couleur: 'bg-slate-600', label: '--' };
            
            let numero = null;
            for (const [key, id] of Object.entries(mapping)) {
                if (id === eleveId) {
                    const match = key.match(/_(\d+)$/);
                    if (match) numero = parseInt(match[1]);
                    break;
                }
            }
            results.push({
                eleve,
                numero,
                tempsMs,
                coups,
                indice,
                niveau
            });
        }
        results.sort((a, b) => {
            if (a.indice === null && b.indice === null) return 0;
            if (a.indice === null) return 1;
            if (b.indice === null) return -1;
            return b.indice - a.indice;
        });

        if (results.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-center">Aucun résultat pour l\'instant.</p>';
            return;
        }

        let html = `
            <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏊 Classement Indice de nage</h3>
            <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        `;
        
        for (const r of results) {
            const photo = await getPhotoUrl(r.eleve.id);
            const photoHtml = photo ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">` : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
            const tempsStr = r.tempsMs !== null ? `${(r.tempsMs/1000).toFixed(1)}s` : '--';
            const coupsStr = r.coups !== null ? `${r.coups}` : '--';
            const indiceStr = r.indice !== null ? r.indice.toFixed(2) : '--';
            
            html += `
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                    ${photoHtml}
                    <div class="flex-1">
                        <div class="font-bold text-white">${r.eleve.prenom} ${r.eleve.nom}</div>
                        <div class="text-xs text-slate-400">N° ${r.numero}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-yellow-400 font-bold">${tempsStr}</span>
                        <span class="text-blue-400 font-bold">${coupsStr} bras</span>
                        <span class="${r.niveau.couleur} px-2 py-0.5 rounded-full text-xs font-black text-white">${indiceStr}</span>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
        container.innerHTML = html;
    }

    currentUnsubTemps = onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        render(); // appel sans await, c'est une promesse mais on ne l'attend pas
    });

    currentUnsubCoups = onValue(coupsRef, (snap) => {
        coupsData = snap.val() || {};
        render();
    });
}