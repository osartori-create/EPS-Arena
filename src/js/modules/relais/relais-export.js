// src/js/modules/relais/relais-export.js
// Export Excel des mesures relais (multi-feuilles)

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping, getStudentsMap } from '../../core/live-engine.js';
import { exporterVersExcel, col } from '../../services/export-service.js';
import { calculerScoreEquipe, getMeilleurEssaiParPaire } from './relais-core.js';

export function exporterRelaisExcel() {
    const classe = getCurrentClasse();
    if (!classe) return alert('Sélectionnez une classe.');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/relais`;

    let config = null, m10 = {}, m2z = {};
    let loaded = 0;

    function check() {
        if (loaded < 3) return;
        const is2Zones = config?.sousActivite === 'relais2zones';
        const mesures = is2Zones ? m2z : m10;
        _generer(is2Zones, mesures);
    }

    onValue(ref(db, `${basePath}/config`), s => { config = s.val() || {}; loaded++; check(); }, { onlyOnce: true });
    onValue(ref(db, `${basePath}/mesures-10s`), s => { m10 = s.val() || {}; loaded++; check(); }, { onlyOnce: true });
    onValue(ref(db, `${basePath}/mesures-2zones`), s => { m2z = s.val() || {}; loaded++; check(); }, { onlyOnce: true });

    function _generer(is2Zones, mesures) {
        const mapping = getLocalMapping(classe) || {};
        const studentsMap = getStudentsMap(classe) || {};
        const mesuresArr = Object.values(mesures);

        if (mesuresArr.length === 0) return alert('Aucune mesure pour cette classe.');

        function nomJoueur(groupeIdx, lettre) {
            const id = mapping[`${classe}_${groupeIdx}_${lettre}`];
            return id ? (studentsMap[id] || lettre) : lettre;
        }

        // ---------- Feuille 1 : Essais ----------
        const lignesEssais = mesuresArr.map(m => {
            const base = {
                groupe: `G${m.groupeNumero || (parseInt(m.groupeIdx) + 1)}`,
                relaye: nomJoueur(m.groupeIdx, m.relayeLettre),
                relayeur: nomJoueur(m.groupeIdx, m.relayeurLettre),
                score: m.score
            };
            if (is2Zones) {
                base.z1 = m.vitesses?.z1 ?? '';
                base.trans = m.vitesses?.trans ?? '';
                base.z2 = m.vitesses?.z2 ?? '';
                base.pctTrans = m.pourcentageTransmission ?? '';
            } else {
                base.zone = m.zoneAtteinte ?? '';
                base.vReelle = m.vReelle ?? '';
                base.vTheo = m.vTheorique ?? '';
                base.ecart = m.ecart ?? '';
            }
            return base;
        });

        // ---------- Feuille 2 : Classement équipes ----------
        const equipesMap = {};
        Object.entries(config.groupes || {}).forEach(([idx, groupe]) => {
            const mg = mesuresArr.filter(m => String(m.groupeIdx) === String(idx));
            equipesMap[`G${groupe.numero}`] = {
                equipe: `G${groupe.numero}`,
                score: calculerScoreEquipe(mg),
                nbEssais: Object.keys(getMeilleurEssaiParPaire(mg)).length
            };
        });
        const lignesClassement = Object.values(equipesMap).sort((a, b) => b.score - a.score);

        const colonnesEssais = is2Zones
            ? [col('Équipe', 'groupe'), col('Relayé', 'relaye'), col('Relayeur', 'relayeur'), col('V Z1', 'z1'), col('V Trans', 'trans'), col('V Z2', 'z2'), col('% Trans', 'pctTrans'), col('Points', 'score')]
            : [col('Équipe', 'groupe'), col('Relayé', 'relaye'), col('Relayeur', 'relayeur'), col('Zone', 'zone'), col('V réelle', 'vReelle'), col('V théorique', 'vTheo'), col('Écart', 'ecart'), col('Points', 'score')];

        exporterVersExcel('Relais', classe, [
            { nom: is2Zones ? 'Essais 2 zones' : 'Essais 10s', colonnes: colonnesEssais, donnees: lignesEssais },
            {
                nom: 'Classement',
                colonnes: [col('Équipe', 'equipe'), col('Points', 'score'), col('Paires mesurées', 'nbEssais')],
                donnees: lignesClassement
            }
        ]);
    }
}

window.exporterRelaisExcel = exporterRelaisExcel;