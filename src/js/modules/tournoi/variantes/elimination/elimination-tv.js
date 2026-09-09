// src/js/modules/tournoi/variantes/elimination/elimination-tv.js
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { getCurrentClasse } from '../../../../core/live-engine.js';

let currentUnsub = null;
let currentClasse = '';

export function renderEliminationTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // Mettre en mode plein écran
    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '10px';
    }

    container.style.height = '90vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#0f172a';
    container.style.overflowY = 'auto';
    container.style.padding = '20px';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem; margin-top:40vh;">Choisissez une classe.</p>';
        return;
    }

    currentClasse = classe;

    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const joueursRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/joueurs`);

    container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:1.5rem; margin-top:40vh;">En attente des données...</p>';

    currentUnsub = onValue(joueursRef, async (snap) => {
        const joueurs = snap.val() || {};
        const entries = Object.entries(joueurs);

        if (entries.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem; margin-top:40vh;">Aucune élimination enregistrée.</p>';
            return;
        }

        const sorted = entries.sort((a, b) => (b[1].eliminations || 0) - (a[1].eliminations || 0));
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

        // Podium : top 3
        const top3 = sorted.slice(0, 3);
        const medailles = ['🥇', '🥈', '🥉'];
        const couleurs = ['#facc15', '#94a3b8', '#d97706'];

        let html = `
            <style>
                .tv-podium { display: flex; justify-content: center; align-items: flex-end; gap: 30px; margin: 40px 0; }
                .tv-podium-item { text-align: center; }
                .tv-podium-item .photo { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 10px; overflow: hidden; border: 4px solid; }
                .tv-podium-item .photo img { width: 100%; height: 100%; object-fit: cover; }
                .tv-podium-item .nom { font-size: 1.2rem; font-weight: 700; color: white; }
                .tv-podium-item .score { font-size: 2.5rem; font-weight: 900; color: #facc15; }
                .tv-podium-item .medaille { font-size: 3rem; }
                .tv-table { margin-top: 30px; background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
                .tv-table th { background: #0f172a; padding: 12px; text-align: left; font-weight: 700; color: #94a3b8; }
                .tv-table td { padding: 10px 12px; border-bottom: 1px solid #1e293b; }
                .tv-table tr:nth-child(even) { background: #0f172a; }
            </style>
            <h2 style="color: #3b82f6; font-weight: 900; font-size: 2.5rem; text-align: center;">🏆 Tournoi Élimination</h2>
            <p style="text-align: center; color: #64748b; margin-bottom: 20px;">Classe : ${classe}</p>
        `;

        // Podium
        if (top3.length > 0) {
            html += `<div class="tv-podium">`;
            for (let i = 0; i < top3.length; i++) {
                const [code, data] = top3[i];
                const eleve = eleves.find(e => e.id === code) || { prenom: code, nom: '' };
                const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : code;
                const eliminations = data.eliminations || 0;

                let photoHtml = `<div style="width:80px;height:80px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 10px;">👤</div>`;
                try {
                    const url = await getPhotoUrl(code);
                    if (url) photoHtml = `<img src="${url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:4px solid ${couleurs[i]};margin:0 auto 10px;">`;
                } catch (e) {}

                html += `
                    <div class="tv-podium-item">
                        <div class="medaille">${medailles[i]}</div>
                        ${photoHtml}
                        <div class="nom">${nom}</div>
                        <div class="score">${eliminations}</div>
                        <div style="color: #64748b; font-size: 0.9rem;">éliminations</div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Tableau complet
        html += `
            <div class="tv-table">
                <table style="width:100%; border-collapse: collapse; color: white;">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Joueur</th>
                            <th style="text-align:center;">Éliminations</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (let i = 0; i < sorted.length; i++) {
            const [code, data] = sorted[i];
            const eleve = eleves.find(e => e.id === code) || { prenom: code, nom: '' };
            const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : code;
            const eliminations = data.eliminations || 0;

            let color = 'white';
            if (eliminations >= 10) color = '#ef4444';
            else if (eliminations >= 5) color = '#facc15';

            html += `
                <tr>
                    <td style="font-weight: 700; color: #94a3b8;">${i+1}</td>
                    <td style="font-weight: 700;">${nom}</td>
                    <td style="text-align:center; font-weight: 900; color: ${color}; font-size: 1.2rem;">${eliminations}</td>
                </tr>
            `;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    });
}