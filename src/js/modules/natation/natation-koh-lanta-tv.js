// src/js/modules/natation/natation-koh-lanta-tv.js
// Écran TV « Koh Lanta » — thème plage (sable doré, ciel azur),
// affichage type « montagne » : photo + numéro + performance (secondes).

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { calculScoreKohLanta, formatScoreKohLanta } from './natation-koh-lanta-core.js';

let currentUnsub = null;
let resizeHandler = null;

export function renderNatationKohLantaTV() {
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
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.background = 'linear-gradient(180deg, #7dd3fc 0%, #bae6fd 42%, #fde68a 43%, #fcd34d 100%)';
    container.style.color = '#78350f';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#78350f; font-size:2rem; margin-top:40vh;">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsub) { currentUnsub(); currentUnsub = null; }
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const histoRef = ref(db, `${getEtab()}/profs/${profCode}/${classe}/natation-koh-lanta/historique`);

    const eleves = getExistingEleves(classe);
    const elevesTries = [...eleves].sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    const NB_VISIBLES = 12;

    function buildEleves(histo = {}) {
        const rows = [];
        for (const [numero, essais] of Object.entries(histo)) {
            if (!Array.isArray(essais) || essais.length === 0) continue;
            const index = parseInt(numero, 10) - 1;
            const eleve = elevesTries[index];
            if (!eleve) continue;

            // Performance retenue : meilleur score (le plus bas).
            const best = essais.reduce((acc, e) => {
                const s = calculScoreKohLanta(e);
                if (acc === null || s < calculScoreKohLanta(acc)) return e;
                return acc;
            }, null);
            rows.push({ numero, eleve, bestScore: calculScoreKohLanta(best) });
        }
        rows.sort((a, b) => a.bestScore - b.bestScore);
        return rows;
    }

    function render(histo) {
        const rows = buildEleves(histo);
        if (rows.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#78350f; font-size:2rem; margin-top:40vh;">Aucune réalisation pour l\'instant.</p>';
            return;
        }

        // Échelle verticale en fonction des scores min/max.
        const scores = rows.map(r => r.bestScore);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const span = Math.max(1, maxScore - minScore);

        // Zone de mer (haut) et sable (bas). On positionne les "grimpeurs"
        // sur la partie sable→ciel : plus le score est bas, plus haut.
        const LOWER = 72; // % position basse (sable)
        const UPPER = 22; // % position haute (ciel)

        const totalWidth = rows.length * 92;
        const nbCopies = rows.length > NB_VISIBLES ? 2 : 1;

        let markers = '';
        for (let copy = 0; copy < nbCopies; copy++) {
            for (const r of rows) {
                const pct = ((r.bestScore - minScore) / span) * 100;
                const y = LOWER - (pct / 100) * (LOWER - UPPER);
                markers += `
                    <div style="position:relative; width:92px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%;">
                        <div class="kl-tv-photo" data-num="${r.numero}" data-copy="${copy}"
                             style="position:absolute; bottom:${y}%; transform:translate(-50%, -100%); left:50%; width:72px; height:72px; border-radius:50%; background:#fde68a; border:3px solid #b45309; display:flex; align-items:center; justify-content:center; font-size:30px; color:#78350f; box-shadow:0 4px 12px rgba(0,0,0,0.25);">
                            👤
                        </div>
                        <div style="position:absolute; bottom:${y}%; transform:translate(-50%, 6px); left:50%; background:rgba(255,255,255,0.9); border-radius:12px; padding:3px 8px; font-weight:900; color:#b45309; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                            #${r.numero} · ${formatScoreKohLanta(r.bestScore)}
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = `
            <div style="position:relative; width:100%; height:100vh; overflow:hidden;">
                <div style="position:absolute; top:10px; left:50%; transform:translateX(-50%); color:#78350f; font-weight:900; font-size:1.6rem; letter-spacing:2px; text-shadow:0 1px 0 rgba(255,255,255,0.4); z-index:10; white-space:nowrap;">🏝️ KOH LANTA</div>
                <div style="position:absolute; top:52px; left:50%; transform:translateX(-50%); color:#b45309; font-weight:900; font-size:1rem; z-index:10; white-space:nowrap;">score le plus bas = le plus haut</div>
                <div id="kl-tv-track" style="position:absolute; top:0; left:0; height:100%; display:flex; align-items:stretch; will-change:transform;">${markers}</div>
            </div>
        `;

        const track = document.getElementById('kl-tv-track');
        if (track && rows.length > NB_VISIBLES) {
            track.style.width = (totalWidth * nbCopies) + 'px';
            let offset = 0;
            const speed = 0.8;
            function animate() {
                offset -= speed;
                if (offset <= -totalWidth) offset += totalWidth;
                if (track) track.style.transform = `translateX(${offset}px)`;
                window.__klTvRaf = requestAnimationFrame(animate);
            }
            if (window.__klTvRaf) cancelAnimationFrame(window.__klTvRaf);
            animate();
        } else if (track) {
            track.style.width = totalWidth + 'px';
            track.style.justifyContent = 'center';
            track.style.margin = '0 auto';
        }

        // Chargement des photos.
        for (const r of rows) {
            getPhotoUrl(r.eleve.id).then(u => {
                if (!u) return;
                container.querySelectorAll(`.kl-tv-photo[data-num="${r.numero}"]`).forEach(d => {
                    d.innerHTML = `<img src="${u}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                });
            }).catch(() => {});
        }
    }

    currentUnsub = onValue(histoRef, (snap) => {
        render(snap.val() || {});
    });

    resizeHandler = () => { /* rendu recalculé au prochain onValue */ };
    window.addEventListener('resize', resizeHandler);
}