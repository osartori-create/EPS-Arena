// src/js/carnet/unss.js
// UNSS — licenciés du sport scolaire (import XLSX extrait depuis le site de l'UNSS).
// Données (localStorage, RGPD) : eps_arena_unss = [{ numLicence, nom, prenom, classe, activitesUnss, ... }]

const KEY = 'eps_arena_unss';

let filtreRecherche = '';
let filtreClasse = '';
let filtreActivite = '';
let licencieEnCours = '';

function lireUnss() { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
function ecrireUnss(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

// Normalise pour comparer (minuscules, sans accents, sans espaces superflus).
function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

// Retrouve la licence UNSS d'un élève (classe + nom + prénom, insensible casse/accents).
export function getLicencieEleve(classe, nom, prenom) {
    return lireUnss().find(l =>
        norm(l.classe) === norm(classe) &&
        norm(l.nom) === norm(nom) &&
        norm(l.prenom) === norm(prenom)
    ) || null;
}

// --- Liaisons manuelles élève ↔ licencié (rapprochement) ---
const KEY_LIAISONS = 'eps_arena_unss_liaisons';

function lireLiaisons() { return JSON.parse(localStorage.getItem(KEY_LIAISONS) || '{}'); }
function ecrireLiaisons(d) { localStorage.setItem(KEY_LIAISONS, JSON.stringify(d)); }

export function lierEleveLicencie(eleveId, idLicencie) {
    const liaisons = lireLiaisons();
    liaisons[eleveId] = idLicencie;
    ecrireLiaisons(liaisons);
}
export function delierEleve(eleveId) {
    const liaisons = lireLiaisons();
    delete liaisons[eleveId];
    ecrireLiaisons(liaisons);
}

// Tous les élèves de toutes les classes (avec leur code classe).
function getAllEleves() {
    const classes = JSON.parse(localStorage.getItem('eps_arena_classes') || '[]');
    const all = [];
    classes.forEach(c => {
        JSON.parse(localStorage.getItem('eps_arena_eleves_' + c) || '[]').forEach(e => all.push({ ...e, classe: c }));
    });
    return all;
}

// Licence UNSS d'un élève : liaison manuelle prioritaire, sinon rapprochement auto (classe + nom + prénom).
export function getLicenceParEleve(eleve) {
    if (!eleve) return null;
    const liaisons = lireLiaisons();
    if (liaisons[eleve.id]) {
        const lic = lireUnss().find(l => String(l.idLicencie) === String(liaisons[eleve.id]));
        if (lic) return lic;
    }
    return getLicencieEleve(eleve.classe, eleve.nom, eleve.prenom);
}

function estRapproche(lic, eleves) {
    const liaisons = lireLiaisons();
    if (Object.values(liaisons).some(idl => String(idl) === String(lic.idLicencie))) return true;
    return eleves.some(e =>
        norm(e.classe) === norm(lic.classe) &&
        norm(e.nom) === norm(lic.nom) &&
        norm(e.prenom) === norm(lic.prenom)
    );
}

export function initUnssInterface() {
    render();
}

function parserUnssXLSX(buf) {
    const XLSX = window.XLSX;
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rows.length) return [];
    const header = rows[0].map(h => String(h).trim());
    const idx = (name) => header.findIndex(h => h === name);
    const licencies = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const nom = String(r[idx('Nom')] || '').trim();
        const prenom = String(r[idx('Prénom')] || '').trim();
        if (!nom && !prenom) continue;
        licencies.push({
            numLicence: r[idx('Numéro de licence')],
            nom,
            prenom,
            dateNaissance: String(r[idx('Date de naissance')] || ''),
            categorie: String(r[idx('Catégorie')] || ''),
            classe: String(r[idx('Classe')] || ''),
            niveauClasse: String(r[idx('Niveau Classe')] || ''),
            activitesUnss: String(r[idx('Activités UNSS')] || ''),
            typeLicence: String(r[idx('Type Licence')] || ''),
            etatParents: String(r[idx('Etat de la réponse des parents')] || ''),
            idLicencie: String(r[idx('ID licencié')] || ''),
        });
    }
    return licencies;
}

