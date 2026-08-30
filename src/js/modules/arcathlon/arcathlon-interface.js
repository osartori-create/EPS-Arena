// src/js/modules/arcathlon/arcathlon-interface.js
// Module Professeur – Génération des équipes, paramétrage, transmission Firebase

import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set } from '../../core/firebase-service.js';

// Palette de couleurs disponibles pour les maillots
const COULEURS_DISPONIBLES = ['Rouge', 'Jaune', 'Bleu', 'Vert', 'Orange', 'Violet', 'Rose', 'Cyan'];

// --------------------------------------------------------------
// 1. GÉNÉRATION DES ÉQUIPES (avec choix des couleurs par quartile)
// --------------------------------------------------------------
export function generateArcathlonTeams() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe d'abord.");

    // Récupérer les couleurs choisies par le professeur
    const couleurVMAplus = document.getElementById('couleurVMAplus')?.value || 'Rouge';
    const couleurVMAinter = document.getElementById('couleurVMAinter')?.value || 'Jaune';
    const couleurVMAmoins = document.getElementById('couleurVMAmoins')?.value || 'Bleu';
    const couleursSelectionnees = [couleurVMAplus, couleurVMAinter, couleurVMAmoins];

    // Vérifier l'unicité
    if (new Set(couleursSelectionnees).size < 3) {
        alert("Les trois couleurs doivent être différentes.");
        return;
    }

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    if (eleves.length < 3) return alert("Il faut au moins 3 élèves pour constituer des équipes.");

    // 1. Trier par VMA décroissante
    const sorted = [...eleves].sort((a, b) => (b.vma || 0) - (a.vma || 0));

    // 2. Répartir en 3 quartiles
    const quartileSize = Math.ceil(sorted.length / 3);
    const quartiles = [
        sorted.slice(0, quartileSize),          // VMA+
        sorted.slice(quartileSize, quartileSize * 2), // VMA±
        sorted.slice(quartileSize * 2)          // VMA−
    ];

    // 3. Mélanger chaque quartile pour répartir aléatoirement
    quartiles.forEach(q => {
        for (let i = q.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [q[i], q[j]] = [q[j], q[i]];
        }
    });

    // 4. Construire les équipes
    const nbEquipes = Math.min(
        quartiles[0].length,
        quartiles[1].length,
        quartiles[2].length
    );
    if (nbEquipes === 0) return alert("Pas assez d'élèves dans un des quartiles pour former des équipes.");

    const equipes = [];
    for (let i = 0; i < nbEquipes; i++) {
        const membres = [
            { ...quartiles[0][i], maillot: couleursSelectionnees[0], absent: false, inapte: false },
            { ...quartiles[1][i], maillot: couleursSelectionnees[1], absent: false, inapte: false },
            { ...quartiles[2][i], maillot: couleursSelectionnees[2], absent: false, inapte: false }
        ];
        equipes.push({
            id: `EQ${i + 1}`,
            pin: Math.floor(100 + Math.random() * 900).toString(),
            membres: membres
        });
    }

    sauvegarderEquipes(activeClasse, equipes);
    renderArcathlonTeams();
    alert(`✅ ${equipes.length} équipes générées avec les couleurs : ${couleursSelectionnees.join(', ')}`);
}

// --------------------------------------------------------------
// 2. FONCTIONS DE SAUVEGARDE / CHARGEMENT
// --------------------------------------------------------------
function sauvegarderEquipes(classe, equipes) {
    localStorage.setItem(`arcathlon_equipes_${classe}`, JSON.stringify(equipes));
}

function chargerEquipes(classe) {
    return JSON.parse(localStorage.getItem(`arcathlon_equipes_${classe}`) || '[]');
}

