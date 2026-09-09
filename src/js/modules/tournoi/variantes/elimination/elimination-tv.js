// src/js/modules/tournoi/variantes/elimination/elimination-tv.js
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { getCurrentClasse } from '../../../../core/live-engine.js';

let currentUnsub = null;
let currentClasse = '';
let animationId = null;
let scrollOffset = 0;

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
    container.style.padding = '0';

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
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const joueursRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/joueurs`);

    container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:1.5rem; margin-top:40vh;">En attente des données...</p>';

    // Configuration (identique à natation-tv.js)
    const NB_VISIBLES = 10;
    const PHOTO_SIZE = 80;
    const SCROLL_SPEED = 1.2;
    const TOP_MARGIN = 80;   // pour le titre
    const BOTTOM_MARGIN = 30;

    let eleveData = [];

    // ============================================================
    // RENDU DU FOND (comme natation-tv.js)
    // ============================================================
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
                    top: 20px;
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
                    top: 70px;
                    left: 50%;
                    transform: translateX(-50%);
                    color: rgba(255,255,255,0.4);
                    font-size: 1rem;
                    z-index: 10;
                    pointer-events: none;
                }
                .tv-scroll-container {
                    position: absolute;
                    top: ${TOP_MARGIN}px;
                    left: 0;
                    right: 0;
                    bottom: ${BOTTOM_MARGIN}px;
                    z-index: 2;
                    overflow: hidden;
                }
                .tv-scroll-inner {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 100%;
                    will-change: transform;
                    display: flex;
                    align-items: stretch;
                    gap: 12px;
                    padding: 0 20px;
                }
                .tv-eleve {
                    position: relative;
                    height: 100%;
                    flex-shrink: 0;
                    width: ${PHOTO_SIZE + 20}px;
                }
                .tv-eleve .marker {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transition: bottom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
                    will-change: bottom;
                    width: 100%;
                }
                .tv-eleve .photo {
                    width: ${PHOTO_SIZE}px;
                    height: ${PHOTO_SIZE}px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid rgba(255,255,255,0.2);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    flex-shrink: 0;
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
                    font-size: 32px;
                    color: #94a3b8;
                }
                .tv-eleve .rank-badge {
                    position: absolute;
                    top: -12px;
                    right: -12px;
                    font-size: 1.2rem;
                    background: #0f172a;
                    border-radius: 50%;
                    padding: 2px;
                    border: 2px solid rgba(255,255,255,0.3);
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 5;
                }
                .tv-eleve .nom {
                    margin-top: 4px;
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: white;
                    text-shadow: 0 0 10px rgba(0,0,0,0.9);
                    background: rgba(0,0,0,0.5);
                    padding: 0 8px;
                    border-radius: 8px;
                    white-space: nowrap;
                    max-width: 80px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .tv-eleve .score {
                    font-size: 1.6rem;
                    font-weight: 900;
                    line-height: 1.2;
                    margin-top: -2px;
                }
                .tv-eleve .score-label {
                    font-size: 0.5rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-top: -4px;
                }
                .tv-eleve.top1 .photo { border-color: #facc15; }
                .tv-eleve.top1 .rank-badge { border-color: #facc15; }
                .tv-eleve.top2 .photo { border-color: #94a3b8; }
                .tv-eleve.top2 .rank-badge { border-color: #94a3b8; }
                .tv-eleve.top3 .photo { border-color: #d97706; }
                .tv-eleve.top3 .rank-badge { border-color: #d97706; }
                @media (max-width: 768px) {
                    .tv-eleve { width: ${PHOTO_SIZE - 20 + 20}px; }
                    .tv-eleve .photo { width: ${PHOTO_SIZE - 20}px; height: ${PHOTO_SIZE - 20}px; }
                    .tv-eleve .nom { font-size: 0.7rem; max-width: 60px; }
                    .tv-eleve .score { font-size: 1.2rem; }
                    .tv-eleve .rank-badge { width: 24px; height: 24px; font-size: 0.9rem; top: -8px; right: -8px; }
                    .tv-title { font-size: 1.3rem; top: 10px; }
                    .tv-subtitle { top: 45px; font-size: 0.8rem; }
                }
                @media (max-width: 480px) {
                    .tv-eleve { width: ${PHOTO_SIZE - 40 + 20}px; }
                    .tv-eleve .photo { width: ${PHOTO_SIZE - 40}px; height: ${PHOTO_SIZE - 40}px; }
                    .tv-eleve .nom { font-size: 0.6rem; max-width: 50px; }
                    .tv-eleve .score { font-size: 1rem; }
                }
            </style>
            <div class="tv-container" id="tv-container">
                <div class="tv-title">🏆 Tournoi Élimination</div>
                <div class="tv-subtitle">Classe : ${classe}</div>
                <div class="tv-scroll-container" id="tv-scroll-container">
                    <div class="tv-scroll-inner" id="tv-scroll-inner"></div>
                </div>
            </div>
        `;
        return html;
    }

    // ============================================================
    // RENDU DES ÉLÈVES (comme natation-tv.js)
    // ============================================================
    function renderEleves(eleves) {
        const inner = document.getElementById('tv-scroll-inner');
        if (!inner) return;

        const containerWidth = window.innerWidth;
        const eleveWidth = PHOTO_SIZE + 20 + 12; // largeur + gap
        const totalWidth = eleves.length * eleveWidth;
        const shouldScroll = eleves.length > NB_VISIBLES;

        const maxElim = Math.max(...eleves.map(e => e.eliminations), 1);

        let html = '';
        const nbCopies = shouldScroll ? 2 : 1;
        for (let copy = 0; copy < nbCopies; copy++) {
            for (const item of eleves) {
                // Position verticale : 0 élimination = 100% (haut), max = 0% (bas)
                const ratio = maxElim > 0 ? item.eliminations / maxElim : 0;
                const bottomPct = (1 - ratio) * 100;

                const rankClass = item.rank === 1 ? 'top1' : (item.rank === 2 ? 'top2' : (item.rank === 3 ? 'top3' : ''));
                const medal = item.rank === 1 ? '🥇' : (item.rank === 2 ? '🥈' : (item.rank === 3 ? '🥉' : ''));

                let color = '#3b82f6';
                if (item.eliminations >= 10) color = '#ef4444';
                else if (item.eliminations >= 5) color = '#facc15';

                const photoId = `tv-photo-${item.code}-${copy}`;

                html += `
                    <div class="tv-eleve">
                        <div class="marker" style="bottom: ${bottomPct}%;">
                            ${medal ? `<span class="rank-badge">${medal}</span>` : ''}
                            <div class="photo ${rankClass}" id="${photoId}">
                                <div class="fallback">👤</div>
                            </div>
                            <div class="nom">${item.nom}</div>
                            <div class="score" style="color: ${color};">${item.eliminations}</div>
                            <div class="score-label">élim.</div>
                        </div>
                    </div>
                `;
            }
        }

        inner.innerHTML = html;
        inner.style.width = shouldScroll ? (totalWidth * 2) + 'px' : totalWidth + 'px';

        // Charger les photos après le rendu
        for (const item of eleves) {
            for (let copy = 0; copy < nbCopies; copy++) {
                const photoDiv = document.getElementById(`tv-photo-${item.code}-${copy}`);
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

        // Positionner le défilement
        if (shouldScroll) {
            const windowWidth = Math.min(containerWidth, NB_VISIBLES * eleveWidth);
            const initialOffset = (containerWidth - windowWidth) / 2;
            scrollOffset = initialOffset;
            inner.style.transform = `translateX(${scrollOffset}px)`;

            if (!animationId) {
                animateScroll(inner, totalWidth);
            }
        } else {
            const totalContentWidth = eleves.length * eleveWidth;
            const offset = (containerWidth - totalContentWidth) / 2;
            inner.style.transform = `translateX(${offset}px)`;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
    }

    function animateScroll(inner, totalWidth) {
        if (!inner) return;

        scrollOffset -= SCROLL_SPEED;

        if (scrollOffset <= -totalWidth) {
            scrollOffset += totalWidth;
        }

        inner.style.transform = `translateX(${scrollOffset}px)`;

        animationId = requestAnimationFrame(() => {
            animateScroll(inner, totalWidth);
        });
    }

    // ============================================================
    // CALCUL DES POSITIONS ET CLASSEMENT
    // ============================================================
    function computeEleveData(joueurs) {
        const entries = Object.entries(joueurs);
        if (entries.length === 0) return [];

        // Classement : les meilleurs sont ceux qui ont le MOINS d'éliminations
        const sorted = entries.sort((a, b) => (a[1].eliminations || 0) - (b[1].eliminations || 0));
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

    // ============================================================
    // RENDU PRINCIPAL
    // ============================================================
    function render() {
        const inner = document.getElementById('tv-scroll-inner');
        if (!inner) {
            // Premier rendu : créer le fond
            const bgHtml = renderBackground();
            container.innerHTML = bgHtml;
            // Rappeler render après la création du DOM
            setTimeout(render, 50);
            return;
        }

        if (eleveData.length === 0) {
            inner.innerHTML = '<p style="text-align:center; color:#64748b; font-size:1.5rem; margin-top:40%;">Aucune élimination enregistrée.</p>';
            return;
        }

        renderEleves(eleveData);
    }

    // ============================================================
    // ÉCOUTE FIREBASE
    // ============================================================
    currentUnsub = onValue(joueursRef, (snap) => {
        const joueurs = snap.val() || {};
        eleveData = computeEleveData(joueurs);
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
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        window.removeEventListener('resize', resizeHandler);
    };
}