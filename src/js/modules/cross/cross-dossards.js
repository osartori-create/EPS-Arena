// src/js/modules/cross/cross-dossards.js
// Génération PDF des dossards + import CSV + données bidons
// A4 portrait · 2 dossards paysage empilés (200 × 141 mm)

import {
    getTousLesElevesCross, setDossardPourEleve, getProchainDossardLibre,
    getStatutsCross, getClassesParticipantes,
    setClassesParticipantes
} from './cross-config.js';
import { COURSES_DEFAUT, getNiveauFromClasse, generateEan13, DISTANCE_CONTRAT_M } from './cross-core.js';
import { getExistingEleves, saveEleves } from '../../services/admin-service.js';

const Papa = window.Papa;

// Dimensions (mm) — A4 portrait 210 × 297
const A4_W = 210, A4_H = 297;
const MARGE = 5;
const ECART = 5;
const DOS_W = A4_W - 2 * MARGE;      // = 200 mm
const DOS_H = (A4_H - 2 * MARGE - ECART) / 2;  // = 141 mm

// Seuil d'affichage du pictogramme coureur
const VMA_SEUIL_COUREUR = 12;

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
                    <button onclick="window.crossSimulerCrossComplet()"
        class="bg-rose-600 hover:bg-rose-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-rose-400 active:scale-95">
    🌊 Simuler un cross complet
</button>
                    <input type="file" id="crossDossardsCSVInput" class="hidden" accept=".csv" onchange="window.crossDossardsTraiterCSV(event)">
                </div>
            </div>

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

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h4 class="text-xs font-bold text-slate-400 uppercase mb-3">Générer le PDF</h4>
                <p class="text-xs text-slate-500 mb-3">
                    Format : A4 portrait · 2 dossards paysage par page (200 × 141 mm) · EAN-13 · impression sur papier de couleur au choix.
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

            <div class="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400">
                    💡 Le code-barres utilise le format <strong class="text-slate-200">EAN-13</strong> (12 chiffres + clé de contrôle).
                    Le numéro imprimé sous le code-barres n'affiche que les 12 chiffres utiles.
                    Ta douchette enverra le numéro suivi d'un Entrée.
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

    liste.sort((a, b) => {
        if (a.classe !== b.classe) return a.classe.localeCompare(b.classe);
        return a.dossard - b.dossard;
    });

    const { jsPDF } = window.jspdf;
    // A4 portrait
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < liste.length; i += 2) {
        const d1 = liste[i];
        const d2 = liste[i + 1] || null;

        if (i > 0) doc.addPage();

        await dessinerDossard(doc, d1, MARGE, MARGE);
        if (d2) await dessinerDossard(doc, d2, MARGE, MARGE + DOS_H + ECART);
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    doc.save(`dossards_cross_${dateStr}.pdf`);
};

// ============================================================
// DESSIN D'UN DOSSARD (paysage 200 × 141)
// ============================================================
async function dessinerDossard(doc, eleve, x0, y0) {
    const ean = generateEan13(eleve.dossard);
    const eanSansCle = ean.slice(0, -1);
    const vma = parseFloat(eleve.vma) || 0;

    // Cadre de coupe fin gris
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(x0, y0, DOS_W, DOS_H);

    // ---- Code-barres vertical à GAUCHE ----
    const barCodeLatW = 14;
    try {
        const eanImg = await genererImageCodeBarres(ean, true);
        doc.addImage(eanImg, 'PNG', x0 + 2, y0 + 4, barCodeLatW - 4, DOS_H - 8);
    } catch (err) {
        console.warn('[Dossards] Erreur code-barres latéral :', err);
    }

    // Zone utile
    const zoneX = x0 + barCodeLatW + 4;
    const zoneW = DOS_W - barCodeLatW - 8;
    const centreX = zoneX + zoneW / 2;

    let cursorY = y0 + 4;

    // ---- Pictogramme coureur si VMA >= 12 (20 mm, centré) ----
    if (vma >= VMA_SEUIL_COUREUR) {
        const img = await genererImageCoureur();
        if (img) {
            const imgSize = 20;
            doc.addImage(img, 'PNG', centreX - imgSize / 2, cursorY, imgSize, imgSize);
        }
    }
    // Espace réservé même sans picto pour garder un alignement identique
    cursorY += 21;

    // ---- Numéro géant ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(110);
    doc.setTextColor(0, 0, 0);
    doc.text(`#${eleve.dossard}`, centreX, cursorY + 42, { align: 'center' });
    cursorY += 46;

    // ---- Nom Prénom ----
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 20);
    doc.text(`${eleve.prenom} ${eleve.nom}`, centreX, cursorY + 5, { align: 'center' });
    cursorY += 10;

    // ---- Code-barres horizontal JUSTE SOUS LE NOM ----
    const barH = 22;
    const barW = Math.min(zoneW - 40, 120);
    const barX = centreX - barW / 2;

    try {
        const eanImg = await genererImageCodeBarres(ean, false);
        doc.addImage(eanImg, 'PNG', barX, cursorY, barW, barH);
    } catch (err) {
        console.warn('[Dossards] Erreur code-barres bas :', err);
    }
    cursorY += barH + 1;

    // ---- Numéro humain SOUS le code-barres (12 chiffres sans la clé) ----
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(eanSansCle, centreX, cursorY + 3, { align: 'center' });
    cursorY += 9;

    // ---- Classe + Catégorie ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(80, 80, 80);
    const cat = getCategorieCourse(eleve);
    doc.text(`Classe ${eleve.classe}  ·  ${cat.label}`, centreX, cursorY + 4, { align: 'center' });
    cursorY += 9;

    // ---- Contrat (2 lignes) ----
    const contrat = getContratLignes(vma);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(contrat.ligne1, centreX, cursorY + 4, { align: 'center' });
    doc.text(contrat.ligne2, centreX, cursorY + 11, { align: 'center' });
}

