// src/js/modules/tournoi/variantes/elimination/elimination-tv.js
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { getCurrentClasse } from '../../../../core/live-engine.js';

let currentUnsub = null;
let currentClasse = '';
let animationId = null;
let scrollOffset = 0;
let photoCache = {};

// ============================================================
// RENDU PRINCIPAL
// ============================================================
export function renderEliminationTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) {
        console.error('❌ tvGlobe introuvable');
        return;
    }

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
    const NB_VISIBLES = 10;
    const PHOTO_SIZE = 60; // Réduit pour performance
    const SCROLL_SPEED = 1.2;
    const TOP_OFFSET = 80;
    const BOTTOM_OFFSET = 30;

    let eleveData = [];
    let rendered = false;

    // ============================================================
    // RENDU DU FOND
    // ============================================================
    function renderBackground() {
        return `
            <div class="tv-container" id="tv-container" style="position:relative;width:100%;height:100vh;background:#0f172a;overflow:hidden;">
                <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-size:2rem;font-weight:700;z-index:10;letter-spacing:4px;text-shadow:0 0 20px rgba(0,0,0,0.9);pointer-events:none;">
                    🏆 Tournoi Élimination
                </div>
                <div style="position:absolute;top:70px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.4);font-size:1rem;z-index:10;pointer-events:none;">
                    Classe : ${currentClasse}
                </div>
                <div id="tv-scroll-container" style="position:absolute;top:${TOP_OFFSET}px;left:0;right:0;bottom:${BOTTOM_OFFSET}px;z-index:2;overflow:hidden;">
                    <div id="tv-scroll-inner" style="position:absolute;bottom:0;left:0;height:100%;will-change:transform;display:flex;align-items:stretch;gap:10px;padding:0 20px;"></div>
                </div>
            </div>
        `;
    }

    // ============================================================
    // RENDU DES ÉLÈVES (optimisé)
    // ============================================================
    function renderEleves(eleves) {
        const inner = document.getElementById('tv-scroll-inner');
        if (!inner) return;

        const containerWidth = window.innerWidth;
        const eleveWidth = PHOTO_SIZE + 20 + 10;
        const totalWidth = eleves.length * eleveWidth;
        const shouldScroll = eleves.length > NB_VISIBLES;

        const maxElim = Math.max(...eleves.map(e => e.eliminations), 1);

        let html = '';
        const nbCopies = shouldScroll ? 2 : 1;

        // Générer le HTML pour chaque élève
        for (const item of eleves) {
            const ratio = item.eliminations / maxElim;
            const bottomPct = (1 - ratio) * 100;

            const rankClass = item.rank === 1 ? 'top1' : (item.rank === 2 ? 'top2' : (item.rank === 3 ? 'top3' : ''));
            const medal = item.rank === 1 ? '🥇' : (item.rank === 2 ? '🥈' : (item.rank === 3 ? '🥉' : ''));

            let color = '#3b82f6';
            if (item.eliminations >= 10) color = '#ef4444';
            else if (item.eliminations >= 5) color = '#facc15';

            // ✅ On utilise une photo placeholder, on chargera les vraies photos en arrière-plan
            const photoId = `tv-photo-${item.code}`;

            // On génère le HTML une seule fois, puis on le clone pour les copies
            const eleveHtml = `
                <div style="position:relative;height:100%;flex-shrink:0;width:${PHOTO_SIZE + 20}px;">
                    <div style="position:absolute;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;transition:bottom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);will-change:bottom;width:100%;bottom:${bottomPct}%;">
                        ${medal ? `<span style="position:absolute;top:-12px;right:-12px;font-size:1.2rem;background:#0f172a;border-radius:50%;padding:2px;border:2px solid rgba(255,255,255,0.3);width:32px;height:32px;display:flex;align-items:center;justify-content:center;z-index:5;">${medal}</span>` : ''}
                        <div id="${photoId}" style="width:${PHOTO_SIZE}px;height:${PHOTO_SIZE}px;border-radius:50%;overflow:hidden;border:3px solid ${item.rank === 1 ? '#facc15' : (item.rank === 2 ? '#94a3b8' : (item.rank === 3 ? '#d97706' : 'rgba(255,255,255,0.2)'))};box-shadow:0 4px 15px rgba(0,0,0,0.5);flex-shrink:0;">
                            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#334155;font-size:28px;color:#94a3b8;">👤</div>
                        </div>
                        <div style="margin-top:3px;font-size:0.8rem;font-weight:700;color:white;text-shadow:0 0 10px rgba(0,0,0,0.9);background:rgba(0,0,0,0.5);padding:0 8px;border-radius:8px;white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis;">${item.nom}</div>
                        <div style="font-size:1.4rem;font-weight:900;line-height:1.2;margin-top:-2px;color:${color};">${item.eliminations}</div>
                        <div style="font-size:0.5rem;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-top:-4px;">élim.</div>
                    </div>
                </div>
            `;

            // Ajouter une ou plusieurs copies selon le défilement
            for (let copy = 0; copy < nbCopies; copy++) {
                // On clone l'élément en modifiant l'ID de la photo
                const copyHtml = eleveHtml.replace(new RegExp(`id="${photoId}"`, 'g'), `id="${photoId}-${copy}"`);
                html += copyHtml;
            }
        }

        inner.innerHTML = html;

        // ✅ Charger les photos UNE SEULE FOIS, en arrière-plan
        for (const item of eleves) {
            if (!item.eleveId) continue;
            if (photoCache[item.eleveId]) {
                // Photo déjà en cache, on l'applique immédiatement
                applyPhotoToElements(item.eleveId, photoCache[item.eleveId], nbCopies);
                continue;
            }

            // Charger la photo
            getPhotoUrl(item.eleveId)
                .then(url => {
                    if (url) {
                        photoCache[item.eleveId] = url;
                        applyPhotoToElements(item.eleveId, url, nbCopies);
                    }
                })
                .catch(() => {});
        }

        // Défilement horizontal
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

        rendered = true;
    }

    function applyPhotoToElements(eleveId, url, nbCopies) {
        // Appliquer la photo à toutes les copies
        for (let copy = 0; copy < nbCopies; copy++) {
            const photoDiv = document.getElementById(`tv-photo-${eleveId}-${copy}`);
            if (photoDiv) {
                photoDiv.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
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
        // Récupérer TOUS les élèves de la classe
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
        if (eleves.length === 0) return [];

        // Trier par nom pour un affichage stable
        eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

        // Construire la liste avec éliminations
        const result = eleves.map((eleve, index) => {
            const code = (index + 1).toString();
            // ✅ 0 élimination si l'élève n'a pas d'entrée dans Firebase
            const eliminations = joueursFirebase[code]?.eliminations || 0;
            return {
                code: code,
                eleveId: eleve.id,      // Pour les photos
                nom: `${eleve.prenom} ${eleve.nom}`,
                eliminations: eliminations
            };
        });

        // Trier par éliminations CROISSANTES (les meilleurs en premier)
        result.sort((a, b) => a.eliminations - b.eliminations);

        // Ajouter le rang
        result.forEach((item, index) => {
            item.rank = index + 1;
        });

        return result;
    }

    // ============================================================
    // RENDU PRINCIPAL
    // ============================================================
    function render() {
        let containerEl = document.getElementById('tv-container');
        if (!containerEl) {
            container.innerHTML = renderBackground();
            setTimeout(render, 50);
            return;
        }

        const inner = document.getElementById('tv-scroll-inner');
        if (!inner) {
            setTimeout(render, 50);
            return;
        }

        if (eleveData.length === 0) {
            inner.innerHTML = '<p style="text-align:center; color:#64748b; font-size:1.5rem; margin-top:40%;">Aucun élève dans cette classe.</p>';
            return;
        }

        // ✅ On ne re-rend que si les données ont changé
        if (!rendered) {
            renderEleves(eleveData);
        } else {
            // Mise à jour des positions uniquement (transition fluide)
            const maxElim = Math.max(...eleveData.map(e => e.eliminations), 1);
            const markers = document.querySelectorAll('#tv-scroll-inner > div > div');
            eleveData.forEach((item, index) => {
                const ratio = item.eliminations / maxElim;
                const bottomPct = (1 - ratio) * 100;
                if (markers[index]) {
                    markers[index].style.bottom = bottomPct + '%';
                }
            });

            // Mise à jour des scores
            const scores = document.querySelectorAll('#tv-scroll-inner > div > div > div:nth-child(3)');
            eleveData.forEach((item, index) => {
                if (scores[index]) {
                    scores[index].textContent = item.eliminations;
                }
            });

            // Mise à jour des médailles
            const badges = document.querySelectorAll('#tv-scroll-inner > div > div > span');
            eleveData.forEach((item, index) => {
                if (badges[index]) {
                    const medal = item.rank === 1 ? '🥇' : (item.rank === 2 ? '🥈' : (item.rank === 3 ? '🥉' : ''));
                    badges[index].textContent = medal;
                    badges[index].style.display = medal ? '' : 'none';
                }
            });
        }
    }

    // ============================================================
    // ÉCOUTE FIREBASE
    // ============================================================
    currentUnsub = onValue(joueursRef, (snap) => {
        const joueurs = snap.val() || {};
        const newData = computeEleveData(joueurs);

        // Vérifier si les données ont changé
        const dataChanged = JSON.stringify(newData) !== JSON.stringify(eleveData);
        if (dataChanged) {
            eleveData = newData;
            rendered = false; // Forcer un re-rendu complet
            render();
        }
    });

    // Redimensionnement
    const resizeHandler = () => {
        if (eleveData.length > 0 && rendered) {
            // Recalculer les positions sans re-rendre tout le HTML
            const maxElim = Math.max(...eleveData.map(e => e.eliminations), 1);
            const markers = document.querySelectorAll('#tv-scroll-inner > div > div');
            eleveData.forEach((item, index) => {
                const ratio = item.eliminations / maxElim;
                const bottomPct = (1 - ratio) * 100;
                if (markers[index]) {
                    markers[index].style.bottom = bottomPct + '%';
                }
            });
        }
    };
    window.addEventListener('resize', resizeHandler);

    // Premier rendu
    render();

    // Nettoyage
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