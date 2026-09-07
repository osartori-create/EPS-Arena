// src/js/modules/natation/natation-tv.js
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
        return { couleur: '#64748b', label: '--' };
    }
    if (indice >= 4.0) return { couleur: '#22c55e', label: 'Excellent' };
    if (indice >= 3.5) return { couleur: '#eab308', label: 'Satisfaisant' };
    if (indice >= 3.0) return { couleur: '#f97316', label: 'Fragile' };
    return { couleur: '#ef4444', label: 'À besoins' };
}

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

    if (currentUnsubTemps) currentUnsubTemps();
    if (currentUnsubCoups) currentUnsubCoups();

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/temps`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/coups`);
    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    let tempsData = {};
    let coupsData = {};

    async function render() {
        const results = [];
        for (const [eleveId, tempsMs] of Object.entries(tempsData)) {
            const eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) continue;
            const coups = coupsData[eleveId] || null;
            const indice = calculIndice(tempsMs, coups);
            const niveau = indice !== null ? getNiveau(indice) : { couleur: '#64748b', label: '--' };
            
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
            container.innerHTML = '<p style="text-align:center; color:#64748b; margin-top:50px;">Aucun résultat pour l\'instant.</p>';
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
                .tv-podium-item .time { font-size: 1.2rem; color: #94a3b8; }
                .tv-podium-item .indice { font-size: 2.5rem; font-weight: 900; color: #facc15; }
                .tv-podium-item .rank { font-size: 3rem; }
                .tv-podium-item .badge { display: inline-block; padding: 2px 12px; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; color: white; margin-top: 4px; }
                .tv-table { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; margin-top: 20px; }
                .tv-table table { width: 100%; border-collapse: collapse; color: white; }
                .tv-table th { background: #0f172a; padding: 12px; text-align: left; border-bottom: 2px solid #334155; }
                .tv-table td { padding: 10px; border-bottom: 1px solid #1e293b; }
                .tv-table .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; color: white; }
            </style>
            <div style="text-align:center; margin-bottom:20px;">
                <h2 style="color:#3b82f6; font-weight:900; font-size:2.5rem;">🏊 Indice de nage</h2>
                <p style="color:#64748b;">Classe : ${classe}</p>
            </div>
        `;

        // Podium
        if (top3.length > 0) {
            html += `<div class="tv-podium">`;
            const podiumColors = ['#facc15', '#94a3b8', '#d97706'];
            for (let i = 0; i < top3.length; i++) {
                const r = top3[i];
                const photo = await getPhotoUrl(r.eleve.id);
                const photoHtml = photo ? `<img src="${photo}">` : `<span style="font-size:3rem;">👤</span>`;
                const medaille = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                const tempsStr = r.tempsMs !== null ? `${(r.tempsMs/1000).toFixed(1)}s` : '--';
                const indiceStr = r.indice !== null ? r.indice.toFixed(2) : '--';
                
                html += `
                    <div class="tv-podium-item" style="order: ${i === 0 ? 2 : i === 1 ? 1 : 3};">
                        <div class="rank">${medaille}</div>
                        <div class="photo" style="border-color: ${podiumColors[i]};">${photoHtml}</div>
                        <div class="name">${r.eleve.prenom} ${r.eleve.nom}</div>
                        <div class="time">${tempsStr} · ${r.coups} bras</div>
                        <div class="indice">${indiceStr}</div>
                        <div class="badge" style="background-color: ${r.niveau.couleur};">${r.niveau.label}</div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Tableau des autres
        if (autres.length > 0) {
            html += `<div class="tv-table"><table>
                <thead><tr><th>#</th><th>Joueur</th><th>Temps</th><th>Bras</th><th>Indice</th><th>Niveau</th></tr></thead>
                <tbody>`;
            for (let i = 0; i < autres.length; i++) {
                const r = autres[i];
                const num = i + 4;
                const tempsStr = r.tempsMs !== null ? `${(r.tempsMs/1000).toFixed(1)}s` : '--';
                const indiceStr = r.indice !== null ? r.indice.toFixed(2) : '--';
                html += `
                    <tr>
                        <td>${num}</td>
                        <td>${r.eleve.prenom} ${r.eleve.nom}</td>
                        <td>${tempsStr}</td>
                        <td>${r.coups || '--'}</td>
                        <td style="font-weight:700; color:#facc15;">${indiceStr}</td>
                        <td><span class="badge" style="background-color: ${r.niveau.couleur};">${r.niveau.label}</span></td>
                    </tr>
                `;
            }
            html += `</tbody></table></div>`;
        }

        container.innerHTML = html;
    }

    currentUnsubTemps = onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        render();
    });

    currentUnsubCoups = onValue(coupsRef, (snap) => {
        coupsData = snap.val() || {};
        render();
    });
}