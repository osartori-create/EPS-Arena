// src/js/modules/arcathlon/arcathlon-interface.js
// Module Professeur – Génération des équipes, paramétrage, transmission Firebase

import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set } from '../../core/firebase-service.js';

// --------------------------------------------------------------
// 1. GÉNÉRATION DES ÉQUIPES (3 par équipe, quartiles de VMA)
// --------------------------------------------------------------
export function generateArcathlonTeams() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe d'abord.");

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    if (eleves.length < 3) return alert("Il faut au moins 3 élèves pour constituer des équipes.");

    // 1. Trier par VMA décroissante
    const sorted = [...eleves].sort((a, b) => (b.vma || 0) - (a.vma || 0));

    // 2. Répartir en 3 quartiles (Rouge = meilleurs, Jaune = intermédiaires, Bleu = moins bons)
    const quartileSize = Math.ceil(sorted.length / 3);
    const quartiles = [
        sorted.slice(0, quartileSize),          // Rouge
        sorted.slice(quartileSize, quartileSize * 2), // Jaune
        sorted.slice(quartileSize * 2)          // Bleu
    ];
    const couleurs = ['Rouge', 'Jaune', 'Bleu'];

    // 3. Mélanger chaque quartile pour répartir aléatoirement
    quartiles.forEach(q => {
        for (let i = q.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [q[i], q[j]] = [q[j], q[i]];
        }
    });

    // 4. Construire les équipes : on prend un élève de chaque quartile
    const nbEquipes = Math.min(
        quartiles[0].length,
        quartiles[1].length,
        quartiles[2].length
    );
    if (nbEquipes === 0) return alert("Pas assez d'élèves dans un des quartiles pour former des équipes.");

    const equipes = [];
    for (let i = 0; i < nbEquipes; i++) {
        // On garde la couleur associée au quartile (0=Rouge, 1=Jaune, 2=Bleu)
        const membres = [
            { ...quartiles[0][i], maillot: 'Rouge', absent: false, inapte: false },
            { ...quartiles[1][i], maillot: 'Jaune', absent: false, inapte: false },
            { ...quartiles[2][i], maillot: 'Bleu', absent: false, inapte: false }
        ];
        equipes.push({
            id: `EQ${i + 1}`,
            pin: Math.floor(100 + Math.random() * 900).toString(),
            membres: membres
        });
    }

    // 5. Sauvegarder dans localStorage
    localStorage.setItem(`arcathlon_equipes_${activeClasse}`, JSON.stringify(equipes));
    renderArcathlonTeams();
    initSortableArcathlon();
    alert(`✅ ${equipes.length} équipes générées. Glissez-déposez pour ajuster.`);
}

