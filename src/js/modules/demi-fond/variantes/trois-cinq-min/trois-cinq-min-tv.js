// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-tv.js
// TV : podium fixe (top 3) + liste défilante en boucle (comme le tournoi ATP)

import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping } from '../../../../core/live-engine.js';
import { getPhotoUrl, getExistingEleves } from '../../../../services/admin-service.js';
import { getCouleurGroupe, getBasePath, getSessionActivePath, getTroisCinqMinObsPath } from '../../demifond-common.js';
import { calculerDistance, calculerVitesse } from './trois-cinq-min-core.js';

let unsubs = [];
let cache = {
    classe: '',
    config: null,
    sequence: null,
    observations: { course1: {}, course2: {}, course3: {} },
    eleves: [],
    mapping: {}
};

let _rafId = null;

export function renderTroisCinqMinTV() {
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

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Sélectionnez une classe.</p>';
        return;
    }

    if (_rafId) cancelAnimationFrame(_rafId);

    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];

    cache = {
        classe,
        config: null,
        sequence: null,
        sessionId: null,
        observations: { course1: {}, course2: {}, course3: {} },
        eleves: getExistingEleves(classe),
        mapping: getLocalMapping(classe) || {}
    };

    const basePath = getBasePath(classe);

    let ready = 0;
    const total = 5;
    let rendered = false;

    function checkReady() {
        ready++;
        if (ready >= total && !rendered) {
            rendered = true;
            renderTV();
        } else if (ready > total) {
            renderTV();
        }
    }

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => { cache.config = snap.val(); checkReady(); }));
    unsubs.push(onValue(ref(db, `${basePath}/commandes/sequence`), snap => { cache.sequence = snap.val(); checkReady(); }));

    let obsUnsubs = [];
    const ecouterObservations = (sessionId) => {
        obsUnsubs.forEach(u => { try { u(); } catch (e) {} });
        obsUnsubs = [];
        const obsBase = getTroisCinqMinObsPath(classe, sessionId);
        for (let i = 1; i <= 3; i++) {
            obsUnsubs.push(onValue(ref(db, `${obsBase}/course-${i}`), snap => {
                cache.observations[`course${i}`] = snap.val() || {};
                checkReady();
            }));
        }
        unsubs.push(...obsUnsubs);
    };

    unsubs.push(onValue(ref(db, getSessionActivePath(classe)), snap => {
        cache.sessionId = snap.val() || null;
        ecouterObservations(cache.sessionId);
    }));

    return () => {
        unsubs.forEach(u => { try { u(); } catch (e) {} });
        unsubs = [];
        if (_rafId) cancelAnimationFrame(_rafId);
    };
}

