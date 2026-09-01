// src/js/modules/evaluation/evaluation-saut.js
// Saisie du Saut en longueur (style VMA : colonnes, sélection, slider central)

import { setResultat, getResultat, setStatutEleve } from './evaluation-stockage.js';
import { groupeForce } from './evaluation-utils.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentData = null;
let currentTestId = 'force';
let currentEleves = [];
let zoneSaisie = null;
let eleveSelectionne = null;
let essaisParEleve = {};
let valeurSlider = 120;
const maxEssais = 3;
const minSlider = 0;
const maxSlider = 250;

// ============================================================
// INITIALISATION
// ============================================================

export function initSaisieSaut(zone, eleve, data, testId, eleves) {
    zoneSaisie = zone;
    currentData = data;
    currentTestId = testId;
    currentEleves = eleves.filter(e => e.statut === 'present');

    essaisParEleve = {};
    currentEleves.forEach(e => {
        const r = getResultat(data, e.id, testId);
        if (r && r.essais) {
            essaisParEleve[e.id] = [...r.essais];
        } else {
            essaisParEleve[e.id] = [];
        }
    });

    const premier = currentEleves.find(e => essaisParEleve[e.id].length < maxEssais) || currentEleves[0];
    eleveSelectionne = premier?.id || null;

    afficherSaut();
}

// ============================================================
// AFFICHAGE
// ============================================================

function afficherSaut() {
    const garcons = currentEleves.filter(e => e.sexe === 'M' || e.sexe === 'm');
    const filles = currentEleves.filter(e => e.sexe === 'F' || e.sexe === 'f');
    const autres = currentEleves.filter(e => e.sexe !== 'M' && e.sexe !== 'm' && e.sexe !== 'F' && e.sexe !== 'f');

    const moitieGarcons = Math.ceil(garcons.length / 2);
    const moitieFilles = Math.ceil(filles.length / 2);

    const colonnes = {
        g1: garcons.slice(0, moitieGarcons),
        g2: garcons.slice(moitieGarcons),
        f1: filles.slice(0, moitieFilles),
        f2: filles.slice(moitieFilles)
    };
    colonnes.g1 = [...colonnes.g1, ...autres];

    const nbTermines = currentEleves.filter(e => essaisParEleve[e.id]?.length >= maxEssais).length;
    const eleveSel = currentEleves.find(e => e.id === eleveSelectionne);
    const essaisSel = eleveSel ? (essaisParEleve[eleveSel.id] || []) : [];
    const meilleurSel = essaisSel.length > 0 ? Math.max(...essaisSel) : null;

    if (essaisSel.length === 0) {
        valeurSlider = 120;
    } else if (essaisSel.length === 1) {
        valeurSlider = essaisSel[0];
    } else {
        valeurSlider = Math.max(...essaisSel);
    }

    zoneSaisie.innerHTML = templateSaut(
        colonnes,
        eleveSelectionne,
        eleveSel,
        essaisParEleve,
        nbTermines,
        currentEleves.length,
        valeurSlider,
        essaisSel,
        meilleurSel
    );

    window.evalSautValider = validerEssai;
    window.evalSautAnnuler = annulerEssai;
    window.evalSautSelectionner = selectionnerEleve;

    // Attacher les événements des cartes
    document.querySelectorAll('.saut-eleve-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.saut-menu-btn')) return;
            const id = card.dataset.id;
            selectionnerEleve(id);
        });
    });

    document.querySelectorAll('.saut-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const menu = btn.parentElement.querySelector('.saut-menu-dropdown');
            if (menu) {
                menu.classList.toggle('hidden');
            }
        });
    });

    document.querySelectorAll('.saut-menu-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = opt.dataset.id;
            const statut = opt.dataset.statut;
            setStatut(id, statut);
            document.querySelectorAll('.saut-menu-dropdown').forEach(m => m.classList.add('hidden'));
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.saut-menu-dropdown').forEach(m => m.classList.add('hidden'));
    });

    // Slider et input
    const slider = document.getElementById('saut-slider');
    const input = document.getElementById('saut-input-manuel');
    if (slider) {
        slider.addEventListener('input', () => {
            valeurSlider = parseFloat(slider.value);
            if (input) input.value = valeurSlider;
            updateSliderDisplay(valeurSlider);
        });
    }
    if (input) {
        input.addEventListener('input', () => {
            let val = parseFloat(input.value);
            if (isNaN(val)) val = 0;
            valeurSlider = val;
            if (slider) {
                if (val < minSlider) slider.value = minSlider;
                else if (val > maxSlider) slider.value = maxSlider;
                else slider.value = val;
            }
            updateSliderDisplay(valeurSlider);
        });
    }

    setTimeout(() => chargerPhotos(), 100);
}

