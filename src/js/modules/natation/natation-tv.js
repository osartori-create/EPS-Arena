// src/js/modules/natation/natation-tv.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';

let currentUnsub = null;

export function renderNatationTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

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
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Choisissez une classe.</p>';
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
        const results = [];
        for (const [eleveId, tempsMs] of Object.entries(data)) {
            const eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) continue;
            let numero = null;
            for (const [key, id] of Object.entries(mapping)) {
                if (id === eleveId) {
                    const match = key.match(/_(\d+)$/);
                    if (match) numero = parseInt(match[1]);
                    break;
                }
            }
            const photo = await getPhotoUrl(eleveId);
            results.push({ eleve, numero, tempsMs, photo });
        }
        results.sort((a, b) => a.tempsMs - b.tempsMs);

        if (results.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; margin-top:50px;">Aucun temps enregistré.</p>';
            return;
        }

        const top3 = results.slice(0, 3);
        const autres = results.slice(3);

        let html = `
            <style>
                .tv-podium { display: flex; justify-content: center; align-items: flex-end; gap: 30px; margin-bottom: 40px; }
                .tv-podium-item { text-align: center; }
                .tv-podium-item .photo { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 10px; overflow: hidden; border: 3px solid #facc15; }
                .tv-podium-item .photo img { width: 100%; height: 100%; object-fit: cover; }
                .tv-podium-item .name { font-size: 1.5rem; font-weight: 700; color: white; }
                .tv-podium-item .time { font-size: 2rem; font-weight: 900; color: #facc15; }
                .tv-podium-item .rank { font-size: 3rem; }
                .tv-table { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
                .tv-table table { width: 100%; border-collapse: collapse; color: white; }
                .tv-table th { background: #0f172a; padding: 12px; text-align: left; border-bottom: 2px solid #334155; }
                .tv-table td { padding: 10px; border-bottom: 1px solid #1e293b; }
            </style>
            <div style="text-align:center; margin-bottom:20px;">
                <h2 style="color:#3b82f6; font-weight:900; font-size:2.5rem;">🏊 Indice de nage</h2>
                <p style="color:#64748b;">Classe : ${classe}</p>
            </div>
        `;

        if (top3.length > 0) {
            html += `<div class="tv-podium">`;
            const podiumColors = ['#facc15', '#94a3b8', '#d97706'];
            top3.forEach((r, idx) => {
                const photoHtml = r.photo ? `<img src="${r.photo}">` : `<span style="font-size:3rem;">👤</span>`;
                html += `
                    <div class="tv-podium-item" style="order: ${idx === 0 ? 2 : idx === 1 ? 1 : 3};">
                        <div class="rank">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</div>
                        <div class="photo" style="border-color: ${podiumColors[idx]};">${photoHtml}</div>
                        <div class="name">${r.eleve.prenom} ${r.eleve.nom}</div>
                        <div class="time">${(r.tempsMs/1000).toFixed(1)}s</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        if (autres.length > 0) {
            html += `<div class="tv-table"><table>
                <thead><tr><th>#</th><th>Joueur</th><th>Temps</th></tr></thead>
                <tbody>`;
            autres.forEach((r, idx) => {
                const num = idx + 4;
                html += `<tr><td>${num}</td><td>${r.eleve.prenom} ${r.eleve.nom}</td><td>${(r.tempsMs/1000).toFixed(1)}s</td></tr>`;
            });
            html += `</tbody></table></div>`;
        }

        container.innerHTML = html;
    });
}