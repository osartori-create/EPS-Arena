// src/js/modules/tournoi/variantes/atp/atp-tv.js
// TV ATP : podium fixe (top 3) + liste défilante en boucle
import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse } from '../../tournoi-core.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { recalculerTout, trierClassement, appliquerAjustements, BAREME_DEFAUT } from './atp-core.js';

let unsubs = [];
let _classe = '';
let _elevesMap = {};
let _codes = [];
let _matchs = {};
let _config = {};
let _ajustements = {};
let _scrollTimer = null;
let _rafId = null;

function getATPBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/atp`;
}

export function renderTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '0';
    }
    container.style.height = '100vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#0f172a';
    container.style.overflow = 'hidden';
    container.style.padding = '20px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    _classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    if (!_classe) {
        container.innerHTML = '<p style="text-align:center;color:#64748b;">Sélectionnez une classe.</p>';
        return;
    }

    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${_classe}`) || '[]');
    _elevesMap = {};
    eleves.forEach(e => { if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) _elevesMap[String(e.codeAutoEval)] = e; });
    _codes = eleves.map(e => String(e.codeAutoEval)).filter(Boolean);
    _matchs = {};
    _config = {};
    _ajustements = {};

    const base = getATPBasePath(_classe);
    const u1 = onValue(ref(db, `${base}/matchs`), snap => { _matchs = snap.val() || {}; render(); });
    const u2 = onValue(ref(db, `${base}/config`), snap => { _config = snap.val() || {}; render(); });
    const u3 = onValue(ref(db, `${base}/ajustements`), snap => { _ajustements = snap.val() || {}; render(); });
    unsubs = [u1, u2, u3];
}

function getBareme() {
    if (_config.bareme && Array.isArray(_config.bareme) && _config.bareme.length > 0) return _config.bareme;
    return BAREME_DEFAUT;
}

async function render() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const base = recalculerTout(_codes, _matchs, getBareme());
    appliquerAjustements(base, _ajustements);
    const classement = trierClassement(base, _elevesMap);

    const top3 = classement.slice(0, 3);
    const reste = classement.slice(3);

    // Podium (fixe)
    let podiumHtml = '';
    for (let i = 0; i < top3.length; i++) {
        const item = top3[i];
        const eleve = item.eleve;
        let photo = null;
        if (eleve) { try { photo = await getPhotoUrl(eleve.id); } catch (e) { photo = null; } }
        const photoHtml = photo
            ? `<img src="${photo}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:5px solid ${i===0?'#facc15':i===1?'#94a3b8':'#d97706'};">`
            : `<div style="width:110px;height:110px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:55px;">👤</div>`;
        const medaille = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const mt = i === 0 ? 0 : i === 1 ? 30 : 60;
        podiumHtml += `
            <div style="display:flex;flex-direction:column;align-items:center;margin-top:${mt}px;">
                <div style="font-size:2.6rem;">${medaille}</div>
                ${photoHtml}
                <div style="color:white;font-size:1.25rem;font-weight:900;margin-top:8px;text-align:center;">
                    ${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}
                </div>
                <div style="color:#facc15;font-size:2.3rem;font-weight:900;">${item.points} pts</div>
            </div>`;
    }

    // Liste défilante : on duplique si moins de 10 joueurs pour remplir l'écran
    let liste = [...reste];
    while (liste.length < 10) {
        liste = liste.concat(reste.length > 0 ? reste : top3.concat(reste));
        if (reste.length === 0 && liste.length > 10) break;
    }

    const maxPts = Math.max(...classement.map(t => t.points), 1);
    let listeHtml = '';
    for (let i = 0; i < liste.length; i++) {
        const item = liste[i];
        const eleve = item.eleve;
        let photo = null;
        if (eleve) { try { photo = await getPhotoUrl(eleve.id); } catch (e) { photo = null; } }
        const photoHtml = photo
            ? `<img src="${photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
            : `<div style="width:40px;height:40px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;">👤</div>`;
        const pct = (item.points / maxPts) * 100;
        listeHtml += `
            <div class="atp-tv-row" style="display:flex;align-items:center;gap:14px;padding:7px 0;">
                <div style="min-width:36px;text-align:center;font-size:1.2rem;font-weight:900;color:#94a3b8;">${item.rang}.</div>
                ${photoHtml}
                <div style="min-width:220px;color:white;font-weight:700;">
                    ${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}
                </div>
                <div style="flex:1;background:#1e293b;height:22px;border-radius:11px;overflow:hidden;">
                    <div style="background:linear-gradient(90deg,#3b82f6,#22c55e);width:${pct}%;height:100%;"></div>
                </div>
                <div style="min-width:90px;text-align:right;color:#facc15;font-size:1.3rem;font-weight:900;">
                    ${item.points} pts
                </div>
            </div>`;
    }

    container.innerHTML = `
        <h1 style="text-align:center;color:#3b82f6;font-size:2.8rem;font-weight:900;margin-bottom:20px;">🎾 Tournoi ATP</h1>
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:40px;flex-shrink:0;">
            ${podiumHtml}
        </div>
        <div id="atp-tv-scroller" style="flex:1;min-height:0;overflow:hidden;margin-top:20px;position:relative;">
            <div id="atp-tv-track" style="max-width:1400px;margin:0 auto;">
                ${listeHtml}
            </div>
        </div>
    `;

    demarrerDefilement();
}

// Défilement régulier vers le haut, en boucle
function demarrerDefilement() {
    if (_scrollTimer) clearInterval(_scrollTimer);
    if (_rafId) cancelAnimationFrame(_rafId);

    const scroller = document.getElementById('atp-tv-scroller');
    const track = document.getElementById('atp-tv-track');
    if (!scroller || !track) return;

    // On ajoute une copie de la liste pour un défilement sans rupture.
    track.innerHTML += track.innerHTML;

    let offset = 0;
    const step = 0.5; // px par frame

    function frame() {
        offset += step;
        const halfHeight = track.scrollHeight / 2;
        if (offset >= halfHeight) offset -= halfHeight;
        track.style.transform = `translateY(-${offset}px)`;
        _rafId = requestAnimationFrame(frame);
    }
    // Démarre le défilement uniquement si le contenu dépasse la zone visible.
    if (track.scrollHeight > scroller.clientHeight) {
        _rafId = requestAnimationFrame(frame);
    }
}

export function cleanupTV() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];
    if (_scrollTimer) clearInterval(_scrollTimer);
    if (_rafId) cancelAnimationFrame(_rafId);
}