// ============================================================
// TEXTE DU CONTRAT (2 LIGNES) AVEC TEMPS CIBLE
// ============================================================
function getContratLignes(vma) {
    const distanceM = DISTANCE_CONTRAT_M;  // 2500 m

    if (!vma || vma <= 0) {
        return {
            ligne1: 'En gérant ton effort (80% VMA), adapte ton allure sur le parcours',
            ligne2: `Distance contrat : ${distanceM} m`
        };
    }

    // Vitesse cible à 80% VMA (km/h)
    const v80 = vma * 0.8;

    // Temps total = distance / vitesse (converti en minutes)
    const tempsMinTotal = (distanceM / 1000) / v80 * 60;
    // Mi-parcours (1250 m)
    const tempsMinMi = tempsMinTotal / 2;

    const fmt = (minutes) => {
        const m = Math.floor(minutes);
        const s = Math.round((minutes - m) * 60);
        // Cas où les secondes arrondissent à 60
        if (s >= 60) return `${m + 1}mn00`;
        return `${m}mn${s}`;
    };

    return {
        ligne1: `En gérant ton effort (80% VMA), tu es capable de réaliser le parcours en moins de ${fmt(tempsMinTotal)}`,
        ligne2: `Temps estimé à mi-parcours : ${fmt(tempsMinMi)}`
    };
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

        // Rotation 90°
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
// PICTOGRAMME COUREUR (emoji rendu via canvas)
// ============================================================
let _cacheCoureur = null;
function genererImageCoureur() {
    if (_cacheCoureur) return Promise.resolve(_cacheCoureur);

    return new Promise((resolve) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 256, 256);
            ctx.font = '220px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏃', 128, 138);
            _cacheCoureur = canvas.toDataURL('image/png');
            resolve(_cacheCoureur);
        } catch (err) {
            console.warn('[Dossards] Emoji coureur non disponible :', err);
            resolve(null);
        }
    });
}

// ============================================================
// CATÉGORIE DE COURSE
// ============================================================
function getCategorieCourse(eleve) {
    const niveau = getNiveauFromClasse(eleve.classe);
    const course = COURSES_DEFAUT.find(c =>
        c.sexe === eleve.sexe && c.niveaux.includes(niveau)
    );
    if (!course) return { label: '—', course };
    return { label: course.label, course };
}

// ============================================================
// IMPORT CSV
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

        existants.forEach(el => {
            if (el.codeAutoEval === undefined || el.codeAutoEval === null) {
                let code = 1;
                while (existants.some(x => x.codeAutoEval === code)) code++;
                el.codeAutoEval = code;
            }
        });

        saveEleves(classe, existants);
    });

    const actuelles = getClassesParticipantes();
    const nouvelles = Array.from(new Set([...actuelles, ...Object.keys(parClasse)]));
    setClassesParticipantes(nouvelles);

    attribuerDossardsManquants();

    alert(`✅ Import terminé !\n\n${nbCrees} élève(s) créé(s)\n${nbModifies} élève(s) mis à jour\n${Object.keys(parClasse).length} classe(s)\n\nDossards attribués automatiquement.`);

    const c = document.getElementById('cross-content');
    if (c) initCrossDossards(c);
}

