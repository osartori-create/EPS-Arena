// src/js/modules/natation/natation-organisation.js
// Organisation pédagogique : référence, équipes équilibrées, rôles or/argent/bronze
// ⚠️ Ne modifie PAS les données de mesure (temps/coups/historique), il les LIT seulement.

import { db, ref, onValue, set, remove } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';

// ============================================================
// NOMS ET COULEURS DES ÉQUIPES
// ============================================================
const NOMS_EQUIPES = [
    'Dauphins', 'Requins', 'Orques', 'Baleines', 'Tortues',
    'Pieuvres', 'Hippocampes', 'Méduses', 'Espadons', 'Raies',
    'Phoques', 'Loutres', 'Pingouins', 'Morses', 'Narvals',
    'Barracudas', 'Sardines', 'Thons', 'Anguilles', 'Coraux'
];

const COULEURS_EQUIPES = [
    '#3b82f6', // bleu
    '#ef4444', // rouge
    '#22c55e', // vert
    '#eab308', // jaune
    '#a855f7', // violet
    '#f97316', // orange
    '#06b6d4', // cyan
    '#ec4899', // rose
    '#84cc16', // lime
    '#14b8a6', // teal
    '#f43f5e', // rose vif
    '#6366f1', // indigo
];

// ============================================================
// CONTENUS DE RELAIS PAR RÔLE (modifiable ici)
// ============================================================
const CONTENUS_RELAIS = {
    or: {
        label: '🥇 Or',
        couleur: '#facc15',
        plongeon: 'Plongeon',
        virage: 'Virage culbute',
        distance: '50m'
    },
    argent: {
        label: '🥈 Argent',
        couleur: '#94a3b8',
        plongeon: 'Plongeon',
        virage: 'Virage simple',
        distance: '50m'
    },
    bronze: {
        label: '🥉 Bronze',
        couleur: '#d97706',
        plongeon: 'Départ dans l\'eau',
        virage: 'Virage simple',
        distance: '25m'
    }
};

// ============================================================
// UTILITAIRES
// ============================================================
function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/natation/organisation`;
}

function calculIndice(tempsMs, nbCoups) {
    if (tempsMs === null || nbCoups === null || tempsMs <= 0 || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

function chargerElevesTries(classe) {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    eleves.forEach((e, idx) => { e.numero = idx + 1; });
    return eleves;
}

// ============================================================
// LECTURE DES MESURES (temps + coups)
// ============================================================
async function chargerMesures(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseMesure = `etablissements/0680013V/profs/${profCode}/${classe}/natation`;

    const lire = (path) => new Promise(resolve => {
        onValue(ref(db, path), snap => resolve(snap.val() || {}), { onlyOnce: true });
    });

    const [temps, coups] = await Promise.all([
        lire(`${baseMesure}/temps`),
        lire(`${baseMesure}/coups`)
    ]);

    return { temps, coups };
}

// ============================================================
// CALCUL DE L'INDICE COURANT PAR NUMÉRO
// ============================================================
async function getIndicesCourants(classe) {
    const { temps, coups } = await chargerMesures(classe);
    const indices = {};
    for (const numero of Object.keys(temps)) {
        const t = temps[numero];
        const c = coups[numero];
        const idx = calculIndice(t, c);
        if (idx !== null) indices[numero] = idx;
    }
    return indices;
}

// ============================================================
// MODALE PRINCIPALE
// ============================================================
export function openOrganisationNatation() {
    const classe = getCurrentClasse();
    if (!classe) {
        alert('Sélectionnez une classe.');
        return;
    }

    // Retirer une éventuelle modale existante
    const existante = document.getElementById('natation-org-modal');
    if (existante) existante.remove();

    const overlay = document.createElement('div');
    overlay.id = 'natation-org-modal';
    overlay.className = 'fixed inset-0 bg-black/95 z-50 flex items-start justify-center p-4 overflow-y-auto';

    const modal = document.createElement('div');
    modal.className = 'bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-5xl my-8';
    modal.innerHTML = `
        <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
            <div>
                <h2 class="text-2xl font-black text-blue-400 uppercase">🏊 Organisation pédagogique</h2>
                <p class="text-xs text-slate-400">Classe : ${classe}</p>
            </div>
            <button onclick="document.getElementById('natation-org-modal').remove()"
                    class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white transition-colors">
                ✖ Fermer
            </button>
        </div>

        <div id="org-content" class="space-y-6">
            <p class="text-slate-400 text-center py-8">⏳ Chargement...</p>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Fermer au clic sur le fond
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // Charger les données
    rafraichirOrganisation(classe);
}

