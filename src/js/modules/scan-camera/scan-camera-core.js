// ============================================================
// src/js/modules/scan-camera/scan-camera-core.js
// Moteur pur du module Scan Caméra — aucune dépendance DOM,
// Firebase ou stockage. Testable en console :
//   import('./src/js/modules/scan-camera/scan-camera-core.js')
//     .then(m => console.log(m.selfTest()));
// ============================================================
//
// Les marqueurs suivent le format js-aruco (grille 7×7, bordure noire,
// 5×5 interne, 10 bits de données → 1024 identifiants possibles).
// Un marqueur encode un identifiant numérique (0..1023). Son ORIENTATION
// (4 rotations possibles) encode la réponse A/B/C/D.
// ============================================================

// Les 4 motifs de ligne valides. Les 2 bits de données occupent les
// colonnes 1 et 3 ; les colonnes 0, 2 et 4 sont redondantes (parité).
export const ROW_PATTERNS = [
    [1, 0, 0, 0, 0],   // données 00
    [1, 0, 1, 1, 1],   // données 01
    [0, 1, 0, 0, 1],   // données 10
    [0, 1, 1, 1, 0]    // données 11
];

export const MARKER_CELLS = 7;        // grille 7×7 (bordure noire de 1 case)
export const MAX_MARKER_ID = 1023;    // 10 bits → identifiants 0..1023

export const DEFAULT_RESPONSES = ['A', 'B', 'C', 'D'];

// Angle (degrés, repère écran y vers le bas) du coin haut-gauche canonique
// lorsque la carte est tenue droite (réponse A en haut).
export const ORIENTATION_REFERENCE_ANGLE = 225;

// ============================================================
// GÉNÉRATION DES MARQUEURS
// ============================================================

/**
 * Construit la matrice binaire 7×7 du marqueur ArUco correspondant à `id`.
 * 0 = cellule noire, 1 = cellule blanche.
 * @param {number} id - identifiant numérique (0..1023)
 * @returns {number[][]} matrice 7×7 de 0/1
 */
export function generateMarkerMatrix(id) {
    id = Number(id);
    if (!Number.isInteger(id) || id < 0 || id > MAX_MARKER_ID) {
        throw new Error(`Identifiant de marqueur invalide : ${id} (attendu 0..${MAX_MARKER_ID}).`);
    }

    const matrix = [];
    for (let r = 0; r < MARKER_CELLS; r++) {
        matrix.push(new Array(MARKER_CELLS).fill(0));
    }

    for (let row = 0; row < 5; row++) {
        // mat2id de js-aruco lit, pour chaque ligne, bits[i][1] puis bits[i][3],
        // la ligne 0 étant la plus significative. On inverse ce codage.
        const hi = (id >> (9 - 2 * row)) & 1; // colonne 1 (bit fort de la ligne)
        const lo = (id >> (8 - 2 * row)) & 1; // colonne 3 (bit faible de la ligne)
        const pattern = ROW_PATTERNS[(hi << 1) | lo];
        for (let col = 0; col < 5; col++) {
            matrix[row + 1][col + 1] = pattern[col];
        }
    }

    return matrix;
}

/**
 * Inverse de generateMarkerMatrix : relit l'identifiant depuis une matrice 7×7.
 * Sert aux tests aller-retour (round-trip).
 * @param {number[][]} matrix - matrice 7×7 de 0/1
 * @returns {number} identifiant décodé
 */
export function matrixToId(matrix) {
    let id = 0;
    for (let row = 0; row < 5; row++) {
        id <<= 1;
        id |= matrix[row + 1][2] & 1; // colonne intérieure 1 (donnée bit fort)
        id <<= 1;
        id |= matrix[row + 1][4] & 1; // colonne intérieure 3 (donnée bit faible)
    }
    return id;
}

/**
 * Produit une chaîne SVG du marqueur (aperçu, sans manipuler le DOM).
 * 0 = noir, 1 = blanc.
 * @param {number} id - identifiant du marqueur
 * @param {number} cellSize - taille d'une cellule en pixels
 * @returns {string} balise SVG autonome
 */
