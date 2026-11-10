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

// Zones du corps pour la silhouette (face et dos). Coordonnées SVG 200×380.
const ZONES = {
    face: [
        { id: 'tete', label: 'Tête', x: 100, y: 32, rx: 22, ry: 22 },
        { id: 'cou', label: 'Cou', x: 100, y: 58, rx: 11, ry: 11 },
        { id: 'epaule_g', label: 'Épaule gauche', x: 68, y: 82, rx: 20, ry: 12 },
        { id: 'epaule_d', label: 'Épaule droite', x: 132, y: 82, rx: 20, ry: 12 },
        { id: 'poitrine', label: 'Poitrine', x: 100, y: 110, rx: 32, ry: 25 },
        { id: 'ventre', label: 'Ventre', x: 100, y: 155, rx: 28, ry: 23 },
        { id: 'coude_g', label: 'Coude gauche', x: 50, y: 140, rx: 10, ry: 10 },
        { id: 'coude_d', label: 'Coude droit', x: 150, y: 140, rx: 10, ry: 10 },
        { id: 'poignet_g', label: 'Poignet gauche', x: 42, y: 190, rx: 8, ry: 8 },
        { id: 'poignet_d', label: 'Poignet droit', x: 158, y: 190, rx: 8, ry: 8 },
        { id: 'hanche_g', label: 'Hanche gauche', x: 84, y: 195, rx: 14, ry: 14 },
        { id: 'hanche_d', label: 'Hanche droite', x: 116, y: 195, rx: 14, ry: 14 },
        { id: 'cuisse_g', label: 'Cuisse gauche', x: 84, y: 245, rx: 15, ry: 26 },
        { id: 'cuisse_d', label: 'Cuisse droite', x: 116, y: 245, rx: 15, ry: 26 },
        { id: 'genou_g', label: 'Genou gauche', x: 84, y: 295, rx: 12, ry: 12 },
        { id: 'genou_d', label: 'Genou droit', x: 116, y: 295, rx: 12, ry: 12 },
        { id: 'cheville_g', label: 'Cheville gauche', x: 84, y: 348, rx: 8, ry: 8 },
        { id: 'cheville_d', label: 'Cheville droite', x: 116, y: 348, rx: 8, ry: 8 },
    ],
    dos: [
        { id: 'nuque', label: 'Nuque', x: 100, y: 58, rx: 11, ry: 11 },
        { id: 'epaule_g', label: 'Épaule gauche', x: 68, y: 82, rx: 20, ry: 12 },
        { id: 'epaule_d', label: 'Épaule droite', x: 132, y: 82, rx: 20, ry: 12 },
        { id: 'dos_haut', label: 'Haut du dos', x: 100, y: 110, rx: 32, ry: 25 },
        { id: 'lombaire', label: 'Bas du dos (lombaires)', x: 100, y: 155, rx: 28, ry: 23 },
        { id: 'coude_g', label: 'Coude gauche', x: 50, y: 140, rx: 10, ry: 10 },
        { id: 'coude_d', label: 'Coude droit', x: 150, y: 140, rx: 10, ry: 10 },
        { id: 'poignet_g', label: 'Poignet gauche', x: 42, y: 190, rx: 8, ry: 8 },
        { id: 'poignet_d', label: 'Poignet droit', x: 158, y: 190, rx: 8, ry: 8 },
        { id: 'fesse_g', label: 'Fesse gauche', x: 84, y: 195, rx: 14, ry: 14 },
        { id: 'fesse_d', label: 'Fesse droite', x: 116, y: 195, rx: 14, ry: 14 },
        { id: 'cuisse_g', label: 'Cuisse gauche', x: 84, y: 245, rx: 15, ry: 26 },
        { id: 'cuisse_d', label: 'Cuisse droite', x: 116, y: 245, rx: 15, ry: 26 },
        { id: 'genou_g', label: 'Genou gauche', x: 84, y: 295, rx: 12, ry: 12 },
        { id: 'genou_d', label: 'Genou droit', x: 116, y: 295, rx: 12, ry: 12 },
        { id: 'cheville_g', label: 'Cheville gauche', x: 84, y: 348, rx: 8, ry: 8 },
        { id: 'cheville_d', label: 'Cheville droite', x: 116, y: 348, rx: 8, ry: 8 },
    ],
};

function labelZone(zoneId) {
    if (!zoneId) return '';
    for (const vue of Object.values(ZONES)) {
        const z = vue.find(x => x.id === zoneId);
        if (z) return z.label;
    }
    return zoneId;
}

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
    if (inapt.zone) s += ` (${labelZone(inapt.zone)})`;
    return s;
}

