// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-tv.js
// TV : classement en direct des élèves par distance cumulée

import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping } from '../../../../core/live-engine.js';
import { getPhotoUrl, getExistingEleves } from '../../../../services/admin-service.js';
import { getCouleurGroupe, getBasePath } from '../../demifond-common.js';
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
    container.style.overflowY = 'auto';
    container.style.padding = '30px';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Sélectionnez une classe.</p>';
        return;
    }

    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];

    cache = {
        classe,
        config: null,
        sequence: null,
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
    for (let i = 1; i <= 3; i++) {
        unsubs.push(onValue(ref(db, `${basePath}/observations/course-${i}`), snap => {
            cache.observations[`course${i}`] = snap.val() || {};
            checkReady();
        }));
    }

    return () => {
        unsubs.forEach(u => { try { u(); } catch (e) {} });
        unsubs = [];
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

    // Titre
    let html = `
        <h1 style="text-align:center; color:#3b82f6; font-size:3rem; font-weight:900; margin-bottom:40px;">
            🏃 1/2 Fond — Classement
        </h1>
        <div style="display:flex; flex-direction:column; gap:14px; max-width:1400px; margin:0 auto;">
    `;

    // Afficher les 20 premiers
    for (let i = 0; i < Math.min(resultats.length, 20); i++) {
        const r = resultats[i];
        const pct = (r.distanceTotale / maxDistance) * 100;
        const medaille = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}.`));

        // Photo
        let photoUrl = null;
        if (r.eleveId) {
            try { photoUrl = await getPhotoUrl(r.eleveId); } catch (e) {}
        }
        const photoHtml = photoUrl
            ? `<img src="${photoUrl}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:3px solid ${r.couleur.bg};">`
            : `<div style="width:60px; height:60px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; font-size:24px;">👤</div>`;

        const nom = r.eleve ? `${r.eleve.prenom} ${r.eleve.nom}` : `#${r.code}`;
        const abandonIcon = r.abandonne ? ' 🚫' : '';

        html += `
            <div style="display:flex; align-items:center; gap:16px;">
                <div style="font-size:2rem; min-width:70px; text-align:center;">${medaille}</div>
                ${photoHtml}
                <div style="min-width:220px;">
                    <div style="font-size:1.4rem; font-weight:900; color:white;">${nom}${abandonIcon}</div>
                    <div style="font-size:0.9rem; color:${r.couleur.bg}; font-weight:700;">${r.couleur.label} #${r.code} · ${r.nbCours} course(s)</div>
                </div>
                <div style="flex:1; background:#1e293b; height:50px; border-radius:25px; overflow:hidden; position:relative;">
                    <div style="background:linear-gradient(90deg, ${r.couleur.bg}, ${r.couleur.border}); width:${pct}%; height:100%; transition:width 0.5s;"></div>
                </div>
                <div style="min-width:200px; text-align:right;">
                    <div style="font-size:1.8rem; font-weight:900; color:#facc15;">${r.distanceTotale.toLocaleString('fr-FR')} m</div>
                    <div style="font-size:1rem; color:#94a3b8;">${r.vitesseMoyenne.toFixed(1)} km/h moy</div>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}