// --------------------------------------------------------------
// 2. AFFICHAGE DES ÉQUIPES (avec photos, cases absent/inapte)
// --------------------------------------------------------------
export async function renderArcathlonTeams() {
    const container = document.getElementById('teamsGridArcathlon');
    if (!container) return;

    // Sauvegarder la position de défilement
    const scrollParent = container.closest('.overflow-y-auto') || container.parentElement;
    const scrollTop = scrollParent.scrollTop || 0;

    const activeClasse = document.getElementById('selectClasse').value;
    const equipes = JSON.parse(localStorage.getItem(`arcathlon_equipes_${activeClasse}`) || '[]');

    container.innerHTML = '';
    for (const eq of equipes) {
        let html = `
            <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col" data-team-id="${eq.id}">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-black text-lg text-slate-200">${eq.id}</h3>
                    <span class="text-xs font-bold text-slate-400">PIN: <strong class="text-emerald-400 font-mono">${eq.pin}</strong></span>
                </div>
                <div class="team-list-sortable flex-1 space-y-2 border border-dashed border-slate-800 rounded-xl p-2 min-h-[60px]" data-team="${eq.id}">
        `;
        for (const m of eq.membres) {
            const url = await getPhotoUrl(m.id);
            const photoHtml = url
                ? `<img src="${url}" class="w-8 h-8 rounded-full object-cover">`
                : `<div class="w-8 h-8 rounded-full bg-slate-700"></div>`;

            const styleMap = {
                'Rouge': 'text-red-400 bg-red-950/40 border-red-800',
                'Jaune': 'text-yellow-400 bg-yellow-950/40 border-yellow-800',
                'Bleu': 'text-blue-400 bg-blue-950/40 border-blue-800'
            };
            const style = styleMap[m.maillot] || 'bg-slate-800 border-slate-600 text-white';

            const absentChecked = m.absent ? 'checked' : '';
            const inapteChecked = m.inapte ? 'checked' : '';

            html += `
                <div class="flex items-center justify-between border border-slate-800 p-2 rounded-lg ${style} bg-slate-950" data-id="${m.id}">
                    <div class="flex items-center gap-2">
                        ${photoHtml}
                        <div>
                            <div class="font-bold text-xs text-white">${m.prenom} ${m.nom.charAt(0)}.</div>
                            <div class="text-[9px] uppercase font-bold tracking-widest text-slate-400">${m.maillot} | VMA ${m.vma}</div>
                        </div>
                    </div>
                    <div class="flex gap-2 text-[10px]">
                        <label class="flex items-center gap-1 text-slate-400">
                            <input type="checkbox" class="absent-check" data-eq="${eq.id}" data-maillot="${m.maillot}" ${absentChecked}> Absent
                        </label>
                        <label class="flex items-center gap-1 text-slate-400">
                            <input type="checkbox" class="inapte-check" data-eq="${eq.id}" data-maillot="${m.maillot}" ${inapteChecked}> Inapte
                        </label>
                    </div>
                </div>
            `;
        }
        html += `</div></div>`;
        container.innerHTML += html;
    }

    // Restaurer la position de défilement
    setTimeout(() => {
        scrollParent.scrollTop = scrollTop;
    }, 10);

    // Attacher les événements aux cases à cocher
    document.querySelectorAll('.absent-check, .inapte-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const eqId = e.target.dataset.eq;
            const maillot = e.target.dataset.maillot;
            const isAbsent = e.target.classList.contains('absent-check');
            const value = e.target.checked;

            const equipes = JSON.parse(localStorage.getItem(`arcathlon_equipes_${activeClasse}`) || '[]');
            const eq = equipes.find(e => e.id === eqId);
            if (!eq) return;
            const membre = eq.membres.find(m => m.maillot === maillot);
            if (!membre) return;

            if (isAbsent) {
                membre.absent = value;
                if (value) membre.inapte = false; // exclusif
            } else {
                membre.inapte = value;
                if (value) membre.absent = false;
            }
            localStorage.setItem(`arcathlon_equipes_${activeClasse}`, JSON.stringify(equipes));
            renderArcathlonTeams(); // rafraîchir
        });
    });

    initSortableArcathlon();
}

// --------------------------------------------------------------
// 3. GLISSER-DÉPOSER (SORTABLE) – sans réattribution de couleur
// --------------------------------------------------------------
let sortableInstances = [];

export function initSortableArcathlon() {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    const containers = document.querySelectorAll('.team-list-sortable');
    containers.forEach(container => {
        const sortable = new Sortable(container, {
            group: 'arcathlon-teams',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                const fromTeam = evt.from.dataset.team;
                const toTeam = evt.to.dataset.team;
                const itemId = evt.item.dataset.id;
                if (fromTeam === toTeam) return;

                const activeClasse = document.getElementById('selectClasse').value;
                const equipes = JSON.parse(localStorage.getItem(`arcathlon_equipes_${activeClasse}`) || '[]');
                const fromEq = equipes.find(e => e.id === fromTeam);
                const toEq = equipes.find(e => e.id === toTeam);
                if (!fromEq || !toEq) return;

                const idx = fromEq.membres.findIndex(m => m.id === itemId);
                if (idx === -1) return;
                const moved = fromEq.membres.splice(idx, 1)[0];
                // On ne réattribue PAS la couleur : on laisse celle que l'élève avait (basée sur sa VMA)
                toEq.membres.push(moved);

                localStorage.setItem(`arcathlon_equipes_${activeClasse}`, JSON.stringify(equipes));
                renderArcathlonTeams();
            }
        });
        sortableInstances.push(sortable);
    });
}

