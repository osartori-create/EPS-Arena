// src/js/modules/cross/cross-dossards.js
// Génération PDF des dossards + import CSV + données bidons
// A4 paysage, 2 dossards A5 (141 × 200 mm) côte à côte

import {
    getTousLesElevesCross, setDossardPourEleve, getProchainDossardLibre,
    getStatutsCross, setStatutsCross, getClassesParticipantes,
    setClassesParticipantes, getDossards, setDossards
} from './cross-config.js';
import { COURSES_DEFAUT, getNiveauFromClasse, generateEan13 } from './cross-core.js';
import { getExistingEleves, saveEleves, migrerCodesAutoEval } from '../../services/admin-service.js';

const Papa = window.Papa;

// Dimensions (mm)
const A4_W = 297, A4_H = 210;
const MARGE = 5;
const ECART = 5;
const DOS_W = (A4_W - 2 * MARGE - ECART) / 2;   // = 141 mm
const DOS_H = A4_H - 2 * MARGE;                  // = 200 mm

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initCrossDossards(container) {
    if (!container) return;

    const classes = getClassesParticipantes();
    const eleves = getTousLesElevesCross();

    const nbPresent = eleves.filter(e => e.statut === 'present').length;
    const nbAvecDossard = eleves.filter(e => e.dossard && e.statut === 'present').length;
    const nbPages = Math.ceil(nbAvecDossard / 2);

    container.innerHTML = `
        <div class="space-y-4">

            <!-- Bandeau titre -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">🎫 Dossards Cross</h3>
                    <p class="text-xs text-slate-400">${classes.length} classes · ${eleves.length} élèves · ${nbPresent} présents</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.crossDossardsImportCSV()"
                            class="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400 active:scale-95">
                        📥 Import CSV (collègues)
                    </button>
                    <button onclick="window.crossDossardsDonneesBidons()"
                            class="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-amber-400 active:scale-95">
                        🧪 Données bidons
                    </button>
                    <input type="file" id="crossDossardsCSVInput" class="hidden" accept=".csv" onchange="window.crossDossardsTraiterCSV(event)">
                </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Présents</div>
                    <div class="text-2xl font-black text-white">${nbPresent}</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Avec dossard</div>
                    <div class="text-2xl font-black text-emerald-400">${nbAvecDossard}</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Sans dossard</div>
                    <div class="text-2xl font-black ${nbPresent - nbAvecDossard > 0 ? 'text-amber-400' : 'text-slate-500'}">${nbPresent - nbAvecDossard}</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Pages A4</div>
                    <div class="text-2xl font-black text-blue-400">${nbPages}</div>
                </div>
            </div>

            <!-- Filtre & génération -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h4 class="text-xs font-bold text-slate-400 uppercase mb-3">Générer le PDF</h4>
                <p class="text-xs text-slate-500 mb-3">
                    Format : A4 paysage · 2 dossards A5 par page (141 × 200 mm) · EAN-13 · impression sur papier de couleur au choix.
                </p>

                <label class="flex items-center gap-2 mb-3 text-xs text-slate-300">
                    <input type="checkbox" id="crossDossardsFiltreClasse" onchange="window.crossDossardsToggleFiltre(this.checked)" ${classes.length > 0 ? 'checked' : ''}>
                    Éditer par classe (sélection ci-dessous)
                </label>

                <div id="crossDossardsClassesList" class="flex flex-wrap gap-2 mb-4 ${classes.length > 0 ? '' : 'hidden'}">
                    ${classes.map(c => `
                        <label class="flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer text-xs text-white">
                            <input type="checkbox" class="crossDossardsClasseCB" value="${c}" checked onchange="window.crossDossardsUpdateCompteur()">
                            ${c}
                        </label>
                    `).join('')}
                </div>

                <div class="flex flex-col md:flex-row gap-3 items-center">
                    <div class="flex-1">
                        <label class="text-xs text-slate-400">Aperçu :</label>
                        <span id="crossDossardsCompteur" class="text-sm font-black text-white ml-2">
                            ${nbAvecDossard} dossards · ${nbPages} pages
                        </span>
                    </div>
                    <button onclick="window.crossDossardsGenererPDF()"
                            class="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-xl font-black text-sm uppercase text-white border-2 border-emerald-400 active:scale-95">
                        📄 Générer le PDF
                    </button>
                </div>
            </div>

            <!-- Note technique -->
            <div class="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400">
                    💡 Le code-barres utilise le format <strong class="text-slate-200">EAN-13</strong> (12 chiffres + clé de contrôle).
                    Ta douchette enverra le numéro suivi d'un Entrée — parfaitement géré par le module Course.
                </p>
            </div>

        </div>
    `;
}

