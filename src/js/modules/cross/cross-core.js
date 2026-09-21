// ============================================================
// src/js/modules/cross/cross-core.js
// Moteur de calcul pur — aucune dépendance UI, Firebase, stockage
// Testable en console : window.crossCore.<fn>()
// ============================================================

// ============================================================
// CONSTANTES MÉTIER
// ============================================================

// Distance utilisée pour le calcul du %VMA (contrat bienveillant)
export const DISTANCE_CONTRAT_M = 2500;

// Distance annoncée aux élèves (dossard, affichage)
export const DISTANCE_AFFICHEE_M = 2400;

// Barème motricité : %VMA tenu → points /13
// Paliers issus du tableau Excel "Motricité"
export const BAREME_MOTRICITE = [
    { seuil: 50,  pts: 1  },
    { seuil: 55,  pts: 2  },
    { seuil: 58,  pts: 3  },
    { seuil: 60,  pts: 4  },
    { seuil: 62,  pts: 5  },
    { seuil: 64,  pts: 6  },
    { seuil: 68,  pts: 7  },
    { seuil: 70,  pts: 8  },
    { seuil: 71,  pts: 9  },
    { seuil: 72,  pts: 10 },
    { seuil: 73,  pts: 11 },
    { seuil: 74,  pts: 12 },
    { seuil: 75,  pts: 13 }
    // Au-delà de 75 %, on plafonne à 13 pts
    // En dessous de 50 %, on est à 0 pt
];

// Barème performance : % de tête dans le peloton → points /7
// Lecture : "les élèves dont le rang% est <= seuil obtiennent pts"
// Exemple : 100 partants, seuil 16 → les 16 premiers ont 7 pts
export const BAREME_PERFORMANCE = [
    { seuil: 16,  pts: 7 },
    { seuil: 30,  pts: 6 },
    { seuil: 40,  pts: 5 },
    { seuil: 50,  pts: 4 },
    { seuil: 60,  pts: 3 },
    { seuil: 75,  pts: 2 },
    { seuil: 90,  pts: 1 },
    { seuil: 100, pts: 0 }
];

// Niveaux (1er chiffre du code classe)
export const NIVEAUX = {
    '3': { label: '3e', ordre: 3 },
    '4': { label: '4e', ordre: 4 },
    '5': { label: '5e', ordre: 5 },
    '6': { label: '6e', ordre: 6 }
};

// Les 4 courses par défaut
export const COURSES_DEFAUT = [
    { id: 'course1', label: '6e + 5e Filles',   sexe: 'F', niveaux: ['6', '5'] },
    { id: 'course2', label: '6e + 5e Garçons',  sexe: 'M', niveaux: ['6', '5'] },
    { id: 'course3', label: '4e + 3e Filles',   sexe: 'F', niveaux: ['4', '3'] },
    { id: 'course4', label: '4e + 3e Garçons',  sexe: 'M', niveaux: ['4', '3'] }
];

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * "507" → "5"
 * "601" → "6"
 * Retourne null si non reconnu.
 */
export function getNiveauFromClasse(codeClasse) {
    if (!codeClasse) return null;
    const s = String(codeClasse).trim();
    const first = s.charAt(0);
    return NIVEAUX[first] ? first : null;
}

/**
 * Normalise une chaîne issue de la douchette en une liste de candidats
 * dossard, du plus probable au moins probable.
 *
 * Cas gérés :
 *   "0000000000178"  → ["17", "17"]    (13 chiffres EAN avec check)
 *   "000000000017"   → ["17"]           (12 chiffres sans check)
 *   "17"             → ["17"]
 *   "178"            → ["178", "17"]    (ambigu, on teste les deux)
 *   "  178\n"        → ["178", "17"]
 *
 * Retourne [] si aucun chiffre.
 */