// --------------------------------------------------------------
// 4. TRANSMISSION VERS FIREBASE (avec nbFleches)
// --------------------------------------------------------------
export function transmettreArcathlonConfig() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const equipes = JSON.parse(localStorage.getItem(`arcathlon_equipes_${activeClasse}`) || '[]');
    if (equipes.length === 0) return alert("Générez d'abord les équipes.");

    // Récupérer les paramètres
    const mode = document.getElementById('arcathlonMode')?.value || 'sprint';
    const nbSeries = parseInt(document.getElementById('arcathlonNbSeries')?.value) || 3;
    const longueurPiste = parseInt(document.getElementById('arcathlonLongueurPiste')?.value) || 100;
    const nbToursCourse = parseInt(document.getElementById('arcathlonNbToursCourse')?.value) || 2;
    const longueurPenalite = parseInt(document.getElementById('arcathlonLongueurPenalite')?.value) || 30;
    const nbFleches = parseInt(document.getElementById('arcathlonNbFleches')?.value) || 2;

    const configData = {
        mode: mode,
        nbSeries: nbSeries,
        nbFleches: nbFleches,
        longueurPiste: longueurPiste,
        nbToursCourse: nbToursCourse,
        longueurPenalite: longueurPenalite,
        distanceTotale: longueurPiste * nbToursCourse,
        vmaReference: {},
        handicaps: {},
        equipes: {}
    };

    // Construction des équipes et mapping VMA
    equipes.forEach(eq => {
        configData.equipes[eq.id] = {
            pin: eq.pin,
            membres: eq.membres.map(m => ({
                maillot: m.maillot,
                vma: m.vma || 0,
                absent: m.absent || false,
                inapte: m.inapte || false,
                code: `${eq.id}_${m.maillot}`
            }))
        };
        eq.membres.forEach(m => {
            configData.vmaReference[`${eq.id}_${m.maillot}`] = m.vma || 0;
        });
    });

    // Handicaps (si mode poursuite, on les charge depuis une autre fonction)
    if (mode === 'poursuite') {
        // Par défaut, on met 0
        Object.keys(configData.vmaReference).forEach(key => {
            configData.handicaps[key] = 0;
        });
    }

    // Envoi à Firebase
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${activeClasse}/arcathlon/config`);

    set(configRef, configData)
        .then(() => {
            alert("✅ Configuration Arcathlon transmise aux iPads !");
        })
        .catch(err => {
            console.error(err);
            alert("❌ Erreur lors de la transmission.");
        });
}

// --------------------------------------------------------------
// 5. INITIALISATION DU MODULE (appelée par activities.js)
// --------------------------------------------------------------
export function initArcathlonInterface() {
    const container = document.getElementById('viewArcathlonSettings');
    if (!container) return;

    // On injecte le HTML de l'interface si nécessaire
    if (!document.getElementById('teamsGridArcathlon')) {
        container.innerHTML = `
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-black text-blue-400 uppercase text-sm">🏹 Arcathlon – Équipes de 3</h3>
                    <button onclick="window.generateArcathlonTeams()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400">🔄 Générer Équipes</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Mode</label>
                        <select id="arcathlonMode" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                            <option value="sprint">Sprint</option>
                            <option value="poursuite">Poursuite inversée</option>
                            <option value="relais">Relais</option>
                            <option value="killbill">Kill Bill</option>
                            <option value="mille">Mille</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Nb séries</label>
                        <input type="number" id="arcathlonNbSeries" value="3" min="1" max="5" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Nb flèches</label>
                        <input type="number" id="arcathlonNbFleches" value="2" min="1" max="3" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Longueur piste (m)</label>
                        <input type="number" id="arcathlonLongueurPiste" value="100" min="50" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Tours par course</label>
                        <input type="number" id="arcathlonNbToursCourse" value="2" min="1" max="5" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Longueur pénalité (m)</label>
                        <input type="number" id="arcathlonLongueurPenalite" value="30" min="10" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
                    </div>
                </div>
                <button onclick="window.transmettreArcathlonConfig()" class="w-full bg-blue-600 py-4 rounded-xl font-black text-lg uppercase tracking-widest text-white border-4 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] active:scale-[0.98] transition-transform">
                    📡 Transmettre aux iPads Élèves
                </button>
                <div id="teamsGridArcathlon" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6"></div>
            </div>
        `;
    }

    // Charger les équipes existantes
    const activeClasse = document.getElementById('selectClasse').value;
    if (activeClasse) {
        const equipes = JSON.parse(localStorage.getItem(`arcathlon_equipes_${activeClasse}`) || '[]');
        if (equipes.length > 0) {
            renderArcathlonTeams();
        }
    }

    // Exposer les fonctions globales
    window.generateArcathlonTeams = generateArcathlonTeams;
    window.transmettreArcathlonConfig = transmettreArcathlonConfig;
}