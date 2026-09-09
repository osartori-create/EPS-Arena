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

    // Configuration
    const PHOTO_SIZE = 70;
    const SCROLL_SPEED = 1.2;
    const TOP_MARGIN = 80;
    const BOTTOM_MARGIN = 30;

    let eleveData = [];

    // ============================================================
    // RENDU DU FOND
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
                    background: #334155;
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
    // RENDU DES ÉLÈVES (avec défilement conditionnel)
    // ============================================================
    function renderEleves(eleves) {
        const inner = document.getElementById('tv-scroll-inner');
        if (!inner) return;

        const containerWidth = window.innerWidth - 40; // padding
        const eleveWidth = PHOTO_SIZE + 20 + 12;
        const totalWidth = eleves.length * eleveWidth;

        // ✅ Détermine si le défilement est nécessaire
        const shouldScroll = totalWidth > containerWidth;

        const maxElim = Math.max(...eleves.map(e => e.eliminations), 1);

        let html = '';
        const nbCopies = shouldScroll ? 2 : 1;

        for (let copy = 0; copy < nbCopies; copy++) {
            for (const item of eleves) {
                const ratio = item.eliminations / maxElim;
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

        // ✅ Largeur et positionnement selon qu'on défile ou non
        if (shouldScroll) {
            inner.style.width = (totalWidth * 2) + 'px';
            const initialOffset = (containerWidth - totalWidth) / 2;
            scrollOffset = initialOffset;
            inner.style.transform = `translateX(${scrollOffset}px)`;

            if (!animationId) {
                animateScroll(inner, totalWidth);
            }
        } else {
            inner.style.width = totalWidth + 'px';
            const offset = (containerWidth - totalWidth) / 2;
            inner.style.transform = `translateX(${offset}px)`;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }

        // Charger les photos
        for (const item of eleves) {
            for (let copy = 0; copy < nbCopies; copy++) {
                const photoDiv = document.getElementById(`tv-photo-${item.code}-${copy}`);
                if (!photoDiv) continue;
                if (item.eleveId) {
                    getPhotoUrl(item.eleveId)
                        .then(url => {
                            if (url) {
                                photoDiv.innerHTML = `<img src="${url}" alt="${item.nom}">`;
                            }
                        })
                        .catch(() => {});
                }
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
    // CALCUL DES DONNÉES : TOUS LES ÉLÈVES DE LA CLASSE
    // ============================================================
    function computeEleveData(joueursFirebase) {
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
        if (eleves.length === 0) return [];

        eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

        const result = eleves.map((eleve, index) => {
            const code = (index + 1).toString();
            const eliminations = joueursFirebase[code]?.eliminations || 0;
            return {
                code: code,
                eleveId: eleve.id,
                nom: `${eleve.prenom} ${eleve.nom}`,
                eliminations: eliminations
            };
        });

        result.sort((a, b) => a.eliminations - b.eliminations);

        result.forEach((item, index) => {
            item.rank = index + 1;
        });

        return result;
    }

    // ============================================================
    // RENDU PRINCIPAL
    // ============================================================
    function render() {
        const inner = document.getElementById('tv-scroll-inner');
        if (!inner) {
            const bgHtml = renderBackground();
            container.innerHTML = bgHtml;
            setTimeout(render, 50);
            return;
        }

        if (eleveData.length === 0) {
            inner.innerHTML = '<p style="text-align:center; color:#64748b; font-size:1.5rem; margin-top:40%;">Aucun élève dans cette classe.</p>';
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

    // Redimensionnement
    const resizeHandler = () => {
        if (eleveData.length > 0) {
            const inner = document.getElementById('tv-scroll-inner');
            if (inner) {
                const containerWidth = window.innerWidth - 40;
                const eleveWidth = PHOTO_SIZE + 20 + 12;
                const totalWidth = eleveData.length * eleveWidth;
                const shouldScroll = totalWidth > containerWidth;

                if (shouldScroll) {
                    if (!animationId) {
                        inner.style.width = (totalWidth * 2) + 'px';
                        const initialOffset = (containerWidth - totalWidth) / 2;
                        scrollOffset = initialOffset;
                        inner.style.transform = `translateX(${scrollOffset}px)`;
                        animateScroll(inner, totalWidth);
                    }
                } else {
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                        animationId = null;
                    }
                    inner.style.width = totalWidth + 'px';
                    const offset = (containerWidth - totalWidth) / 2;
                    inner.style.transform = `translateX(${offset}px)`;
                }
            }
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