function render() {
    const container = document.getElementById('viewUnss');
    if (!container) return;
    const licencies = lireUnss();

    if (licencies.length === 0) {
        container.innerHTML = `
            <div class="bg-slate-800 p-10 rounded-2xl border border-slate-700 text-center text-slate-400">
                <p class="text-3xl mb-2">🏟️</p>
                <p class="font-bold">Aucun licencié UNSS importé.</p>
                <p class="text-xs mt-1 mb-4">Importe le fichier XLSX extrait depuis le site de l'UNSS.</p>
                <button onclick="window.unssImporter()" class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white">📥 Importer le fichier XLSX</button>
            </div>`;
        return;
    }

    const classes = [...new Set(licencies.map(l => l.classe).filter(Boolean))].sort();
    const activites = [...new Set(licencies.flatMap(l => l.activitesUnss.split(',').map(a => a.trim()).filter(Boolean)))].sort();
    const eleves = getAllEleves();
    const nonRapproches = licencies.filter(l => !estRapproche(l, eleves));

    let liste = licencies;
    if (filtreRecherche) {
        const q = filtreRecherche.toLowerCase();
        liste = liste.filter(l => (l.nom + ' ' + l.prenom).toLowerCase().includes(q));
    }
    if (filtreClasse) liste = liste.filter(l => l.classe === filtreClasse);
    if (filtreActivite) liste = liste.filter(l => l.activitesUnss.toLowerCase().includes(filtreActivite.toLowerCase()));
    liste.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    const badgesActivites = (l) => l.activitesUnss.split(',').map(a => a.trim()).filter(Boolean)
        .map(a => `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200">${a}</span>`).join(' ');

    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">🏟️ UNSS — Licenciés</h3>
                    <p class="text-xs text-slate-400 mt-1">${licencies.length} licencié(s) · ${classes.length} classe(s) · ${activites.length} activité(s)</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.unssImporter()" class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white">📥 Importer</button>
                    <button onclick="window.unssEffacer()" class="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white">🗑️ Effacer</button>
                </div>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-wrap gap-2 items-center">
                <input type="text" placeholder="🔍 Rechercher un élève…" value="${filtreRecherche}" oninput="window.unssFiltreRecherche(this.value)" class="flex-1 min-w-[180px] bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                <select onchange="window.unssFiltreClasse(this.value)" class="bg-slate-900 border border-slate-600 rounded px-2 py-2 text-xs font-bold text-white">
                    <option value="">Toutes les classes</option>
                    ${classes.map(c => `<option value="${c}" ${c === filtreClasse ? 'selected' : ''}>Classe ${c}</option>`).join('')}
                </select>
                <select onchange="window.unssFiltreActivite(this.value)" class="bg-slate-900 border border-slate-600 rounded px-2 py-2 text-xs font-bold text-white">
                    <option value="">Toutes les activités</option>
                    ${activites.map(a => `<option value="${a}" ${a === filtreActivite ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                            <th class="p-2 text-left">Élève</th>
                            <th class="p-2 text-center">Classe</th>
                            <th class="p-2 text-center">Catégorie</th>
                            <th class="p-2 text-left">Activités UNSS</th>
                            <th class="p-2 text-center">Licence</th>
                            <th class="p-2 text-center">Parents</th>
                            <th class="p-2 text-center">Rapproché</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${liste.map(l => `
                            <tr class="border-b border-slate-800 hover:bg-slate-700/30">
                                <td class="p-2 font-bold text-white">${l.prenom} ${l.nom}</td>
                                <td class="p-2 text-center text-slate-300">${l.classe}${l.niveauClasse ? ` (${l.niveauClasse})` : ''}</td>
                                <td class="p-2 text-center text-slate-300">${l.categorie || '—'}</td>
                                <td class="p-2">${badgesActivites(l) || '<span class="text-slate-500">—</span>'}</td>
                                <td class="p-2 text-center text-slate-400 text-xs">${l.numLicence || '—'}</td>
                                <td class="p-2 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${/valid/i.test(l.etatParents) ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}">${l.etatParents || '—'}</span></td>
                                <td class="p-2 text-center" title="${estRapproche(l, eleves) ? 'Rapproché d\'un élève' : 'Non rapproché'}">${estRapproche(l, eleves) ? '🏟️' : '⚠️'}</td>
                            </tr>
                        `).join('')}
                        ${liste.length === 0 ? '<tr><td colspan="7" class="p-4 text-center text-slate-500">Aucun résultat.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>

            ${nonRapproches.length ? `
            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-amber-600">
                <h4 class="text-xs font-black text-amber-400 uppercase mb-3">🔗 Élèves non rapprochés (${nonRapproches.length})</h4>
                <div class="space-y-1">
                    ${nonRapproches.map(l => `
                        <div class="flex items-center gap-2 py-1">
                            <span class="text-sm text-white">${l.prenom} ${l.nom}</span>
                            <span class="text-xs text-slate-400">(${l.classe || 'sans classe'})</span>
                            <button onclick="window.unssOuvrirRapprocher('${l.idLicencie}')" class="ml-auto bg-amber-600 hover:bg-amber-500 px-3 py-1 rounded-lg font-black text-xs text-white">🔗 Rapprocher</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function notifier(msg, ok = true) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);z-index:9999;max-width:90vw;padding:0.6rem 1rem;border-radius:0.75rem;font-weight:700;font-size:0.8rem;color:#fff;box-shadow:0 10px 25px rgba(0,0,0,.4);background:' + (ok ? '#059669' : '#dc2626') + ';';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}
window.notifier = notifier;

window.unssImporter = function() {
    const input = document.getElementById('unssFileInput');
    if (!input) { notifier("Champ d'import introuvable.", false); return; }
    input.value = ''; // réinitialise pour pouvoir réimporter le même fichier
    input.click();
};

window.unssTraiterImport = async function(ev) {
    const input = ev && ev.target;
    if (!input || !input.files || !input.files[0]) return;
    try {
        const buf = await input.files[0].arrayBuffer();
        const nouveaux = parserUnssXLSX(buf);
        if (nouveaux.length === 0) { notifier('Aucun licencié trouvé dans ce fichier.', false); return; }
        const existants = lireUnss();
        const map = new Map();
        const cle = (l) => String(l.idLicencie || l.numLicence || `${l.nom}|${l.prenom}|${l.classe}`);
        existants.forEach(l => map.set(cle(l), l));
        let ajoutes = 0;
        nouveaux.forEach(l => {
            const k = cle(l);
            if (!map.has(k)) ajoutes++;
            map.set(k, l);
        });
        ecrireUnss([...map.values()]);
        filtreRecherche = ''; filtreClasse = ''; filtreActivite = '';
        render();
        notifier(`✅ ${ajoutes} ajouté(s), ${nouveaux.length - ajoutes} mis à jour (${nouveaux.length} au total).`);
    } catch (err) {
        notifier('Erreur lors de la lecture du fichier XLSX.', false);
        console.error(err);
    }
};

window.unssEffacer = function() {
    if (confirm('Effacer toutes les données UNSS ?')) {
        ecrireUnss([]);
        filtreRecherche = ''; filtreClasse = ''; filtreActivite = '';
        render();
    }
};

window.unssFiltreRecherche = function(v) { filtreRecherche = v; render(); };
window.unssFiltreClasse = function(v) { filtreClasse = v; render(); };
window.unssFiltreActivite = function(v) { filtreActivite = v; render(); };

window.unssLier = function(idLicencie, eleveId) {
    if (!eleveId) return;
    lierEleveLicencie(eleveId, idLicencie);
    render();
};

window.unssOuvrirRapprocher = function(idLicencie) {
    licencieEnCours = idLicencie;
    const lic = lireUnss().find(l => String(l.idLicencie) === String(idLicencie));
    if (!lic) return;
    const classes = JSON.parse(localStorage.getItem('eps_arena_classes') || '[]');
    document.getElementById('unss-rap-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'unss-rap-modal';
    modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h3 class="text-lg font-black text-white">🔗 Rapprocher</h3>
                    <p class="text-xs text-slate-400">${lic.prenom} ${lic.nom}${lic.classe ? ' · ' + lic.classe : ''}</p>
                </div>
                <button onclick="document.getElementById('unss-rap-modal').remove()" class="bg-slate-700 px-3 py-1.5 rounded-lg font-black text-xs text-white">✖</button>
            </div>
            <label class="text-xs text-slate-400 block mb-1">1. Classe</label>
            <select id="unss-rap-classe" onchange="window.unssRapClasse()" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white mb-2">
                ${classes.map(c => `<option value="${c}" ${c === lic.classe ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <label class="text-xs text-slate-400 block mb-1">2. Élève</label>
            <input id="unss-rap-recherche" placeholder="🔍 Rechercher…" oninput="window.unssRapClasse()" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white mb-2">
            <div id="unss-rap-liste" class="space-y-1 max-h-72 overflow-y-auto"></div>
        </div>
    `;
    document.body.appendChild(modal);
    window.unssRapClasse();
};

window.unssRapClasse = function() {
    const classe = document.getElementById('unss-rap-classe')?.value;
    const q = (document.getElementById('unss-rap-recherche')?.value || '').toLowerCase();
    const eleves = getAllEleves().filter(e => {
        if (e.classe !== classe) return false;
        const nomComplet = (e.prenom + ' ' + e.nom).toLowerCase();
        const nomInverse = (e.nom + ' ' + e.prenom).toLowerCase();
        return !q || nomComplet.includes(q) || nomInverse.includes(q);
    });
    const cont = document.getElementById('unss-rap-liste');
    if (!cont) return;
    if (!eleves.length) {
        cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Aucun élève dans cette classe.</p>';
        return;
    }
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));
    cont.innerHTML = eleves.map(e => `
        <button onclick="window.unssRapValider('${e.id}')" class="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700">
            <span class="text-sm text-white font-bold">${e.prenom} ${e.nom}</span>
            ${e.ine ? `<span class="text-[10px] text-slate-400">INE ${e.ine}</span>` : ''}
            <span class="text-[10px] text-amber-400 font-black ml-auto">✓ Valider</span>
        </button>
    `).join('');
};

window.unssRapValider = function(eleveId) {
    if (!licencieEnCours || !eleveId) return;
    lierEleveLicencie(eleveId, licencieEnCours);
    document.getElementById('unss-rap-modal')?.remove();
    render();
    notifier('✅ Élève rapproché.');
};