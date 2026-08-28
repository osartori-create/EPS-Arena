// src/js/modules/orientshow/orientshow-tv.js

import { listenOrientShowPassages } from '../../core/firebase-service.js';
import { getLocalMapping, getNomFromCode } from '../../core/live-engine.js';

export function renderOrientShowTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const classe = document.getElementById('selectClasse').value;
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500">Choisissez une classe.</p>';
        return;
    }

    listenOrientShowPassages(classe, (data) => {
        const scores = {};
        Object.values(data).forEach(p => {
            if (!scores[p.code]) scores[p.code] = 0;
            scores[p.code] += p.score;
        });

        const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
        if (sorted.length === 0) {
            container.innerHTML = '<p class="text-slate-500">En attente de résultats...</p>';
            return;
        }

        const maxScore = sorted[0][1] || 1;
        let html = `<div class="flex flex-wrap justify-center items-end gap-4 h-[70vh] overflow-y-auto">`;
        sorted.slice(0, 10).forEach(([code, score]) => {
            const nom = getNomFromCode(code);
            const height = Math.max(40, (score / maxScore) * 300);
            html += `<div class="flex flex-col items-center">
                        <div class="text-sm font-bold text-white">${nom || code}</div>
                        <div style="height:${height}px; width:60px; background:#3b82f6; border-radius:8px 8px 0 0;" class="flex items-end justify-center text-white font-black text-lg">${score}</div>
                        <div class="text-xs text-slate-400">${code}</div>
                    </div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    });
}