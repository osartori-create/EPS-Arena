// src/js/modules/demi-fond/demifond-live.js
// Dispatch vers le sous-module actif

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getLocalMapping } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { COULEURS_GROUPES, getBasePath, getVMAEleve } from './demifond-common.js';
import { calculerDistance, calculerVitesse } from './variantes/trois-cinq-min/trois-cinq-min-core.js';

let currentUnsub = null;

export function renderDemiFondLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const select = document.getElementById('selectClasse');
    const classe = select ? select.value : '';

    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configPath = `etablissements/0680013V/profs/${profCode}/${classe}/demi-fond/config`;

    import('../../core/firebase-service.js').then(({ db, ref, onValue }) => {
        onValue(ref(db, configPath), (snap) => {
            const config = snap.val();
            const sousModule = config?.sousModule || '3x5min';

            if (currentUnsub) {
                try { currentUnsub(); } catch (e) {}
                currentUnsub = null;
            }

            if (sousModule === '3x5min') {
                import('./variantes/trois-cinq-min/trois-cinq-min-live.js')
                    .then(m => {
                        currentUnsub = m.renderTroisCinqMinLive() || null;
                    })
                    .catch(err => {
                        console.error('[DemiFond Live] Erreur:', err);
                        container.innerHTML = `<p class="text-red-400 text-center">❌ ${err.message}</p>`;
                    });
            } else if (sousModule === 'enchainement') {
                import('./variantes/enchainement/enchainement-live.js')
                    .then(m => {
                        currentUnsub = m.renderEnchainementLive() || null;
                    })
                    .catch(err => {
                        console.error('[DemiFond Live] Erreur:', err);
                        container.innerHTML = `<p class="text-red-400 text-center">❌ ${err.message}</p>`;
                    });
            }
        }, { onlyOnce: true });
    });
}

// ============================================================
// EXPORT CSV DÉDIÉ AU LIVE 1/2 FOND
// (lit les observations Firebase : distance, vitesse et plots
//  par course, quel que soit le sous-module 3x5min ou enchaînement)
// ============================================================
window.exportDemiFondLiveCSV = async function() {
    const select = document.getElementById('selectClasse');
    const classe = select ? select.value : '';
    if (!classe) return alert('Sélectionnez une classe.');

    const basePath = getBasePath(classe);

    try {
        const configSnap = await new Promise(resolve => onValue(ref(db, `${basePath}/config`), resolve, { onlyOnce: true }));
        const config = configSnap.val();
        if (!config || !config.groupes) return alert('Aucune configuration 1/2 fond pour cette classe.');

        const sousModule = config.sousModule || '3x5min';
        const tour = config.tour || 200;
        const plots = config.plots || 8;
        const nbCourses = sousModule === 'enchainement'
            ? (config.durees || []).length
            : (config.nbCourses || 3);
        const durees = sousModule === 'enchainement'
            ? (config.durees || [])
            : Array(nbCourses).fill(config.duree || 300);

        // Lecture de toutes les observations
        const observations = {};
        for (let i = 1; i <= nbCourses; i++) {
            const snap = await new Promise(resolve => onValue(ref(db, `${basePath}/observations/course-${i}`), resolve, { onlyOnce: true }));
            observations[i] = snap.val() || {};
        }

        const eleves = getExistingEleves(classe);
        const mapping = getLocalMapping(classe) || {};

        function esc(v) {
            const s = (v === null || v === undefined) ? '' : String(v);
            return '"' + s.replace(/"/g, '""') + '"';
        }

        // En-tête
        const header = ['Groupe', 'Code', 'Nom', 'Prénom', 'VMA'];
        for (let i = 1; i <= nbCourses; i++) {
            header.push(`Course ${i} - distance (m)`);
            header.push(`Course ${i} - vitesse (km/h)`);
            header.push(`Course ${i} - plots`);
        }
        header.push('Distance totale (m)', 'Vitesse moyenne (km/h)');

        const lignes = [];
        COULEURS_GROUPES.forEach(couleur => {
            const codes = config.groupes[couleur.id] || [];
            codes.forEach(code => {
                const eleveId = mapping[`${classe}_${couleur.id}_${code}`];
                const eleve = eleves.find(e => e.id === eleveId);
                const vma = eleve ? getVMAEleve(classe, eleve.id) : null;

                const row = [
                    couleur.label,
                    String(code),
                    eleve?.nom || '',
                    eleve?.prenom || '',
                    vma !== null && vma !== undefined ? String(vma).replace('.', ',') : ''
                ];

                let distanceTotale = 0;
                let vitesseSum = 0;
                let nbTerminees = 0;

                for (let i = 1; i <= nbCourses; i++) {
                    const obs = observations[i]?.[String(code)];
                    if (!obs) {
                        row.push('', '', '');
                        continue;
                    }
                    const distance = Math.round(calculerDistance(obs.timestamps || [], obs.partiel || 0, tour, plots));
                    const vitesse = obs.abandon ? 0 : calculerVitesse(distance, durees[i - 1]);
                    row.push(
                        String(distance).replace('.', ','),
                        String(vitesse).replace('.', ','),
                        String(obs.partiel || 0)
                    );
                    if (!obs.abandon) {
                        distanceTotale += distance;
                        vitesseSum += vitesse;
                        nbTerminees++;
                    }
                }

                row.push(String(Math.round(distanceTotale)).replace('.', ','));
                row.push(nbTerminees > 0 ? String(vitesseSum / nbTerminees).replace('.', ',') : '');
                lignes.push(row);
            });
        });

        const csv = '\uFEFF'
            + header.map(esc).join(';') + '\n'
            + lignes.map(r => r.map(esc).join(';')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `DemiFond_Live_${classe}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error('[DemiFond Export]', err);
        alert('❌ Erreur lors de l\'export CSV : ' + err.message);
    }
};

export function cleanupDemiFondLive() {
    if (currentUnsub) {
        try { currentUnsub(); } catch (e) {}
        currentUnsub = null;
    }
}