export function normaliserScan(brut) {
    const digits = String(brut == null ? '' : brut).replace(/\D/g, '');
    if (!digits) return [];

    const candidats = [];
    const add = (s) => {
        const stripped = s.replace(/^0+/, '') || '0';
        if (!candidats.includes(stripped)) candidats.push(stripped);
    };

    // 1. Valeur brute (sans les zéros de tête)
    //    "000000000185" → "185"
    add(digits);

    // 2. Retire 1, 2 puis 3 chiffres de la fin (clé de contrôle)
    //    "000000000185" → "00000000018" → "18"  ← C'EST CELUI QU'ON VEUT
    for (let n = 1; n <= 3 && n < digits.length; n++) {
        add(digits.slice(0, -n));
    }

    // 3. Essaie les derniers 12, 11 puis 10 chiffres
    //    (utile si le scanner ajoute un préfixe exotique)
    if (digits.length > 12) add(digits.slice(-12));
    if (digits.length > 11) add(digits.slice(-11));
    if (digits.length > 10) add(digits.slice(-10));

    return candidats;
}

/**
 * "17" → "0000000000178" (EAN-13 avec checksum calculé)
 * Utilisé pour la génération PDF des dossards.
 */
export function generateEan13(numero) {
    const base = String(numero).padStart(12, '0');
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(base.charAt(i), 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return base + check;
}

// ============================================================
// CALCULS ÉLÈVE
// ============================================================

/**
 * %VMA tenu par un élève sur la distance CONTRAT (2500 m).
 * Formule : (distance_km / temps_h) / vma × 100
 *         = (DISTANCE_CONTRAT_M × 3.6) / (temps_s × VMA)
 *
 * Retourne un pourcentage (ex : 80.4) ou null si données manquantes.
 */
export function calculerPourcentageVMA(tempsSec, vma) {
    if (!tempsSec || !vma || tempsSec <= 0 || vma <= 0) return null;
    const pct = (DISTANCE_CONTRAT_M * 3.6) / (tempsSec * vma) * 100;
    return Math.round(pct * 10) / 10;
}

/**
 * Points motricité (0 à 13) selon le %VMA tenu.
 */
export function calculerPointsMotricite(pourcentageVMA) {
    if (pourcentageVMA === null || pourcentageVMA === undefined) return 0;
    if (pourcentageVMA < BAREME_MOTRICITE[0].seuil) return 0;

    let pts = 0;
    for (const palier of BAREME_MOTRICITE) {
        if (pourcentageVMA >= palier.seuil) pts = palier.pts;
        else break;
    }
    return pts;
}

/**
 * Tranche de performance d'un élève : % de tête dans le peloton.
 * Ex : rang 15 sur 100 arrivants → 15 %
 */
export function calculerTranchePerformance(rang, nbArrivants) {
    if (!rang || !nbArrivants || nbArrivants <= 0) return null;
    const pct = rang / nbArrivants * 100;
    return Math.round(pct * 10) / 10;
}

/**
 * Points performance (0 à 7) selon la tranche.
 */
export function calculerPointsPerformance(tranche) {
    if (tranche === null || tranche === undefined) return 0;
    for (const palier of BAREME_PERFORMANCE) {
        if (tranche <= palier.seuil) return palier.pts;
    }
    return 0;
}

/**
 * Note complète d'un élève sur une course.
 * @param {Object} p
 * @param {number} p.tempsSec       Temps réel (secondes)
 * @param {number} p.vma            VMA de l'élève
 * @param {number} p.rang           Rang dans sa catégorie (1 = meilleur)
 * @param {number} p.nbArrivants    Nombre d'arrivants dans sa catégorie
 * @returns {Object} { pourcentageVMA, ptsMotricite, tranche, ptsPerformance, total }
 */
export function calculerNoteEleve({ tempsSec, vma, rang, nbArrivants }) {
    const pourcentageVMA = calculerPourcentageVMA(tempsSec, vma);
    const ptsMotricite = calculerPointsMotricite(pourcentageVMA);
    const tranche = calculerTranchePerformance(rang, nbArrivants);
    const ptsPerformance = calculerPointsPerformance(tranche);

    return {
        pourcentageVMA,
        ptsMotricite,
        tranche,
        ptsPerformance,
        total: ptsMotricite + ptsPerformance
    };
}

// ============================================================
// AGRÉGATION D'UNE COURSE
// ============================================================

/**
 * Prend les arrivées brutes (dossards scannés + timestamp) et les élèves,
 * retourne un classement par niveau.
 *
 * @param {Array} arriveesTriees - [{ dossard, timestamp }] triés par timestamp
 * @param {Object} eleves        - { dossard: { eleveId, nom, prenom, classe, sexe, vma, statut } }
 * @param {Object} courseConfig  - { niveaux: ['5','6'], sexe: 'F' }
 * @returns {Object} { parNiveau: { '5': [...], '6': [...] } }
 */
export function classerParNiveau(arriveesTriees, eleves, courseConfig) {
    const parNiveau = {};
    courseConfig.niveaux.forEach(n => { parNiveau[n] = []; });

    // On garde un seul scan par dossard (le premier)
    const vus = new Set();

    arriveesTriees.forEach((arr) => {
        const dossard = String(arr.dossard);
        if (vus.has(dossard)) return;
        vus.add(dossard);

        const eleve = eleves[dossard];
        if (!eleve) return;                                   // dossard inconnu
        if (eleve.statut && eleve.statut !== 'present') return; // absent/inapte/abandon
        if (eleve.sexe !== courseConfig.sexe) return;         // mauvaise course

        const niveau = getNiveauFromClasse(eleve.classe);
        if (!niveau || !parNiveau[niveau]) return;            // niveau non concerné

        parNiveau[niveau].push({
            dossard,
            eleveId: eleve.eleveId,
            nom: eleve.nom,
            prenom: eleve.prenom,
            classe: eleve.classe,
            sexe: eleve.sexe,
            vma: eleve.vma,
            timestamp: arr.timestamp
        });
    });

    // Tri par timestamp (au cas où), puis attribution du rang dans la catégorie
    Object.keys(parNiveau).forEach(niveau => {
        const liste = parNiveau[niveau];
        liste.sort((a, b) => a.timestamp - b.timestamp);
        const nb = liste.length;
        liste.forEach((item, idx) => {
            item.rang = idx + 1;
            item.nbArrivants = nb;
            const note = calculerNoteEleve({
                tempsSec: null,                // pas de temps absolu (scan = ordre d'arrivée)
                vma: item.vma,
                rang: item.rang,
                nbArrivants: nb
            });
            item.ptsPerformance = note.ptsPerformance;
            item.tranche = note.tranche;
            // Note : ptsMotricité ne peut pas être calculé sans temps absolu.
            // Voir cross-scan.js pour l'ajout du temps relatif au GO.
        });
    });

    return { parNiveau };
}

/**
 * Extrait les 3 premiers de chaque niveau.
 * @returns {Object} { '5': [or, argent, bronze], '6': [...] }
 */
export function extrairePodiums(classementParNiveau) {
    const podiums = {};
    Object.keys(classementParNiveau).forEach(niveau => {
        podiums[niveau] = classementParNiveau[niveau].slice(0, 3);
    });
    return podiums;
}

/**
 * Agrège tout ce qu'il faut pour l'affichage d'une course.
 * @returns {Object} { arrivees, classementParNiveau, podiums, statsGlobales }
 */
export function agregerCourse({ arrivees, eleves, courseConfig }) {
    // arrivees = objet Firebase { pushId: { dossard, timestamp } }
    // → on trie par timestamp croissant
    const arriveesTriees = Object.entries(arrivees || {})
        .map(([id, a]) => ({ id, ...a }))
        .filter(a => a.dossard != null && a.timestamp != null)
        .sort((a, b) => a.timestamp - b.timestamp);

    const classement = classerParNiveau(arriveesTriees, eleves || {}, courseConfig);
    const podiums = extrairePodiums(classement.parNiveau);

    // Stats globales
    const nbArrivantsTotal = arriveesTriees.length;
    const nbParNiveau = {};
    Object.keys(classement.parNiveau).forEach(n => {
        nbParNiveau[n] = classement.parNiveau[n].length;
    });

    return {
        arrivees: arriveesTriees,
        classementParNiveau: classement.parNiveau,
        podiums,
        statsGlobales: {
            nbArrivantsTotal,
            nbParNiveau
        }
    };
}

// ============================================================
// CLASSEMENT PAR CLASSE
// ============================================================

/**
 * Calcule le classement par classe à partir de TOUTES les courses.
 * Règle : moyenne des rangs catégorie, plus petit = meilleur.
 * Exclus : absents, inaptes, abandons (ne sont pas dans les arrivées).
 *
 * @param {Object} arriveesParCourse - { course1: {pushId: {...}}, ... }
 * @param {Object} eleves            - { dossard: {...} }
 * @param {Array}  courses           - COURSES_DEFAUT
 * @returns {Array} [{ classe, moyenne, nbClasses, nbExclus, nbAbsents, nbInaptes, nbAbandons }]
 */
export function agregerParClasse({ arriveesParCourse, eleves, courses }) {
    // 1. On parcourt chaque course, on récupère les rangs par niveau
    const rangsParClasse = {};   // { "501": [3, 17, 42, ...] }
    const classesVues = new Set();
    const statutsParClasse = {}; // { "501": { absents: 0, inaptes: 0, abandons: 0 } }

    (courses || COURSES_DEFAUT).forEach(course => {
        const arrivees = arriveesParCourse[course.id] || {};
        const result = agregerCourse({ arrivees, eleves, courseConfig: course });
        Object.keys(result.classementParNiveau).forEach(niveau => {
            result.classementParNiveau[niveau].forEach(e => {
                if (!rangsParClasse[e.classe]) rangsParClasse[e.classe] = [];
                rangsParClasse[e.classe].push(e.rang);
                classesVues.add(e.classe);
            });
        });
    });

    // 2. Comptage des statuts par classe (absents, inaptes, abandons)
    Object.values(eleves || {}).forEach(e => {
        if (!e.classe) return;
        classesVues.add(e.classe);
        if (!statutsParClasse[e.classe]) {
            statutsParClasse[e.classe] = { absents: 0, inaptes: 0, abandons: 0 };
        }
        if (e.statut === 'absent')   statutsParClasse[e.classe].absents++;
        if (e.statut === 'inapte')   statutsParClasse[e.classe].inaptes++;
        if (e.statut === 'abandon')  statutsParClasse[e.classe].abandons++;
    });

    // 3. Calcul de la moyenne
    const resultats = Array.from(classesVues).map(classe => {
        const rangs = rangsParClasse[classe] || [];
        const nbClasses = rangs.length;
        const moyenne = nbClasses > 0
            ? Math.round(rangs.reduce((a, b) => a + b, 0) / nbClasses * 10) / 10
            : null;
        const stats = statutsParClasse[classe] || { absents: 0, inaptes: 0, abandons: 0 };

        return {
            classe,
            niveau: getNiveauFromClasse(classe),
            moyenne,
            nbClasses,
            nbAbsents: stats.absents,
            nbInaptes: stats.inaptes,
            nbAbandons: stats.abandons,
            nbExclus: stats.absents + stats.inaptes + stats.abandons
        };
    });

    // 4. Tri : plus petite moyenne = meilleure
    resultats.sort((a, b) => {
        if (a.moyenne === null && b.moyenne === null) return 0;
        if (a.moyenne === null) return 1;
        if (b.moyenne === null) return -1;
        return a.moyenne - b.moyenne;
    });

    // 5. Attribution du rang de classe
    resultats.forEach((r, idx) => { r.rang = idx + 1; });

    return resultats;
}

// ============================================================
// HELPERS D'AFFICHAGE
// ============================================================

/**
 * 1234 → "20:34"
 */
export function formatTemps(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return '--:--';
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * 1 → 🥇, 2 → 🥈, 3 → 🥉, autre → "4."
 */
export function getMedaille(rang) {
    if (rang === 1) return '🥇';
    if (rang === 2) return '🥈';
    if (rang === 3) return '🥉';
    return rang + '.';
}

/**
 * 80.4 → "80.4 %"
 */
export function formatPourcentage(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return '--';
    return `${pct.toFixed(1)} %`;
}