// ============================================================
// MISE À JOUR DE L'AFFICHAGE DU SLIDER
// ============================================================

function updateSliderDisplay(valeur) {
    // Mettre à jour le score sur la toise
    const scoreDisplay = document.getElementById('saut-score-display');
    if (scoreDisplay) {
        scoreDisplay.textContent = valeur;
    }
    // Mettre à jour la position du curseur
    const curseur = document.getElementById('saut-curseur');
    if (curseur) {
        const pct = (valeur / maxSlider) * 100;
        curseur.style.left = Math.min(100, Math.max(0, pct)) + '%';
    }
    // Mettre à jour les essais
    const essaisContainer = document.getElementById('saut-essais-display');
    if (essaisContainer) {
        const eleveSel = currentEleves.find(e => e.id === eleveSelectionne);
        if (eleveSel) {
            const essais = essaisParEleve[eleveSel.id] || [];
            const meilleur = essais.length > 0 ? Math.max(...essais) : null;
            if (essais.length > 0) {
                essaisContainer.innerHTML = essais.map(t => {
                    const isBest = (t === meilleur);
                    return `<span class="${isBest ? 'text-yellow-400 font-black' : 'text-slate-400'}">${t}</span>`;
                }).join(' / ') + ' <span class="text-sm text-slate-500">cm</span>';
            } else {
                essaisContainer.innerHTML = '<span class="text-slate-600">__ / __ / __</span>';
            }
        }
    }
}

// ============================================================
// TEMPLATE
// ============================================================

