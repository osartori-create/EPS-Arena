// src/js/modules/badminton/badminton-tv.js
// TV Badminton : classement général en temps réel

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';

let currentUnsub = null;
let currentClasse = '';

export function renderBadmintonTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // Forcer l'affichage TV
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

    const classe = document.getElementById('selectClasse')?.value || getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Choisissez une classe.</p>';
        return;
    }

    currentClasse = classe;

    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    const eleveMap = {};
    eleves.forEach(e => {
        eleveMap[e.id] = { nom: `${e.prenom} ${e.nom}`, sexe: e.sexe };
    });

    function getEleveFromCode(code) {
        for (const [key, value] of Object.entries(mapping)) {
            const parts = key.split('_');
            if (parts.length >= 3) {
                const terrain = parts[1];
                const lettre = parts[2];
                if (`${terrain}_${lettre}` === code) {
                    return eleveMap[value] || { nom: code, sexe: '' };
                }
                if (Array.isArray(value)) {
                    const index = parseInt(lettre) - 1;
                    if (index >= 0 && index < value.length) {
                        const id = value[index];
                        return eleveMap[id] || { nom: code, sexe: '' };
                    }
                }
            }
        }
        return { nom: code, sexe: '' };
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/badminton/results`);

    if (currentUnsub) currentUnsub();

    currentUnsub = onValue(resultsRef, async (snap) => {
        const data = snap.val() || {};

        // Calculer le classement
        const classement = {};

        Object.values(data).forEach(m => {
            if (!m.p1 || !m.p2) return;
            // Points classement (déjà calculés)
            const pts1 = m.pts1 || 0;
            const pts2 = m.pts2 || 0;

            if (!classement[m.p1]) classement[m.p1] = { pts: 0, wins: 0, losses: 0, diff: 0, avec: 0, sans: 0 };
            if (!classement[m.p2]) classement[m.p2] = { pts: 0, wins: 0, losses: 0, diff: 0, avec: 0, sans: 0 };

            classement[m.p1].pts += pts1;
            classement[m.p2].pts += pts2;

            if (m.winner === m.p1) {
                classement[m.p1].wins++;
                classement[m.p2].losses++;
                if (m.avecManiere1) classement[m.p1].avec++;
                else classement[m.p1].sans++;
            } else if (m.winner === m.p2) {
                classement[m.p2].wins++;
                classement[m.p1].losses++;
                if (m.avecManiere2) classement[m.p2].avec++;
                else classement[m.p2].sans++;
            }

            // Diff
            const diff1 = (m.score1 || 0) - (m.score2 || 0);
            const diff2 = (m.score2 || 0) - (m.score1 || 0);
            classement[m.p1].diff += diff1;
            classement[m.p2].diff += diff2;
        });

        const sorted = Object.entries(classement).sort((a, b) => b[1].pts - a[1].pts || b[1].diff - a[1].diff);

        if (sorted.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; margin-top:50px;">Aucun match terminé.</p>';
            return;
        }

        // Afficher le podium
        let html = `
            <style>
                .tv-podium { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-bottom: 30px; }
                .tv-card { background: #1e293b; border-radius: 16px; padding: 20px; min-width: 150px; text-align: center; border: 2px solid #334155; }
                .tv-card.gold { border-color: #facc15; background: #1e293b; }
                .tv-card.silver { border-color: #94a3b8; background: #1e293b; }
                .tv-card.bronze { border-color: #d97706; background: #1e293b; }
                .tv-rank { font-size: 2rem; font-weight: 900; color: #facc15; }
                .tv-photo { width: 60px; height: 60px; border-radius: 50%; margin: 10px auto; }
                .tv-name { font-size: 1.2rem; font-weight: 700; color: white; }
                .tv-stats { font-size: 0.9rem; color: #94a3b8; }
                .tv-score { font-size: 2rem; font-weight: 900; color: #facc15; }
                .tv-badge-avec { background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; display: inline-block; margin: 2px; }
                .tv-badge-sans { background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; display: inline-block; margin: 2px; }
            </style>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #3b82f6; font-weight: 900; font-size: 2rem;">🏸 Badminton</h2>
                <span style="color: #64748b;">Classe : ${classe}</span>
            </div>
            <div class="tv-podium">
        `;

        for (let i = 0; i < Math.min(sorted.length, 5); i++) {
            const [code, stats] = sorted[i];
            const joueur = getEleveFromCode(code);
            let photoHtml = await getPhotoFromId(joueur.id || code);
            let rankClass = i === 0 ? 'gold' : (i === 1 ? 'silver' : (i === 2 ? 'bronze' : ''));
            const medaille = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i+1}.`));

            html += `
                <div class="tv-card ${rankClass}">
                    <div class="tv-rank">${medaille}</div>
                    <div class="tv-photo">${photoHtml}</div>
                    <div class="tv-name">${joueur.nom}</div>
                    <div class="tv-stats">${code}</div>
                    <div class="tv-score">${stats.pts}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">
                        ${stats.wins}V - ${stats.losses}D
                    </div>
                    <div>
                        <span class="tv-badge-avec">${stats.avec || 0} 🏆</span>
                        <span class="tv-badge-sans">${stats.sans || 0}</span>
                    </div>
                </div>
            `;
        }

        // Tableau complet
        html += `
            </div>
            <div style="background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
                <table style="width: 100%; border-collapse: collapse; color: white;">
                    <thead style="background: #0f172a; border-bottom: 2px solid #334155;">
                        <tr>
                            <th style="padding: 12px; text-align: left;">#</th>
                            <th style="padding: 12px; text-align: left;">Joueur</th>
                            <th style="padding: 12px; text-align: center;">Points</th>
                            <th style="padding: 12px; text-align: center;">V/D</th>
                            <th style="padding: 12px; text-align: center;">Diff</th>
                            <th style="padding: 12px; text-align: center;">🏆</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sorted.forEach(([code, stats], idx) => {
            const joueur = getEleveFromCode(code);
            const bg = idx % 2 === 0 ? 'background: #1e293b;' : 'background: #0f172a;';
            html += `
                <tr style="${bg} border-bottom: 1px solid #1e293b;">
                    <td style="padding: 10px; text-align: left; font-weight: 700; color: #94a3b8;">${idx + 1}</td>
                    <td style="padding: 10px; text-align: left; font-weight: 700;">${joueur.nom}</td>
                    <td style="padding: 10px; text-align: center; font-weight: 700; color: #facc15;">${stats.pts}</td>
                    <td style="padding: 10px; text-align: center;">${stats.wins}V - ${stats.losses}D</td>
                    <td style="padding: 10px; text-align: center;">${stats.diff > 0 ? '+':''}${stats.diff}</td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">${stats.avec || 0}</span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    });
}

async function getPhotoFromId(id) {
    if (!id) return `<div style="width: 60px; height: 60px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 10px auto;">👤</div>`;
    try {
        const url = await getPhotoUrl(id);
        if (url) {
            return `<img src="${url}" style="width: 60px; height: 60px; border-radius: 50%; object-cover; border: 2px solid #3b82f6; margin: 10px auto;">`;
        }
    } catch (e) { /* ignore */ }
    return `<div style="width: 60px; height: 60px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 10px auto;">👤</div>`;
}

export function initBadmintonTV() {
    renderBadmintonTV();
}