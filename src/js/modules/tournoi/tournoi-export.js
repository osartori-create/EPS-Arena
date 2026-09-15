// src/js/modules/tournoi/tournoi-export.js
// Export Excel des résultats du tournoi élimination

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { exporterVersExcel, col } from '../../services/export-service.js';

export function exporterTournoiExcel() {
    const classe = getCurrentClasse();
    if (!classe) return alert('Sélectionnez une classe.');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const joueursRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/joueurs`);

    onValue(joueursRef, (snap) => {
        const joueurs = snap.val() || {};
        const eleves = getExistingEleves(classe);
        if (eleves.length === 0) return alert('Aucun élève dans cette classe.');

        eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

        const lignes = eleves.map((e, i) => {
            const code = String(e.codeAutoEval ?? (i + 1));
            const elim = joueurs[code]?.eliminations || 0;
            return {
                nom: e.nom,
                prenom: e.prenom,
                code,
                eliminations: elim,
                statut: elim === 0 ? 'Invaincu' : (elim >= 10 ? 'Éliminé (≥10)' : 'En course')
            };
        });

        lignes.sort((a, b) => a.eliminations - b.eliminations);

        exporterVersExcel('Tournoi', classe, [
            {
                nom: 'Éliminations',
                colonnes: [
                    col('Nom', 'nom'),
                    col('Prénom', 'prenom'),
                    col('Code', 'code'),
                    col('Éliminations', 'eliminations'),
                    col('Statut', 'statut')
                ],
                donnees: lignes
            }
        ]);
    }, { onlyOnce: true });
}

window.exporterTournoiExcel = exporterTournoiExcel;