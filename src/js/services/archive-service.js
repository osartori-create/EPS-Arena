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

/**
 * Ouvre une fenêtre de saisie de la configuration Grist, puis l'enregistre
 * en localStorage (jamais dans le code). Retourne la config ou null si annulé.
 *
 * Indispensable sur GitHub Pages : config.local.js étant gitignoré,
 * c'est cette saisie (stockée côté navigateur) qui alimente l'archivage.
 */
export function demanderConfigGrist() {
    return new Promise((resolve) => {
        const existing = getGristConfig() || {};

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto';
        overlay.innerHTML = `
            <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-white">🗄️ Configuration Grist</h3>
                    <button id="grist-config-annuler" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white">✖</button>
                </div>
                <p class="text-xs text-slate-400 mb-4">
                    Renseigne une seule fois le document Grist cible. Ces informations
                    restent dans le navigateur (localStorage), jamais dans le code.
                </p>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Base API</label>
                        <input id="grist-config-base" value="${existing.base || DEFAULT_GRIST_BASE}"
                               class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Identifiant du document (docId)</label>
                        <input id="grist-config-docid" value="${existing.docId || ''}"
                               placeholder="ex: 7a1b2c3d"
                               class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Table (tableId)</label>
                        <input id="grist-config-tableid" value="${existing.tableId || 'Resultats'}"
                               class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Jeton d'accès (token)</label>
                        <input id="grist-config-token" type="password" value="${existing.token || ''}"
                               placeholder="colle ici ton jeton d'accès personnel"
                               class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm">
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button id="grist-config-sauver" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">💾 Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const fermer = () => { overlay.remove(); resolve(null); };
        overlay.querySelector('#grist-config-annuler').onclick = fermer;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });

        overlay.querySelector('#grist-config-sauver').onclick = () => {
            const cfg = {
                base: overlay.querySelector('#grist-config-base').value.trim() || DEFAULT_GRIST_BASE,
                docId: overlay.querySelector('#grist-config-docid').value.trim(),
                tableId: overlay.querySelector('#grist-config-tableid').value.trim() || 'Resultats',
                token: overlay.querySelector('#grist-config-token').value.trim()
            };
            if (!cfg.docId) {
                alert('Le docId est obligatoire.');
                return;
            }
            sauverGristConfigLocal(cfg);
            overlay.remove();
            resolve(cfg);
        };
    });
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
 * Normalise les montées d'ESCALADE en lignes génériques.
 * @param {string} classe
 * @param {object} montees - objet { cle: { groupe, role, voie_num, couleur, cotation, hauteur, points, reussie, timestamp } }
 * @returns {Array<object>}
 */
export function normaliserEscalade(classe, montees = {}) {
    const lignes = [];
    for (const m of Object.values(montees)) {
        if (!m) continue;
        lignes.push({
            etablissement: getRNE(),
            prof: getProfCode(),
            classe,
            activite: 'escalade',
            code: m.groupe && m.role ? `${m.groupe}${m.role}` : '',
            voie_num: m.voie_num ?? null,
            couleur: m.couleur ?? '',
            cotation: m.cotation ?? '',
            hauteur: m.hauteur ?? null,
            points: m.points ?? null,
            reussie: m.reussie ?? (m.hauteur >= 9),
            horodatage: new Date(m.timestamp || Date.now()).toISOString()
        });
    }
    return lignes;
}

/**
 * Normalise les validations BLOC CONTEST en lignes génériques.
 * @param {string} classe
 * @param {object} validations - objet { cle: { eleveId, code, blocId, valeurAuMoment, reussite, timestamp } }
 * @returns {Array<object>}
 */
export function normaliserBlocContest(classe, validations = {}) {
    const lignes = [];
    for (const v of Object.values(validations)) {
        if (!v) continue;
        lignes.push({
            etablissement: getRNE(),
            prof: getProfCode(),
            classe,
            activite: 'bloccontest',
            eleve_id: v.eleveId ?? v.code ?? null,
            bloc_id: v.blocId ?? null,
            valeur_pts: v.valeurAuMoment ?? null,
            reussite: !!v.reussite,
            horodatage: new Date(v.timestamp || Date.now()).toISOString()
        });
    }
    return lignes;
}

/**
 * Normaliseur GÉNÉRIQUE de secours : aplatit une liste d'objets en y
 * injectant les métadonnées (établissement, prof, classe, activité).
 * Chaque entrée conserve tous ses champs d'origine.
 *
 * @param {string} classe
 * @param {string} activite - identifiant métier ('badminton', 'demi-fond', ...)
 * @param {Array|object} entrees - liste d'objets (ou objet dont on prend les valeurs)
 * @returns {Array<object>}
 */
export function normaliserGenerique(classe, activite, entrees) {
    const liste = Array.isArray(entrees) ? entrees : Object.values(entrees || {});
    return liste
        .filter(e => e && typeof e === 'object')
        .map(e => ({
            etablissement: getRNE(),
            prof: getProfCode(),
            classe,
            activite,
            horodatage: e.horodatage || new Date((e.timestamp || Date.now())).toISOString(),
            ...e
        }));
}

/**
 * Aplatit un arbre de collections imbriquées (map de maps) en une liste
 * plate d'enregistrements "feuilles".
 *
 * Exemple : { "2025-01-01": { "A1": { ...record } } } → [ { ...record } ]
 * Un "record feuille" est un objet dont au moins une valeur n'est pas un objet.
 * Les tableaux sont descendus récursivement.
 *
 * @param {*} entree - objet, tableau ou valeur
 * @returns {Array<object>} liste plate d'enregistrements
 */
export function aplanirCollections(entree) {
    if (Array.isArray(entree)) {
        return entree.flatMap(aplanirCollections);
    }
    if (entree && typeof entree === 'object') {
        const valeurs = Object.values(entree);
        const estCollection = valeurs.length > 0 && valeurs.every(v => v && typeof v === 'object');
        if (estCollection) {
            return valeurs.flatMap(aplanirCollections);
        }
        return [entree];
    }
    return [];
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
    let cfg = getGristConfig();

    // Si Grist n'est pas (complètement) configuré, propose une saisie unique
    // stockée en localStorage — fonctionne aussi sur GitHub Pages, sans
    // versionner le token. Si l'utilisateur annule, on bascule en export local.
    if (!cfg || !cfg.docId || !cfg.token) {
        cfg = await demanderConfigGrist();
    }

    if (cfg && cfg.docId && cfg.token) {
        try {
            const nb = await archiverVersGrist(lignes, cfg);
            return { cible: 'grist', nb };
        } catch (err) {
            console.warn('[archive] Échec Grist, repli export local :', err.message);
        }
    }

    // Repli : export Excel local.
    // Les colonnes sont dérivées automatiquement des clés rencontrées
    // dans les lignes (identité en tête, horodatage en fin).
    const cles = [...new Set(lignes.flatMap(l => Object.keys(l)))];
    const identite = cles.filter(c => c === 'nom' || c === 'prenom');
    const corps = cles.filter(c => c !== 'nom' && c !== 'prenom' && c !== 'horodatage');
    const colonnes = [
        ...(identite.length ? identite.map(c => col(c === 'nom' ? 'Nom de famille' : 'Prénom', c)) : []),
        ...corps.map(c => col(c, c)),
        ...(cles.includes('horodatage') ? [col('Horodatage', 'horodatage')] : [])
    ];
    const feuilles = [{ nom: nomModule, colonnes, donnees: lignes }];
    exporterVersExcel(nomModule, classe, feuilles);
    return { cible: 'local', nb: lignes.length };
}
