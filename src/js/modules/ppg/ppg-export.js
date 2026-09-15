// src/js/modules/ppg/ppg-export.js
// Export Excel (multi-feuilles) : séance du jour + historique complet
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { exporterVersExcel, col } from '../../services/export-service.js';
import { fusionnerBibliotheque, agregerSeance, getAtelierById } from './ppg-core.js';

function getProfBasePath() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}
function elevesParCode(eleves) {
    const map = {};
    eleves.forEach(e => {
        if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) {
            map[String(e.codeAutoEval)] = e;
        }
    });
    return map;
}

export function exporterPPGExcel() {
    const classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    if (!classe) return alert('Sélectionnez une classe.');

    const eleves = getExistingEleves(classe);
    if (eleves.length === 0) return alert('Aucun élève dans cette classe.');

    const elevesMap = elevesParCode(eleves);
    const basePath = `${getProfBasePath()}/${classe}/ppg`;

    let config = {}, seances = {}, observations = {};
    let loaded = 0;

    function check() {
        if (loaded < 3) return;
        genererFichier(classe, eleves, elevesMap, config, seances, observations);
    }

    onValue(ref(db, `${basePath}/config`), s => { config = s.val() || {}; loaded++; check(); }, { onlyOnce: true });
    onValue(ref(db, `${basePath}/seance`), s => { seances = s.val() || {}; loaded++; check(); }, { onlyOnce: true });
    onValue(ref(db, `${basePath}/observations`), s => { observations = s.val() || {}; loaded++; check(); }, { onlyOnce: true });
}

function genererFichier(classe, eleves, elevesMap, config, seances, observations) {
    const biblio = fusionnerBibliotheque(config.ateliers);
    const today = getTodayDate();

    // ============================================================
    // Feuille 1 : Séance du jour (élève × atelier → best + points)
    // ============================================================
    const seanceJour = seances[today];
    const ateliersJour = (seanceJour?.ateliers || []).map(id => getAtelierById(id, biblio)).filter(Boolean);
    const obsJour = observations[today] || {};

    const lignesJour = [];
    eleves.forEach(e => {
        if (!e.codeAutoEval) return;
        const code = String(e.codeAutoEval);
        const obsEleve = obsJour[code];
        const ligne = {
            nom: e.nom || '',
            prenom: e.prenom || '',
            code
        };

        let total = 0;
        ateliersJour.forEach(a => {
            const src = obsEleve?.perfs?.[a.id] || obsEleve?.[a.id] || null;
            if (!src) {
                ligne[`${a.id}_best`] = '';
                ligne[`${a.id}_niveau`] = '';
                ligne[`${a.id}_pts`] = '';
                return;
            }
            const niveau = src.niveau || null;
            const best = src.best || 0;
            const facteur = a.type === 'niveaux' ? (niveau || 1) : 1;
            const pts = best * facteur * (a.pointsParUnite || 1);
            total += pts;

            ligne[`${a.id}_best`] = best;
            ligne[`${a.id}_niveau`] = niveau ? `N${niveau}` : '';
            ligne[`${a.id}_pts`] = pts;
        });
        ligne.total = total;
        lignesJour.push(ligne);
    });

    lignesJour.sort((a, b) => b.total - a.total);

    const colonnesJour = [
        col('Nom', 'nom'),
        col('Prénom', 'prenom'),
        col('Code', 'code')
    ];
    ateliersJour.forEach(a => {
        colonnesJour.push(col(`${a.label} — Best`, `${a.id}_best`));
        if (a.type === 'niveaux') {
            colonnesJour.push(col(`${a.label} — Niveau`, `${a.id}_niveau`));
        }
        colonnesJour.push(col(`${a.label} — Pts`, `${a.id}_pts`));
    });
    colonnesJour.push(col('Total pts', 'total'));

    // ============================================================
    // Feuille 2 : Historique complet (une ligne par élève × date)
    // ============================================================
    const dates = Object.keys(observations).sort();
    const lignesHisto = [];

    dates.forEach(date => {
        const seance = seances[date];
        if (!seance?.ateliers) return;
        const ateliers = seance.ateliers.map(id => getAtelierById(id, biblio)).filter(Boolean);
        const obsDate = observations[date] || {};

        eleves.forEach(e => {
            if (!e.codeAutoEval) return;
            const code = String(e.codeAutoEval);
            const obsEleve = obsDate[code];
            if (!obsEleve) return;

            const ligne = {
                date,
                nom: e.nom || '',
                prenom: e.prenom || '',
                code
            };
            let total = 0;
            ateliers.forEach(a => {
                const src = obsEleve?.perfs?.[a.id] || obsEleve?.[a.id] || null;
                if (!src) return;
                const niveau = src.niveau || null;
                const best = src.best || 0;
                const facteur = a.type === 'niveaux' ? (niveau || 1) : 1;
                const pts = best * facteur * (a.pointsParUnite || 1);
                total += pts;
                ligne[`${a.id}_best`] = best;
                ligne[`${a.id}_niveau`] = niveau ? `N${niveau}` : '';
            });
            ligne.total = total;
            lignesHisto.push(ligne);
        });
    });

    // Colonnes historiques : toutes les colonnes d'ateliers possibles dans la bibliothèque
    const colonnesHisto = [
        col('Date', 'date'),
        col('Nom', 'nom'),
        col('Prénom', 'prenom'),
        col('Code', 'code')
    ];
    biblio.forEach(a => {
        colonnesHisto.push(col(`${a.label} — Best`, `${a.id}_best`));
        if (a.type === 'niveaux') {
            colonnesHisto.push(col(`${a.label} — Niveau`, `${a.id}_niveau`));
        }
    });
    colonnesHisto.push(col('Total pts', 'total'));

    exporterVersExcel('PPG', classe, [
        { nom: 'Séance du jour', colonnes: colonnesJour, donnees: lignesJour },
        { nom: 'Historique', colonnes: colonnesHisto, donnees: lignesHisto }
    ]);
}

window.exporterPPGExcel = exporterPPGExcel;