// ============================================================
// ATTRIBUTION AUTO DES DOSSARDS MANQUANTS
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

    const tous = [...elevesExistants, ...nouveaux];
    tous.forEach(el => {
        if (el.codeAutoEval === undefined || el.codeAutoEval === null) {
            let code = 1;
            while (tous.some(x => x !== el && x.codeAutoEval === code)) code++;
            el.codeAutoEval = code;
        }
    });

    saveEleves(classe, tous);

    const actuelles = getClassesParticipantes();
    if (!actuelles.includes(classe)) {
        setClassesParticipantes([...actuelles, classe]);
    }

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
// ============================================================
// GÉNÉRATION D'UN CROSS COMPLET (élèves + dossards + arrivées)
// ============================================================
const NOMS_SIMULATION = [
    'MARTIN', 'BERNARD', 'DUBOIS', 'THOMAS', 'ROBERT', 'RICHARD', 'PETIT', 'DURAND',
    'LEROY', 'MOREAU', 'SIMON', 'LAURENT', 'LEFEBVRE', 'MICHEL', 'GARCIA', 'DAVID',
    'BERTRAND', 'ROUX', 'VINCENT', 'FOURNIER', 'MOREL', 'GIRARD', 'ANDRE', 'LEFEVRE',
    'MERCIER', 'DUPONT', 'LAMBERT', 'BONNET', 'FRANCOIS', 'MARTINEZ', 'LEGRAND', 'GARNIER',
    'FAURE', 'ROUSSEAU', 'BLANC', 'GUERIN', 'MULLER', 'HENRY', 'ROUSSEL', 'NICOLAS',
    'PERRIN', 'MORIN', 'MATHIEU', 'CLEMENT', 'GAUTHIER', 'DUMONT', 'LOPEZ', 'FONTAINE',
    'CHEVALIER', 'ROBIN', 'MASSON', 'SANCHEZ', 'GERARD', 'NGUYEN', 'BOYER', 'DENIS',
    'LEMAIRE', 'DUVAL', 'JULIEN', 'GAUTIER', 'ROGER', 'ROCHE', 'ROY', 'NOEL',
    'MEYER', 'LUCAS', 'MEUNIER', 'JEAN', 'PEREZ', 'MARCHAND', 'DUFOUR', 'BLANCHARD',
    'MARIE', 'BARBIER', 'BRUN', 'DUMAS', 'BRUNET', 'SCHMITT', 'REY', 'BLANCHET',
    'THIBAULT', 'CARON', 'COLIN', 'VIDAL', 'CARPENTIER', 'PICARD', 'RENAUD', 'LACROIX'
];

const PRENOMS_M_SIMULATION = [
    'Lucas', 'Hugo', 'Léo', 'Nathan', 'Théo', 'Enzo', 'Mathis', 'Tom', 'Louis', 'Gabriel',
    'Adam', 'Raphaël', 'Arthur', 'Jules', 'Paul', 'Maxime', 'Antoine', 'Alexandre', 'Ethan', 'Baptiste',
    'Clément', 'Quentin', 'Romain', 'Timéo', 'Noah', 'Sacha', 'Maël', 'Aaron', 'Eliott', 'Rayan',
    'Yanis', 'Marius', 'Titouan', 'Evan', 'Mathéo', 'Noé', 'Thomas', 'Nolan', 'Ayden', 'Ilan'
];

const PRENOMS_F_SIMULATION = [
    'Emma', 'Léa', 'Chloé', 'Manon', 'Camille', 'Sarah', 'Louise', 'Jade', 'Alice', 'Lina',
    'Rose', 'Anna', 'Inès', 'Zoé', 'Mila', 'Léna', 'Juliette', 'Ambre', 'Lou', 'Mya',
    'Nina', 'Clara', 'Maëlys', 'Éva', 'Charlotte', 'Romane', 'Lola', 'Capucine', 'Océane', 'Yasmine',
    'Alicia', 'Assia', 'Léana', 'Solène', 'Victoire', 'Apolline', 'Faustine', 'Adèle', 'Anouk', 'Élise'
];

