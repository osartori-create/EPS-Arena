// src/js/modules/natation/natation-tv.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';

let currentUnsubTemps = null;
let currentUnsubCoups = null;
let animationId = null;
let scrollOffset = 0;

// ============================================================
// BARÈME
// ============================================================
function getNiveau(indice) {
    if (indice === null || isNaN(indice)) return { couleur: '#64748b', label: '--' };
    const rounded = Math.round(indice * 100) / 100;
    if (rounded >= 4.0) return { couleur: '#22c55e', label: 'Excellent' };
    if (rounded >= 3.0) return { couleur: '#3b82f6', label: 'Très satisfaisant' };
    if (rounded >= 2.0) return { couleur: '#eab308', label: 'Satisfaisant' };
    if (rounded >= 1.31) return { couleur: '#f97316', label: 'Fragile' };
    return { couleur: '#ef4444', label: 'Très insuffisant' };
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

// ============================================================
// RENDU PRINCIPAL
// ============================================================
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
    container.style.position = 'relative';
    container.style.padding = '0';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem; margin-top:40vh;">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsubTemps) currentUnsubTemps();
    if (currentUnsubCoups) currentUnsubCoups();
    if (animationId) cancelAnimationFrame(animationId);

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/temps`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/coups`);

    let tempsData = {};
    let coupsData = {};
    const mapping = getLocalMapping(classe) || {};
    const eleves = getExistingEleves(classe);

    // Configuration
    const INDICE_MIN = 0.8;
    const INDICE_MAX = 4.5;
    const NB_VISIBLES = 10;
    const PHOTO_SIZE = 80;
    const SCROLL_SPEED = 1.2;

    // Zones de couleur
    const ZONES = [
        { min: 0, max: 1.3, couleur: '#ef4444', label: 'Très insuffisant' },
        { min: 1.3, max: 2.0, couleur: '#f97316', label: 'Fragile' },
        { min: 2.0, max: 3.0, couleur: '#eab308', label: 'Satisfaisant' },
        { min: 3.0, max: 4.0, couleur: '#3b82f6', label: 'Très satisfaisant' },
        { min: 4.0, max: 6.0, couleur: '#22c55e', label: 'Excellent' }
    ];

    const REPERES = [
        { valeur: 1.0, label: '1.0' },
        { valeur: 1.3, label: '1.3' },
        { valeur: 2.0, label: '2.0' },
        { valeur: 3.0, label: '3.0' },
        { valeur: 4.0, label: '4.0' }
    ];

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
                .tv-background {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 0;
                }
                .tv-background .zone {
                    position: absolute;
                    left: 0;
                    width: 100%;
                    opacity: 0.25;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .tv-background .repere {
                    position: absolute;
                    left: 60px;
                    right: 60px;
                    height: 1px;
                    background: rgba(255,255,255,0.15);
                    z-index: 1;
                }
                .tv-background .repere-label {
                    position: absolute;
                    left: 10px;
                    transform: translateY(-50%);
                    color: rgba(255,255,255,0.4);
                    font-size: 1.2rem;
                    font-weight: 700;
                    z-index: 1;
                    text-shadow: 0 0 10px rgba(0,0,0,0.8);
                }
                .tv-scroll-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 2;
                    overflow: hidden;
                }
                .tv-scroll-inner {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: calc(100% - 20px);
                    will-change: transform;
                    display: flex;
                    align-items: stretch;
                    gap: 12px;
                    padding: 0 20px;
                }
                /*
                 * FIX : chaque "slot" élève est désormais un conteneur en
                 * position:relative avec une largeur explicite (pour que le
                 * flex horizontal / gap continue de fonctionner comme avant),
                 * et c'est le ".marker" à l'intérieur qui est positionné en
                 * absolu. On utilise "bottom: X%" (résolu par rapport à la
                 * HAUTEUR du bloc conteneur) au lieu de "margin-bottom: X%"
                 * (qui se résout TOUJOURS par rapport à la LARGEUR, quel que
                 * soit le contexte flex — c'est ce qui causait le bug de
                 * hauteur incorrecte par rapport à l'indice).
                 */
                .tv-eleve {
                    position: relative;
                    height: 100%;
                    flex-shrink: 0;
                    width: ${PHOTO_SIZE}px;
                }
                .tv-eleve .marker {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transition: bottom 0.3s ease;
                }
                .tv-eleve .photo {
                    width: ${PHOTO_SIZE}px;
                    height: ${PHOTO_SIZE}px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid rgba(255,255,255,0.3);
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
                .tv-eleve .numero {
                    margin-top: 4px;
                    font-size: 1.2rem;
                    font-weight: 900;
                    color: #facc15;
                    text-shadow: 0 0 10px rgba(0,0,0,0.9);
                    background: rgba(0,0,0,0.6);
                    padding: 0 10px;
                    border-radius: 12px;
                    white-space: nowrap;
                    line-height: 1.6;
                }
                .tv-title {
                    position: absolute;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    color: rgba(255,255,255,0.6);
                    font-size: 1.8rem;
                    font-weight: 700;
                    z-index: 10;
                    letter-spacing: 4px;
                    text-shadow: 0 0 20px rgba(0,0,0,0.9);
                    pointer-events: none;
                }
                @media (max-width: 768px) {
                    .tv-eleve .photo { width: 60px; height: 60px; }
                    .tv-eleve .numero { font-size: 0.9rem; }
                    .tv-background .repere-label { font-size: 0.8rem; left: 5px; }
                    .tv-background .repere { left: 30px; right: 30px; }
                    .tv-title { font-size: 1.2rem; top: 10px; }
                }
                @media (max-width: 480px) {
                    .tv-eleve .photo { width: 45px; height: 45px; }
                    .tv-eleve .numero { font-size: 0.7rem; }
                }
            </style>
            <div class="tv-container" id="tv-container">
                <div class="tv-title">🏊 INDICE DE NAGE</div>
                <div class="tv-background" id="tv-background">
        `;

        let bgHtml = '';
        for (const zone of ZONES) {
            const topPct = 100 - ((zone.min - INDICE_MIN) / (INDICE_MAX - INDICE_MIN)) * 100;
            const heightPct = ((zone.max - zone.min) / (INDICE_MAX - INDICE_MIN)) * 100;
            bgHtml += `<div class="zone" style="top: ${topPct}%; height: ${heightPct}%; background: ${zone.couleur};"></div>`;
        }

        for (const repere of REPERES) {
            const topPct = 100 - ((repere.valeur - INDICE_MIN) / (INDICE_MAX - INDICE_MIN)) * 100;
            bgHtml += `
                <div class="repere" style="top: ${topPct}%;"></div>
                <div class="repere-label" style="top: ${topPct}%;">${repere.label}</div>
            `;
        }

        return html + bgHtml + `
                </div>
                <div class="tv-scroll-container" id="tv-scroll-container">
                    <div class="tv-scroll-inner" id="tv-scroll-inner"></div>
                </div>
            </div>
        `;
    }

    function renderEleves(eleves) {
        const inner = document.getElementById('tv-scroll-inner');
        if (!inner) return;

        const containerWidth = window.innerWidth;
        const eleveWidth = PHOTO_SIZE + 12;
        const totalWidth = eleves.length * eleveWidth;
        const shouldScroll = eleves.length > NB_VISIBLES;

        let html = '';
        const nbCopies = shouldScroll ? 2 : 1;
        for (let copy = 0; copy < nbCopies; copy++) {
            for (const item of eleves) {
                const colorBorder = item.niveau.couleur;
                const yPosition = item.yPct;
                const photoId = `photo-${item.numero}-${copy}`;
                // FIX : "bottom" en % se résout par rapport à la hauteur du
                // slot (.tv-eleve, position:relative, height:100%), à
                // l'inverse de l'ancien "margin-bottom: %" qui se résolvait
                // par rapport à la largeur de l'écran. Le +10px reproduit
                // le petit espacement bas qu'il y avait avant (padding-bottom).
                html += `
                    <div class="tv-eleve">
                        <div class="marker" style="bottom: calc(${yPosition}% + 10px);">
                            <div class="photo" style="border-color: ${colorBorder};" id="${photoId}">
                                <div class="fallback">👤</div>
                            </div>
                            <div class="numero">#${item.numero}</div>
                        </div>
                    </div>
                `;
            }
        }

        inner.innerHTML = html;
        inner.style.width = shouldScroll ? (totalWidth * 2) + 'px' : totalWidth + 'px';

        // Charger les photos
        for (const item of eleves) {
            const photoDiv = document.getElementById(`photo-${item.numero}-0`);
            if (!photoDiv) continue;
            try {
                const url = getPhotoUrl(item.eleve.id);
                url.then(u => {
                    if (u) {
                        photoDiv.innerHTML = `<img src="${u}" alt="${item.eleve.prenom}">`;
                        const photoDiv2 = document.getElementById(`photo-${item.numero}-1`);
                        if (photoDiv2) photoDiv2.innerHTML = `<img src="${u}" alt="${item.eleve.prenom}">`;
                    }
                });
            } catch (e) {
                // fallback déjà présent
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

    function computeElevePositions() {
        const result = [];
        for (const [numero, tempsMs] of Object.entries(tempsData)) {
            const eleveId = mapping[`${classe}_${numero}`];
            const eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) continue;
            const coups = coupsData[numero] || null;
            const indice = calculIndice(tempsMs, coups);
            if (indice === null) continue;
            // yPct = pourcentage de la hauteur totale (0 = bas, 100 = haut)
            const yPct = ((Math.min(Math.max(indice, INDICE_MIN), INDICE_MAX) - INDICE_MIN) / (INDICE_MAX - INDICE_MIN)) * 100;
            result.push({
                numero: parseInt(numero),
                eleve,
                indice,
                yPct: yPct,
                niveau: getNiveau(indice)
            });
        }
        result.sort((a, b) => a.numero - b.numero);
        return result;
    }

    function render() {
        const newEleveData = computeElevePositions();

        if (newEleveData.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem; margin-top:40vh;">Aucune performance enregistrée.</p>';
            return;
        }

        // Mettre à jour les données
        eleveData = newEleveData;

        // Rendre le fond (une seule fois)
        if (!container.querySelector('.tv-container')) {
            const bgHtml = renderBackground();
            container.innerHTML = bgHtml;
        }

        // Rendre les élèves
        renderEleves(eleveData);
    }

    // Écouter les changements
    currentUnsubTemps = onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        render();
    });

    currentUnsubCoups = onValue(coupsRef, (snap) => {
        coupsData = snap.val() || {};
        render();
    });

    // Gérer le redimensionnement
    window.addEventListener('resize', () => {
        if (eleveData.length > 0) {
            renderEleves(eleveData);
        }
    });

    // Premier rendu
    render();

    return () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (currentUnsubTemps) {
            currentUnsubTemps();
            currentUnsubTemps = null;
        }
        if (currentUnsubCoups) {
            currentUnsubCoups();
            currentUnsubCoups = null;
        }
    };
}