export function generateMarkerSvg(id, cellSize = 10) {
    const matrix = generateMarkerMatrix(id);
    const size = MARKER_CELLS * cellSize;
    let black = '';
    for (let r = 0; r < MARKER_CELLS; r++) {
        for (let c = 0; c < MARKER_CELLS; c++) {
            if (matrix[r][c] === 0) {
                black += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}"/>`;
            }
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
        `<rect width="${size}" height="${size}" fill="white"/>` +
        `<g fill="black">${black}</g></svg>`;
}

// ============================================================
// DÉCODAGE DE L'ORIENTATION
// ============================================================

/**
 * Détermine l'orientation (0..3) d'un marqueur détecté à partir de ses coins.
 * js-aruco renvoie `corners` dans l'ordre canonique : corners[0] = coin
 * haut-gauche du marqueur (tel qu'encodé). On mesure l'angle du coin canonique
 * par rapport au centre pour retrouver la rotation physique de la carte.
 *
 * Convention :
 *   0 = carte droite          (lettre A en haut)
 *   1 = rotation 90° horaire  (lettre B en haut)
 *   2 = rotation 180°         (lettre C en haut)
 *   3 = rotation 270° horaire (lettre D en haut)
 *
 * @param {Array<{x:number,y:number}>} corners - 4 coins du marqueur détecté
 * @returns {number} 0..3, ou -1 si les coins sont invalides
 */
export function decodeMarkerOrientation(corners) {
    if (!corners || corners.length < 4) return -1;

    const cx = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
    const cy = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;

    const vx = corners[0].x - cx;
    const vy = corners[0].y - cy;

    let angle = Math.atan2(vy, vx) * 180 / Math.PI;
    angle = (angle + 360) % 360;

    let orientation = Math.round((angle - ORIENTATION_REFERENCE_ANGLE) / 90) % 4;
    if (orientation < 0) orientation += 4;
    return orientation;
}

// ============================================================
// RÉPONSES
// ============================================================

/**
 * Convertit une orientation (0..3) en réponse (par défaut A/B/C/D).
 * @param {number} orientation - 0..3
 * @param {string[]} responses - libellés des 4 réponses
 * @returns {string|null}
 */
export function orientationToResponse(orientation, responses = DEFAULT_RESPONSES) {
    if (orientation == null || orientation < 0 || orientation >= responses.length) return null;
    return responses[orientation];
}

/**
 * Décode un marqueur détecté en { markerId, orientation, response }.
 * @param {{id:number, corners:Array}} marker - marqueur js-aruco
 * @param {string[]} responses - libellés des 4 réponses
 * @returns {{markerId:number, orientation:number, response:string|null, corners:Array}|null}
 */
export function decodeResponse(marker, responses = DEFAULT_RESPONSES) {
    if (!marker) return null;
    const orientation = decodeMarkerOrientation(marker.corners);
    return {
        markerId: marker.id,
        orientation,
        response: orientationToResponse(orientation, responses),
        corners: marker.corners
    };
}

/**
 * Détecte et décode tous les marqueurs présents dans une image.
 * @param {ImageData} imageData - image brute (canvas getImageData)
 * @param {object} detector - instance de la bibliothèque ArUco (window.AR)
 * @param {string[]} responses - libellés des 4 réponses
 * @returns {Array}
 */
export function detectResponses(imageData, detector, responses = DEFAULT_RESPONSES) {
    if (!imageData || !detector) return [];
    const markers = detector.detect(imageData);
    return markers.map(m => decodeResponse(m, responses));
}

// ============================================================
// AFFECTATION DES IDENTIFIANTS (locale, jamais sur Firebase)
// ============================================================

/**
 * Attribue un identifiant de marqueur séquentiel (1..N) à chaque élève.
 * @param {Array<{id:string}>} eleves - liste des élèves
 * @returns {{byMarker:Object, byEleve:Object}} byMarker { markerId: eleveId }, byEleve { eleveId: markerId }
 */
export function assignMarkerIds(eleves) {
    const byMarker = {};
    const byEleve = {};
    let markerId = 1;
    (eleves || []).forEach(e => {
        if (!e || e.id == null) return;
        byMarker[markerId] = e.id;
        byEleve[e.id] = markerId;
        markerId++;
    });
    return { byMarker, byEleve };
}

// ============================================================
// PAYLOAD FIREBASE (strictement anonyme)
// ============================================================

/**
 * Construit l'objet de réponse envoyé sur Firebase.
 * Ne contient QUE des données anonymes : jamais de nom/prénom/eleveId.
 * @returns {{markerId:number, response:string, questionId:string, sessionId:string, timestamp:number, source:string}}
 */
export function buildFirebaseResponse({ markerId, response, questionId = null, sessionId = null, source = 'scancamera' }) {
    return {
        markerId: Number(markerId),
        response: response || null,
        questionId: questionId || null,
        sessionId: sessionId || null,
        timestamp: Date.now(),
        source
    };
}

// ============================================================
// OUTILS DE TEST
// ============================================================

/**
 * Construit les 4 coins canoniques d'un marqueur pour une rotation physique
 * donnée. Sert uniquement aux tests de decodeMarkerOrientation.
 * @param {number} rotation - 0..3 (nombre de rotations de 90° horaire)
 * @param {number} size - taille du carré simulé
 * @returns {Array<{x:number,y:number}>}
 */
export function simulateCornersForRotation(rotation, size = 100) {
    const positions = [
        { x: 0, y: 0 }, { x: size, y: 0 }, { x: size, y: size }, { x: 0, y: size }
    ];
    const corners = [];
    for (let i = 0; i < 4; i++) {
        corners.push(positions[(i + rotation) % 4]);
    }
    return corners;
}

/**
 * Vérifie la cohérence du moteur (génération, décodage, orientation, mapping).
 * @returns {{ok:boolean, failures:string[], summary:string}}
 */
export function selfTest() {
    const failures = [];

    // 1. Aller-retour identifiant ↔ matrice (cohérence avec mat2id js-aruco).
    [0, 1, 17, 42, 255, 511, 1000, 1023].forEach(id => {
        const back = matrixToId(generateMarkerMatrix(id));
        if (back !== id) failures.push(`aller-retour id ${id} → ${back}`);
    });

    // 2. Convention d'orientation (0..3).
    for (let r = 0; r < 4; r++) {
        const o = decodeMarkerOrientation(simulateCornersForRotation(r));
        if (o !== r) failures.push(`orientation ${r} → ${o}`);
    }

    // 3. Mapping des réponses.
    if (orientationToResponse(0) !== 'A' || orientationToResponse(1) !== 'B' ||
        orientationToResponse(2) !== 'C' || orientationToResponse(3) !== 'D') {
        failures.push('mapping réponses A/B/C/D');
    }

    // 4. Affectation séquentielle des identifiants.
    const mapping = assignMarkerIds([{ id: 'eleve1' }, { id: 'eleve2' }]);
    if (mapping.byMarker['1'] !== 'eleve1' || mapping.byEleve['eleve2'] !== 2) {
        failures.push('affectation des identifiants');
    }

    return {
        ok: failures.length === 0,
        failures,
        summary: failures.length === 0 ? 'Tous les tests passent ✅' : `${failures.length} échec(s)`
    };
}