// ============================================================
// COMPTEUR DYNAMIQUE
// ============================================================
window.crossDossardsToggleFiltre = function(checked) {
    const list = document.getElementById('crossDossardsClassesList');
    if (list) list.classList.toggle('hidden', !checked);
    window.crossDossardsUpdateCompteur();
};

window.crossDossardsUpdateCompteur = function() {
    const eleves = getTousLesElevesCross();
    const filtrer = document.getElementById('crossDossardsFiltreClasse')?.checked;
    const classesChoisies = filtrer
        ? Array.from(document.querySelectorAll('.crossDossardsClasseCB:checked')).map(c => c.value)
        : null;

    const selectionnes = eleves.filter(e => {
        if (e.statut !== 'present') return false;
        if (!e.dossard) return false;
        if (classesChoisies && !classesChoisies.includes(e.classe)) return false;
        return true;
    });

    const pages = Math.ceil(selectionnes.length / 2);
    const el = document.getElementById('crossDossardsCompteur');
    if (el) el.textContent = `${selectionnes.length} dossards · ${pages} pages`;
};

// ============================================================
// GÉNÉRATION PDF
// ============================================================
window.crossDossardsGenererPDF = async function() {
    if (!window.jspdf || !window.JsBarcode) {
        alert('❌ Librairie jsPDF ou JsBarcode non chargée.\nVérifie le CDN dans maitre.html.');
        return;
    }

    const eleves = getTousLesElevesCross();
    const filtrer = document.getElementById('crossDossardsFiltreClasse')?.checked;
    const classesChoisies = filtrer
        ? Array.from(document.querySelectorAll('.crossDossardsClasseCB:checked')).map(c => c.value)
        : null;

    let liste = eleves.filter(e => {
        if (e.statut !== 'present') return false;
        if (!e.dossard) return false;
        if (classesChoisies && !classesChoisies.includes(e.classe)) return false;
        return true;
    });

    if (liste.length === 0) {
        alert('Aucun élève à imprimer.\n\nVérifie que les dossards sont attribués (onglet Préparation).');
        return;
    }

    // Tri : par classe puis par dossard
    liste.sort((a, b) => {
        if (a.classe !== b.classe) return a.classe.localeCompare(b.classe);
        return a.dossard - b.dossard;
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Pour chaque paire de dossards → une page
    for (let i = 0; i < liste.length; i += 2) {
        const d1 = liste[i];
        const d2 = liste[i + 1] || null;

        if (i > 0) doc.addPage();

        await dessinerDossard(doc, d1, MARGE, MARGE);
        if (d2) await dessinerDossard(doc, d2, MARGE + DOS_W + ECART, MARGE);
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    doc.save(`dossards_cross_${dateStr}.pdf`);
};

// ============================================================
// DESSIN D'UN DOSSARD
// ============================================================
async function dessinerDossard(doc, eleve, x0, y0) {
    const ean = generateEan13(eleve.dossard);

    // Cadre de coupe (fin, gris clair)
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(x0, y0, DOS_W, DOS_H);

    // --- Bande verticale code-barres à gauche (12 mm de large) ---
    const barCodeW = 12;
    try {
        const eanImg = await genererImageCodeBarres(ean, true);
        doc.addImage(eanImg, 'PNG', x0 + 1, y0 + 1, barCodeW - 2, DOS_H - 2);
    } catch (err) {
        console.warn('[Dossards] Impossible de générer le code-barres latéral :', err);
    }

    // Zone utile (à droite du code-barres latéral)
    const zoneX = x0 + barCodeW + 3;
    const zoneW = DOS_W - barCodeW - 6;
    const centreX = zoneX + zoneW / 2;

    // --- En-tête ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text('EPS-ARENA CROSS', centreX, y0 + 10, { align: 'center' });

    // --- Numéro géant ---
    doc.setFontSize(130);
    doc.setTextColor(0, 0, 0);
    doc.text(`#${eleve.dossard}`, centreX, y0 + 90, { align: 'center' });

    // --- Nom Prénom ---
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    const nomPrenom = `${eleve.prenom} ${eleve.nom}`;
    doc.text(nomPrenom, centreX, y0 + 115, { align: 'center' });

    // --- Classe + Catégorie ---
    const catInfo = getCategorieCourse(eleve);
    doc.setFontSize(16);
    doc.setTextColor(80, 80, 80);
    doc.text(`Classe ${eleve.classe}`, centreX, y0 + 128, { align: 'center' });

    doc.setFontSize(14);
    doc.text(catInfo.label, centreX, y0 + 138, { align: 'center' });

    // --- Contrat ---
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text('CONTRAT : 2500 m · 2400 m annoncés · %VMA', centreX, y0 + 150, { align: 'center' });

    // --- Code-barres horizontal en bas ---
    const barH = 30;
    const barW = zoneW - 20;
    const barX = centreX - barW / 2;
    const barY = y0 + DOS_H - barH - 12;

    try {
        const eanImg = await genererImageCodeBarres(ean, false);
        doc.addImage(eanImg, 'PNG', barX, barY, barW, barH);
    } catch (err) {
        console.warn('[Dossards] Impossible de générer le code-barres bas :', err);
    }

    // Numéro humain sous le code-barres
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(ean, centreX, y0 + DOS_H - 3, { align: 'center' });
}

// ============================================================
// GÉNÉRATION CODE-BARRES (canvas → dataURL)
// ============================================================
function genererImageCodeBarres(valeur, rotation) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        try {
            window.JsBarcode(canvas, valeur, {
                format: 'EAN13',
                displayValue: false,
                margin: 0,
                background: '#ffffff',
                lineColor: '#000000',
                width: 2,
                height: 100
            });
        } catch (err) {
            reject(err);
            return;
        }

        if (!rotation) {
            resolve(canvas.toDataURL('image/png'));
            return;
        }

        // Rotation 90° : on tourne le canvas
        const w = canvas.width;
        const h = canvas.height;
        const rot = document.createElement('canvas');
        rot.width = h;
        rot.height = w;
        const ctx = rot.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, h, w);
        ctx.translate(h / 2, w / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(canvas, -w / 2, -h / 2);
        resolve(rot.toDataURL('image/png'));
    });
}