// ============================================================
// RAFRAÎCHISSEMENT COMPLET DE L'INTERFACE
// ============================================================
async function rafraichirOrganisation(classe) {
    const container = document.getElementById('org-content');
    if (!container) return;

    const basePath = getBasePath(classe);

    // 1. Lire la référence
    const referenceRef = ref(db, `${basePath}/reference`);
    const reference = await new Promise(resolve => {
        onValue(referenceRef, snap => resolve(snap.val() || {}), { onlyOnce: true });
    });

    // 2. Lire les équipes
    const equipesRef = ref(db, `${basePath}/equipes`);
    const equipes = await new Promise(resolve => {
        onValue(equipesRef, snap => resolve(snap.val() || {}), { onlyOnce: true });
    });

    // 3. Indices courants
    const indicesCourants = await getIndicesCourants(classe);

    // 4. Élèves triés
    const eleves = chargerElevesTries(classe);

    // 5. Rendu
    await renderOrganisation(container, classe, eleves, reference, equipes, indicesCourants, basePath);
}

// ============================================================
// RENDU DE L'INTERFACE
// ============================================================
async function renderOrganisation(container, classe, eleves, reference, equipes, indicesCourants, basePath) {
    const hasReference = Object.keys(reference).length > 0;
    const hasEquipes = Object.keys(equipes).length > 0;
    const nbEleves = eleves.length;

    let html = '';

    // ─────────────────────────────────────────────
    // SECTION 1 : RÉFÉRENCE
    // ─────────────────────────────────────────────
    if (!hasReference) {
        html += `
            <div class="bg-amber-900/20 border-2 border-amber-500 p-5 rounded-2xl">
                <h3 class="font-black text-amber-400 uppercase text-sm mb-2">📸 1. Figer la référence de départ</h3>
                <p class="text-sm text-slate-300 mb-4">
                    Faites passer un <strong>essai initial</strong> à tous les élèves (test de 25m chronométré + comptage des coups de bras).
                    Quand tous les essais sont enregistrés, cliquez sur le bouton ci-dessous.
                    Cette référence servira de <strong>point de départ</strong> pour mesurer la progression sur tout le cycle.
                </p>
                <p class="text-xs text-slate-500 mb-4">
                    ${nbEleves} élève(s) dans la classe · ${Object.keys(indicesCourants).length} essai(s) déjà enregistré(s)
                </p>
                <button onclick="window.figerReferenceNatation()" 
                        class="w-full bg-amber-600 hover:bg-amber-500 py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-all">
                    📸 Figer la référence maintenant
                </button>
            </div>
        `;
    } else {
        const nbReference = Object.keys(reference).length;
        const dateRef = new Date(Object.values(reference)[0]?.date || Date.now());
        const dateStr = dateRef.toLocaleDateString('fr-FR');
        html += `
            <div class="bg-emerald-900/20 border-2 border-emerald-500 p-5 rounded-2xl">
                <div class="flex justify-between items-start mb-3 flex-wrap gap-2">
                    <div>
                        <h3 class="font-black text-emerald-400 uppercase text-sm">✅ Référence figée</h3>
                        <p class="text-xs text-slate-400 mt-1">
                            ${nbReference} élève(s) · enregistrée le ${dateStr}
                        </p>
                    </div>
                    <button onclick="window.reinitialiserReferenceNatation()" 
                            class="bg-red-900/50 hover:bg-red-800 px-3 py-1.5 rounded-xl font-black text-xs text-red-300 active:scale-95">
                        ↺ Refiger (attention : efface la progression)
                    </button>
                </div>
                ${!hasEquipes ? `
                    <p class="text-xs text-slate-400 mt-3">➡️ Étape suivante : générez les équipes.</p>
                ` : ''}
            </div>
        `;
    }

    // ─────────────────────────────────────────────
    // SECTION 2 : ÉQUIPES
    // ─────────────────────────────────────────────
    if (hasReference) {
        html += `<div class="bg-slate-800 border-2 border-slate-700 p-5 rounded-2xl">`;
        html += `
            <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h3 class="font-black text-blue-400 uppercase text-sm">👥 2. Équipes</h3>
                <div class="flex gap-2 flex-wrap items-center">
                    <label class="text-xs text-slate-400 font-bold">Nb équipes</label>
                    <input type="number" id="org-nb-equipes" value="${Math.max(1, Math.ceil(nbEleves / 3))}" min="2" max="10"
                           class="w-16 bg-slate-900 border border-slate-600 rounded p-1 text-white text-center font-black">
                    <button onclick="window.genererEquipesNatation()" 
                            class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        🔄 ${hasEquipes ? 'Regénérer' : 'Générer les équipes'}
                    </button>
                    ${hasEquipes ? `
                        <button onclick="window.reinitialiserEquipesNatation()" 
                                class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                            🗑️ Effacer
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        if (!hasEquipes) {
            html += `<p class="text-slate-400 text-sm text-center py-6">Pas encore d'équipes générées.</p>`;
        } else {
             html += await renderEquipesCartes(classe, eleves, reference, equipes, indicesCourants);
        }

        html += `</div>`;
    }

    container.innerHTML = html;
}

