// src/js/modules/orientshow/orientshow-live.js

import { listenOrientShowPassages } from '../../core/firebase-service.js';
import { getNomFromCode, getPhotoHtml } from '../../core/live-engine.js';

let currentClasse = '';

export function renderOrientShowLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    currentClasse = document.getElementById('selectClasse').value;
    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
        return;
    }

    listenOrientShowPassages(currentClasse, (data) => {
        const passages = Object.values(data).sort((a,b) => b.timestamp - a.timestamp);
        let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🏃 Dernières validations OrientShow</h3>`;
        if (passages.length === 0) {
            html += `<p class="text-slate-500">Aucun passage pour l'instant.</p>`;
        } else {
            html += `<div class="space-y-2 max-h-[60vh] overflow-y-auto">`;
            passages.slice(0, 20).forEach(p => {
                const nom = getNomFromCode(p.code);
                html += `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-white">${nom || p.code}</span>
                                <span class="text-xs text-slate-400">C${p.circuit}</span>
                            </div>
                            <span class="text-${p.score === 5 ? 'emerald' : p.score === 2 ? 'yellow' : 'red'}-400 font-black">${p.score} pts</span>
                        </div>`;
            });
            html += `</div>`;
        }
        container.innerHTML = html;
    });
}