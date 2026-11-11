// src/js/modules/natation/natation-longue-tv.js
// TV du mode « Longue distance » : podium (top 3) + liste défilante.

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { getBasePath, getSessionActivePath, getSessionObsPath, getSessionModifsPath, getStatuts, getCouleurGroupe } from './natation-longue-common.js';
import { agregerResultats } from './natation-longue-bilan.js';

let unsubs = [];
let obsUnsubs = [];
let _rafId = null;
let cache = {
    classe: '',
    config: null,
    sessionId: null,
    observations: null,
    modifications: null,
    statuts: {}
};

// ============================================================
// INITIALISATION
// ============================================================
export function renderNatationLongueTV() {
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
    obsUnsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];
    obsUnsubs = [];

    cache = {
        classe,
        config: null,
        sessionId: null,
        observations: null,
        modifications: null,
        statuts: getStatuts(classe)
    };

    const basePath = getBasePath(classe);

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => { cache.config = snap.val(); renderTV(); }));

    const ecouterSession = (sessionId) => {
        obsUnsubs.forEach(u => { try { u(); } catch (e) {} });
        obsUnsubs = [];
        cache.sessionId = sessionId;
        cache.observations = null;
        cache.modifications = null;
        if (sessionId) {
            obsUnsubs.push(onValue(ref(db, getSessionObsPath(classe, sessionId)), snap => {
                cache.observations = snap.val() || {};
                renderTV();
            }));
            obsUnsubs.push(onValue(ref(db, getSessionModifsPath(classe, sessionId)), snap => {
                cache.modifications = snap.val() || {};
                renderTV();
            }));
        }
        renderTV();
    };

    unsubs.push(onValue(ref(db, getSessionActivePath(classe)), snap => ecouterSession(snap.val() || null)));

    return cleanupNatationLongueTV;
}

// ============================================================
// RENDU TV
// ============================================================
function renderTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    if (!cache.config) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">En attente de la configuration...</p>';
        return;
    }

    const resultats = agregerResultats(cache.classe, cache.observations || {}, cache.modifications || {}, cache.config, cache.statuts)
        .filter(r => !r.exclu);

    if (resultats.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Aucun résultat pour cette épreuve.</p>';
        return;
    }

    const maxDistance = Math.max(1, ...resultats.map(r => r.distance));

    // Podium (top 3)
    const top = resultats.slice(0, 3);
    const positions = [
        { rang: 2, h: 90, label: '2', color: '#94a3b8' },
        { rang: 1, h: 130, label: '1', color: '#facc15' },
        { rang: 3, h: 70, label: '3', color: '#d97706' }
    ];
    let podiumHtml = '';
    positions.forEach(p => {
        const r = top[p.rang - 1];
        if (!r) {
            podiumHtml += `<div style="display:flex;flex-direction:column;align-items:center;width:180px;"><div style="height:${p.h}px;width:180px;background:#1e293b;border-radius:12px 12px 0 0;border:2px solid #334155;"></div></div>`;
            return;
        }
        const couleur = getCouleurGroupe(r.couleur.id);
        podiumHtml += `
            <div style="display:flex;flex-direction:column;align-items:center;width:180px;">
                <div style="font-size:1.6rem;font-weight:900;color:white;margin-bottom:6px;">${r.nom}</div>
                <div style="font-size:1rem;font-weight:700;color:${couleur.bg};margin-bottom:4px;">#${r.numero}</div>
                <div style="font-size:1.3rem;font-weight:900;color:${p.color};margin-bottom:6px;">${r.distance.toLocaleString('fr-FR')} m</div>
                <div style="height:${p.h}px;width:180px;background:linear-gradient(180deg,${couleur.bg},${couleur.border});border-radius:12px 12px 0 0;border:2px solid ${couleur.border};display:flex;align-items:flex-start;justify-content:center;">
                    <span style="font-size:2rem;font-weight:900;color:white;margin-top:6px;">${p.label}</span>
                </div>
            </div>
        `;
    });

    // Liste défilante
    let liste = [...resultats];
    const reste = [...resultats];
    while (liste.length < 10 && reste.length > 0) liste = liste.concat(reste);

    let listeHtml = '';
    for (let i = 0; i < liste.length; i++) {
        const r = liste[i];
        const rang = resultats.indexOf(r) + 1;
        const pct = (r.distance / maxDistance) * 100;
        const couleur = getCouleurGroupe(r.couleur.id);
        listeHtml += `
            <div class="nl-tv-row" style="display:flex;align-items:center;gap:14px;padding:7px 0;">
                <div style="min-width:36px;text-align:center;font-size:1.2rem;font-weight:900;color:#94a3b8;">${rang}.</div>
                <div style="min-width:220px;color:white;font-weight:700;">
                    ${r.nom}
                    <span style="color:${couleur.bg};font-size:0.8rem;margin-left:6px;">#${r.numero}</span>
                </div>
                <div style="flex:1;background:#1e293b;height:22px;border-radius:11px;overflow:hidden;">
                    <div style="background:linear-gradient(90deg,${couleur.bg},${couleur.border});width:${pct}%;height:100%;"></div>
                </div>
                <div style="min-width:140px;text-align:right;color:#facc15;font-size:1.3rem;font-weight:900;">${r.distance.toLocaleString('fr-FR')} m</div>
            </div>`;
    }

    container.innerHTML = `
        <h1 style="text-align:center;color:#3b82f6;font-size:2.6rem;font-weight:900;margin-bottom:16px;">🏊 Natation — Longue distance</h1>
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:40px;flex-shrink:0;">${podiumHtml}</div>
        <div id="nl-tv-scroller" style="flex:1;min-height:0;overflow:hidden;margin-top:20px;position:relative;">
            <div id="nl-tv-track" style="max-width:1400px;margin:0 auto;">${listeHtml}</div>
        </div>
    `;

    demarrerDefilement();
}

// Défilement régulier en boucle
function demarrerDefilement() {
    if (_rafId) cancelAnimationFrame(_rafId);
    const scroller = document.getElementById('nl-tv-scroller');
    const track = document.getElementById('nl-tv-track');
    if (!scroller || !track) return;

    track.innerHTML += track.innerHTML;

    let offset = 0;
    const step = 0.5;
    function frame() {
        offset += step;
        const halfHeight = track.scrollHeight / 2;
        if (halfHeight > 0 && offset >= halfHeight) offset -= halfHeight;
        track.style.transform = `translateY(-${offset}px)`;
        _rafId = requestAnimationFrame(frame);
    }
    if (track.scrollHeight > scroller.clientHeight) {
        _rafId = requestAnimationFrame(frame);
    }
}

export function cleanupNatationLongueTV() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    obsUnsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];
    obsUnsubs = [];
    if (_rafId) cancelAnimationFrame(_rafId);
}