// ============================================================
// RENDU DES CARTES D'ÉQUIPES
// ============================================================
async function renderEquipesCartes(classe, eleves, reference, equipes, indicesCourants) {
    const equipesList = Object.entries(equipes).sort(([idA], [idB]) => idA.localeCompare(idB));

    // Calcul de la dispersion (écart max entre moyennes)
    const moyennes = equipesList.map(([, eq]) => {
        const refs = eq.membres.map(n => reference[n]?.valeur || 0);
        return refs.length > 0 ? refs.reduce((a, b) => a + b, 0) / refs.length : 0;
    });
    const moyMax = Math.max(...moyennes);
    const moyMin = Math.min(...moyennes);
    const dispersion = moyMax - moyMin;

    let html = `
        <div class="mb-4 text-center">
            <span class="text-xs font-bold text-slate-400 uppercase">Dispersion des moyennes d'équipes : </span>
            <span class="font-black ${dispersion < 0.15 ? 'text-emerald-400' : dispersion < 0.3 ? 'text-amber-400' : 'text-red-400'}">
                ${dispersion.toFixed(3)} pt
            </span>
            <span class="text-[10px] text-slate-500 ml-1">
                (${dispersion < 0.15 ? '🟢 excellent' : dispersion < 0.3 ? '🟡 correct' : '🔴 à retenter'})
            </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    for (const [eqId, eq] of equipesList) {
        const couleur = eq.couleur || '#3b82f6';
        const nom = eq.nom || eqId;

        // Calculer les indices de référence des membres
        const membres = eq.membres.map(numero => {
            const eleve = eleves.find(e => e.numero === parseInt(numero));
            const refVal = reference[numero]?.valeur || null;
            const curVal = indicesCourants[numero] || null;
            const progression = (refVal !== null && curVal !== null) ? curVal - refVal : null;
            return { numero, eleve, refVal, curVal, progression };
        });

        // Trier par indice décroissant pour attribuer les rôles
        const membresTries = [...membres].sort((a, b) => (b.refVal || 0) - (a.refVal || 0));
        const roleParNumero = {};
        if (membresTries.length >= 1) roleParNumero[membresTries[0].numero] = 'or';
        if (membresTries.length >= 2) roleParNumero[membresTries[1].numero] = 'argent';
        if (membresTries.length >= 3) roleParNumero[membresTries[2].numero] = 'bronze';
        for (let i = 3; i < membresTries.length; i++) {
            roleParNumero[membresTries[i].numero] = 'bronze'; // 4e = bronze aussi
        }

        const moyRef = membres.reduce((s, m) => s + (m.refVal || 0), 0) / (membres.length || 1);

        html += `
            <div class="bg-slate-900 rounded-2xl border-2 p-4" style="border-color:${couleur}">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-black text-lg" style="color:${couleur}">${nom}</h4>
                    <span class="text-xs text-slate-400">Moy. ${moyRef.toFixed(3)}</span>
                </div>
                <div class="space-y-2">
        `;

        for (const m of membres) {
            const role = roleParNumero[m.numero] || 'bronze';
            const contenu = CONTENUS_RELAIS[role];
            const photoUrl = m.eleve ? await getPhotoUrl(m.eleve.id) : null;
            const photoHtml = photoUrl
                ? `<img src="${photoUrl}" class="w-10 h-10 rounded-full object-cover border-2" style="border-color:${contenu.couleur}">`
                : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">👤</div>`;

            const progressionHtml = m.progression !== null
                ? `<span class="${m.progression > 0.05 ? 'text-emerald-400' : m.progression < -0.05 ? 'text-red-400' : 'text-slate-400'} font-bold">
                     ${m.progression > 0 ? '+' : ''}${m.progression.toFixed(2)}
                   </span>`
                : '<span class="text-slate-500">—</span>';

            html += `
                <div class="flex items-center gap-2 p-2 rounded-lg" style="background:${couleur}15">
                    ${photoHtml}
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1">
                            <span class="text-xs font-black" style="color:${contenu.couleur}">${contenu.label}</span>
                            <span class="text-xs font-bold text-white truncate">${m.eleve?.prenom || '?'} ${m.eleve?.nom || ''}</span>
                        </div>
                        <div class="text-[10px] text-slate-400">
                            Réf. ${m.refVal !== null ? m.refVal.toFixed(2) : '—'} · 
                            Act. ${m.curVal !== null ? m.curVal.toFixed(2) : '—'} · 
                            Prog. ${progressionHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        html += `
                </div>
                <div class="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
                    <strong class="text-slate-400">Relais :</strong>
                    🥇 ${CONTENUS_RELAIS.or.plongeon} + ${CONTENUS_RELAIS.or.virage} + ${CONTENUS_RELAIS.or.distance} ·
                    🥈 ${CONTENUS_RELAIS.argent.plongeon} + ${CONTENUS_RELAIS.argent.virage} + ${CONTENUS_RELAIS.argent.distance} ·
                    🥉 ${CONTENUS_RELAIS.bronze.plongeon} + ${CONTENUS_RELAIS.bronze.virage} + ${CONTENUS_RELAIS.bronze.distance}
                </div>
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

// ============================================================
// ACTION : FIGER LA RÉFÉRENCE
// ============================================================
window.figerReferenceNatation = async function() {
    const classe = getCurrentClasse();
    if (!classe) return;

    const indices = await getIndicesCourants(classe);
    const nbIndices = Object.keys(indices).length;

    if (nbIndices === 0) {
        alert('Aucun essai enregistré. Faites d\'abord passer le test aux élèves.');
        return;
    }

    const eleves = chargerElevesTries(classe);
    const nbAttendus = eleves.length;

    if (nbIndices < nbAttendus) {
        const manquants = nbAttendus - nbIndices;
        if (!confirm(`⚠️ Il manque ${manquants} élève(s) sur ${nbAttendus}.\n\nFiger quand même la référence ?\n(Les élèves sans essai n'auront pas de référence.)`)) {
            return;
        }
    } else {
        if (!confirm(`📸 Figer la référence pour ${nbIndices} élève(s) ?\n\nCette action servira de point de départ pour la progression.\nElle peut être refaite plus tard (mais effacera la progression mesurée).`)) {
            return;
        }
    }

    const basePath = getBasePath(classe);
    const dateNow = Date.now();
    const referenceData = {};

    const { temps, coups } = await chargerMesures(classe);
    for (const numero of Object.keys(indices)) {
        referenceData[numero] = {
            valeur: Math.round(indices[numero] * 100) / 100,
            tempsMs: temps[numero] || null,
            nbCoups: coups[numero] || null,
            date: dateNow
        };
    }

    try {
        await set(ref(db, `${basePath}/reference`), referenceData);
        alert(`✅ Référence figée pour ${nbIndices} élève(s) !`);
        rafraichirOrganisation(classe);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de l\'enregistrement : ' + err.message);
    }
};

