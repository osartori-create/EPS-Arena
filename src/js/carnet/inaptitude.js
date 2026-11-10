// src/js/carnet/inaptitude.js
// Gestion des inaptitudes (ponctuelle / médicale) + fenêtre de saisie.
// ⚠️ Données nominatives → localStorage uniquement (RGPD), jamais Firebase.
// Clé : eps_arena_inaptitudes_<classe>  →  { [eleveId]: { type, motif, zone, dateDebut, dateFin, commentaire } }

const STORAGE_PREFIX = 'eps_arena_inaptitudes_';

export const MOTIFS_PONCTUELS = [
    { id: 'fin_maladie', label: 'Fin de maladie', icon: '🤒' },
    { id: 'feminin', label: 'Problème féminin', icon: '🌸' },
    { id: 'douleur', label: 'Mal à un endroit', icon: '💢' },
];

let currentClasse = '';

export function setClasseInaptitude(classe) { currentClasse = classe; }

function lire() { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + currentClasse) || '{}'); }
function ecrire(data) { localStorage.setItem(STORAGE_PREFIX + currentClasse, JSON.stringify(data)); }

export function getInaptitude(eleveId) { return lire()[eleveId] || null; }

export function sauvegarderInaptitude(eleveId, data) {
    const all = lire();
    all[eleveId] = data;
    ecrire(all);
}

function formaterDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${j}`;
}

// Jours restants (null si pas de date de fin). Négatif = terminée.
export function calculerTempsRestant(inapt) {
    if (!inapt || !inapt.dateFin) return null;
    const fin = new Date(inapt.dateFin + 'T12:00:00');
    const auj = new Date(); auj.setHours(12, 0, 0, 0);
    return Math.round((fin - auj) / (1000 * 60 * 60 * 24));
}

export function libelleInaptitude(inapt) {
    if (!inapt) return '';
    if (inapt.type === 'medicale') {
        const j = calculerTempsRestant(inapt);
        let s = 'Inapt. médicale';
        if (j !== null && j >= 0) s += ` · ${j} j restants`;
        else if (j !== null && j < 0) s += ' · terminée';
        if (inapt.commentaire) s += ` — ${inapt.commentaire}`;
        return s;
    }
    const motif = MOTIFS_PONCTUELS.find(m => m.id === inapt.motif);
    let s = motif ? motif.label : 'Inapte';
    if (inapt.zone) s += ` (${inapt.zone})`;
    return s;
}

// ============================================================
// FENÊTRE DE SAISIE
// ============================================================
export function ouvrirModalInaptitude(eleve, onSave) {
    const existant = getInaptitude(eleve.id) || {};
    const initial = {
        type: existant.type || 'ponctuelle',
        motif: existant.motif || 'fin_maladie',
        zone: existant.zone || '',
        dateDebut: existant.dateDebut || formaterDate(new Date()),
        dateFin: existant.dateFin || '',
        commentaire: existant.commentaire || ''
    };

    const overlay = document.createElement('div');
    overlay.id = 'inaptitude-modal';
    overlay.className = 'fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-lg my-8">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-xl font-black text-purple-400 uppercase">🩹 Inaptitude</h2>
                    <p class="text-sm font-bold text-white">${eleve.prenom} ${eleve.nom}</p>
                </div>
                <button onclick="document.getElementById('inaptitude-modal').remove()" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white text-sm">✖</button>
            </div>

            <div class="flex gap-2 mb-4">
                <button onclick="window.inaptChoisirType('ponctuelle')" id="inapt-tab-ponctuelle" class="flex-1 py-2 rounded-xl font-black text-sm">Ponctuelle (parents)</button>
                <button onclick="window.inaptChoisirType('medicale')" id="inapt-tab-medicale" class="flex-1 py-2 rounded-xl font-black text-sm">Médicale (médecin)</button>
            </div>

            <div id="inapt-ponctuelle" class="space-y-3">
                <p class="text-xs text-slate-400 uppercase font-bold">Motif</p>
                <div class="grid grid-cols-1 gap-2">
                    ${MOTIFS_PONCTUELS.map(m => `
                        <button onclick="window.inaptChoisirMotif('${m.id}')" id="inapt-motif-${m.id}" class="flex items-center gap-2 p-3 rounded-xl text-left font-bold text-sm">${m.icon} ${m.label}</button>
                    `).join('')}
                </div>
                <div id="inapt-zone-container" class="hidden">
                    <label class="text-xs text-slate-400 uppercase font-bold">Zone douloureuse</label>
                    <input type="text" id="inapt-zone" placeholder="ex : poignet droit, genou…" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1">
                </div>
            </div>

            <div id="inapt-medicale" class="space-y-3 hidden">
                <div>
                    <label class="text-xs text-slate-400 uppercase font-bold">Date de début</label>
                    <input type="date" id="inapt-date-debut" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-slate-400 uppercase font-bold">Durée (semaines)</label>
                        <input type="number" id="inapt-duree" min="0" placeholder="ex : 4" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 uppercase font-bold">OU date de fin</label>
                        <input type="date" id="inapt-date-fin" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1">
                    </div>
                </div>
                <div>
                    <label class="text-xs text-slate-400 uppercase font-bold">Commentaire (ex : natation, course, poignet droit)</label>
                    <textarea id="inapt-commentaire" rows="2" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1"></textarea>
                </div>
            </div>

            <div class="flex gap-3 mt-6">
                <button onclick="document.getElementById('inaptitude-modal').remove()" class="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-black text-white text-sm">Annuler</button>
                <button onclick="window.inaptValider('${eleve.id}')" class="flex-1 bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-black text-white text-sm">Valider</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    window._inaptType = initial.type;
    window._inaptMotif = initial.motif;
    window._inaptOnSave = onSave;

    document.getElementById('inapt-date-debut').value = initial.dateDebut;
    document.getElementById('inapt-zone').value = initial.zone;
    document.getElementById('inapt-commentaire').value = initial.commentaire;
    if (initial.dateFin) document.getElementById('inapt-date-fin').value = initial.dateFin;

    window.inaptChoisirType(initial.type);
}

window.inaptChoisirType = function(type) {
    window._inaptType = type;
    document.getElementById('inapt-ponctuelle').classList.toggle('hidden', type !== 'ponctuelle');
    document.getElementById('inapt-medicale').classList.toggle('hidden', type !== 'medicale');
    document.getElementById('inapt-tab-ponctuelle').className = 'flex-1 py-2 rounded-xl font-black text-sm ' + (type === 'ponctuelle' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400');
    document.getElementById('inapt-tab-medicale').className = 'flex-1 py-2 rounded-xl font-black text-sm ' + (type === 'medicale' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400');
    window.inaptRafraichirMotifs();
};

window.inaptChoisirMotif = function(motif) {
    window._inaptMotif = motif;
    window.inaptRafraichirMotifs();
};

window.inaptRafraichirMotifs = function() {
    MOTIFS_PONCTUELS.forEach(m => {
        const btn = document.getElementById('inapt-motif-' + m.id);
        if (btn) btn.className = 'flex items-center gap-2 p-3 rounded-xl text-left font-bold text-sm ' + (window._inaptMotif === m.id ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400');
    });
    const zoneC = document.getElementById('inapt-zone-container');
    if (zoneC) zoneC.classList.toggle('hidden', window._inaptMotif !== 'douleur');
};

window.inaptValider = function(eleveId) {
    const type = window._inaptType;
    const data = { type, motif: null, zone: '', dateDebut: null, dateFin: null, commentaire: '' };
    if (type === 'ponctuelle') {
        data.motif = window._inaptMotif;
        data.zone = document.getElementById('inapt-zone').value.trim();
    } else {
        data.dateDebut = document.getElementById('inapt-date-debut').value;
        const duree = parseInt(document.getElementById('inapt-duree').value, 10);
        const dateFin = document.getElementById('inapt-date-fin').value;
        if (dateFin) {
            data.dateFin = dateFin;
        } else if (duree > 0) {
            const d = new Date(data.dateDebut + 'T12:00:00');
            d.setDate(d.getDate() + duree * 7);
            data.dateFin = formaterDate(d);
        }
        data.commentaire = document.getElementById('inapt-commentaire').value.trim();
    }
    document.getElementById('inaptitude-modal').remove();
    if (window._inaptOnSave) window._inaptOnSave(data);
};
