// src/js/modules/tournoi/variantes/elimination/elimination-live.js
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { getCurrentClasse } from '../../../../core/live-engine.js';

let currentUnsub = null;
let currentClasse = '';

export function renderEliminationLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    currentClasse = classe;

    // Nettoyer l'ancien écouteur
    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const joueursRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/joueurs`);

    container.innerHTML = '<p class="text-slate-500 text-center">Chargement...</p>';

    currentUnsub = onValue(joueursRef, async (snap) => {
        const joueurs = snap.val() || {};
        const entries = Object.entries(joueurs);

        if (entries.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-center">Aucune élimination enregistrée.</p>';
            return;
        }

        // Trier par nombre d'éliminations (décroissant)
        const sorted = entries.sort((a, b) => (b[1].eliminations || 0) - (a[1].eliminations || 0));

        // Récupérer les élèves de la classe pour les noms
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

        let html = `
            <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏆 Classement des éliminations</h3>
            <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        `;

        for (const [code, data] of sorted) {
            const eleve = eleves.find(e => e.id === code) || { prenom: code, nom: '' };
            const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : code;
            const eliminations = data.eliminations || 0;

            // Récupérer la photo
            let photoHtml = `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
            try {
                const url = await getPhotoUrl(code);
                if (url) photoHtml = `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`;
            } catch (e) {}

            // Déterminer la couleur selon le nombre d'éliminations
            let color = 'text-slate-400';
            if (eliminations >= 10) color = 'text-red-400 font-black';
            else if (eliminations >= 5) color = 'text-yellow-400 font-bold';

            html += `
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                    ${photoHtml}
                    <div class="flex-1">
                        <span class="font-bold text-white">${nom}</span>
                        <span class="text-xs text-slate-400 ml-2">#${code}</span>
                    </div>
                    <div class="text-right">
                        <span class="${color} text-2xl font-black">${eliminations}</span>
                        <span class="text-xs text-slate-500 ml-1">élim.</span>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;
    });
}