// src/js/modules/grilles/connecteurs/relais.js
// Connecteur : remplit automatiquement les critères "auto" de la grille Relais C4
// Lit les mesures du module Relais (mesures-10s et mesures-2zones)

import { db, ref, onValue } from '../../../core/firebase-service.js';
import { getLocalMapping } from '../../../core/live-engine.js';

/**
 * Calcule les niveaux automatiques pour un élève.
 * @param {string} classe
 * @param {string} eleveId
 * @param {Object} config - Config Firebase du module relais
 * @returns {Promise<Object>} { [critereId]: niveau }
 */
export function calculerNiveauxRelais(classe, eleveId, config) {
    return new Promise((resolve) => {
        if (!config || !config.groupes) {
            resolve({});
            return;
        }

        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/relais`;

        let mesures10s = {};
        let mesures2z = {};
        let loaded = 0;

        function check() {
            if (loaded < 2) return;
            const result = analyser(mesures10s, mesures2z, config, classe, eleveId);
            resolve(result);
        }

        onValue(ref(db, `${basePath}/mesures-10s`), s => { mesures10s = s.val() || {}; loaded++; check(); }, { onlyOnce: true });
        onValue(ref(db, `${basePath}/mesures-2zones`), s => { mesures2z = s.val() || {}; loaded++; check(); }, { onlyOnce: true });
    });
}

function analyser(mesures10s, mesures2z, config, classe, eleveId) {
    const mapping = getLocalMapping(classe) || {};
    const result = {};

    // Trouver le groupe et la lettre de l'élève
    let groupeIdx = null;
    let lettre = null;
    for (const [key, id] of Object.entries(mapping)) {
        if (id === eleveId) {
            const match = key.replace(`${classe}_`, '').match(/^(\d+)_([a-z])$/);
            if (match) {
                groupeIdx = parseInt(match[1]);
                lettre = match[2];
                break;
            }
        }
    }

    if (groupeIdx === null) return result;

    // ============================================================
    // Critère 1 : Performance Donneur (basé sur mesures-10s)
    // ============================================================
    const essais10s = Object.values(mesures10s).filter(m =>
        String(m.groupeIdx) === String(groupeIdx) && m.relayeLettre === lettre
    );

    if (essais10s.length > 0) {
        // Meilleur écart (le plus proche de 0)
        const meilleurEcart = Math.min(...essais10s.map(m => Math.abs(m.ecart)));
        // Niveau selon l'écart en km/h
        // Écart 0 → 4 ; 0.5-1 → 3 ; 1.5-2 → 2 ; 2-3 → 1
        let niveau = 1;
        if (meilleurEcart <= 0.5) niveau = 4;
        else if (meilleurEcart <= 1.2) niveau = 3;
        else if (meilleurEcart <= 2.2) niveau = 2;
        else niveau = 1;

        result['performance_donneur'] = niveau;
    }

    // ============================================================
    // Critère 2 : Qualité de transmission (basé sur mesures-2zones)
    // ============================================================
    const essais2z = Object.values(mesures2z).filter(m =>
        String(m.groupeIdx) === String(groupeIdx) && m.relayeLettre === lettre
    );

    if (essais2z.length > 0) {
        // Meilleur % de transmission
        const meilleurPct = Math.max(...essais2z.map(m => m.pourcentageTransmission));
        let niveau = 1;
        if (meilleurPct >= 100) niveau = 4;
        else if (meilleurPct >= 90) niveau = 3;
        else if (meilleurPct >= 80) niveau = 2;
        else niveau = 1;

        result['qualite_de_transmission'] = niveau;
    }

    return result;
}