// --------------------------------------------------------------
// 3. REMPLACEMENT COLLECTIF DES COULEURS (corrigé)
// --------------------------------------------------------------
export function remplacerCouleurCollectif() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const source = document.getElementById('couleurSource')?.value;
    const target = document.getElementById('couleurCible')?.value;
    if (!source || !target) return alert("Veuillez sélectionner une couleur source et une couleur cible.");
    if (source === target) return alert("Les couleurs source et cible sont identiques.");

    const equipes = chargerEquipes(activeClasse);
    let modifie = 0;

    equipes.forEach(eq => {
        eq.membres.forEach(m => {
            if (m.maillot === source) {
                m.maillot = target;
                modifie++;
            }
        });
    });

    if (modifie === 0) {
        alert(`Aucun élève ne porte la couleur "${source}".`);
        return;
    }

    sauvegarderEquipes(activeClasse, equipes);
    renderArcathlonTeams();
    alert(`✅ ${modifie} élève(s) changé(s) de "${source}" vers "${target}".`);
}

// --------------------------------------------------------------
// 4. AFFICHAGE DES ÉQUIPES (avec bandeau couleur + sexe)
// --------------------------------------------------------------
export async function renderArcathlonTeams() {
    const container = document.getElementById('teamsGridArcathlon');
    if (!container) return;

    // Sauvegarder la position de défilement
    const scrollContainer = container.closest('.overflow-y-auto') || container.parentElement;
    const firstVisibleCard = scrollContainer.querySelector('.bg-slate-900.rounded-2xl');
    let targetId = null;
    if (firstVisibleCard) {
        targetId = firstVisibleCard.dataset.teamId;
    }

    const activeClasse = document.getElementById('selectClasse').value;
    const equipes = chargerEquipes(activeClasse);

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

            // Fond selon le sexe (comme dans les autres modules)
            let bgSexe = 'bg-slate-200 border-slate-400';
            if (m.sexe === 'M') bgSexe = 'bg-blue-200 border-blue-400';
            else if (m.sexe === 'F') bgSexe = 'bg-rose-200 border-rose-400';

            // Bandeau de couleur du maillot en haut de la carte
            const colorMap = {
                'Rouge': 'bg-red-600',
                'Jaune': 'bg-yellow-500',
                'Bleu': 'bg-blue-600',
                'Vert': 'bg-green-600',
                'Orange': 'bg-orange-500',
                'Violet': 'bg-purple-600',
                'Rose': 'bg-pink-500',
                'Cyan': 'bg-cyan-500'
            };
            const bandeauCouleur = colorMap[m.maillot] || 'bg-slate-600';

            const absentChecked = m.absent ? 'checked' : '';
            const inapteChecked = m.inapte ? 'checked' : '';

            // Sélecteur de couleur individuel
            const colorOptions = COULEURS_DISPONIBLES.map(c =>
                `<option value="${c}" ${c === m.maillot ? 'selected' : ''}>${c}</option>`
            ).join('');

            html += `
                <div class="relative rounded-lg border-2 ${bgSexe} bg-opacity-80" data-id="${m.id}">
                    <!-- Bandeau de couleur du maillot -->
                    <div class="${bandeauCouleur} h-1.5 rounded-t-lg"></div>
                    <div class="flex items-center justify-between p-2">
                        <div class="flex items-center gap-2">
                            ${photoHtml}
                            <div>
                                <div class="font-black text-slate-900 text-sm">${m.prenom}</div>
                                <div class="text-xs font-bold text-slate-600 uppercase">${m.nom}</div>
                                <div class="text-[10px] font-bold text-slate-500">VMA ${m.vma}</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 text-[10px]">
                            <select class="couleur-select bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white" data-eq="${eq.id}" data-id="${m.id}">
                                ${colorOptions}
                            </select>
                            <label class="flex items-center gap-0.5 text-slate-600" title="Absent">
                                <input type="checkbox" class="absent-check" data-eq="${eq.id}" data-id="${m.id}" ${absentChecked}> A
                            </label>
                            <label class="flex items-center gap-0.5 text-slate-600" title="Inapte">
                                <input type="checkbox" class="inapte-check" data-eq="${eq.id}" data-id="${m.id}" ${inapteChecked}> I
                            </label>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div></div>`;
        container.innerHTML += html;
    }

    // Restaurer la position de défilement
    if (targetId) {
        const targetCard = container.querySelector(`[data-team-id="${targetId}"]`);
        if (targetCard) {
            targetCard.scrollIntoView({ block: 'start', behavior: 'auto' });
        }
    }

    // Attacher les événements
    document.querySelectorAll('.couleur-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const eqId = e.target.dataset.eq;
            const eleveId = e.target.dataset.id;
            const nouvelleCouleur = e.target.value;
            const classe = document.getElementById('selectClasse').value;
            const equipes = chargerEquipes(classe);
            const eq = equipes.find(e => e.id === eqId);
            if (!eq) return;
            const membre = eq.membres.find(m => m.id === eleveId);
            if (!membre) return;
            membre.maillot = nouvelleCouleur;
            sauvegarderEquipes(classe, equipes);
            renderArcathlonTeams();
        });
    });

    document.querySelectorAll('.absent-check, .inapte-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const eqId = e.target.dataset.eq;
            const eleveId = e.target.dataset.id;
            const isAbsent = e.target.classList.contains('absent-check');
            const value = e.target.checked;
            const classe = document.getElementById('selectClasse').value;
            const equipes = chargerEquipes(classe);
            const eq = equipes.find(e => e.id === eqId);
            if (!eq) return;
            const membre = eq.membres.find(m => m.id === eleveId);
            if (!membre) return;

            if (isAbsent) {
                membre.absent = value;
                if (value) membre.inapte = false;
            } else {
                membre.inapte = value;
                if (value) membre.absent = false;
            }
            sauvegarderEquipes(classe, equipes);
            renderArcathlonTeams();
        });
    });

    initSortableArcathlon();
}