// ============================================================
// CATÉGORIE DE COURSE D'UN ÉLÈVE
// ============================================================
function getCategorieCourse(eleve) {
    const niveau = getNiveauFromClasse(eleve.classe);
    const course = COURSES_DEFAUT.find(c =>
        c.sexe === eleve.sexe && c.niveaux.includes(niveau)
    );
    if (!course) return { label: '—', course };
    return {
        label: course.label,
        course
    };
}

// ============================================================
// IMPORT CSV (collègues)
// ============================================================
window.crossDossardsImportCSV = function() {
    document.getElementById('crossDossardsCSVInput').click();
};

window.crossDossardsTraiterCSV = function(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const csv = e.target.result;
        const sep = csv.includes(';') ? ';' : ',';

        Papa.parse(csv, {
            delimiter: sep,
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
            complete: (result) => {
                if (result.errors.length > 0 && result.data.length === 0) {
                    alert('❌ Erreur de lecture CSV : ' + result.errors[0].message);
                    return;
                }
                traiterDonneesCSV(result.data, result.meta.fields);
            }
        });
    };
    reader.readAsText(file);
    event.target.value = '';
};

function traiterDonneesCSV(rows, headers) {
    // Détection automatique des colonnes
    const findCol = (...aliases) => {
        for (const a of aliases) {
            const h = headers.find(x => x === a || x.includes(a));
            if (h) return h;
        }
        return null;
    };

    const colNom     = findCol('nom', 'lastname', 'name_last');
    const colPrenom  = findCol('prenom', 'prénom', 'firstname', 'name_first');
    const colClasse  = findCol('classe', 'division', 'group');
    const colSexe    = findCol('sexe', 'sex', 'gender', 'm/f');
    const colVma     = findCol('vma', 'vmax');
    const colInapte  = findCol('inapte', 'aptitude', 'dispense', 'apte');
    const colComm    = findCol('commentaire', 'comment', 'note');

    if (!colNom || !colPrenom || !colClasse) {
        alert(`❌ Colonnes obligatoires manquantes.\n\nDétecté :\n- Nom : ${colNom || '❌'}\n- Prénom : ${colPrenom || '❌'}\n- Classe : ${colClasse || '❌'}\n\nColonnes trouvées : ${headers.join(', ')}`);
        return;
    }

    const parClasse = {};
    let nbCrees = 0, nbModifies = 0;

    rows.forEach(row => {
        const nom     = (row[colNom] || '').trim().toUpperCase();
        const prenom  = (row[colPrenom] || '').trim();
        const classe  = (row[colClasse] || '').trim();
        const sexeRaw = (row[colSexe] || '').trim().toUpperCase();
        const vma     = parseFloat(row[colVma]) || null;
        const inapteRaw = (row[colInapte] || '').trim().toLowerCase();
        const commentaire = (row[colComm] || '').trim();

        if (!nom || !prenom || !classe) return;

        let sexe = '';
        if (sexeRaw === 'M' || sexeRaw === 'G' || sexeRaw === 'H' || sexeRaw.startsWith('MASC')) sexe = 'M';
        else if (sexeRaw === 'F' || sexeRaw.startsWith('FEM')) sexe = 'F';

        const inapte = ['oui', 'yes', 'true', '1', 'x', 'inapte'].includes(inapteRaw);

        if (!parClasse[classe]) parClasse[classe] = [];
        parClasse[classe].push({ nom, prenom, sexe, vma, inapte, commentaire });
    });

    Object.entries(parClasse).forEach(([classe, elevesCSV]) => {
        const existants = getExistingEleves(classe);
        const map = {};
        existants.forEach(e => {
            const cle = `${(e.nom || '').toUpperCase()}|${(e.prenom || '').toUpperCase()}`;
            map[cle] = e;
        });

        elevesCSV.forEach(e => {
            const cle = `${e.nom.toUpperCase()}|${e.prenom.toUpperCase()}`;
            const existant = map[cle];

            if (existant) {
                if (e.vma !== null) existant.vma = e.vma;
                if (e.sexe) existant.sexe = e.sexe;
                if (e.commentaire) existant.commentaire = e.commentaire;
                nbModifies++;
            } else {
                const id = `${normaliserNom(e.nom)}_${normaliserNom(e.prenom).charAt(0)}`;
                const newEleve = {
                    id,
                    nom: e.nom,
                    prenom: e.prenom,
                    sexe: e.sexe,
                    dateNaissance: '',
                    vma: e.vma || 0,
                    palier: 0,
                    longueur: null,
                    sprint30: null,
                    force: 0,
                    commentaire: e.commentaire || ''
                };
                existants.push(newEleve);
                nbCrees++;
            }
        });

        // Attribution des codes auto-éval manquants
        existants.forEach(el => {
            if (el.codeAutoEval === undefined || el.codeAutoEval === null) {
                let code = 1;
                while (existants.some(x => x.codeAutoEval === code)) code++;
                el.codeAutoEval = code;
            }
        });

        saveEleves(classe, existants);
    });

    // Mise à jour des classes participantes
    const actuelles = getClassesParticipantes();
    const nouvelles = Array.from(new Set([...actuelles, ...Object.keys(parClasse)]));
    setClassesParticipantes(nouvelles);

    // Attribution automatique des dossards pour les nouveaux
    attribuerDossardsManquants();

    alert(`✅ Import terminé !\n\n${nbCrees} élève(s) créé(s)\n${nbModifies} élève(s) mis à jour\n${Object.keys(parClasse).length} classe(s)\n\nDossards attribués automatiquement.`);

    // Rafraîchir l'onglet
    const c = document.getElementById('cross-content');
    if (c) initCrossDossards(c);
}