async function renderTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const { config, observations, eleves, mapping, classe } = cache;
    if (!config) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">⏳ En attente de la configuration...</p>';
        return;
    }

    // Calculer les scores de tous les élèves
    const resultats = [];

    for (const [couleurId, codes] of Object.entries(config.groupes || {})) {
        const couleur = getCouleurGroupe(couleurId);
        for (const code of codes) {
            const eleveId = mapping[`${classe}_${couleurId}_${code}`];
            const eleve = eleves.find(e => e.id === eleveId);

            const cours = [1, 2, 3].map(n => {
                const obs = observations[`course${n}`]?.[String(code)];
                if (!obs) return null;
                const distance = calculerDistance(obs.timestamps || [], obs.partiel || 0, config.tour, config.plots);
                const vitesse = obs.abandon ? 0 : calculerVitesse(distance, config.duree);
                return { distance: Math.round(distance), vitesse, abandon: obs.abandon };
            });

            const distanceTotale = cours.reduce((s, c) => s + (c?.distance || 0), 0);
            const coursTerminees = cours.filter(c => c && !c.abandon);
            const vitesseMoyenne = coursTerminees.length > 0
                ? coursTerminees.reduce((s, c) => s + c.vitesse, 0) / coursTerminees.length
                : 0;
            const nbCours = cours.filter(c => c).length;
            const abandonne = cours.some(c => c?.abandon);

            if (nbCours === 0) continue;

            resultats.push({
                code,
                couleur,
                eleve,
                eleveId,
                distanceTotale,
                vitesseMoyenne,
                nbCours,
                abandonne
            });
        }
    }

    // Trier par distance cumulée
    resultats.sort((a, b) => b.distanceTotale - a.distanceTotale);

    if (resultats.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:1.5rem; margin-top:30vh;">En attente des performances...</p>';
        return;
    }

    // Max pour la barre
    const maxDistance = Math.max(...resultats.map(r => r.distanceTotale), 1);

    const top3 = resultats.slice(0, 3);
    const reste = resultats.slice(3);

    // ---- Podium fixe (top 3) ----
    let podiumHtml = '';
    for (let i = 0; i < top3.length; i++) {
        const r = top3[i];
        const photoUrl = r.eleveId ? await getPhotoUrl(r.eleveId).catch(() => null) : null;
        const photoHtml = photoUrl
            ? `<img src="${photoUrl}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:5px solid ${i===0?'#facc15':i===1?'#94a3b8':'#d97706'};">`
            : `<div style="width:110px;height:110px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:55px;">👤</div>`;
        const medaille = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const mt = i === 0 ? 0 : i === 1 ? 30 : 60;
        const nom = r.eleve ? `${r.eleve.prenom} ${r.eleve.nom}` : `#${r.code}`;
        podiumHtml += `
            <div style="display:flex;flex-direction:column;align-items:center;margin-top:${mt}px;">
                <div style="font-size:2.6rem;">${medaille}</div>
                ${photoHtml}
                <div style="color:white;font-size:1.15rem;font-weight:900;margin-top:8px;text-align:center;">
                    ${nom}${r.abandonne ? ' 🚫' : ''}
                </div>
                <div style="color:${r.couleur.bg};font-size:0.9rem;font-weight:700;">${r.couleur.label} #${r.code}</div>
                <div style="color:#facc15;font-size:2.1rem;font-weight:900;">${r.distanceTotale.toLocaleString('fr-FR')} m</div>
            </div>`;
    }

    // ---- Liste défilante (reste) - on duplique si nécessaire ----
    let liste = [...reste];
    while (liste.length < 10) {
        if (reste.length === 0) break;
        liste = liste.concat(reste);
    }

    let listeHtml = '';
    for (let i = 0; i < liste.length; i++) {
        const r = liste[i];
        const rang = resultats.indexOf(r) + 1;
        const pct = (r.distanceTotale / maxDistance) * 100;
        const photoUrl = r.eleveId ? await getPhotoUrl(r.eleveId).catch(() => null) : null;
        const photoHtml = photoUrl
            ? `<img src="${photoUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
            : `<div style="width:40px;height:40px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;">👤</div>`;
        const nom = r.eleve ? `${r.eleve.prenom} ${r.eleve.nom}` : `#${r.code}`;
        listeHtml += `
            <div class="dmf-tv-row" style="display:flex;align-items:center;gap:14px;padding:7px 0;">
                <div style="min-width:36px;text-align:center;font-size:1.2rem;font-weight:900;color:#94a3b8;">${rang}.</div>
                ${photoHtml}
                <div style="min-width:220px;color:white;font-weight:700;">
                    ${nom}${r.abandonne ? ' 🚫' : ''}
                    <span style="color:${r.couleur.bg};font-size:0.8rem;margin-left:6px;">#${r.code}</span>
                </div>
                <div style="flex:1;background:#1e293b;height:22px;border-radius:11px;overflow:hidden;">
                    <div style="background:linear-gradient(90deg,${r.couleur.bg},${r.couleur.border});width:${pct}%;height:100%;"></div>
                </div>
                <div style="min-width:160px;text-align:right;color:#facc15;font-size:1.3rem;font-weight:900;">
                    ${r.distanceTotale.toLocaleString('fr-FR')} m
                </div>
            </div>`;
    }

    container.innerHTML = `
        <h1 style="text-align:center;color:#3b82f6;font-size:2.8rem;font-weight:900;margin-bottom:20px;">🏃 1/2 Fond — Classement</h1>
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:40px;flex-shrink:0;">
            ${podiumHtml}
        </div>
        <div id="dmf-tv-scroller" style="flex:1;min-height:0;overflow:hidden;margin-top:20px;position:relative;">
            <div id="dmf-tv-track" style="max-width:1400px;margin:0 auto;">
                ${listeHtml}
            </div>
        </div>
    `;

    demarrerDefilement();
}

// Défilement régulier vers le haut, en boucle
function demarrerDefilement() {
    if (_rafId) cancelAnimationFrame(_rafId);

    const scroller = document.getElementById('dmf-tv-scroller');
    const track = document.getElementById('dmf-tv-track');
    if (!scroller || !track) return;

    // On ajoute une copie de la liste pour un défilement sans rupture.
    track.innerHTML += track.innerHTML;

    let offset = 0;
    const step = 0.5; // px par frame

    function frame() {
        offset += step;
        const halfHeight = track.scrollHeight / 2;
        if (halfHeight > 0 && offset >= halfHeight) offset -= halfHeight;
        track.style.transform = `translateY(-${offset}px)`;
        _rafId = requestAnimationFrame(frame);
    }

    // Démarre le défilement uniquement si le contenu dépasse la zone visible.
    if (track.scrollHeight > scroller.clientHeight) {
        _rafId = requestAnimationFrame(frame);
    }
}

export function cleanupTroisCinqMinTV() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];
    if (_rafId) cancelAnimationFrame(_rafId);
}