function _genererEleveSimule(usedIds) {
    const sexe = Math.random() < 0.5 ? 'M' : 'F';
    const prenom = sexe === 'M'
        ? PRENOMS_M_SIMULATION[Math.floor(Math.random() * PRENOMS_M_SIMULATION.length)]
        : PRENOMS_F_SIMULATION[Math.floor(Math.random() * PRENOMS_F_SIMULATION.length)];
    const nom = NOMS_SIMULATION[Math.floor(Math.random() * NOMS_SIMULATION.length)];

    let baseId = `${nom}_${prenom.charAt(0)}`;
    let id = baseId;
    let suffixe = 0;
    while (usedIds.has(id)) {
        suffixe++;
        id = `${baseId}${suffixe}`;
    }
    usedIds.add(id);

    // VMA : distribution normale centrée sur 12, écart-type ~2, bornée 8-18
    const gauss = (Math.random() + Math.random() + Math.random() - 1.5) * 2.5;
    const vma = Math.max(8, Math.min(18, Math.round((12 + gauss) * 10) / 10));

    return {
        id,
        nom,
        prenom,
        sexe,
        dateNaissance: '',
        vma,
        palier: 0,
        longueur: null,
        sprint30: null,
        force: 0,
        commentaire: '',
        codeAutoEval: 0
    };
}