// ============================================================
// ATTRIBUTION AUTOMATIQUE DES DOSSARDS MANQUANTS
// ============================================================
function attribuerDossardsManquants() {
    const eleves = getTousLesElevesCross();
    const sansDossard = eleves
        .filter(e => e.statut === 'present' && !e.dossard)
        .sort((a, b) => {
            if (a.classe !== b.classe) return a.classe.localeCompare(b.classe);
            return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`);
        });

    let prochain = getProchainDossardLibre();
    sansDossard.forEach(e => {
        setDossardPourEleve(e.eleveId, prochain);
        prochain++;
    });
}

// ============================================================
// DONNÉES BIDONS
// ============================================================
window.crossDossardsDonneesBidons = function() {
    const classe = prompt('Classe pour les données bidons ?', '608');
    if (!classe) return;
    const nb = parseInt(prompt('Combien d\'élèves fictifs ?', '30')) || 30;

    const prenomsM = ['Lucas', 'Hugo', 'Léo', 'Nathan', 'Théo', 'Enzo', 'Mathis', 'Tom', 'Louis', 'Gabriel', 'Adam', 'Raphaël', 'Arthur', 'Jules', 'Paul'];
    const prenomsF = ['Emma', 'Léa', 'Chloé', 'Manon', 'Camille', 'Sarah', 'Louise', 'Jade', 'Alice', 'Lina', 'Rose', 'Anna', 'Inès', 'Zoé', 'Mila'];
    const noms = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia'];

    const elevesExistants = getExistingEleves(classe);
    const nouveaux = [];

    for (let i = 0; i < nb; i++) {
        const sexe = Math.random() < 0.5 ? 'M' : 'F';
        const prenom = sexe === 'M'
            ? prenomsM[Math.floor(Math.random() * prenomsM.length)]
            : prenomsF[Math.floor(Math.random() * prenomsF.length)];
        const nom = noms[Math.floor(Math.random() * noms.length)];
        const id = `${normaliserNom(nom)}_${normaliserNom(prenom).charAt(0)}${i}`;

        nouveaux.push({
            id,
            nom: nom.toUpperCase(),
            prenom,
            sexe,
            dateNaissance: '',
            vma: Math.round((10 + Math.random() * 6) * 10) / 10,
            palier: 0,
            longueur: null,
            sprint30: null,
            force: 0,
            commentaire: ''
        });
    }

    // Attribution codes auto-éval
    const tous = [...elevesExistants, ...nouveaux];
    tous.forEach(el => {
        if (el.codeAutoEval === undefined || el.codeAutoEval === null) {
            let code = 1;
            while (tous.some(x => x !== el && x.codeAutoEval === code)) code++;
            el.codeAutoEval = code;
        }
    });

    saveEleves(classe, tous);

    // Ajout à la liste des classes participantes
    const actuelles = getClassesParticipantes();
    if (!actuelles.includes(classe)) {
        setClassesParticipantes([...actuelles, classe]);
    }

    // Attribution des dossards
    attribuerDossardsManquants();

    alert(`✅ ${nb} élèves fictifs ajoutés à la classe ${classe}.\nDossards attribués automatiquement.`);
    const c = document.getElementById('cross-content');
    if (c) initCrossDossards(c);
};

// ============================================================
// UTILITAIRE
// ============================================================
function normaliserNom(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}