function templateSaut(colonnes, eleveSelectionneId, eleveSel, essaisParEleve, nbTermines, totalEleves, valeurSlider, essaisSel, meilleurSel) {
    const colonnesIds = ['g1', 'g2', 'f1', 'f2'];
    const labels = ['👦 Garçons', '👦 Garçons', '👩 Filles', '👩 Filles'];
    const classes = ['border-blue-800/30', 'border-blue-800/30', 'border-rose-800/30', 'border-rose-800/30'];

    const htmlColonnes = colonnesIds.map((colId, idx) => `
        <div class="bg-slate-900 p-2 rounded-2xl border-2 border-dashed ${classes[idx]} min-h-[200px]">
            <div class="text-xs font-bold text-slate-400 uppercase mb-2">${labels[idx]}</div>
            <div id="saut-col-${colId}" class="space-y-2">
                ${(colonnes[colId] || []).map(e => {
                    const essais = essaisParEleve[e.id] || [];
                    const meilleur = essais.length > 0 ? Math.max(...essais) : null;
                    const estSelectionne = e.id === eleveSelectionneId;
                    const estTermine = essais.length >= maxEssais;
                    const statut = currentData.eleves[e.id]?.statut || 'present';
                    const isAbsent = statut === 'absent';
                    const isInapte = statut === 'inapte';

                    let bgClass = 'bg-slate-200 border-slate-400';
                    if (e.sexe === 'M' || e.sexe === 'm') bgClass = 'bg-blue-200 border-blue-400';
                    else if (e.sexe === 'F' || e.sexe === 'f') bgClass = 'bg-rose-200 border-rose-400';

                    if (isAbsent) bgClass = 'bg-red-200 border-red-400 opacity-60';
                    else if (isInapte) bgClass = 'bg-orange-200 border-orange-400 opacity-60';

                    const statutBadge = isAbsent ? '🚫' : (isInapte ? '⚠️' : '');

                    const affichageEssais = Array.from({ length: maxEssais }, (_, i) => {
                        if (i < essais.length) {
                            const val = essais[i];
                            const isBest = (val === meilleur);
                            return `<span class="${isBest ? 'text-yellow-400 font-black' : 'text-slate-400'}">${val}</span>`;
                        }
                        return `<span class="text-slate-600">__</span>`;
                    }).join(' / ');

                    const menuOptions = [
                        { label: '✅ Présent', statut: 'present' },
                        { label: '🚫 Absent', statut: 'absent' },
                        { label: '⚠️ Inapte', statut: 'inapte' }
                    ];

                    return `
                        <div class="saut-eleve-card p-2 rounded-xl border-2 cursor-pointer hover:border-blue-500 transition-all flex items-center gap-2 ${bgClass} ${estSelectionne ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''} ${estTermine ? 'border-emerald-500 bg-emerald-950/20' : ''}"
                             data-id="${e.id}" data-nom="${e.prenom} ${e.nom}">
                            <div class="saut-photo-container w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center text-sm">
                                <span class="text-sm">${e.prenom?.charAt(0) || '👤'}</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-slate-900 truncate">${e.prenom} ${e.nom}</p>
                                <p class="text-[10px] text-slate-600">${e.id}</p>
                                ${statutBadge ? `<p class="text-[10px] font-bold ${isAbsent ? 'text-red-600' : 'text-orange-600'}">${statutBadge}</p>` : ''}
                            </div>
                            <div class="text-right flex-shrink-0">
                                <div class="text-[11px] font-mono">${affichageEssais}</div>
                                <div class="text-[10px] text-slate-500">${essais.length}/${maxEssais}</div>
                                ${estTermine ? '<div class="text-xs font-black text-emerald-600">✅</div>' : ''}
                            </div>
                            <div class="relative flex-shrink-0 ml-1">
                                <button class="saut-menu-btn w-6 h-6 rounded-full bg-slate-700 text-white text-xs font-black hover:bg-slate-600 flex items-center justify-center" data-id="${e.id}">
                                    •••
                                </button>
                                <div class="saut-menu-dropdown hidden absolute right-0 top-7 z-20 bg-slate-800 border border-slate-600 rounded-xl overflow-hidden shadow-xl min-w-[120px]">
                                    ${menuOptions.map(opt => `
                                        <div class="saut-menu-option px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer transition-colors ${opt.statut === statut ? 'bg-slate-700' : ''}" 
                                             data-id="${e.id}" data-statut="${opt.statut}">
                                            ${opt.label}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');

    const nbEssais = essaisSel.length;

    return `
        <div class="space-y-4">
            <!-- Barre de navigation -->
            <div class="flex justify-between items-center bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <button onclick="window.evalRetourMenu()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">
                    ← Retour
                </button>
                <h3 class="font-black text-blue-400 uppercase text-sm">📏 Saut en longueur</h3>
                <span class="text-xs text-slate-400">${nbTermines}/${totalEleves} terminés</span>
            </div>

            <!-- Slider central -->
            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-blue-500">
                <div class="text-center">
                    <p class="text-xs text-slate-400">Élève sélectionné : <span class="font-bold text-white">${eleveSel ? `${eleveSel.prenom} ${eleveSel.nom}` : 'Aucun'}</span></p>
                    <p class="text-xs text-slate-500">Essai ${nbEssais + 1} / ${maxEssais}</p>
                </div>

                <!-- TOISE AVEC SCORE INTÉGRÉ (PAS DE SCORE BLANC À L'EXTÉRIEUR) -->
                <div class="relative w-full h-40 mt-2 bg-gradient-to-b from-emerald-800 to-emerald-600 rounded-2xl border-2 border-slate-600 overflow-hidden">
                    <!-- Graduations -->
                    <div class="absolute bottom-0 left-0 right-0 h-8 bg-emerald-900/50 flex items-end">
                        ${Array.from({ length: 26 }, (_, i) => {
                            const val = i * 10;
                            const pos = (val / maxSlider) * 100;
                            return `
                                <div class="absolute bottom-0 flex flex-col items-center" style="left:${pos}%">
                                    <div class="w-px h-3 bg-white/30"></div>
                                    <span class="text-[6px] text-white/50">${val}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <!-- Bandes de couleur -->
                    <div class="absolute inset-0 flex pointer-events-none" style="opacity:0.25;">
                        <div class="h-full bg-red-500" style="width:${(110 / maxSlider) * 100}%;"></div>
                        <div class="h-full bg-amber-500" style="width:${(30 / maxSlider) * 100}%;"></div>
                        <div class="h-full bg-emerald-500" style="width:${((maxSlider - 140) / maxSlider) * 100}%;"></div>
                    </div>
                    <!-- Repères -->
                    <div class="absolute inset-0 pointer-events-none">
                        <div class="absolute top-0 w-px h-full bg-red-500/50 border-l border-dashed border-red-400/50" style="left:${(110 / maxSlider) * 100}%;"></div>
                        <div class="absolute top-0 w-px h-full bg-amber-500/50 border-l border-dashed border-amber-400/50" style="left:${(140 / maxSlider) * 100}%;"></div>
                    </div>
                    <!-- Curseur -->
                    <div id="saut-curseur" class="absolute bottom-0 w-1 h-28 bg-yellow-400 shadow-lg shadow-yellow-500/50 transition-all" 
                         style="left:${(valeurSlider / maxSlider) * 100}%; transform: translateX(-50%);">
                        <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white shadow-lg"></div>
                    </div>
                    <!-- SCORE AFFICHÉ EN JAUNE SUR LA TOISE (UNIQUEMENT ICI) -->
                    <div class="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 px-6 py-1.5 rounded-xl z-10">
                        <span id="saut-score-display" class="text-3xl font-black text-yellow-400">${valeurSlider}</span>
                        <span class="text-xs text-white/70">cm</span>
                    </div>
                </div>

                <!-- Contrôles du slider -->
                <div class="flex gap-3 mt-3 items-center">
                    <input type="range" id="saut-slider" min="${minSlider}" max="${maxSlider}" step="1" value="${Math.min(maxSlider, Math.max(minSlider, valeurSlider))}"
                           class="flex-1 h-2 bg-slate-700 rounded-full appearance-none cursor-pointer 
                                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 
                                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-400 
                                  [&::-webkit-slider-thumb]:border-3 [&::-webkit-slider-thumb]:border-white">
                    <input type="number" id="saut-input-manuel" value="${valeurSlider}" step="1" min="0"
                           class="w-24 bg-slate-900 border-2 border-slate-600 rounded-xl p-2 text-center text-xl font-black text-white">
                    <span class="text-sm text-slate-400">cm</span>
                </div>

                <!-- AFFICHAGE DES ESSAIS : 114 / 122 / 110 (meilleur en jaune) -->
                <div id="saut-essais-display" class="text-center mt-2 text-lg font-mono">
                    ${essaisSel.length > 0 ? essaisSel.map((t, i) => {
                        const isBest = (t === meilleurSel);
                        return `<span class="${isBest ? 'text-yellow-400 font-black' : 'text-slate-400'}">${t}</span>`;
                    }).join(' / ') + ' <span class="text-sm text-slate-500">cm</span>' : '<span class="text-slate-600">__ / __ / __</span>'}
                </div>

                <!-- Boutons -->
                <div class="flex gap-3 mt-3">
                    <button onclick="window.evalSautValider()" id="saut-valider-btn" 
                            class="flex-1 bg-emerald-600 py-4 rounded-xl font-black text-white text-lg active:scale-95 ${nbEssais >= maxEssais ? 'opacity-50 cursor-not-allowed' : ''}" 
                            ${nbEssais >= maxEssais ? 'disabled' : ''}>
                        ✅ Valider l'essai
                    </button>
                    <button onclick="window.evalSautAnnuler()" id="saut-annuler-btn" 
                            class="bg-slate-600 px-6 py-4 rounded-xl font-black text-white text-lg active:scale-95 ${nbEssais === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                            ${nbEssais === 0 ? 'disabled' : ''}>
                        ↩ Annuler
                    </button>
                </div>
            </div>

            <!-- 4 colonnes -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${htmlColonnes}
            </div>

            <!-- Légende -->
            <div class="flex justify-center gap-4 text-xs text-slate-400 flex-wrap">
                <span class="flex items-center gap-1">🔵 Clic = sélectionner</span>
                <span class="flex items-center gap-1">🟢 ✅ 3 essais</span>
                <span class="flex items-center gap-1">••• = changer statut</span>
                <span class="flex items-center gap-1">🟡 Meilleur essai en jaune</span>
                <span class="flex items-center gap-1">🔴 ≤ 110 cm</span>
                <span class="flex items-center gap-1">🟠 111-140 cm</span>
                <span class="flex items-center gap-1">🟢 > 140 cm</span>
            </div>
        </div>
    `;
}

// ============================================================
// ACTIONS
// ============================================================

function selectionnerEleve(eleveId) {
    eleveSelectionne = eleveId;
    afficherSaut();
}

function validerEssai() {
    if (!eleveSelectionne) {
        alert('Sélectionnez d\'abord un élève.');
        return;
    }
    const essais = essaisParEleve[eleveSelectionne] || [];
    if (essais.length >= maxEssais) {
        alert('Cet élève a déjà 3 essais.');
        return;
    }

    const valeur = valeurSlider;
    if (valeur < 0) {
        alert('Valeur invalide.');
        return;
    }

    essais.push(valeur);
    const meilleur = Math.max(...essais);
    const groupe = groupeForce(meilleur);

    setResultat(currentData, eleveSelectionne, currentTestId, {
        essais: essais,
        meilleur: meilleur,
        groupe: groupe
    });

    essaisParEleve[eleveSelectionne] = essais;

    if (essais.length >= maxEssais) {
        const suivant = currentEleves.find(e => (essaisParEleve[e.id]?.length || 0) < maxEssais && e.id !== eleveSelectionne);
        if (suivant) {
            setTimeout(() => {
                selectionnerEleve(suivant.id);
            }, 400);
        } else {
            setTimeout(() => {
                alert('🎉 Tous les élèves ont terminé leurs 3 essais !');
                afficherSaut();
            }, 300);
        }
    } else {
        afficherSaut();
    }
}

function annulerEssai() {
    if (!eleveSelectionne) return;
    const essais = essaisParEleve[eleveSelectionne] || [];
    if (essais.length === 0) {
        alert('Aucun essai à annuler.');
        return;
    }

    essais.pop();
    const meilleur = essais.length > 0 ? Math.max(...essais) : null;
    const groupe = meilleur !== null ? groupeForce(meilleur) : null;

    setResultat(currentData, eleveSelectionne, currentTestId, {
        essais: essais,
        meilleur: meilleur,
        groupe: groupe
    });

    essaisParEleve[eleveSelectionne] = essais;
    afficherSaut();
}

function setStatut(eleveId, statut) {
    setStatutEleve(currentData, eleveId, statut);
    import('./evaluation-stockage.js').then(module => {
        const elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentData.classe}`) || '[]');
        currentData = module.loadOrCreateData(currentData.classe, elevesData);
        currentData.classe = currentData.classe;
        currentEleves.forEach(e => {
            const r = getResultat(currentData, e.id, currentTestId);
            if (r && r.essais) {
                essaisParEleve[e.id] = [...r.essais];
            }
        });
        afficherSaut();
    });
}

// ============================================================
// CHARGEMENT DES PHOTOS
// ============================================================

async function chargerPhotos() {
    const containers = document.querySelectorAll('.saut-photo-container');
    for (const container of containers) {
        const card = container.closest('.saut-eleve-card');
        if (!card) continue;
        const eleveId = card.dataset.id;
        try {
            const url = await getPhotoUrl(eleveId);
            if (url) {
                container.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-full">`;
            }
        } catch (e) { /* ignorer */ }
    }
}

// Exposer les fonctions globales
window.evalSautValider = validerEssai;
window.evalSautAnnuler = annulerEssai;
window.evalSautSelectionner = selectionnerEleve;
window.evalSautSetStatut = setStatut;