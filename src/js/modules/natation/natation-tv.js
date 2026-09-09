// src/js/modules/natation/natation-tv.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';

let currentUnsubTemps = null;
let currentUnsubCoups = null;
let currentClasse = '';

function getNiveau(indice) {
    if (indice === null || isNaN(indice)) return { couleur: '#64748b', label: '--' };
    const rounded = Math.round(indice * 100) / 100;
    if (rounded >= 4.0) return { couleur: '#22c55e', label: '🌟 Excellent' };
    if (rounded >= 3.0) return { couleur: '#3b82f6', label: '💪 Très satisfaisant' };
    if (rounded >= 2.0) return { couleur: '#eab308', label: '✅ Satisfaisant' };
    if (rounded >= 1.31) return { couleur: '#f97316', label: '🟡 Fragile' };
    return { couleur: '#ef4444', label: '🔴 Très insuffisant' };
}

function calculIndice(tempsMs, nbCoups) {
    if (tempsMs === null || nbCoups === null || tempsMs <= 0 || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

function formatTime(ms) {
    if (!ms || ms <= 0) return '--:--.-';
    const totalSec = Math.floor(ms / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    const dec = Math.floor((ms % 1000) / 100);
    return `${min}:${sec}.${dec}`;
}

export function renderNatationTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '0';
        tvView.style.overflow = 'hidden';
    }

    container.style.height = '100vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#0f172a';
    container.style.overflow = 'hidden';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.padding = '20px';

    currentClasse = getCurrentClasse();
    if (!currentClasse) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem;">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsubTemps) currentUnsubTemps();
    if (currentUnsubCoups) currentUnsubCoups();

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/coups`);

    let tempsData = {};
    let coupsData = {};
    const mapping = getLocalMapping(currentClasse) || {};
    const eleves = getExistingEleves(currentClasse);

    async function render() {
        if (Object.keys(tempsData).length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem;">En attente des résultats...</p>';
            return;
        }

        const results = [];
        for (const [numero, tempsMs] of Object.entries(tempsData)) {
            const eleveId = mapping[`${currentClasse}_${numero}`];
            const eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) continue;
            const coups = coupsData[numero] || null;
            const indice = calculIndice(tempsMs, coups);
            const niveau = indice !== null ? getNiveau(indice) : { couleur: '#64748b', label: '--' };
            results.push({
                numero,
                eleve,
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
            container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem;">Aucun résultat.</p>';
            return;
        }

        const maxIndice = Math.max(...results.map(r => r.indice || 0), 1);

        let html = `
            <style>
                .tv-header {
                    font-size: 2.5rem;
                    font-weight: 900;
                    color: #3b82f6;
                    text-align: center;
                    margin-bottom: 20px;
                    letter-spacing: 4px;
                }
                .tv-container {
                    width: 100%;
                    max-width: 1400px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 0 20px;
                    height: calc(100vh - 120px);
                    justify-content: flex-end;
                }
                .tv-bar {
                    display: flex;
                    align-items: center;
                    border-radius: 8px;
                    transition: height 0.5s ease;
                    min-height: 40px;
                    padding: 4px 12px;
                    position: relative;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .tv-bar .photo {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    overflow: hidden;
                    flex-shrink: 0;
                    border: 2px solid rgba(255,255,255,0.3);
                    margin-right: 12px;
                }
                .tv-bar .photo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .tv-bar .photo .fallback {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #334155;
                    font-size: 24px;
                }
                .tv-bar .info {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .tv-bar .numero {
                    font-size: 1.8rem;
                    font-weight: 900;
                    color: #facc15;
                    min-width: 60px;
                }
                .tv-bar .nom {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: white;
                }
                .tv-bar .temps {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #94a3b8;
                }
                .tv-bar .indice {
                    font-size: 1.6rem;
                    font-weight: 900;
                    color: #facc15;
                    margin-left: auto;
                    padding-left: 16px;
                }
                .tv-bar .badge {
                    padding: 2px 12px;
                    border-radius: 9999px;
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: white;
                }
                @media (max-width: 768px) {
                    .tv-bar .nom { font-size: 1rem; }
                    .tv-bar .numero { font-size: 1.2rem; min-width: 40px; }
                    .tv-bar .indice { font-size: 1.2rem; }
                    .tv-bar .photo { width: 36px; height: 36px; }
                    .tv-header { font-size: 1.8rem; }
                }
            </style>
            <div class="tv-header">🏊 Classement Indice de nage</div>
            <div class="tv-container">
        `;

        const maxHeight = 80; // % de la hauteur disponible
        const minHeight = 8;

        for (const r of results) {
            const hauteur = r.indice ? Math.max(minHeight, (r.indice / maxIndice) * maxHeight) : minHeight;
            const tempsStr = r.tempsMs ? formatTime(r.tempsMs) : '--';
            const indiceStr = r.indice ? r.indice.toFixed(2) : '--';

            let photoHtml = '';
            try {
                const photoUrl = await getPhotoUrl(r.eleve.id);
                if (photoUrl) {
                    photoHtml = `<img src="${photoUrl}" alt="${r.eleve.prenom}">`;
                } else {
                    photoHtml = `<div class="fallback">👤</div>`;
                }
            } catch (e) {
                photoHtml = `<div class="fallback">👤</div>`;
            }

            html += `
                <div class="tv-bar" style="height: ${hauteur}%; background-color: ${r.niveau.couleur};">
                    <div class="photo">${photoHtml}</div>
                    <div class="info">
                        <span class="numero">#${r.numero}</span>
                        <span class="nom">${r.eleve.prenom} ${r.eleve.nom}</span>
                        <span class="temps">${tempsStr}</span>
                        <span class="badge" style="background-color: ${r.niveau.couleur};">${r.niveau.label}</span>
                    </div>
                    <span class="indice">${indiceStr}</span>
                </div>
            `;
        }

        html += `</div>`;
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