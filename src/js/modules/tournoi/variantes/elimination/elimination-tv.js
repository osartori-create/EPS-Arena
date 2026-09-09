// src/js/modules/tournoi/variantes/elimination/elimination-tv.js
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { getCurrentClasse } from '../../../../core/live-engine.js';

let currentUnsub = null;
let currentClasse = '';

// ============================================================
// RENDU PRINCIPAL
// ============================================================
export function renderEliminationTV() {
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
    container.style.position = 'relative';
    container.style.padding = '20px';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem; margin-top:40vh;">Sélectionnez une classe.</p>';
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

    // Configuration
    const PHOTO_SIZE = 65;
    const TOP_OFFSET = 80; // pour le titre
    const BOTTOM_OFFSET = 30;

    let eleveData = [];

    function renderBackground() {
        const html = `
            <style>
                .tv-container {
                    position: relative;
                    width: 100%;
                    height: 100vh;
                    background: #0f172a;
                    overflow: hidden;
                }
                .tv-title {
                    position: absolute;
                    top: 15px;
                    left: 50%;
                    transform: translateX(-50%);
                    color: rgba(255,255,255,0.7);
                    font-size: 2rem;
                    font-weight: 700;
                    z-index: 10;
                    letter-spacing: 4px;
                    text-shadow: 0 0 20px rgba(0,0,0,0.9);
                    pointer-events: none;
                }
                .tv-subtitle {
                    position: absolute;
                    top: 60px;
                    left: 50%;
                    transform: translateX(-50%);
                    color: rgba(255,255,255,0.4);
                    font-size: 1rem;
                    z-index: 10;
                    pointer-events: none;
                }
                .tv-eleve-container {
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: ${TOP_OFFSET}px;
                    bottom: ${BOTTOM_OFFSET}px;
                    z-index: 2;
                }
                .tv-eleve {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transition: top 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                    will-change: top;
                    padding: 4px 12px;
                    border-radius: 16px;
                    background: rgba(30, 41, 59, 0.5);
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(71, 85, 105, 0.3);
                    min-width: 80px;
                    cursor: default;
                }
                .tv-eleve .photo {
                    width: ${PHOTO_SIZE}px;
                    height: ${PHOTO_SIZE}px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid rgba(255,255,255,0.2);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    flex-shrink: 0;
                    margin-bottom: 2px;
                }
                .tv-eleve .photo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .tv-eleve .photo .fallback {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #334155;
                    font-size: 28px;
                    color: #94a3b8;
                }
                .tv-eleve .nom {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: white;
                    text-shadow: 0 0 10px rgba(0,0,0,0.8);
                    white-space: nowrap;
                    max-width: 100px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .tv-eleve .score {
                    font-size: 1.8rem;
                    font-weight: 900;
                    line-height: 1.2;
                }
                .tv-eleve .score-label {
                    font-size: 0.5rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .tv-eleve .rank-badge {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    font-size: 1rem;
                    background: #0f172a;
                    border-radius: 50%;
                    padding: 2px;
                    border: 2px solid rgba(255,255,255,0.2);
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .tv-eleve.top1 {
                    border-color: #facc15;
                    background: rgba(250, 204, 21, 0.2);
                }
                .tv-eleve.top1 .rank-badge {
                    border-color: #facc15;
                }
                .tv-eleve.top2 {
                    border-color: #94a3b8;
                    background: rgba(148, 163, 184, 0.2);
                }
                .tv-eleve.top2 .rank-badge {
                    border-color: #94a3b8;
                }
                .tv-eleve.top3 {
                    border-color: #d97706;
                    background: rgba(217, 119, 6, 0.2);
                }
                .tv-eleve.top3 .rank-badge {
                    border-color: #d97706;
                }
                @media (max-width: 768px) {
                    .tv-eleve { min-width: 60px; padding: 2px 8px; }
                    .tv-eleve .photo { width: 45px; height: 45px; }
                    .tv-eleve .nom { font-size: 0.6rem; max-width: 70px; }
                    .tv-eleve .score { font-size: 1.2rem; }
                    .tv-eleve .rank-badge { width: 22px; height: 22px; font-size: 0.7rem; top: -6px; right: -6px; }
                    .tv-title { font-size: 1.3rem; top: 10px; }
                    .tv-subtitle { top: 45px; font-size: 0.8rem; }
                }
                @media (max-width: 480px) {
                    .tv-eleve .photo { width: 35px; height: 35px; }
                    .tv-eleve .nom { font-size: 0.5rem; max-width: 50px; }
                    .tv-eleve .score { font-size: 1rem; }
                }
            </style>
            <div class="tv-container" id="tv-container">
                <div class="tv-title">🏆 Tournoi Élimination</div>
                <div class="tv-subtitle">Classe : ${classe}</div>
                <div class="tv-eleve-container" id="tv-eleve-container"></div>
            </div>
        `;
        return html;
    }

    function renderEleves(eleves) {
        const containerEl = document.getElementById('tv-eleve-container');
        if (!containerEl) return;

        // Hauteur disponible pour les positions
        const containerHeight = containerEl.clientHeight || window.innerHeight - TOP_OFFSET - BOTTOM_OFFSET;
        const maxElim = Math.max(...eleves.map(e => e.eliminations), 1);

        // Calculer la position en pixels pour chaque élève
        // 0 élimination = 0 (tout en haut), max = containerHeight (tout en bas)
        // On ajoute un petit offset pour que le premier ne soit pas collé au bord
        const padding = 10;
        const usableHeight = containerHeight - 2 * padding;

        let html = '';
        for (const item of eleves) {
            const ratio = item.eliminations / maxElim;
            const topPos = padding + ratio * usableHeight;

            const rankClass = item.rank === 1 ? 'top1' : (item.rank === 2 ? 'top2' : (item.rank === 3 ? 'top3' : ''));
            const medal = item.rank === 1 ? '🥇' : (item.rank === 2 ? '🥈' : (item.rank === 3 ? '🥉' : `#${item.rank}`));

            let color = '#3b82f6';
            if (item.eliminations >= 10) color = '#ef4444';
            else if (item.eliminations >= 5) color = '#facc15';

            const photoId = `tv-photo-${item.code}`;

            html += `
                <div class="tv-eleve ${rankClass}" style="top: ${topPos}px;">
                    <span class="rank-badge">${medal}</span>
                    <div class="photo" id="${photoId}">
                        <div class="fallback">👤</div>
                    </div>
                    <div class="nom">${item.nom}</div>
                    <div class="score" style="color: ${color};">${item.eliminations}</div>
                    <div class="score-label">élim.</div>
                </div>
            `;
        }

        containerEl.innerHTML = html;

        // Charger les photos après le rendu
        for (const item of eleves) {
            const photoDiv = document.getElementById(`tv-photo-${item.code}`);
            if (!photoDiv) continue;
            try {
                const url = getPhotoUrl(item.code);
                url.then(u => {
                    if (u) {
                        photoDiv.innerHTML = `<img src="${u}" alt="${item.nom}">`;
                    }
                });
            } catch (e) {
                // Garder le fallback
            }
        }
    }

    function computeElevePositions(joueurs) {
        const entries = Object.entries(joueurs);
        if (entries.length === 0) return [];

        // Trier par nombre d'éliminations décroissant pour le classement
        const sorted = entries.sort((a, b) => (b[1].eliminations || 0) - (a[1].eliminations || 0));
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

        return sorted.map(([code, data], index) => {
            const eleve = eleves.find(e => e.id === code) || { prenom: code, nom: '' };
            const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : code;
            const eliminations = data.eliminations || 0;
            return {
                code,
                nom,
                eliminations,
                rank: index + 1
            };
        });
    }

    function render() {
        const containerEl = document.getElementById('tv-eleve-container');
        if (!containerEl) {
            // Premier rendu : créer le fond
            const bgHtml = renderBackground();
            container.innerHTML = bgHtml;
            // Rappeler render après la création du DOM
            setTimeout(render, 50);
            return;
        }

        if (eleveData.length === 0) {
            containerEl.innerHTML = '<p style="text-align:center; color:#64748b; font-size:1.5rem; margin-top:40%;">Aucune élimination enregistrée.</p>';
            return;
        }

        renderEleves(eleveData);
    }

    // Écouter les changements
    currentUnsub = onValue(joueursRef, (snap) => {
        const joueurs = snap.val() || {};
        eleveData = computeElevePositions(joueurs);
        render();
    });

    // Gérer le redimensionnement
    const resizeHandler = () => {
        if (eleveData.length > 0) {
            renderEleves(eleveData);
        }
    };
    window.addEventListener('resize', resizeHandler);

    // Premier rendu
    render();

    return () => {
        if (currentUnsub) {
            currentUnsub();
            currentUnsub = null;
        }
        window.removeEventListener('resize', resizeHandler);
    };
}