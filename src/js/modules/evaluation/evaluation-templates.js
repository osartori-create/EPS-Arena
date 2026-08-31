// src/js/modules/evaluation/evaluation-templates.js
// Templates HTML pour le module d'évaluation

/**
 * Template de la vue principale (liste des tests)
 */
export function templateVuePrincipale(data, classe) {
    const stats = calculerStatistiques(data);
    
    return `
        <div class="space-y-6">
            <!-- En-tête -->
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div>
                    <h2 class="text-xl font-black text-blue-400">📊 Évaluation des aptitudes physiques</h2>
                    <p class="text-xs text-slate-400">Classe : ${classe} | ${Object.keys(data.eleves).length} élèves</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.evalGenererFactices()" class="bg-purple-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400">
                        🧪 Données factices
                    </button>
                    <button onclick="window.evalReinitialiser()" class="bg-red-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-red-400">
                        🗑️ Réinitialiser
                    </button>
                    <button onclick="window.evalExporterCSV()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400">
                        📥 Export CSV
                    </button>
                </div>
            </div>

            <!-- Statistiques rapides -->
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

            <!-- Tests principaux -->
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏆 Tests principaux (obligatoires)</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${['endurance', 'force', 'vitesse'].map(testId => templateCarteTest(testId, data)).join('')}
                </div>
            </div>

            <!-- Tests complémentaires -->
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🧪 Tests complémentaires (facultatifs)</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    ${['equilibre', 'coordination', 'souplesse', 'endurance_musculaire'].map(testId => templateCarteTest(testId, data)).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Template d'une carte de test
 */
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

/**
 * Template de la vue de passation
 */
export function templatePassation(testId, eleveEnCours, eleveSuivant, eleves, data) {
    const libelle = LIBELLES_TESTS[testId] || testId;
    const resultat = eleveEnCours ? data.eleves[eleveEnCours.id]?.resultats?.[testId] : null;
    
    return `
        <div class="space-y-4">
            <!-- Barre de navigation -->
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <button onclick="window.evalRetourMenu()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                    ← Retour
                </button>
                <h3 class="font-black text-blue-400 uppercase text-sm">${libelle}</h3>
                <span class="text-xs text-slate-400">${eleves.filter(e => e.resultats[testId] !== null).length}/${eleves.length} terminés</span>
            </div>

            <!-- Élève en cours -->
            <div class="bg-slate-800 p-6 rounded-2xl border-2 border-blue-500">
                <div class="flex items-center gap-6">
                    <div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-4xl">
                        ${eleveEnCours ? eleveEnCours.prenom?.charAt(0) || '👤' : '👤'}
                    </div>
                    <div class="flex-1">
                        <p class="text-2xl font-black text-white">${eleveEnCours ? `${eleveEnCours.prenom} ${eleveEnCours.nom}` : '--'}</p>
                        <p class="text-sm text-slate-400">Code : ${eleveEnCours?.id || '--'}</p>
                        ${resultat ? `<p class="text-xs text-emerald-400">✅ Test terminé</p>` : ''}
                    </div>
                    ${eleveSuivant ? `
                        <div class="text-right border-l border-slate-700 pl-4">
                            <p class="text-xs text-slate-400">Prochain :</p>
                            <p class="font-bold text-white text-sm">${eleveSuivant.prenom} ${eleveSuivant.nom}</p>
                            <p class="text-xs text-amber-400">👀 se prépare</p>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Zone de saisie spécifique au test -->
            <div id="eval-zone-saisie" class="bg-slate-800 p-6 rounded-2xl border border-slate-700 min-h-[300px]">
                <!-- Rempli dynamiquement par le module spécifique -->
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
                <button onclick="window.evalPasserSuivant()" class="flex-1 bg-blue-600 py-4 rounded-xl font-black text-white text-lg active:scale-95">
                    ✅ Suivant
                </button>
                <button onclick="window.evalTerminerTest()" class="bg-slate-700 px-6 py-4 rounded-xl font-black text-white text-sm active:scale-95">
                    ⏹ Terminer
                </button>
            </div>
        </div>
    `;
}

/**
 * Template du slider géant pour le saut
 */
export function templateSliderSaut(valeur, min = 50, max = 250, unite = 'cm') {
    const pct = Math.max(0, Math.min(100, ((valeur - min) / (max - min)) * 100));
    
    return `
        <div class="space-y-6">
            <!-- Représentation visuelle du tapis -->
            <div class="relative w-full h-48 bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-2xl border-4 border-slate-600 overflow-hidden">
                <!-- Graduations -->
                <div class="absolute bottom-0 left-0 right-0 h-12 bg-emerald-900/50 flex items-end">
                    ${Array.from({ length: Math.floor((max - min) / 10) + 1 }, (_, i) => {
                        const val = min + i * 10;
                        const pos = ((val - min) / (max - min)) * 100;
                        return `
                            <div class="absolute bottom-0 flex flex-col items-center" style="left:${pos}%">
                                <div class="w-px h-4 bg-white/30"></div>
                                <span class="text-[8px] text-white/50">${val}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <!-- Curseur -->
                <div class="absolute bottom-0 w-2 h-32 bg-yellow-400 shadow-lg shadow-yellow-500/50 transition-all" 
                     style="left:${pct}%">
                    <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-yellow-400 rounded-full border-2 border-white shadow-lg"></div>
                </div>
                <!-- Affichage de la valeur -->
                <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 px-6 py-2 rounded-xl">
                    <span class="text-4xl font-black text-yellow-400">${valeur}</span>
                    <span class="text-sm text-white/70">${unite}</span>
                </div>
            </div>

            <!-- Contrôles -->
            <div class="flex gap-4 items-center">
                <div class="flex-1">
                    <input type="range" id="eval-slider" min="${min}" max="${max}" step="1" value="${valeur}"
                           class="w-full h-3 bg-slate-700 rounded-full appearance-none cursor-pointer 
                                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 
                                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-400 
                                  [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white">
                </div>
                <div class="w-28">
                    <input type="number" id="eval-input-manuel" value="${valeur}" min="${min}" max="${max}" step="1"
                           class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3 text-center text-2xl font-black text-white">
                </div>
            </div>

            <div class="flex gap-3">
                <button onclick="window.evalValiderEssai()" class="flex-1 bg-emerald-600 py-4 rounded-xl font-black text-white text-xl active:scale-95">
                    ✅ Valider l'essai
                </button>
                <button onclick="window.evalEssaiSuivant()" class="bg-blue-600 px-6 py-4 rounded-xl font-black text-white active:scale-95">
                    Essai suivant →
                </button>
            </div>
        </div>
    `;
}

/**
 * Template du chrono pour le sprint
 */
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

/**
 * Template de la vue VMA (4 colonnes)
 */
export function templateVMA(elevesParColonne, palierActuel, palierValide, tempsRestant) {
    const colonnes = [
        { id: 'g1', label: '👦 Garçons', class: 'border-blue-800/30' },
        { id: 'g2', label: '👦 Garçons', class: 'border-blue-800/30' },
        { id: 'f1', label: '👩 Filles', class: 'border-rose-800/30' },
        { id: 'f2', label: '👩 Filles', class: 'border-rose-800/30' }
    ];

    const htmlColonnes = colonnes.map((col, idx) => `
        <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed ${col.class} min-h-[200px]">
            <div class="text-xs font-bold text-slate-400 uppercase mb-2">${col.label}</div>
            <div id="eval-col-${col.id}" class="space-y-2">
                ${(elevesParColonne[col.id] || []).map(e => `
                    <div class="eval-eleve-vma bg-slate-800 p-2 rounded-xl border border-slate-700 cursor-pointer hover:border-blue-500 active:scale-95 transition-all"
                         data-id="${e.id}" onclick="window.evalVmaClicEleve('${e.id}')">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm">${e.prenom?.charAt(0) || '?'}</div>
                            <div class="flex-1">
                                <p class="text-sm font-bold text-white">${e.prenom} ${e.nom}</p>
                                <p class="text-[10px] text-slate-400">${e.id}</p>
                            </div>
                            <div class="text-right">
                                <span class="text-xs font-black text-yellow-400" id="vma-palier-${e.id}">--</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    return `
        <div class="space-y-4">
            <!-- Affichage des paliers -->
            <div class="grid grid-cols-2 gap-4 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="text-center">
                    <p class="text-xs text-slate-400">Palier en cours</p>
                    <p class="text-4xl font-black text-yellow-400">Palier ${palierActuel}</p>
                    <p class="text-sm text-slate-500">${tempsRestant}s restantes</p>
                </div>
                <div class="text-center border-l border-slate-700 pl-4">
                    <p class="text-xs text-slate-400">Dernier palier validé</p>
                    <p class="text-4xl font-black text-emerald-400">Palier ${palierValide}</p>
                </div>
            </div>

            <!-- Contrôles vidéo -->
            <div class="flex gap-3">
                <button onclick="window.evalVmaDemarrer()" id="eval-vma-start" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white active:scale-95">
                    ▶ Démarrer le test
                </button>
                <button onclick="window.evalVmaPause()" id="eval-vma-pause" class="hidden bg-yellow-600 px-6 py-3 rounded-xl font-black text-white active:scale-95">
                    ⏸ Pause
                </button>
                <button onclick="window.evalVmaTerminer()" id="eval-vma-stop" class="hidden bg-red-600 px-6 py-3 rounded-xl font-black text-white active:scale-95">
                    ⏹ Terminer
                </button>
            </div>

            <!-- Lecture seule de la vidéo YouTube (audio) -->
            <div id="eval-youtube-player" class="w-full h-0"></div>

            <!-- 4 colonnes -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${htmlColonnes}
            </div>
        </div>
    `;
}

/**
 * Calcule les statistiques par test
 */
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