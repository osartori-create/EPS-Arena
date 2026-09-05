// src/js/modules/evaluation/evaluation-templates.js
// Templates HTML pour le module d'évaluation

import { LIBELLES_TESTS, LIBELLES_GROUPES, COULEURS_GROUPES, getVMAFromPalier } from './evaluation-utils.js';

// ============================================================
// MENU PRINCIPAL
// ============================================================

export function templateVuePrincipale(data, classe) {
    const stats = calculerStatistiques(data);
    return `
        <div class="space-y-6">
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div>
                    <h2 class="text-xl font-black text-blue-400">📊 Évaluation des aptitudes physiques</h2>
                    <p class="text-xs text-slate-400">Classe : ${classe} | ${Object.keys(data.eleves).length} élèves</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.evalVoirResultats()" class="bg-indigo-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400">
                        📊 Voir les résultats
                    </button>
                    <button onclick="window.evalGenererFactices()" class="bg-purple-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400">
                        🧪 Données factices
                    </button>
                    <button onclick="window.evalOuvrirPurge()" class="bg-red-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-red-400">
                        🗑️ Gérer les données
                    </button>
                    <button onclick="window.evalExporterCSV()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400">
                        📥 Export CSV
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-3 md:grid-cols-7 gap-2">
                ${Object.keys(LIBELLES_TESTS).map(testId => {
                    const statsTest = stats[testId] || { total: 0, a_besoins: 0, fragile: 0, satisfaisant: 0 };
                    const pct = statsTest.total > 0 ? Math.round((statsTest.satisfaisant / statsTest.total) * 100) : 0;
                    return `
                        <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase">${LIBELLES_TESTS[testId].split('(')[0].trim()}</p>
                            <p class="text-lg font-black text-white">${statsTest.total}</p>
                            <div class="w-full h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                                <div class="h-full bg-emerald-500 rounded-full" style="width:${pct}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏆 Tests principaux (obligatoires)</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${['endurance', 'force', 'vitesse'].map(testId => templateCarteTest(testId, data)).join('')}
                </div>
            </div>

            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🧪 Tests complémentaires (facultatifs)</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    ${['equilibre', 'coordination', 'souplesse', 'endurance_musculaire'].map(testId => templateCarteTest(testId, data)).join('')}
                </div>
            </div>
        </div>
    `;
}

function templateCarteTest(testId, data) {
    const nbEleves = Object.values(data.eleves).filter(e => e.statut === 'present').length;
    const nbRemplis = Object.values(data.eleves).filter(e => e.resultats[testId] !== null).length;
    const pct = nbEleves > 0 ? Math.round((nbRemplis / nbEleves) * 100) : 0;
    const estRempli = nbRemplis === nbEleves && nbEleves > 0;

    return `
        <button onclick="window.evalLancerTest('${testId}')" 
                class="bg-slate-900 p-5 rounded-2xl border-2 ${estRempli ? 'border-emerald-500' : 'border-slate-600'} 
                       hover:border-blue-500 transition-all active:scale-95 text-left">
            <div class="flex justify-between items-start">
                <span class="text-lg font-black text-white">${LIBELLES_TESTS[testId]}</span>
                ${estRempli ? '<span class="text-emerald-400 text-xs font-black">✅</span>' : ''}
            </div>
            <div class="mt-2 flex justify-between text-xs text-slate-400">
                <span>${nbRemplis}/${nbEleves} élèves</span>
                <span>${pct}%</span>
            </div>
            <div class="w-full h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full" style="width:${pct}%"></div>
            </div>
            <p class="text-[10px] text-slate-500 mt-2">Cliquez pour passer le test</p>
        </button>
    `;
}

// ============================================================
// PASSATION (commun à tous les tests)
// ============================================================

export function templatePassation(testId, eleveEnCours, eleveSuivant, eleves, data, mode = 'individuel') {
    const libelle = LIBELLES_TESTS[testId] || testId;
    const resultat = eleveEnCours ? data.eleves[eleveEnCours.id]?.resultats?.[testId] : null;
    const isCollectif = (mode === 'collectif');

    const statut = eleveEnCours?.statut || 'present';
    let statutLabel = '✅ Présent';
    let statutClass = 'text-emerald-400';
    if (statut === 'absent') { statutLabel = '🚫 Absent'; statutClass = 'text-red-400'; }
    else if (statut === 'inapte') { statutLabel = '⚠️ Inapte'; statutClass = 'text-amber-400'; }

    return `
        <div class="space-y-4">
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <button onclick="window.evalRetourMenu()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                    ← Retour
                </button>
                <h3 class="font-black text-blue-400 uppercase text-sm">${libelle}</h3>
                <span class="text-xs text-slate-400">${eleves.filter(e => e.resultats[testId] !== null).length}/${eleves.length} terminés</span>
            </div>

            ${!isCollectif ? `
            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-blue-500">
                <div class="flex items-center gap-4">
                    <div id="eval-eleve-photo" class="w-16 h-16 rounded-full border-2 flex items-center justify-center text-3xl overflow-hidden bg-slate-700 border-slate-500">
                        <span class="text-3xl">${eleveEnCours?.prenom?.charAt(0) || '👤'}</span>
                    </div>
                    <div class="flex-1">
                        <p class="text-xl font-black text-white">${eleveEnCours ? `${eleveEnCours.prenom} ${eleveEnCours.nom}` : '--'}</p>
                        <p class="text-sm text-slate-400">Code : ${eleveEnCours?.id || '--'}</p>
                        <div class="flex gap-2 mt-1 flex-wrap">
                            <span id="eval-statut-label" class="text-xs font-bold ${statutClass}">${statutLabel}</span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <button onclick="window.evalSetStatut('absent')" 
                                class="px-3 py-1 text-xs font-black rounded-lg bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white transition-colors">
                            Absent
                        </button>
                        <button onclick="window.evalSetStatut('inapte')" 
                                class="px-3 py-1 text-xs font-black rounded-lg bg-slate-700 text-slate-300 hover:bg-amber-600 hover:text-white transition-colors">
                            Inapte
                        </button>
                        <button onclick="window.evalSetStatut('present')" 
                                class="px-3 py-1 text-xs font-black rounded-lg bg-slate-700 text-slate-300 hover:bg-emerald-600 hover:text-white transition-colors">
                            Présent
                        </button>
                    </div>
                    ${eleveSuivant ? `
                        <div class="text-right border-l border-slate-700 pl-4">
                            <p class="text-xs text-slate-400">Prochain :</p>
                            <div class="flex items-center gap-2 justify-end">
                                <div id="eval-prochain-photo" class="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm overflow-hidden bg-slate-700 border-slate-500">
                                    <span class="text-sm">${eleveSuivant.prenom?.charAt(0) || '👤'}</span>
                                </div>
                                <p class="font-bold text-white text-sm">${eleveSuivant.prenom} ${eleveSuivant.nom}</p>
                            </div>
                            <p class="text-xs text-amber-400">👀 se prépare</p>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <div id="eval-zone-saisie" class="bg-slate-800 p-6 rounded-2xl border border-slate-700 min-h-[300px]">
                <!-- Rempli dynamiquement -->
            </div>

            ${!isCollectif ? `
            <div class="flex gap-3">
                <button onclick="window.evalPasserSuivant()" class="flex-1 bg-blue-600 py-4 rounded-xl font-black text-white text-lg active:scale-95">
                    ✅ Suivant
                </button>
                <button onclick="window.evalTerminerTest()" class="bg-slate-700 px-6 py-4 rounded-xl font-black text-white text-sm active:scale-95">
                    ⏹ Terminer
                </button>
            </div>
            ` : ''}
        </div>
    `;
}

// ============================================================
// SAUT (slider + toise)
// ============================================================

export function templateSliderSaut(valeur, min = 0, max = 250, unite = 'cm') {
    const valCurseur = Math.max(min, Math.min(max, valeur));
    const pct = ((valCurseur - min) / (max - min)) * 100;

    return `
        <div class="space-y-3">
            <div class="relative w-full h-40 bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-2xl border-2 border-slate-600 overflow-hidden">
                <div class="absolute bottom-0 left-0 right-0 h-10 bg-emerald-900/50 flex items-end">
                    ${Array.from({ length: Math.floor((max - min) / 10) + 1 }, (_, i) => {
                        const val = min + i * 10;
                        const pos = ((val - min) / (max - min)) * 100;
                        return `
                            <div class="absolute bottom-0 flex flex-col items-center" style="left:${pos}%">
                                <div class="w-px h-3 bg-white/30"></div>
                                <span class="text-[6px] text-white/50">${val}</span>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="absolute inset-0 flex pointer-events-none" style="opacity:0.25;">
                    <div class="h-full bg-red-500" style="width:${((110 - min) / (max - min)) * 100}%;"></div>
                    <div class="h-full bg-amber-500" style="width:${((140 - 110) / (max - min)) * 100}%;"></div>
                    <div class="h-full bg-emerald-500" style="width:${((max - 140) / (max - min)) * 100}%;"></div>
                </div>

                <div class="absolute inset-0 pointer-events-none">
                    <div class="absolute top-0 w-px h-full bg-red-500/50 border-l border-dashed border-red-400/50" style="left:${((110 - min) / (max - min)) * 100}%;"></div>
                    <div class="absolute top-0 w-px h-full bg-amber-500/50 border-l border-dashed border-amber-400/50" style="left:${((140 - min) / (max - min)) * 100}%;"></div>
                </div>

                <div id="slider-bar" class="absolute bottom-0 w-1 h-28 bg-yellow-400 shadow-lg shadow-yellow-500/50 transition-all" 
                     style="left:${pct}%; transform: translateX(-50%);">
                    <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-yellow-400 rounded-full border-2 border-white shadow-lg"></div>
                </div>

                <div id="slider-score" class="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-1.5 rounded-xl z-10">
                    <span class="text-3xl font-black text-yellow-400">${valeur}</span>
                    <span class="text-xs text-white/70">${unite}</span>
                </div>
            </div>

            <div class="flex items-center justify-center gap-2">
                <button onclick="window.adjustSlider(-1)" class="bg-slate-700 w-14 h-14 rounded-2xl text-3xl font-black text-white active:scale-95 touch-manipulation">−</button>
                <input type="number" id="eval-input-manuel" value="${valeur}" step="1" min="0"
                       class="w-40 bg-slate-900 border-2 border-slate-600 rounded-xl p-3 text-center text-3xl font-black text-white">
                <button onclick="window.adjustSlider(1)" class="bg-slate-700 w-14 h-14 rounded-2xl text-3xl font-black text-white active:scale-95 touch-manipulation">+</button>
                <span class="text-sm text-slate-400 ml-1">cm</span>
            </div>

            <input type="range" id="eval-slider" min="${min}" max="${max}" step="1" value="${Math.min(max, Math.max(min, valeur))}"
                   class="w-full h-3 bg-slate-700 rounded-full appearance-none cursor-pointer 
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 
                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-400 
                          [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white"
                   oninput="window.evalUpdateSlider(this.value, 0, 250)">

            <div class="flex gap-3">
                <button onclick="window.evalValiderEssai()" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-lg active:scale-95">
                    ✅ Valider l'essai
                </button>
                <button onclick="window.evalEssaiSuivant()" class="bg-slate-600 px-4 py-3 rounded-xl font-black text-white text-lg active:scale-95">
                    ↩ Annuler
                </button>
            </div>
        </div>
    `;
}

// ============================================================
// SPRINT (chrono)
// ============================================================

export function templateChronoSprint(temps) {
    const affichage = temps !== null ? temps.toFixed(1) : '--';
    return `
        <div class="text-center py-8">
            <div class="text-8xl font-black tabular-nums text-yellow-400">${affichage}</div>
            <p class="text-sm text-slate-400 mt-2">secondes</p>
            <div class="mt-6 flex gap-4 justify-center">
                <button onclick="window.evalDemarrerChrono()" class="bg-emerald-600 px-8 py-4 rounded-xl font-black text-white text-xl active:scale-95">
                    ▶ Départ
                </button>
                <button onclick="window.evalArreterChrono()" class="bg-red-600 px-8 py-4 rounded-xl font-black text-white text-xl active:scale-95">
                    ⏹ Arrivée
                </button>
            </div>
            <div class="mt-4 text-xs text-slate-400">
                Essais : <span id="eval-nb-essais">0</span> / 3
            </div>
        </div>
    `;
}

// ============================================================
// VMA
// ============================================================

export function templateVMA(colonnes, palierEnCours, palierValide, tempsRestant, nbTermines, totalEleves, hasAudio) {
    const colonnesIds = ['g1', 'g2', 'f1', 'f2'];
    const labels = ['👦 Garçons', '👦 Garçons', '👩 Filles', '👩 Filles'];
    const classes = ['border-blue-800/30', 'border-blue-800/30', 'border-rose-800/30', 'border-rose-800/30'];

    const htmlColonnes = colonnesIds.map((colId, idx) => `
        <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed ${classes[idx]} min-h-[200px]">
            <div class="text-xs font-bold text-slate-400 uppercase mb-2">${labels[idx]}</div>
            <div id="eval-col-${colId}" class="space-y-2"></div>
        </div>
    `).join('');

    const affichePalierValide = palierValide >= 0 ? `Palier ${palierValide}` : '--';
    const audioStatus = hasAudio ? '✅' : '❌';

    return `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="text-center">
                    <p class="text-xs text-slate-400">Palier en cours</p>
                    <p class="text-4xl font-black text-yellow-400">Palier ${palierEnCours}</p>
                    <p class="text-sm text-slate-500">${tempsRestant}s restantes</p>
                </div>
                <div class="text-center border-l border-slate-700 pl-4">
                    <p class="text-xs text-slate-400">Dernier palier validé</p>
                    <p class="text-4xl font-black text-emerald-400">${affichePalierValide}</p>
                </div>
            </div>

            <div class="text-center text-xs text-slate-400">
                ${nbTermines} / ${totalEleves} élèves ont un palier validé
            </div>

            <div class="flex flex-wrap gap-2">
                <button onclick="window.evalVmaImporterAudio()" class="bg-purple-600 px-4 py-3 rounded-xl font-black text-xs text-white active:scale-95">
                    📁 Importer bande son ${audioStatus}
                </button>
                <button onclick="window.evalVmaDemarrer()" id="eval-vma-start" class="flex-1 min-w-[100px] bg-emerald-600 py-3 rounded-xl font-black text-white active:scale-95">
                    ▶ Démarrer
                </button>
                <button onclick="window.evalVmaTerminer()" id="eval-vma-stop" class="hidden flex-1 min-w-[100px] bg-red-600 py-3 rounded-xl font-black text-white active:scale-95">
                    ⏹ Terminer
                </button>
                <button onclick="window.evalVmaUndo()" class="bg-slate-600 px-4 py-3 rounded-xl font-black text-xs text-white active:scale-95">
                    ↩ Annuler
                </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${htmlColonnes}
            </div>
        </div>
    `;
}

// ============================================================
// TABLEAU DE BORD - avec VMA entre Palier et Force
// ============================================================

export function templateTableauBord(data, classe) {
    const eleves = Object.values(data.eleves).sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    const libellesCourts = {
        endurance: 'Palier',
        force: 'Force',
        vitesse: 'Vit.',
        equilibre: 'Éq.',
        coordination: 'Coord.',
        souplesse: 'Soupl.',
        endurance_musculaire: 'EM'
    };

    const stats = {};
    tests.forEach(testId => {
        const nb = eleves.filter(e => e.resultats[testId] !== null && e.resultats[testId]?.groupe !== null).length;
        stats[testId] = nb;
    });

    let html = `
        <div class="space-y-4">
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 flex-wrap gap-2">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">📊 Résultats de la classe</h3>
                    <p class="text-xs text-slate-400">${eleves.length} élèves · ${Object.values(data.eleves).filter(e => e.statut === 'present').length} présents</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.evalRetourMenu()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        ← Retour
                    </button>
                    <button onclick="window.evalExporterCSV()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">
                        📥 Export CSV
                    </button>
                    <button onclick="window.evalGenererFactices()" class="bg-purple-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-purple-400 active:scale-95">
                        🧪 Factices
                    </button>
                    <button onclick="window.evalOuvrirPurge()" class="bg-red-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-red-400 active:scale-95">
                        🗑️ Gérer les données
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-7 gap-1">
                ${tests.map(testId => `
                    <div class="bg-slate-800 p-2 rounded-xl text-center border border-slate-700">
                        <p class="text-[10px] font-bold text-slate-400 uppercase">${libellesCourts[testId]}</p>
                        <p class="text-lg font-black text-white">${stats[testId]}</p>
                        <p class="text-[9px] text-slate-500">/ ${eleves.length}</p>
                    </div>
                `).join('')}
            </div>

            <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-900 text-slate-400 text-xs uppercase border-b border-slate-700">
                        <tr>
                            <th class="p-3 font-bold sticky left-0 bg-slate-900">Élève</th>
                            <th class="p-3 font-bold text-center">Palier</th>
                            <th class="p-3 font-bold text-center bg-slate-900 text-emerald-400">VMA</th>
                            <th class="p-3 font-bold text-center">Force</th>
                            <th class="p-3 font-bold text-center">Vit.</th>
                            <th class="p-3 font-bold text-center">Éq.</th>
                            <th class="p-3 font-bold text-center">Coord.</th>
                            <th class="p-3 font-bold text-center">Soupl.</th>
                            <th class="p-3 font-bold text-center">EM</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${eleves.map(e => {
                            const bgRow = e.statut === 'absent' ? 'opacity-40' : '';
                            const statutBadge = e.statut === 'absent' ? '🚫' : (e.statut === 'inapte' ? '⚠️' : '');
                            
                            // Récupérer les résultats pour chaque test
                            const rEndurance = e.resultats.endurance;
                            const rForce = e.resultats.force;
                            const rVitesse = e.resultats.vitesse;
                            const rEquilibre = e.resultats.equilibre;
                            const rCoordination = e.resultats.coordination;
                            const rSouplesse = e.resultats.souplesse;
                            const rEM = e.resultats.endurance_musculaire;

                            // VMA
                            let vmaAffichage = '--';
                            if (rEndurance && rEndurance.palier !== undefined && rEndurance.palier !== null) {
                                const vma = getVMAFromPalier(rEndurance.palier);
                                if (vma !== null) vmaAffichage = vma.toFixed(1);
                            }

                            // Fonction pour formater une cellule
                            const formatCell = (result, testId) => {
                                if (!result || result.groupe === null) {
                                    return '<td class="p-3 text-center text-slate-500">--</td>';
                                }
                                const couleur = COULEURS_GROUPES[result.groupe] || '#64748b';
                                let valeur = '';
                                switch (testId) {
                                    case 'endurance': valeur = result.palier !== undefined ? result.palier : '--'; break;
                                    case 'force': valeur = result.meilleur !== undefined ? result.meilleur : '--'; break;
                                    case 'vitesse': valeur = result.meilleur !== undefined ? result.meilleur.toFixed(1) : '--'; break;
                                    case 'equilibre': valeur = result.temps !== undefined ? result.temps : '--'; break;
                                    case 'coordination': valeur = result.nb_lancers !== undefined ? result.nb_lancers : '--'; break;
                                    case 'souplesse': valeur = result.meilleur !== undefined ? result.meilleur : '--'; break;
                                    case 'endurance_musculaire': valeur = result.temps !== undefined ? result.temps : '--'; break;
                                    default: valeur = '--';
                                }
                                return `<td class="p-3 text-center"><span class="px-2 py-1 rounded-full text-xs font-black text-white" style="background-color:${couleur}">${valeur}</span></td>`;
                            };

                            return `
                                <tr class="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer ${bgRow}" 
                                    onclick="window.evalOuvrirFiche('${e.id}')">
                                    <td class="p-3 font-bold text-white sticky left-0 bg-slate-800 flex items-center gap-2">
                                        <span class="text-xs text-slate-400">${e.id}</span>
                                        <span>${e.prenom} ${e.nom}</span>
                                        ${statutBadge ? `<span class="text-xs">${statutBadge}</span>` : ''}
                                    </td>
                                    ${formatCell(rEndurance, 'endurance')}
                                    <td class="p-3 text-center font-black text-emerald-400">${vmaAffichage}</td>
                                    ${formatCell(rForce, 'force')}
                                    ${formatCell(rVitesse, 'vitesse')}
                                    ${formatCell(rEquilibre, 'equilibre')}
                                    ${formatCell(rCoordination, 'coordination')}
                                    ${formatCell(rSouplesse, 'souplesse')}
                                    ${formatCell(rEM, 'endurance_musculaire')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="flex justify-center gap-4 text-xs">
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> Satisfaisant</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-amber-500"></span> Fragile</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-red-500"></span> À besoins</span>
                <span class="flex items-center gap-1 text-slate-500"><span class="w-3 h-3 rounded-full bg-slate-600"></span> Non évalué</span>
            </div>
        </div>
    `;
    return html;
}

// ============================================================
// FICHE ÉLÈVE
// ============================================================

export function templateFicheEleve(eleve, data, modeEdition = false) {
    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    const libellesAffiches = {
        endurance: 'Endurance (Luc Léger)',
        force: 'Force (saut en longueur)',
        vitesse: 'Vitesse (30m)',
        equilibre: 'Équilibre (Flamingo)',
        coordination: 'Coordination (lancer/rattrapé)',
        souplesse: 'Souplesse (sit and reach)',
        endurance_musculaire: 'Endurance musculaire (chaise)'
    };
    const unites = {
        endurance: 'palier',
        force: 'cm',
        vitesse: 's',
        equilibre: 's',
        coordination: 'lancers',
        souplesse: 'cm',
        endurance_musculaire: 's'
    };

    let bgSexe = 'bg-slate-200 border-slate-400';
    if (eleve.sexe === 'M' || eleve.sexe === 'm') bgSexe = 'bg-blue-200 border-blue-400';
    else if (eleve.sexe === 'F' || eleve.sexe === 'f') bgSexe = 'bg-rose-200 border-rose-400';

    const aDesResultats = tests.some(t => eleve.resultats[t] !== null && eleve.resultats[t]?.groupe !== null);

    let statutLabel = '✅ Présent';
    let statutClass = 'text-emerald-400';
    if (eleve.statut === 'absent') { statutLabel = '🚫 Absent'; statutClass = 'text-red-400'; }
    else if (eleve.statut === 'inapte') { statutLabel = '⚠️ Inapte'; statutClass = 'text-amber-400'; }

    let html = `
        <div class="space-y-4">
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <button onclick="window.evalRetourResultats()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                    ← Retour
                </button>
                <h3 class="font-black text-blue-400 uppercase text-sm">Fiche élève</h3>
                <div class="flex gap-2">
                    <button onclick="window.evalToggleEdition()" class="${modeEdition ? 'bg-emerald-600' : 'bg-blue-600'} px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        ${modeEdition ? '💾 Enregistrer' : '✏️ Modifier'}
                    </button>
                    <button onclick="window.evalRetourMenu()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        ⏹ Quitter
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col items-center">
                    <div class="w-32 h-32 rounded-full ${bgSexe} border-4 border-slate-600 flex items-center justify-center text-6xl overflow-hidden">
                        <div id="eval-photo-container"></div>
                    </div>
                    <p class="text-2xl font-black text-white mt-4">${eleve.prenom} ${eleve.nom}</p>
                    <p class="text-sm text-slate-400">Code : ${eleve.id}</p>
                    <p class="text-sm ${statutClass} font-bold">${statutLabel}</p>
                    <p class="text-xs text-slate-500 mt-2">Sexe : ${eleve.sexe || 'Non renseigné'}</p>
                    ${!aDesResultats ? '<p class="text-xs text-amber-400 mt-2">⚠️ Aucun résultat enregistré</p>' : ''}
                    ${aDesResultats ? `
                        <div class="w-full mt-4">
                            <p class="text-xs font-bold text-slate-400 uppercase text-center mb-2">Profil</p>
                            <canvas id="eval-radar-canvas"></canvas>
                        </div>
                    ` : ''}
                </div>

                <div class="md:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <h4 class="font-black text-slate-400 uppercase text-xs mb-4">Résultats détaillés</h4>
                    <div class="space-y-3">
                        ${tests.map(testId => {
                            const r = eleve.resultats[testId];
                            const libelle = libellesAffiches[testId];
                            const unite = unites[testId];
                            
                            if (!r || r.groupe === null) {
                                return `
                                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                                        <span class="text-sm text-slate-400">${libelle}</span>
                                        <span class="text-sm text-slate-500">Non évalué</span>
                                    </div>
                                `;
                            }

                            const couleur = COULEURS_GROUPES[r.groupe] || '#64748b';
                            const libelleGroupe = LIBELLES_GROUPES[r.groupe] || '';
                            
                            let affichageValeur = '';
                            let essaisHtml = '';
                            let inputHtml = '';

                            switch (testId) {
                                case 'endurance':
                                    const vma = getVMAFromPalier(r.palier);
                                    const vmaStr = vma !== null ? vma.toFixed(1) : '--';
                                    affichageValeur = `Palier ${r.palier} → VMA : ${vmaStr} km/h`;
                                    if (modeEdition) {
                                        inputHtml = `
                                            <input type="number" id="edit-${testId}" value="${r.palier}" min="-1" max="20" 
                                                   class="w-20 bg-slate-900 border-2 border-slate-600 rounded-lg p-2 text-center text-white font-black">
                                            <span class="text-xs text-slate-500 ml-1">palier</span>
                                        `;
                                    }
                                    break;
                                case 'force':
                                case 'souplesse':
                                    affichageValeur = `${r.meilleur} ${unite}`;
                                    essaisHtml = r.essais ? `Essais : ${r.essais.join(', ')} ${unite}` : '';
                                    if (modeEdition) {
                                        inputHtml = `
                                            <input type="number" id="edit-${testId}" value="${r.meilleur}" step="1" 
                                                   class="w-24 bg-slate-900 border-2 border-slate-600 rounded-lg p-2 text-center text-white font-black">
                                            <span class="text-xs text-slate-500">${unite}</span>
                                        `;
                                    }
                                    break;
                                case 'vitesse':
                                    affichageValeur = `${r.meilleur.toFixed(1)} ${unite}`;
                                    essaisHtml = r.essais ? `Essais : ${r.essais.map(e => e.toFixed(1)).join(', ')} ${unite}` : '';
                                    if (modeEdition) {
                                        inputHtml = `
                                            <input type="number" id="edit-${testId}" value="${r.meilleur}" step="0.1" 
                                                   class="w-24 bg-slate-900 border-2 border-slate-600 rounded-lg p-2 text-center text-white font-black">
                                            <span class="text-xs text-slate-500">${unite}</span>
                                        `;
                                    }
                                    break;
                                case 'equilibre':
                                case 'endurance_musculaire':
                                    affichageValeur = `${r.temps} ${unite}`;
                                    if (modeEdition) {
                                        inputHtml = `
                                            <input type="number" id="edit-${testId}" value="${r.temps}" step="1" 
                                                   class="w-24 bg-slate-900 border-2 border-slate-600 rounded-lg p-2 text-center text-white font-black">
                                            <span class="text-xs text-slate-500">${unite}</span>
                                        `;
                                    }
                                    break;
                                case 'coordination':
                                    affichageValeur = `${r.nb_lancers} ${unite}`;
                                    if (modeEdition) {
                                        inputHtml = `
                                            <input type="number" id="edit-${testId}" value="${r.nb_lancers}" step="1" 
                                                   class="w-20 bg-slate-900 border-2 border-slate-600 rounded-lg p-2 text-center text-white font-black">
                                        `;
                                    }
                                    break;
                                default:
                                    affichageValeur = '--';
                            }

                            return `
                                <div class="bg-slate-900 p-3 rounded-xl border-l-4 flex justify-between items-center" style="border-color:${couleur}">
                                    <div>
                                        <span class="text-sm font-bold text-white">${libelle}</span>
                                        ${modeEdition ? inputHtml : `<span class="text-sm text-slate-300 ml-2">${affichageValeur}</span>`}
                                        ${essaisHtml ? `<span class="text-xs text-slate-500 ml-2">${essaisHtml}</span>` : ''}
                                    </div>
                                    <span class="text-xs font-black px-2 py-1 rounded-full text-white" style="background-color:${couleur}">
                                        ${libelleGroupe}
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="mt-4 p-3 bg-slate-900 rounded-xl border border-slate-700">
                        <div class="flex items-center gap-4">
                            <span class="text-sm font-bold text-white">Statut :</span>
                            ${modeEdition ? `
                                <select id="edit-statut" class="bg-slate-800 border border-slate-600 rounded p-1 text-white text-sm">
                                    <option value="present" ${eleve.statut === 'present' ? 'selected' : ''}>Présent</option>
                                    <option value="absent" ${eleve.statut === 'absent' ? 'selected' : ''}>Absent</option>
                                    <option value="inapte" ${eleve.statut === 'inapte' ? 'selected' : ''}>Inapte</option>
                                </select>
                            ` : `
                                <span class="text-sm ${statutClass}">${statutLabel}</span>
                            `}
                        </div>
                    </div>

                    ${modeEdition ? `
                        <div class="mt-4 flex gap-2">
                            <button onclick="window.evalSauvegarderFiche()" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                                💾 Sauvegarder les modifications
                            </button>
                            <button onclick="window.evalToggleEdition()" class="bg-slate-700 px-6 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                                ❌ Annuler
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    return html;
}

// ============================================================
// MODALE DE PURGE
// ============================================================

export function templateModalPurge(classe, stats, libelles, nbEleves) {
    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    
    return `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-black text-blue-400">🗑️ Gestion des données</h2>
                <button id="eval-purge-close" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                    ✖ Fermer
                </button>
            </div>
            
            <p class="text-sm text-slate-400 mb-4">
                Classe : <span class="font-bold text-white">${classe}</span> · 
                ${nbEleves} élèves · 
                ${total} résultat(s) enregistré(s)
            </p>
            
            <div class="space-y-2 mb-6">
                <p class="text-xs font-bold text-slate-500 uppercase">Purge par test</p>
                ${tests.map(testId => {
                    const count = stats[testId] || 0;
                    const libelle = libelles[testId] || testId;
                    const status = count > 0 ? `${count} résultats` : 'Aucun résultat';
                    const statusClass = count > 0 ? 'text-slate-300' : 'text-slate-500';
                    return `
                        <div class="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700">
                            <span class="text-sm text-white">${libelle}</span>
                            <div class="flex items-center gap-3">
                                <span class="text-xs ${statusClass}">${status}</span>
                                <button data-test="${testId}" class="eval-purge-test bg-red-600 px-3 py-1 rounded-lg font-black text-xs text-white active:scale-95 ${count === 0 ? 'opacity-40 cursor-not-allowed' : ''}" ${count === 0 ? 'disabled' : ''}>
                                    Purger
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="border-t border-slate-700 pt-4 space-y-3">
                <button id="eval-purge-all" class="w-full bg-amber-600 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                    🧹 Purger tous les résultats (${total} au total)
                </button>
                <button id="eval-purge-all-eleves" class="w-full bg-red-700 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                    💀 Supprimer toute la classe (élèves + résultats)
                </button>
            </div>
            
            <p class="text-[10px] text-slate-500 mt-4 text-center">
                ⚠️ Les purges sont irréversibles. Les données supprimées ne peuvent pas être récupérées.
            </p>
        </div>
    `;
}

// ============================================================
// STATISTIQUES (fonction interne)
// ============================================================

function calculerStatistiques(data) {
    const stats = {};
    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    const eleves = Object.values(data.eleves).filter(e => e.statut === 'present');
    tests.forEach(testId => {
        const resultats = eleves.map(e => e.resultats[testId]).filter(r => r !== null);
        stats[testId] = {
            total: resultats.length,
            a_besoins: resultats.filter(r => r.groupe === 'a_besoins').length,
            fragile: resultats.filter(r => r.groupe === 'fragile').length,
            satisfaisant: resultats.filter(r => r.groupe === 'satisfaisant').length
        };
    });
    return stats;
}