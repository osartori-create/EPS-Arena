// src/js/modules/scan-camera/scan-camera-export.js
// Génération PDF des cartes élèves (marqueurs ArUco + lettres A/B/C/D).
// Utilise jsPDF (chargé par CDN dans maitre.html, global window.jspdf).
// A4 portrait, 3 colonnes × 4 lignes = 12 cartes par page.

import { generateMarkerMatrix, MARKER_CELLS, DEFAULT_RESPONSES } from './scan-camera-core.js';

const A4_W = 210;
const A4_H = 297;
const MARGIN = 10;
const GAP_X = 4;
const GAP_Y = 5;
const COLS = 3;
const ROWS = 4;

/**
 * Dessine un marqueur ArUco dans un document jsPDF.
 * 0 = noir, 1 = blanc.
 * @param {object} doc - instance jsPDF
 * @param {number} id - identifiant du marqueur
 * @param {number} x - position x (mm)
 * @param {number} y - position y (mm)
 * @param {number} size - taille du carré (mm)
 */
export function drawMarkerToJsPdf(doc, id, x, y, size) {
    const matrix = generateMarkerMatrix(id);
    const cell = size / MARKER_CELLS;

    // Fond blanc (indépendant de la couleur de la page).
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, size, size, 'F');

    // Cellules noires (bordure comprise : la bordure est codée 0).
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < MARKER_CELLS; r++) {
        for (let c = 0; c < MARKER_CELLS; c++) {
            if (matrix[r][c] === 0) {
                doc.rect(x + c * cell, y + r * cell, cell, cell, 'F');
            }
        }
    }

    // Liseré gris pour délimiter le marqueur.
    doc.setDrawColor(180, 180, 180);
    doc.rect(x, y, size, size);
}

/**
 * Génère et télécharge le PDF des cartes élèves.
 * @param {Object} options
 * @param {Array<{id:string,nom?:string,prenom?:string}>} options.eleves - élèves concernés
 * @param {Object} options.mappingByEleve - { eleveId: markerId }
 * @param {string[]} [options.responses] - libellés des 4 réponses (défaut A/B/C/D)
 * @param {string} [options.classe] - code classe (pour le nom du fichier)
 * @returns {number} nombre de cartes générées
 */
export function generateStudentCardsPDF({ eleves, mappingByEleve, responses = DEFAULT_RESPONSES, classe = '' }) {
    if (!window.jspdf) {
        throw new Error('jsPDF non chargé. Vérifie le CDN dans maitre.html.');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const list = (eleves || []).filter(e => e && e.id != null);
    const cellW = (A4_W - 2 * MARGIN - (COLS - 1) * GAP_X) / COLS;
    const cellH = (A4_H - 2 * MARGIN - (ROWS - 1) * GAP_Y) / ROWS;
    const perPage = COLS * ROWS;
    const pages = Math.ceil(list.length / perPage);

    let drawn = 0;

    for (let p = 0; p < pages; p++) {
        if (p > 0) doc.addPage();

        for (let slot = 0; slot < perPage; slot++) {
            const index = p * perPage + slot;
            if (index >= list.length) break;

            const eleve = list[index];
            const markerId = (mappingByEleve && mappingByEleve[eleve.id]) || null;

            const col = slot % COLS;
            const row = Math.floor(slot / COLS);
            const x0 = MARGIN + col * (cellW + GAP_X);
            const y0 = MARGIN + row * (cellH + GAP_Y);

            // Contour de carte (repère de découpe).
            doc.setDrawColor(210, 210, 210);
            doc.roundedRect(x0, y0, cellW, cellH, 2, 2);

            if (markerId == null) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(160, 160, 160);
                doc.text('Pas de numéro', x0 + cellW / 2, y0 + cellH / 2, { align: 'center' });
                continue;
            }

            const markerSize = Math.min(cellW, cellH) * 0.58;
            const mx = x0 + (cellW - markerSize) / 2;
            const my = y0 + 3;

            drawMarkerToJsPdf(doc, markerId, mx, my, markerSize);

            // Lettres autour du marqueur (A en haut, B à droite, C en bas, D à gauche).
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(30, 30, 30);
            const cy = my + markerSize / 2;
            doc.text(responses[0], mx + markerSize / 2, my - 2, { align: 'center' });
            doc.text(responses[1], mx + markerSize + 4, cy + 1.5, { align: 'left' });
            doc.text(responses[2], mx + markerSize / 2, my + markerSize + 6, { align: 'center' });
            doc.text(responses[3], mx - 4, cy + 1.5, { align: 'right' });

            // Identifiant numérique + nom (affichés sur la carte physique).
            const nomAffiche = eleve.nom
                ? `${eleve.nom} ${eleve.prenom || ''}`.trim().toUpperCase()
                : '';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text(`N° ${markerId}`, x0 + cellW / 2, y0 + cellH - 7, { align: 'center' });
            if (nomAffiche) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(90, 90, 90);
                doc.text(nomAffiche, x0 + cellW / 2, y0 + cellH - 3, { align: 'center' });
            }

            drawn++;
        }
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = classe ? `_${classe}` : '';
    doc.save(`cartes_scan_camera${suffix}_${dateStr}.pdf`);
    return drawn;
}
