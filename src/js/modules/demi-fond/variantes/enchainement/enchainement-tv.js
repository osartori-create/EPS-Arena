// src/js/modules/demi-fond/variantes/enchainement/enchainement-tv.js
// TV : classement en direct des élèves par distance cumulée.

import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping } from '../../../../core/live-engine.js';
import { getPhotoUrl, getExistingEleves } from '../../../../services/admin-service.js';
import { getCouleurGroupe, getBasePath } from '../../demifond-common.js';
import { calculerDistance, calculerVitesse } from './enchainement-core.js';

let unsubs = [];
let cache = null;

export function renderEnchainementTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;
    const tvView = document.getElementById('viewTV');
    if (tvView) { tvView.style.display = 'block'; tvView.style.height = '100vh'; tvView.style.padding = '0'; }
    container.style.height = '100vh'; container.style.width = '100%'; container.style.backgroundColor = '#0f172a'; container.style.overflowY = 'auto'; container.style.padding = '30px';

    const classe = getCurrentClasse();
    if (!classe) { container.innerHTML = '<p style="text-align:center;color:#64748b;">Sélectionnez une classe.</p>'; return; }

    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];

    cache = { classe, config: null, sequence: null, observations: {}, eleves: getExistingEleves(classe), mapping: getLocalMapping(classe) || {} };
    const basePath = getBasePath(classe);
    const nbCourses = 6;
    const total = 2 + nbCourses;
    let ready = 0; let rendered = false;
    function checkReady() { ready++; if (ready >= total && !rendered) { rendered = true; renderTV(); } else if (ready > total) { renderTV(); } }

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => { cache.config = snap.val(); checkReady(); }));
    unsubs.push(onValue(ref(db, `${basePath}/commandes/sequence`), snap => { cache.sequence = snap.val(); checkReady(); }));
    for (let i = 1; i <= nbCourses; i++) {
        unsubs.push(onValue(ref(db, `${basePath}/observations/course-${i}`), snap => { cache.observations[`course${i}`] = snap.val() || {}; checkReady(); }));
    }
    return () => { unsubs.forEach(u => { try { u(); } catch (e) {} }); unsubs = []; };
}

async function renderTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;
    const { config, observations, eleves, mapping, classe } = cache;
    if (!config) { container.innerHTML = '<p style="text-align:center;color:#64748b;">⏳ En attente de la configuration...</p>'; return; }

    const nbCourses = (config.durees || []).length;
    const resultats = [];
    for (const [couleurId, codes] of Object.entries(config.groupes || {})) {
        const couleur = getCouleurGroupe(couleurId);
        for (const code of codes) {
            const eleveId = mapping[`${classe}_${couleurId}_${code}`];
            const eleve = eleves.find(e => e.id === eleveId);
            let distanceTotale = 0, vitesseSum = 0, nbTerminees = 0, nbCours = 0, abandonne = false;
            for (let n = 1; n <= nbCourses; n++) {
                const obs = observations[`course${n}`]?.[String(code)];
                if (!obs) continue;
                nbCours++;
                const duree = config.durees[n - 1];
                const distance = calculerDistance(obs.timestamps || [], obs.partiel || 0, config.tour, config.plots);
                distanceTotale += distance;
                if (obs.abandon) { abandonne = true; } else { vitesseSum += calculerVitesse(distance, duree); nbTerminees++; }
            }
            if (nbCours === 0) continue;
            resultats.push({ code, couleur, eleve, eleveId, distanceTotale, vitesseMoyenne: nbTerminees > 0 ? vitesseSum / nbTerminees : 0, nbCours, abandonne });
        }
    }
    resultats.sort((a, b) => b.distanceTotale - a.distanceTotale);
    if (resultats.length === 0) { container.innerHTML = '<p style="text-align:center;color:#64748b;font-size:1.5rem;margin-top:30vh;">En attente des performances...</p>'; return; }

    const maxDistance = Math.max(...resultats.map(r => r.distanceTotale), 1);
    let html = '<h1 style="text-align:center;color:#3b82f6;font-size:3rem;font-weight:900;margin-bottom:40px;">🏃 1/2 Fond — Enchaînement</h1><div style="display:flex;flex-direction:column;gap:14px;max-width:1400px;margin:0 auto;">';
    for (let i = 0; i < Math.min(resultats.length, 20); i++) {
        const r = resultats[i];
        const pct = (r.distanceTotale / maxDistance) * 100;
        const medaille = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}.`));
        let photoUrl = null;
        if (r.eleveId) { try { photoUrl = await getPhotoUrl(r.eleveId); } catch (e) {} }
        const photoHtml = photoUrl ? `<img src="${photoUrl}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:3px solid ${r.couleur.bg};">` : '<div style="width:60px;height:60px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-size:24px;">👤</div>';
        const nom = r.eleve ? `${r.eleve.prenom} ${r.eleve.nom}` : `#${r.code}`;
        html += `<div style="display:flex;align-items:center;gap:16px;"><div style="font-size:2rem;min-width:70px;text-align:center;">${medaille}</div>${photoHtml}<div style="min-width:220px;"><div style="font-size:1.4rem;font-weight:900;color:white;">${nom}${r.abandonne ? ' 🚫' : ''}</div><div style="font-size:0.9rem;color:${r.couleur.bg};font-weight:700;">${r.couleur.label} #${r.code} · ${r.nbCours} série(s)</div></div><div style="flex:1;background:#1e293b;height:50px;border-radius:25px;overflow:hidden;"><div style="background:linear-gradient(90deg,${r.couleur.bg},${r.couleur.border});width:${pct}%;height:100%;"></div></div><div style="min-width:200px;text-align:right;"><div style="font-size:1.8rem;font-weight:900;color:#facc15;">${Math.round(r.distanceTotale).toLocaleString('fr-FR')} m</div><div style="font-size:1rem;color:#94a3b8;">${r.vitesseMoyenne.toFixed(1)} km/h moy</div></div></div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}