// src/js/modules/badminton/badminton-export.js
// Export Excel des matchs de badminton (multi-feuilles)

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping, getStudentsMap } from '../../core/live-engine.js';
import { exporterVersExcel, col } from '../../services/export-service.js';

export function exporterBadmintonExcel() {
    const classe = getCurrentClasse();
    if (!classe) return alert('Sélectionnez une classe.');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/badminton/results`);

    onValue(resultsRef, (snap) => {
        const results = snap.val() || {};
        const matchs = Object.values(results).sort((a, b) => a.timestamp - b.timestamp);

        if (matchs.length === 0) return alert('Aucun match terminé pour cette classe.');

        const mapping = getLocalMapping(classe) || {};
        const studentsMap = getStudentsMap(classe) || {};

        function nomJoueur(terrain, lettre) {
            const key = `${classe}_${terrain}_${lettre}`;
            const id = mapping[key];
            return id ? (studentsMap[id] || lettre) : lettre;
        }

        // ---------- Feuille 1 : Matchs ----------
        const lignesMatchs = matchs.map(m => {
            const terrain = m.terrain || '1';
            return {
                date: new Date(m.timestamp).toLocaleString('fr-FR'),
                terrain,
                mode: m.mode || 'terrain',
                joueur1: nomJoueur(terrain, m.p1),
                score1: m.score1 ?? '',
                score2: m.score2 ?? '',
                joueur2: nomJoueur(terrain, m.p2),
                vainqueur: m.winner ? nomJoueur(terrain, m.winner) : 'Match nul',
                pts1: m.pts1 ?? '',
                pts2: m.pts2 ?? ''
            };
        });

        // ---------- Feuille 2 : Classement ----------
        const classement = {};
        matchs.forEach(m => {
            const terrain = m.terrain || '1';
            const key1 = `${terrain}_${m.p1}`;
            const key2 = `${terrain}_${m.p2}`;

            if (!classement[key1]) classement[key1] = { nom: nomJoueur(terrain, m.p1), v: 0, d: 0, pts: 0, total: 0 };
            if (!classement[key2]) classement[key2] = { nom: nomJoueur(terrain, m.p2), v: 0, d: 0, pts: 0, total: 0 };

            classement[key1].pts += m.pts1 || 0;
            classement[key2].pts += m.pts2 || 0;
            classement[key1].total += (m.score1 || 0) - (m.score2 || 0);
            classement[key2].total += (m.score2 || 0) - (m.score1 || 0);

            if (m.winner === m.p1) { classement[key1].v++; classement[key2].d++; }
            else if (m.winner === m.p2) { classement[key2].v++; classement[key1].d++; }
        });

        const lignesClassement = Object.values(classement)
            .sort((a, b) => b.pts - a.pts || b.total - a.total)
            .map(c => ({
                nom: c.nom,
                victoires: c.v,
                defaites: c.d,
                points: c.pts,
                diff: c.total > 0 ? `+${c.total}` : c.total
            }));

        exporterVersExcel('Badminton', classe, [
            {
                nom: 'Matchs',
                colonnes: [
                    col('Date', 'date'),
                    col('Terrain', 'terrain'),
                    col('Mode', 'mode'),
                    col('Joueur 1', 'joueur1'),
                    col('Score 1', 'score1'),
                    col('Score 2', 'score2'),
                    col('Joueur 2', 'joueur2'),
                    col('Vainqueur', 'vainqueur'),
                    col('Pts classement 1', 'pts1'),
                    col('Pts classement 2', 'pts2')
                ],
                donnees: lignesMatchs
            },
            {
                nom: 'Classement',
                colonnes: [
                    col('Joueur', 'nom'),
                    col('Victoires', 'victoires'),
                    col('Défaites', 'defaites'),
                    col('Points', 'points'),
                    col('Différence', 'diff')
                ],
                donnees: lignesClassement
            }
        ]);
    }, { onlyOnce: true });
}

window.exporterBadmintonExcel = exporterBadmintonExcel;