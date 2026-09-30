// src/js/services/archive-service.js
// Couche d'archivage long terme vers Grist (relayable par n8n plus tard).
//
// ════════════════════════════════════════════════════════════════
//  PRINCIPE « DEUX VITESSES »
//  - Temps réel séance : Firebase Realtime Database (onValue) — inchangé.
//  - Archivage long terme : Grist (REST), déclenché EN FIN DE SÉANCE.
//
//  Ce service NE TOUCHE PAS au temps réel. Il lit les données déjà
//  consolidées en mémoire (ou dans Firebase) et les normalise en
//  lignes « élève × résultat », puis les pousse vers Grist.
// ════════════════════════════════════════════════════════════════
//
//  CONFIGURATION GRIST (aucun secret dans le code) :
//  La config est lue à l'exécution, dans l'ordre :
//    1. localStorage['eps_arena_grist']      => JSON
//    2. window.EPS_ARENA_CONFIG.grist        => objet
//  Exemple :
//    {
//      "base": "https://grist.numerique.gouv.fr/api",
//      "docId": "xxxxxxxx",
//      "tableId": "Resultats",
//      "token": "xxxxxxxxxxxxxxxxxxxxxxxx"
//    }
//
//  ⚠️ En pur frontend, le token est visible depuis le navigateur.
//     Pour une vraie sécurité, passer plus tard par n8n comme proxy.
// ════════════════════════════════════════════════════════════════

import { getRNE, getProfCode } from '../core/firebase-service.js';
import { exporterVersExcel, colonnesIdentite, col } from './export-service.js';

const DEFAULT_GRIST_BASE = 'https://grist.numerique.gouv.fr/api';

// ------------------------------------------------------------------
// CONFIGURATION GRIST
// ------------------------------------------------------------------

/**
 * Lit la configuration Grist (docId, tableId, token) sans jamais l'écrire en dur.
 * @returns {{ base: string, docId: string, tableId: string, token: string } | null}
 */
export function getGristConfig() {
    // 1) localStorage (saisie à la volée dans l'interface prof)
    try {
        const raw = localStorage.getItem('eps_arena_grist');
        if (raw) {
            const cfg = JSON.parse(raw);
            if (cfg && cfg.docId) return normaliserGristConfig(cfg);
        }
    } catch (e) { /* ignore */ }

    // 2) config locale (window.EPS_ARENA_CONFIG.grist)
    if (typeof window !== 'undefined' && window.EPS_ARENA_CONFIG && window.EPS_ARENA_CONFIG.grist) {
        return normaliserGristConfig(window.EPS_ARENA_CONFIG.grist);
    }

    return null;
}

function normaliserGristConfig(cfg) {
    return {
        base: cfg.base || DEFAULT_GRIST_BASE,
        docId: cfg.docId,
        tableId: cfg.tableId || 'Resultats',
        token: cfg.token || ''
    };
}

export function sauverGristConfigLocal(cfg) {
    localStorage.setItem('eps_arena_grist', JSON.stringify(cfg));
}

// ------------------------------------------------------------------
// NORMALISATION — lignes « élève × résultat »
// ------------------------------------------------------------------

/**
 * Normalise les résultats de NATATION en lignes génériques.
 *
 * @param {string} classe
 * @param {object} data   - { temps: {numero:ms}, coups: {numero:n}, historique: {numero:[...]} }
 * @param {Array}  elevesTries - liste d'élèves triée (nom/prénom), index = numero-1
 * @returns {Array<object>} lignes plates prêtes à archiver
 */
export function normaliserNatation(classe, data, elevesTries) {
    const lignes = [];
    const temps = data.temps || {};
    const coups = data.coups || {};
    const historique = data.historique || {};

    for (const [numero, tempsMs] of Object.entries(temps)) {
        if (tempsMs === null || tempsMs === undefined) continue;

        const index = parseInt(numero, 10) - 1;
        const eleve = elevesTries[index];
        const nbCoups = coups[numero] ?? null;
        const indice = calculerIndiceNage(tempsMs, nbCoups);
        const horodatage = new Date().toISOString();

        lignes.push({
            etablissement: getRNE(),
            prof: getProfCode(),
            classe,
            activite: 'natation',
            eleve_id: eleve ? eleve.id : null,
            nom: eleve ? eleve.nom : '',
            prenom: eleve ? eleve.prenom : '',
            numero,
            temps_ms: tempsMs,
            coups: nbCoups,
            indice_nage: indice !== null ? Math.round(indice * 100) / 100 : null,
            nb_essais: (historique[numero] || []).length,
            horodatage
        });
    }

    return lignes;
}

/**
 * Calcule l'indice de nage (vitesse × distance par cycle).
 * Reprend la formule de natation-live.js (25 m, cycles = coups/2).
 */
export function calculerIndiceNage(tempsMs, nbCoups) {
    if (tempsMs === null || nbCoups === null || tempsMs <= 0 || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

// ------------------------------------------------------------------
// ENVOI VERS GRIST (REST)
// ------------------------------------------------------------------

/**
 * Pousse des lignes vers une table Grist via l'API REST.
 * @param {Array<object>} lignes - lignes normalisées
 * @param {object} cfg - config Grist (getGristConfig())
 * @returns {Promise<number>} nombre d'enregistrements créés
 */
export async function archiverVersGrist(lignes, cfg) {
    if (!cfg || !cfg.docId) {
        throw new Error('Configuration Grist absente. Renseigne docId/tableId/token.');
    }
    if (!cfg.token) {
        throw new Error('Token Grist manquant. Ajoute-le dans la config locale (jamais dans le code).');
    }
    if (!lignes || lignes.length === 0) {
        return 0;
    }

    const url = `${cfg.base.replace(/\/$/, '')}/docs/${cfg.docId}/tables/${encodeURIComponent(cfg.tableId)}/records`;

    // Grist attend { records: [{ fields: {...} }] }
    const body = {
        records: lignes.map(l => ({ fields: l }))
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${cfg.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Grist a refusé l'archivage (HTTP ${response.status}) : ${detail}`);
    }

    const json = await response.json();
    return (json.records && json.records.length) || lignes.length;
}

// ------------------------------------------------------------------
// ARCHIVAGE COMPLET (haut niveau, avec repli local)
// ------------------------------------------------------------------

/**
 * Archive des lignes vers Grist, avec repli vers un export Excel local
 * si Grist n'est pas configuré ou échoue.
 *
 * @param {string} nomModule - 'Natation'
 * @param {string} classe
 * @param {Array<object>} lignes - lignes normalisées
 * @returns {Promise<{cible:'grist'|'local', nb:number}>}
 */
export async function archiver(nomModule, classe, lignes) {
    const cfg = getGristConfig();

    if (cfg && cfg.docId && cfg.token) {
        try {
            const nb = await archiverVersGrist(lignes, cfg);
            return { cible: 'grist', nb };
        } catch (err) {
            console.warn('[archive] Échec Grist, repli export local :', err.message);
        }
    }

    // Repli : export Excel local (réutilise les conventions existantes)
    const feuilles = [{
        nom: nomModule,
        colonnes: [...colonnesIdentite(), col('Classe', 'classe'), col('Activité', 'activite'),
                   col('Numéro', 'numero'), col('Temps (ms)', 'temps_ms'), col('Coups', 'coups'),
                   col('Indice de nage', 'indice_nage'), col('Horodatage', 'horodatage')],
        donnees: lignes
    }];
    exporterVersExcel(nomModule, classe, feuilles);
    return { cible: 'local', nb: lignes.length };
}