window.crossSimulerCrossComplet = async function() {
    if (!confirm('🌊 GÉNÉRATION D\'UN CROSS COMPLET\n\nCela va :\n- Générer des élèves fictifs dans plusieurs classes\n- Attribuer des dossards\n- Simuler des arrivées sur les 4 courses\n\n⚠️ Les données cross actuelles seront REMPLACÉES.\n\nContinuer ?')) return;

    const nbClassesParNiveau = Math.min(10, parseInt(prompt('Nombre de classes PAR NIVEAU (max 10) ?\n\n→ 8 = configuration réaliste d\'un collège\n→ Total = 4 × ce nombre', '8')) || 8);
    const nbParClasse = Math.min(30, parseInt(prompt('Élèves par classe (max 30) ?', '25')) || 25);

    const nbTotalClasses = nbClassesParNiveau * 4;
    const nbTotalEleves = nbTotalClasses * nbParClasse;

    console.log(`🌊 Simulation : ${nbTotalClasses} classes × ${nbParClasse} élèves = ${nbTotalEleves} élèves`);

    // --- Construction des classes : 601 à 60X, puis 501 à 50X, etc. ---
    const niveaux = ['6', '5', '4', '3'];
    const classes = [];
    for (const niveau of niveaux) {
        for (let i = 1; i <= nbClassesParNiveau; i++) {
            classes.push(`${niveau}0${i}`);   // 601, 602, ... puis 501, 502...
        }
    }
    console.log(`Classes : ${classes.join(', ')}`);

    // --- Nettoyage des données cross ---
    localStorage.removeItem('eps_arena_cross_dossards');
    localStorage.removeItem('eps_arena_cross_dossards_inv');
    localStorage.removeItem('eps_arena_cross_statuts');
    localStorage.removeItem('eps_arena_cross_classes');

    // --- Génération des élèves + dossards ---
    const usedIds = new Set();
    const elevesParClasse = {};
    const dossards = {};
    const invDossards = {};
    let dossardCourant = 1;

    // Attribution des dossards par ordre alphabétique global (classe puis nom)
    for (const classe of classes) {
        const eleves = [];
        for (let i = 0; i < nbParClasse; i++) {
            const e = _genererEleveSimule(usedIds);
            e.codeAutoEval = i + 1;
            eleves.push(e);
        }
        // Tri alphabétique interne
        eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
        eleves.forEach((e, idx) => { e.codeAutoEval = idx + 1; });
        elevesParClasse[classe] = eleves;
    }

    // Attribution des dossards (ordre : classe puis nom)
    for (const classe of classes) {
        for (const e of elevesParClasse[classe]) {
            dossards[String(dossardCourant)] = e.id;
            invDossards[e.id] = String(dossardCourant);
            dossardCourant++;
        }
    }

    // --- Sauvegarde locale ---
    for (const [classe, eleves] of Object.entries(elevesParClasse)) {
        saveEleves(classe, eleves);
    }
    localStorage.setItem('eps_arena_cross_dossards', JSON.stringify(dossards));
    localStorage.setItem('eps_arena_cross_dossards_inv', JSON.stringify(invDossards));
    localStorage.setItem('eps_arena_cross_classes', JSON.stringify(classes));
    localStorage.setItem('eps_arena_cross_statuts', JSON.stringify({}));

    console.log(`✅ ${nbTotalEleves} élèves et ${dossardCourant - 1} dossards sauvegardés`);

    // --- Simulation Firebase ---
    const COURSES_SIM = [
        { id: 'course1', sexe: 'F', niveaux: ['6', '5'], label: '6e+5e Filles' },
        { id: 'course2', sexe: 'M', niveaux: ['6', '5'], label: '6e+5e Garçons' },
        { id: 'course3', sexe: 'F', niveaux: ['4', '3'], label: '4e+3e Filles' },
        { id: 'course4', sexe: 'M', niveaux: ['4', '3'], label: '4e+3e Garçons' }
    ];

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/cross`;

    const { db: fdb, ref: fref, set: fset } = await import('../../core/firebase-service.js');

    // Reset des 4 courses
    for (const c of COURSES_SIM) {
        try {
            await fset(fref(fdb, `${basePath}/courses/${c.id}/go`), null);
            await fset(fref(fdb, `${basePath}/courses/${c.id}/arrivees`), null);
        } catch (e) {
            console.warn(`[Simu] Erreur reset ${c.id} :`, e);
        }
    }

    let totalArrivees = 0;
    const statsCourses = [];

    for (const course of COURSES_SIM) {
        // Sélection des élèves de cette course
        const elevesCourse = [];
        for (const [classe, eleves] of Object.entries(elevesParClasse)) {
            const niveau = classe.charAt(0);
            if (!course.niveaux.includes(niveau)) continue;
            for (const e of eleves) {
                if (e.sexe !== course.sexe) continue;
                const dossard = invDossards[e.id];
                elevesCourse.push({ ...e, dossard, niveau });
            }
        }

        if (elevesCourse.length === 0) continue;

        // Calcul des temps (corrélés à la VMA avec bruit réaliste)
        elevesCourse.forEach(e => {
            const baseFactor = 0.78 + (e.vma - 10) / 40;
            const bruit = (Math.random() - 0.5) * 0.15;
            const facteur = Math.max(0.68, Math.min(0.95, baseFactor + bruit));
            const vCible = e.vma * facteur;
            const tempsSec = (2500 / 1000) / vCible * 3600;
            e.tempsMs = Math.round(tempsSec * 1000);
        });

        // Tri par temps
        elevesCourse.sort((a, b) => a.tempsMs - b.tempsMs);

        // GO : il y a 20 minutes
        const goTimestamp = Date.now() - 20 * 60 * 1000;

        // Construction de l'objet arrivées
        const arrivees = {};
        elevesCourse.forEach((e, idx) => {
            const arriveeTs = goTimestamp + e.tempsMs;
            arrivees[`sim_${goTimestamp}_${idx}`] = {
                dossard: String(e.dossard),
                timestamp: arriveeTs,
                source: 'simulation'
            };
        });

        try {
            await fset(fref(fdb, `${basePath}/courses/${course.id}/go`), {
                timestamp: goTimestamp,
                profCode,
                simule: true
            });
            await fset(fref(fdb, `${basePath}/courses/${course.id}/arrivees`), arrivees);
            totalArrivees += elevesCourse.length;

            // Compter par niveau
            const nb6 = elevesCourse.filter(e => e.niveau === '6').length;
            const nb5 = elevesCourse.filter(e => e.niveau === '5').length;
            const nb4 = elevesCourse.filter(e => e.niveau === '4').length;
            const nb3 = elevesCourse.filter(e => e.niveau === '3').length;
            let detail = [];
            if (nb6) detail.push(`6e: ${nb6}`);
            if (nb5) detail.push(`5e: ${nb5}`);
            if (nb4) detail.push(`4e: ${nb4}`);
            if (nb3) detail.push(`3e: ${nb3}`);

            statsCourses.push(`${course.label} : ${elevesCourse.length} arrivées (${detail.join(' · ')})`);
            console.log(`✅ ${course.id} : ${elevesCourse.length} arrivées — ${detail.join(' · ')}`);
        } catch (err) {
            console.error(`❌ Erreur ${course.id} :`, err);
        }
    }

    // Transmission Firebase (config courses + élèves)
    try {
        const { transmettreCrossConfig } = await import('./cross-transmit.js');
        const res = await transmettreCrossConfig();
        console.log('✅ Config transmise aux iPads :', res);
    } catch (err) {
        console.warn('⚠️ Transmission config échouée :', err);
    }

    alert(`🌊 Simulation terminée !\n\n📊 Bilan :\n- ${nbTotalClasses} classes (${nbClassesParNiveau} par niveau)\n- ${nbTotalEleves} élèves\n- ${dossardCourant - 1} dossards attribués\n- ${totalArrivees} arrivées simulées\n\n${statsCourses.join('\n')}\n\nVa dans Cross → Course pour voir le résultat.`);

    // Rafraîchir l'interface
    const c = document.getElementById('cross-content');
    if (c) initCrossDossards(c);
};