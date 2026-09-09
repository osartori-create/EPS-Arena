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

    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const joueursRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/joueurs`);

    container.innerHTML = '<p class="text-slate-500 text-center">Chargement...</p>';

    currentUnsub = onValue(joueursRef, async (snap) => {
        const joueurs = snap.val() || {};

        // 1. Récupérer TOUS les élèves de la classe depuis localStorage
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
        if (eleves.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-center">Aucun élève dans cette classe.</p>';
            return;
        }

        // 2. Trier les élèves par nom
        eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

        // 3. Construire la liste complète avec les éliminations
        const data = eleves.map((eleve, index) => {
            const code = (index + 1).toString();
            const eliminations = joueurs[code]?.eliminations || 0;
            return {
                code: code,                 // Numéro affiché
                eleveId: eleve.id,          // ID pour la photo
                nom: `${eleve.prenom} ${eleve.nom}`,
                eliminations: eliminations
            };
        });

        // 4. Trier par éliminations décroissantes (les plus éliminés en premier)
        data.sort((a, b) => b.eliminations - a.eliminations);

        // 5. Afficher
        let html = `
            <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏆 Classement des éliminations</h3>
            <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        `;

        for (const item of data) {
            // Charger la photo
            let photoHtml = `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
            if (item.eleveId) {
                try {
                    const url = await getPhotoUrl(item.eleveId);
                    if (url) {
                        photoHtml = `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`;
                    }
                } catch (e) {}
            }

            let color = 'text-slate-400';
            if (item.eliminations >= 10) color = 'text-red-400 font-black';
            else if (item.eliminations >= 5) color = 'text-yellow-400 font-bold';

            html += `
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                    ${photoHtml}
                    <div class="flex-1">
                        <span class="font-bold text-white">${item.nom}</span>
                        <span class="text-xs text-slate-400 ml-2">#${item.code}</span>
                    </div>
                    <div class="text-right">
                        <span class="${color} text-2xl font-black">${item.eliminations}</span>
                        <span class="text-xs text-slate-500 ml-1">élim.</span>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;
    });
}