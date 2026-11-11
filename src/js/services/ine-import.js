// src/js/services/ine-import.js
// Import de la liste officielle des élèves (SIECLE/STSweb) avec réconciliation par INE.
// Stratégie "chirurgicale" : aucune suppression, aucun changement d'id, écriture limitée
// aux champs d'identité (ine, nom, prénom, sexe, naissance, régime).
// Les contacts administratifs (représentants légaux, responsable financier) sont stockés
// à part dans eps_arena_admin_eleves, clé par INE (RGPD : tout reste en local).

import { getExistingEleves, saveEleves, migrerCodesAutoEval } from './admin-service.js';

const Papa = window.Papa;
const KEY_CLASSES = 'eps_arena_classes';
const KEY_ADMIN = 'eps_arena_admin_eleves';

function lireClasses() { return JSON.parse(localStorage.getItem(KEY_CLASSES) || '[]'); }
function lireAdmin() { return JSON.parse(localStorage.getItem(KEY_ADMIN) || '{}'); }
function ecrireAdmin(d) { localStorage.setItem(KEY_ADMIN, JSON.stringify(d)); }

function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function capPrenom(s) { const t = String(s || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ''; }
function majNom(s) { return String(s || '').trim().toUpperCase(); }

// Correspondance champs logiques -> libellés de colonnes du CSV institution.
const COLONNES = {
    ine: ['INE'],
    division: ['Division'],
    mef: ['MEF'],
    nom: ['Nom de famille'],
    prenom: ['Prénom 1', 'Prénom'],
    sexe: ['Sexe'],
    naissance: ['Date de naissance'],
    commune: ['Commune de naissance'],
    regime: ['Régime'],
    r1civ: ['Civilité repr. légal'],
    r1nom: ['Nom de famille repr. légal'],
    r1usage: ["Nom d'usage repr. légal"],
    r1prenom: ['Prénom repr. légal'],
    r1adresse: ['Ligne 3 Adresse légal'],
    r1cp: ['Code postal repr. légal'],
    r1commune: ['Commune repr. légal'],
    r1tel: ['Tel mobile repr. légal'],
    r1email: ['Courriel repr. légal'],
    fnom: ['Nom de famille resp. financ.'],
    fprenom: ['Prénom resp. financ.'],
    r2civ: ['Civilité autre repr. légal'],
    r2nom: ['Nom de famille autre repr. légal'],
    r2usage: ["Nom d'usage autre repr. légal"],
    r2prenom: ['Prénom autre repr. légal'],
    r2adresse: ['Ligne 3 Adresse autre légal'],
    r2cp: ['Code postal autre repr. légal'],
    r2commune: ['Commune autre repr. légal'],
    r2tel: ['Tel mobile autre repr. légal'],
    r2email: ['Courriel autre repr. légal'],
};

function resoudreColonnes(headers) {
    const map = {};
    const normH = headers.map(norm);
    for (const [field, mots] of Object.entries(COLONNES)) {
        let idx = -1;
        for (const m of mots) { idx = normH.indexOf(norm(m)); if (idx >= 0) break; }
        if (idx < 0) idx = normH.findIndex(h => mots.some(m => h.startsWith(norm(m))));
        if (idx >= 0) map[field] = headers[idx];
    }
    return map;
}

function tousLesEleves() {
    const all = [];
    lireClasses().forEach(c => getExistingEleves(c).forEach(e => all.push({ ...e, classe: c })));
    return all;
}

function genererId(nom, prenom, existants) {
    const base = `${norm(nom)}_${norm(prenom).charAt(0)}`;
    let id = base, i = 2;
    while (existants.some(e => e.id === id)) id = `${base}${i++}`;
    return id;
}

// Rapproche un élève du CSV vers un élève existant (ou statut nouveau/ambigu).
function statutRow(row, classeCible, all) {
    if (row.ine) {
        const parIne = all.find(e => String(e.ine) === row.ine);
        if (parIne) return { statut: 'ine', label: '✅ INE', eleve: parIne, classe: parIne.classe };
    }
    const n = norm(row.nom), p = norm(row.prenom);
    const dans = all.filter(e => e.classe === classeCible && norm(e.nom) === n && norm(e.prenom) === p);
    if (dans.length === 1) return { statut: 'nom', label: '✅ Nom', eleve: dans[0], classe: classeCible };
    if (dans.length > 1) return { statut: 'ambigu', label: '⚠️ Homonyme', eleve: null, classe: classeCible };
    const ailleurs = all.find(e => norm(e.nom) === n && norm(e.prenom) === p);
    if (ailleurs) return { statut: 'ailleurs', label: '⚠️ Autre classe', eleve: ailleurs, classe: ailleurs.classe };
    return { statut: 'nouveau', label: '➕ Nouveau', eleve: null, classe: classeCible };
}

function parserCSV(texte) {
    const sep = texte.includes(';') ? ';' : ',';
    const res = Papa.parse(texte, {
        delimiter: sep, header: true, skipEmptyLines: true,
        transformHeader: h => String(h).replace(/^\uFEFF/, '').trim()
    });
    if (res.errors && res.errors.length) throw new Error('Fichier illisible : ' + res.errors[0].message);
    const headers = res.meta.fields || [];
    const cols = resoudreColonnes(headers);
    if (!cols.nom || !cols.prenom || !cols.division) throw new Error('Colonnes obligatoires introuvables (Nom de famille, Prénom 1, Division).');
    const rows = [];
    res.data.forEach(r => {
        const nom = majNom(r[cols.nom]);
        const prenom = capPrenom(r[cols.prenom]);
        if (!nom || !prenom) return;
        const v = (f) => { const c = cols[f]; return c ? String(r[c] || '').trim() : ''; };
        rows.push({
            ine: v('ine'), division: v('division'), mef: v('mef'),
            nom, prenom, sexe: v('sexe').toUpperCase(), naissance: v('naissance'),
            commune: v('commune'), regime: v('regime'),
            legal1: { civ: v('r1civ'), nom: v('r1nom'), usage: v('r1usage'), prenom: v('r1prenom'), adresse: v('r1adresse'), cp: v('r1cp'), commune: v('r1commune'), tel: v('r1tel'), email: v('r1email') },
            legal2: { civ: v('r2civ'), nom: v('r2nom'), usage: v('r2usage'), prenom: v('r2prenom'), adresse: v('r2adresse'), cp: v('r2cp'), commune: v('r2commune'), tel: v('r2tel'), email: v('r2email') },
            financ: { nom: v('fnom'), prenom: v('fprenom') }
        });
    });
    return rows;
}

export function openImportINE() {
    const modal = document.createElement('div');
    modal.id = 'ine-import-modal';
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h3 class="text-xl font-black text-blue-400 uppercase">📋 Import liste élèves (INE)</h3>
                    <p class="text-[10px] text-amber-400">Réconciliation chirurgicale — photos, notes, indices de nage et évaluations existants sont intacts.</p>
                </div>
                <button onclick="window.closeImportINE()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white">✖ Fermer</button>
            </div>
            <div id="ine-zone1">
                <div id="ine-drop-zone" class="border-2 border-dashed border-slate-600 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                    <div class="text-4xl mb-2">📂</div>
                    <p class="text-slate-400">Clique ou glisse le fichier CSV (liste élèves institution)</p>
                    <input type="file" id="ine-file-input" accept=".csv" class="hidden">
                </div>
            </div>
            <div id="ine-zone2" class="hidden"></div>
            <div class="flex gap-3 mt-6">
                <button onclick="window.closeImportINE()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white text-sm">Annuler</button>
                <button id="ine-confirm" onclick="window.ineValider()" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm hidden">✅ Valider l'import</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const dropZone = document.getElementById('ine-drop-zone');
    const fileInput = document.getElementById('ine-file-input');
    const zone1 = document.getElementById('ine-zone1');
    const zone2 = document.getElementById('ine-zone2');
    const confirmBtn = document.getElementById('ine-confirm');

    let divisions = [];
    let mapping = {};

    window.closeImportINE = () => modal.remove();
    window.ineChoisirClasse = (div, v) => { mapping[div] = v; renderPreview(); };
    window.ineValider = () => valider();

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('border-blue-500'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('border-blue-500'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const texte = String(e.target.result).replace(/^\uFEFF/, '');
                const rows = parserCSV(texte);
                if (!rows.length) { alert('Aucun élève trouvé dans ce fichier.'); return; }
                const groupes = {};
                rows.forEach(r => { (groupes[r.division] = groupes[r.division] || []).push(r); });
                divisions = Object.keys(groupes)
                    .map(d => ({ division: d, mef: groupes[d][0].mef, rows: groupes[d] }))
                    .sort((a, b) => a.division.localeCompare(b.division));
                const classesExistantes = lireClasses();
                mapping = {};
                divisions.forEach(d => {
                    mapping[d.division] = classesExistantes.includes(d.division) ? d.division : '__NEW__' + d.division;
                });
                zone1.classList.add('hidden');
                zone2.classList.remove('hidden');
                confirmBtn.classList.remove('hidden');
                renderPreview();
            } catch (err) {
                alert('Erreur : ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    function renderPreview() {
        const all = tousLesEleves();
        const classesExistantes = lireClasses();
        let nbOK = 0, nbNouveau = 0, nbWarn = 0;
        const lignes = divisions.map(d => {
            const cible = mapping[d.division].replace(/^__NEW__/, '');
            const stats = { ine: 0, nom: 0, nouveau: 0, ambigu: 0, ailleurs: 0 };
            d.rows.forEach(r => { stats[statutRow(r, cible, all).statut]++; });
            nbOK += stats.ine + stats.nom; nbNouveau += stats.nouveau; nbWarn += stats.ambigu + stats.ailleurs;
            const opts = classesExistantes.map(c => `<option value="${c}" ${mapping[d.division] === c ? 'selected' : ''}>${c}</option>`).join('');
            return `<tr class="border-b border-slate-800">
                <td class="p-2 font-bold text-white">${d.division}</td>
                <td class="p-2 text-xs text-slate-400">${d.mef}</td>
                <td class="p-2 text-center text-xs">${d.rows.length}</td>
                <td class="p-2"><select onchange="window.ineChoisirClasse('${d.division}', this.value)" class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                    ${opts}
                    <option value="__NEW__${d.division}" ${mapping[d.division].startsWith('__NEW__') ? 'selected' : ''}>➕ Créer « ${d.division} »</option>
                </select></td>
                <td class="p-2 text-center text-[10px] whitespace-nowrap">✅${stats.ine + stats.nom} ➕${stats.nouveau} ⚠️${stats.ambigu + stats.ailleurs}</td>
            </tr>`;
        }).join('');

        const details = divisions.flatMap(d => {
            const cible = mapping[d.division].replace(/^__NEW__/, '');
            return d.rows.map(r => ({ ...r, classe: cible }));
        }).slice(0, 80).map(r => {
            const s = statutRow(r, r.classe, all);
            const couleur = s.statut === 'nouveau' ? 'text-blue-400' : (s.statut === 'ine' || s.statut === 'nom') ? 'text-emerald-400' : 'text-amber-400';
            return `<div class="flex items-center gap-2 text-xs py-0.5"><span class="${couleur} font-bold w-28 shrink-0">${s.label}</span><span class="text-white">${r.nom} ${r.prenom}</span><span class="text-slate-500">→ ${r.classe}</span></div>`;
        }).join('');

        const total = divisions.reduce((a, d) => a + d.rows.length, 0);

        zone2.innerHTML = `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
                <p class="text-sm text-slate-300">${total} élève(s) · ${divisions.length} division(s)</p>
                <p class="text-xs mt-1"><span class="text-emerald-400 font-bold">✅ ${nbOK} rapproché(s)</span> · <span class="text-blue-400 font-bold">➕ ${nbNouveau} nouveau(x)</span> · <span class="text-amber-400 font-bold">⚠️ ${nbWarn} à vérifier</span></p>
                <p class="text-[10px] text-slate-500 mt-2">Les élèves « ⚠️ » (homonyme ou présent dans une autre classe) ne seront ni créés ni modifiés automatiquement.</p>
            </div>
            <div class="overflow-x-auto mb-4">
                <table class="w-full text-xs">
                    <thead><tr class="bg-slate-800 text-slate-400"><th class="p-2 text-left">Division</th><th class="p-2 text-left">MEF</th><th class="p-2 text-center">Élèves</th><th class="p-2 text-left">Classe EPS-Arena</th><th class="p-2 text-center">Résultat</th></tr></thead>
                    <tbody>${lignes}</tbody>
                </table>
            </div>
            <details class="mb-4">
                <summary class="text-xs font-bold text-slate-400 cursor-pointer">Voir le détail (${Math.min(total, 80)}/${total})</summary>
                <div class="mt-2 space-y-0.5 max-h-64 overflow-y-auto bg-slate-800/50 p-3 rounded-xl">${details}</div>
            </details>
        `;
    }

    function valider() {
        const all = tousLesEleves();
        const admin = lireAdmin();
        let classes = lireClasses();
        const classeExistante = new Set(classes);
        let nbMAJ = 0, nbNouveau = 0, nbIgnore = 0;
        const travail = {};

        divisions.forEach(d => {
            const cible = mapping[d.division].replace(/^__NEW__/, '');
            if (!classeExistante.has(cible)) { classeExistante.add(cible); classes.push(cible); }
        });
        localStorage.setItem(KEY_CLASSES, JSON.stringify(classes));

        divisions.forEach(d => {
            const cible = mapping[d.division].replace(/^__NEW__/, '');
            if (!travail[cible]) travail[cible] = { eleves: getExistingEleves(cible), touche: false, nouveaux: false };
            d.rows.forEach(row => {
                const s = statutRow(row, cible, all);
                if (s.statut === 'nouveau') {
                    const id = genererId(row.nom, row.prenom, travail[cible].eleves);
                    const e = {
                        id, nom: row.nom, prenom: row.prenom, sexe: row.sexe,
                        dateNaissance: row.naissance, ine: row.ine || undefined, regime: row.regime,
                        vma: 0, palier: 0, longueur: null, sprint30: null, force: 0
                    };
                    travail[cible].eleves.push(e);
                    all.push({ ...e, classe: cible });
                    travail[cible].touche = true; travail[cible].nouveaux = true;
                    nbNouveau++;
                } else if (s.statut === 'ine' || s.statut === 'nom') {
                    const classeEleve = s.classe;
                    if (!travail[classeEleve]) travail[classeEleve] = { eleves: getExistingEleves(classeEleve), touche: false, nouveaux: false };
                    const c = travail[classeEleve].eleves.find(x => x.id === s.eleve.id);
                    if (c) {
                        if (row.ine) c.ine = row.ine;
                        c.nom = row.nom;
                        c.prenom = row.prenom;
                        if (row.sexe) c.sexe = row.sexe;
                        if (row.naissance) c.dateNaissance = row.naissance;
                        if (row.regime) c.regime = row.regime;
                        travail[classeEleve].touche = true;
                        nbMAJ++;
                    }
                } else {
                    nbIgnore++;
                }
                if (row.ine) {
                    admin[row.ine] = {
                        nom: row.nom, prenom: row.prenom, sexe: row.sexe,
                        naissance: row.naissance, commune: row.commune, regime: row.regime,
                        legal1: row.legal1, legal2: row.legal2, financ: row.financ
                    };
                }
            });
        });

        Object.keys(travail).forEach(classe => {
            if (travail[classe].touche) saveEleves(classe, travail[classe].eleves);
            if (travail[classe].nouveaux) migrerCodesAutoEval(classe);
        });
        ecrireAdmin(admin);

        zone2.innerHTML = `
            <div class="bg-emerald-900/40 p-5 rounded-2xl border-2 border-emerald-600 text-center">
                <p class="text-2xl mb-2">✅</p>
                <p class="font-black text-emerald-300 text-sm">Import terminé</p>
                <p class="text-xs text-slate-300 mt-2">${nbMAJ} rapproché(s) · ${nbNouveau} créé(s) · ${nbIgnore} ignoré(s) (homonymes / autre classe)</p>
                <p class="text-[10px] text-slate-500 mt-2">Photos, notes, indices de nage et évaluations existants sont intacts.</p>
            </div>
        `;
        confirmBtn.classList.add('hidden');
    }
}