// --------------------------------------------------------------
// 5. GLISSER-DÉPOSER (SORTABLE)
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
                const equipes = chargerEquipes(activeClasse);
                const fromEq = equipes.find(e => e.id === fromTeam);
                const toEq = equipes.find(e => e.id === toTeam);
                if (!fromEq || !toEq) return;

                const idx = fromEq.membres.findIndex(m => m.id === itemId);
                if (idx === -1) return;
                const moved = fromEq.membres.splice(idx, 1)[0];
                toEq.membres.push(moved);

                sauvegarderEquipes(activeClasse, equipes);
                renderArcathlonTeams();
            }
        });
        sortableInstances.push(sortable);
    });
}

// --------------------------------------------------------------
// 6. TRANSMISSION VERS FIREBASE
// --------------------------------------------------------------
export function transmettreArcathlonConfig() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const equipes = chargerEquipes(activeClasse);
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

    if (mode === 'poursuite') {
        Object.keys(configData.vmaReference).forEach(key => {
            configData.handicaps[key] = 0;
        });
    }

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
// 7. EXPORT / IMPORT JSON
// --------------------------------------------------------------
export function exportArcathlonConfig() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const equipes = chargerEquipes(activeClasse);
    const data = {
        version: 1,
        classe: activeClasse,
        activite: 'arcathlon',
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        equipes: equipes
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeClasse}_arcathlon_equipes_${data.date}.json`;
    a.click();
}

export function importArcathlonConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.equipes) throw new Error("Format invalide.");
            const classe = data.classe;
            sauvegarderEquipes(classe, data.equipes);
            const select = document.getElementById('selectClasse');
            if (select.value !== classe) {
                select.value = classe;
                select.dispatchEvent(new Event('change'));
            } else {
                renderArcathlonTeams();
            }
            alert("✅ Configuration Arcathlon importée !");
        } catch (err) {
            alert("❌ Erreur d'import : " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// --------------------------------------------------------------
// 8. INITIALISATION DU MODULE
// --------------------------------------------------------------
export function initArcathlonInterface() {
    const container = document.getElementById('viewArcathlonSettings');
    if (!container) return;

    if (!document.getElementById('teamsGridArcathlon')) {
        container.innerHTML = `
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h3 class="font-black text-blue-400 uppercase text-sm">🏹 Arcathlon – Équipes de 3</h3>
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="window.generateArcathlonTeams()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400">🔄 Générer</button>
                        <button onclick="window.exportArcathlonConfig()" class="bg-indigo-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400">⬇️ Export JSON</button>
                        <button onclick="document.getElementById('importArcathlonFile').click()" class="bg-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400">⬆️ Import JSON</button>
                        <input type="file" id="importArcathlonFile" class="hidden" accept=".json" onchange="window.importArcathlonConfig(event)">
                    </div>
                </div>

                <!-- Choix des couleurs par quartile (avant génération) -->
                <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 mb-4 flex flex-wrap items-center gap-3">
                    <span class="text-xs font-bold text-slate-400 uppercase">Couleurs des maillots :</span>
                    <label class="text-xs text-slate-400">VMA+</label>
                    <select id="couleurVMAplus" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                        ${COULEURS_DISPONIBLES.map(c => `<option value="${c}" ${c==='Rouge'?'selected':''}>${c}</option>`).join('')}
                    </select>
                    <label class="text-xs text-slate-400">VMA±</label>
                    <select id="couleurVMAinter" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                        ${COULEURS_DISPONIBLES.map(c => `<option value="${c}" ${c==='Jaune'?'selected':''}>${c}</option>`).join('')}
                    </select>
                    <label class="text-xs text-slate-400">VMA−</label>
                    <select id="couleurVMAmoins" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                        ${COULEURS_DISPONIBLES.map(c => `<option value="${c}" ${c==='Bleu'?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>

                <!-- Panneau de remplacement collectif -->
                <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 mb-4 flex flex-wrap items-center gap-3">
                    <span class="text-xs font-bold text-slate-400 uppercase">Remplacer :</span>
                    <select id="couleurSource" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                        ${COULEURS_DISPONIBLES.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                    <span class="text-xs text-slate-400">→</span>
                    <select id="couleurCible" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                        ${COULEURS_DISPONIBLES.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                    <button onclick="window.remplacerCouleurCollectif()" class="bg-purple-600 px-4 py-1.5 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400">🔄 Appliquer</button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Mode</label>
                        <select id="arcathlonMode" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm">
                            <option value="sprint">Sprint</option>
                            <option value="poursuite">Poursuite</option>
                            <option value="relais">Relais</option>
                            <option value="killbill">Kill Bill</option>
                            <option value="mille">Mille</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Nb séries</label>
                        <input type="number" id="arcathlonNbSeries" value="3" min="1" max="5" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-sm">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Nb flèches</label>
                        <input type="number" id="arcathlonNbFleches" value="2" min="1" max="3" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-sm">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Piste (m)</label>
                        <input type="number" id="arcathlonLongueurPiste" value="100" min="50" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-sm">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Tours/course</label>
                        <input type="number" id="arcathlonNbToursCourse" value="2" min="1" max="5" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-sm">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Pénalité (m)</label>
                        <input type="number" id="arcathlonLongueurPenalite" value="30" min="10" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-sm">
                    </div>
                </div>
                <button onclick="window.transmettreArcathlonConfig()" class="w-full bg-blue-600 py-3 rounded-xl font-black text-base uppercase tracking-widest text-white border-4 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] active:scale-[0.98] transition-transform">
                    📡 Transmettre aux iPads Élèves
                </button>
                <div id="teamsGridArcathlon" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6"></div>
            </div>
        `;
    }

    const activeClasse = document.getElementById('selectClasse').value;
    if (activeClasse) {
        const equipes = chargerEquipes(activeClasse);
        if (equipes.length > 0) {
            renderArcathlonTeams();
        }
    }

    // Exposer les fonctions globales
    window.generateArcathlonTeams = generateArcathlonTeams;
    window.transmettreArcathlonConfig = transmettreArcathlonConfig;
    window.exportArcathlonConfig = exportArcathlonConfig;
    window.importArcathlonConfig = importArcathlonConfig;
    window.remplacerCouleurCollectif = remplacerCouleurCollectif;
}