// ============================================================
// ACTION : RÉINITIALISER LA RÉFÉRENCE
// ============================================================
window.reinitialiserReferenceNatation = async function() {
    const classe = getCurrentClasse();
    if (!classe) return;

    if (!confirm('⚠️ Effacer la référence actuelle ?\n\nCela effacera aussi toutes les équipes et la progression mesurée.\n(Les temps/coups/historique ne sont PAS touchés.)')) {
        return;
    }

    const basePath = getBasePath(classe);
    try {
        await remove(ref(db, `${basePath}/reference`));
        await remove(ref(db, `${basePath}/equipes`));
        alert('✅ Référence et équipes effacées.');
        rafraichirOrganisation(classe);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

// ============================================================
// ACTION : GÉNÉRER LES ÉQUIPES
// ============================================================
window.genererEquipesNatation = async function() {
    const classe = getCurrentClasse();
    if (!classe) return;

    const input = document.getElementById('org-nb-equipes');
    const nbEquipes = parseInt(input?.value) || Math.ceil(chargerElevesTries(classe).length / 3);

    if (nbEquipes < 2) {
        alert('Il faut au moins 2 équipes.');
        return;
    }

    const basePath = getBasePath(classe);

    // Lire la référence
    const reference = await new Promise(resolve => {
        onValue(ref(db, `${basePath}/reference`), snap => resolve(snap.val() || {}), { onlyOnce: true });
    });

    if (Object.keys(reference).length === 0) {
        alert('Il faut d\'abord figer la référence.');
        return;
    }

    const eleves = chargerElevesTries(classe);
    const elevesAvecRef = eleves.filter(e => reference[e.numero]);

    if (elevesAvecRef.length < nbEquipes * 2) {
        alert(`Pas assez d'élèves avec référence (${elevesAvecRef.length}) pour ${nbEquipes} équipes.`);
        return;
    }

    // ─────────────────────────────────────────────
    // ALGORITHME : 1000 tirages, on garde le meilleur
    // ─────────────────────────────────────────────
    const N_TIRAGES = 1000;
    let meilleurTirage = null;
    let meilleureDispersion = Infinity;

    for (let tirage = 0; tirage < N_TIRAGES; tirage++) {
        const melange = [...elevesAvecRef].sort(() => Math.random() - 0.5);
        const equipesTmp = Array.from({ length: nbEquipes }, () => []);

        // Distribution en serpentin
        let direction = 1;
        let idx = 0;
        for (const eleve of melange) {
            equipesTmp[idx].push(eleve);
            idx += direction;
            if (idx >= nbEquipes) { idx = nbEquipes - 1; direction = -1; }
            else if (idx < 0) { idx = 0; direction = 1; }
        }

        // Calculer la dispersion (écart max - min des moyennes)
        const moyennes = equipesTmp.map(eq => {
            if (eq.length === 0) return 0;
            return eq.reduce((s, e) => s + (reference[e.numero]?.valeur || 0), 0) / eq.length;
        });
        const dispersion = Math.max(...moyennes) - Math.min(...moyennes);

        if (dispersion < meilleureDispersion) {
            meilleureDispersion = dispersion;
            meilleurTirage = equipesTmp;
        }
    }

    if (!meilleurTirage) {
        alert('Impossible de générer les équipes.');
        return;
    }

    // Construire les données à sauvegarder
    const equipesData = {};
    meilleurTirage.forEach((eq, i) => {
        const eqId = `eq${i + 1}`;
        const nom = NOMS_EQUIPES[i % NOMS_EQUIPES.length];
        const couleur = COULEURS_EQUIPES[i % COULEURS_EQUIPES.length];

        // Attribution des rôles par indice décroissant
        const membresTries = [...eq].sort((a, b) => (reference[b.numero]?.valeur || 0) - (reference[a.numero]?.valeur || 0));
        const roles = {};
        if (membresTries[0]) roles[membresTries[0].numero] = 'or';
        if (membresTries[1]) roles[membresTries[1].numero] = 'argent';
        if (membresTries[2]) roles[membresTries[2].numero] = 'bronze';
        for (let j = 3; j < membresTries.length; j++) {
            roles[membresTries[j].numero] = 'bronze';
        }

        equipesData[eqId] = {
            nom,
            couleur,
            membres: eq.map(e => e.numero),
            roles,
            dateCreation: Date.now()
        };
    });

    try {
        await set(ref(db, `${basePath}/equipes`), equipesData);
        const msg = `✅ ${nbEquipes} équipes générées !\n\nDispersion des moyennes : ${meilleureDispersion.toFixed(3)} pt\n\n${meilleureDispersion < 0.15 ? '🟢 Excellent équilibrage' : meilleureDispersion < 0.3 ? '🟡 Équilibrage correct' : '🔴 Équilibrage moyen — relance si besoin'}`;
        alert(msg);
        rafraichirOrganisation(classe);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

// ============================================================
// ACTION : RÉINITIALISER LES ÉQUIPES
// ============================================================
window.reinitialiserEquipesNatation = async function() {
    const classe = getCurrentClasse();
    if (!classe) return;
    if (!confirm('⚠️ Effacer les équipes actuelles ?\n(La référence est conservée.)')) return;

    const basePath = getBasePath(classe);
    try {
        await remove(ref(db, `${basePath}/equipes`));
        alert('✅ Équipes effacées.');
        rafraichirOrganisation(classe);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};