// ============================================================
// SILHOUETTE CLIQUABLE
// ============================================================
function rendererSilhouette() {
    const container = document.getElementById('inapt-silhouette');
    if (!container) return;
    const vue = window._inaptVue || 'face';
    const zones = ZONES[vue];
    const selected = window._inaptZone || '';
    const nom = zones.find(z => z.id === selected)?.label || '';

    container.innerHTML = `
        <svg viewBox="0 0 200 380" class="w-full max-w-[230px] mx-auto">
            <defs>
                <linearGradient id="corpsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#94a3b8"/>
                    <stop offset="100%" stop-color="#475569"/>
                </linearGradient>
            </defs>
            <!-- Corps -->
            <g fill="url(#corpsGrad)" stroke="#1e293b" stroke-width="1.5">
                <circle cx="100" cy="32" r="22"/>
                <rect x="89" y="49" width="22" height="18" rx="7"/>
                <ellipse cx="100" cy="130" rx="37" ry="60"/>
                <ellipse cx="84" cy="196" rx="16" ry="15"/>
                <ellipse cx="116" cy="196" rx="16" ry="15"/>
            </g>
            <!-- Bras -->
            <g stroke="#64748b" stroke-width="15" stroke-linecap="round" fill="none">
                <path d="M64 82 L50 140 L42 190"/>
                <path d="M136 82 L150 140 L158 190"/>
            </g>
            <!-- Jambes -->
            <g stroke="#64748b" stroke-width="17" stroke-linecap="round" fill="none">
                <path d="M84 210 L84 270 L84 340"/>
                <path d="M116 210 L116 270 L116 340"/>
            </g>
            <!-- Zones cliquables -->
            ${zones.map(z => `
                <ellipse cx="${z.x}" cy="${z.y}" rx="${z.rx}" ry="${z.ry}"
                         fill="${selected === z.id ? '#a78bfa' : 'rgba(255,255,255,0.16)'}"
                         stroke="${selected === z.id ? '#ede9fe' : 'rgba(255,255,255,0.22)'}"
                         stroke-width="2" style="cursor:pointer"
                         onclick="window.inaptChoisirZone('${z.id}')">
                    <title>${z.label}</title>
                </ellipse>
            `).join('')}
        </svg>
    `;

    const labelEl = document.getElementById('inapt-zone-label');
    if (labelEl) labelEl.textContent = nom ? `Zone : ${nom}` : 'Clique sur la zone douloureuse';
}

window.inaptChoisirVue = function(vue) {
    window._inaptVue = vue;
    document.getElementById('inapt-vue-face').className = 'flex-1 py-2 rounded-xl font-black text-xs ' + (vue === 'face' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400');
    document.getElementById('inapt-vue-dos').className = 'flex-1 py-2 rounded-xl font-black text-xs ' + (vue === 'dos' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400');
    rendererSilhouette();
};

window.inaptChoisirZone = function(zoneId) {
    window._inaptZone = zoneId;
    rendererSilhouette();
};

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
                    <p class="text-xs text-slate-400 uppercase font-bold">Zone douloureuse</p>
                    <div class="flex gap-2 mb-2">
                        <button onclick="window.inaptChoisirVue('face')" id="inapt-vue-face" class="flex-1 py-2 rounded-xl font-black text-xs">Face</button>
                        <button onclick="window.inaptChoisirVue('dos')" id="inapt-vue-dos" class="flex-1 py-2 rounded-xl font-black text-xs">Dos</button>
                    </div>
                    <div id="inapt-silhouette" class="bg-slate-800 rounded-2xl p-2"></div>
                    <p id="inapt-zone-label" class="text-center text-xs font-bold text-purple-300 mt-2"></p>
                </div>
                <div>
                    <label class="text-xs text-slate-400 uppercase font-bold">Champ libre</label>
                    <input type="text" id="inapt-commentaire-ponctuelle" placeholder="Remarque éventuelle…" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1">
                </div>
            </div>

            <div id="inapt-medicale" class="space-y-3 hidden">
                <div>
                    <label class="text-xs text-slate-400 uppercase font-bold">Date de début</label>
                    <input type="date" id="inapt-date-debut" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-slate-400 uppercase font-bold">Durée (jours)</label>
                        <input type="number" id="inapt-duree" min="0" placeholder="ex : 21" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm mt-1">
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
    window._inaptZone = initial.zone;
    window._inaptVue = 'face';
    window._inaptOnSave = onSave;

    document.getElementById('inapt-date-debut').value = initial.dateDebut;
    document.getElementById('inapt-commentaire').value = initial.commentaire;
    document.getElementById('inapt-commentaire-ponctuelle').value = initial.commentaire;
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
    if (zoneC) {
        zoneC.classList.toggle('hidden', window._inaptMotif !== 'douleur');
        if (window._inaptMotif === 'douleur') rendererSilhouette();
    }
};

window.inaptValider = function(eleveId) {
    const type = window._inaptType;
    const data = { type, motif: null, zone: '', dateDebut: null, dateFin: null, commentaire: '' };
    if (type === 'ponctuelle') {
        data.motif = window._inaptMotif;
        data.zone = window._inaptZone || '';
        data.commentaire = document.getElementById('inapt-commentaire-ponctuelle').value.trim();
    } else {
        data.dateDebut = document.getElementById('inapt-date-debut').value;
        const duree = parseInt(document.getElementById('inapt-duree').value, 10);
        const dateFin = document.getElementById('inapt-date-fin').value;
        if (dateFin) {
            data.dateFin = dateFin;
        } else if (duree > 0) {
            const d = new Date(data.dateDebut + 'T12:00:00');
            d.setDate(d.getDate() + duree);
            data.dateFin = formaterDate(d);
        }
        data.commentaire = document.getElementById('inapt-commentaire').value.trim();
    }
    document.getElementById('inaptitude-modal').remove();
    if (window._inaptOnSave) window._inaptOnSave(data);
};
