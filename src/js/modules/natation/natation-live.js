// src/js/modules/natation/natation-live.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';

let currentUnsub = null;

export function renderNatationLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/temps`);
    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    currentUnsub = onValue(tempsRef, async (snap) => {
        const data = snap.val() || {};
        // data = { eleveId: tempsMs, ... }
        const results = [];
        for (const [eleveId, tempsMs] of Object.entries(data)) {
            const eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) continue;
            // Trouver le numéro
            let numero = null;
            for (const [key, id] of Object.entries(mapping)) {
                if (id === eleveId) {
                    const match = key.match(/_(\d+)$/);
                    if (match) numero = parseInt(match[1]);
                    break;
                }
            }
            const photo = await getPhotoUrl(eleveId);
            results.push({
                eleve,
                numero,
                tempsMs,
                photo
            });
        }
        results.sort((a, b) => a.tempsMs - b.tempsMs);

        if (results.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-center">Aucun temps enregistré.</p>';
            return;
        }

        let html = `
            <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏊 Classement Indice de nage</h3>
            <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        `;
        results.forEach((r, idx) => {
            const medaille = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`;
            const photoHtml = r.photo ? `<img src="${r.photo}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">` : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
            html += `
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                    <span class="w-8 text-xs font-black text-slate-400">${medaille}</span>
                    ${photoHtml}
                    <div class="flex-1">
                        <div class="font-bold text-white">${r.eleve.prenom} ${r.eleve.nom}</div>
                        <div class="text-xs text-slate-400">N° ${r.numero}</div>
                    </div>
                    <div class="text-2xl font-black text-yellow-400">${(r.tempsMs/1000).toFixed(1)}s</div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    });
}