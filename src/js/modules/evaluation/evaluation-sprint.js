// src/js/modules/evaluation/evaluation-sprint.js
// Saisie du Sprint 30m (style VMA : colonnes, sélection, bouton dynamique)

import { setResultat, getResultat, setStatutEleve } from './evaluation-stockage.js';
import { groupeVitesse } from './evaluation-utils.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentData = null;
let currentTestId = 'vitesse';
let currentEleves = [];
let zoneSaisie = null;
let eleveSelectionne = null;
let essaisParEleve = {};
let chronoRunning = false;
let chronoStart = 0;
let chronoElapsed = 0;
let rafId = null;
const maxEssais = 3;

// ============================================================
// INITIALISATION
// ============================================================

export function initSaisieSprint(zone, eleve, data, testId, eleves) {
    zoneSaisie = zone;
    currentData = data;
    currentTestId = testId;
    currentEleves = eleves.filter(e => e.statut === 'present');

    // Trier par nom
    currentEleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

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

    afficherSprint();
}

// ============================================================
// AFFICHAGE
// ============================================================

function afficherSprint() {
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
    const meilleurSel = essaisSel.length > 0 ? Math.min(...essaisSel) : null;
    const prochainEleve = currentEleves.find(e => 
        e.id !== eleveSelectionne && 
        (essaisParEleve[e.id]?.length || 0) < maxEssais
    );

    const affichageChrono = chronoRunning ? (chronoElapsed / 1000).toFixed(1) : (essaisSel.length > 0 ? essaisSel[essaisSel.length - 1].toFixed(1) : '0.0');

    zoneSaisie.innerHTML = `
        <div class="space-y-4">
            <!-- Header -->
            <div class="flex justify-between items-center bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <button onclick="window.evalRetourMenu()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">
                    ← Retour
                </button>
                <h3 class="font-black text-blue-400 uppercase text-sm">🏃 Sprint 30m</h3>
                <span class="text-xs text-slate-400">${nbTermines}/${currentEleves.length} terminés</span>
            </div>

            <!-- Élève sélectionné + prochain -->
            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-blue-500">
                <div class="flex items-center gap-6">
                    <div id="sprint-eleve-photo" class="w-24 h-24 rounded-full border-4 border-blue-500 overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center text-4xl">
                        <span class="text-4xl">${eleveSel?.prenom?.charAt(0) || '👤'}</span>
                    </div>
                    <div class="flex-1">
                        <p class="text-5xl font-black text-white">${eleveSel ? `${eleveSel.prenom} ${eleveSel.nom}` : 'Aucun'}</p>
                        <p class="text-sm text-slate-400">Code : ${eleveSel?.id || '--'}</p>
                        <p class="text-xs text-slate-500">Essai ${essaisSel.length + 1} / ${maxEssais}</p>
                        ${meilleurSel ? `<p class="text-xs text-yellow-400">Meilleur : ${meilleurSel.toFixed(1)}s</p>` : ''}
                    </div>
                    <!-- Chrono central -->
                    <div class="text-center">
                        <div class="text-8xl font-black tabular-nums text-yellow-400" id="sprint-chrono-display">${affichageChrono}</div>
                        <p class="text-sm text-slate-400">secondes</p>
                    </div>
                </div>

                <!-- Prochain élève -->
                ${prochainEleve ? `
                <div class="mt-3 border-t border-slate-700 pt-3 flex items-center gap-3">
                    <div id="sprint-prochain-photo" class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center text-sm">
                        <span class="text-sm">${prochainEleve.prenom?.charAt(0) || '👤'}</span>
                    </div>
                    <div>
                        <p class="text-xs text-slate-400">Prochain :</p>
                        <p class="text-base font-bold text-white">${prochainEleve.prenom} ${prochainEleve.nom}</p>
                    </div>
                    <span class="text-xs text-amber-400 ml-auto">👀 se prépare</span>
                </div>
                ` : ''}

                <!-- Bouton Démarrer/Arrêter agrandi -->
                <div class="mt-4">
                    ${essaisSel.length >= maxEssais ? `
                        <div class="text-emerald-400 font-bold text-sm">✅ 3 essais terminés</div>
                        <div class="mt-1 text-xs text-slate-400">Meilleur : ${meilleurSel?.toFixed(1)}s</div>
                    ` : `
                        <button id="sprint-main-btn" 
                                class="w-full py-6 rounded-2xl font-black text-3xl uppercase shadow-xl active:scale-95 transition-transform ${chronoRunning ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}">
                            ${chronoRunning ? '⏹ Arrêter' : '▶ Démarrer'}
                        </button>
                    `}
                    <div class="flex gap-2 mt-2">
                        <button onclick="window.evalSprintReset()" class="bg-slate-600 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                            ↺ Réinitialiser
                        </button>
                        ${essaisSel.length > 0 ? `
                            <button onclick="window.evalSprintAnnulerEssai()" class="bg-amber-600 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                                ↩ Annuler essai
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Essais -->
                ${essaisSel.length > 0 ? `
                    <div class="mt-2 text-xs text-slate-400 text-center">
                        Essais : ${essaisSel.map((t, i) => `
                            <span class="${t === meilleurSel ? 'text-yellow-400 font-black' : 'text-slate-400'}">${t.toFixed(1)}s</span>
                        `).join(' / ')}
                    </div>
                ` : ''}
            </div>

            <!-- Colonnes -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${templateColonnes(colonnes, eleveSelectionne, essaisParEleve)}
            </div>

            <!-- Légende -->
            <div class="flex justify-center gap-4 text-xs text-slate-400 flex-wrap">
                <span class="flex items-center gap-1">🔵 Clic = sélectionner</span>
                <span class="flex items-center gap-1">🟢 ✅ 3 essais</span>
                <span class="flex items-center gap-1">••• = changer statut</span>
                <span class="flex items-center gap-1">🟡 Meilleur temps en jaune</span>
            </div>
        </div>
    `;

    // Charger les photos
    if (eleveSelectionne) {
        chargerPhotoSprint(eleveSelectionne, 'sprint-eleve-photo');
    }
    if (prochainEleve) {
        chargerPhotoSprint(prochainEleve.id, 'sprint-prochain-photo');
    }

    // Attacher les événements des cartes
    document.querySelectorAll('.sprint-eleve-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.sprint-menu-btn')) return;
            const id = card.dataset.id;
            selectionnerEleve(id);
        });
    });

    document.querySelectorAll('.sprint-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const menu = btn.parentElement.querySelector('.sprint-menu-dropdown');
            if (menu) {
                menu.classList.toggle('hidden');
            }
        });
    });

    document.querySelectorAll('.sprint-menu-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = opt.dataset.id;
            const statut = opt.dataset.statut;
            setStatut(id, statut);
            document.querySelectorAll('.sprint-menu-dropdown').forEach(m => m.classList.add('hidden'));
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.sprint-menu-dropdown').forEach(m => m.classList.add('hidden'));
    });

    // Gestion du bouton principal
    const mainBtn = document.getElementById('sprint-main-btn');
    if (mainBtn) {
        mainBtn.addEventListener('click', () => {
            if (chronoRunning) {
                arreterChrono();
            } else {
                demarrerChrono();
            }
        });
    }

    setTimeout(() => chargerPhotosColonnes(), 100);
}

// ============================================================
// CHARGEMENT DES PHOTOS
// ============================================================

async function chargerPhotoSprint(eleveId, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    try {
        const url = await getPhotoUrl(eleveId);
        if (url) {
            container.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-full">`;
        } else {
            const eleve = currentData.eleves[eleveId];
            container.innerHTML = `<span class="${elementId === 'sprint-eleve-photo' ? 'text-4xl' : 'text-sm'}">${eleve?.prenom?.charAt(0) || '👤'}</span>`;
        }
    } catch (e) {
        const eleve = currentData.eleves[eleveId];
        container.innerHTML = `<span class="${elementId === 'sprint-eleve-photo' ? 'text-4xl' : 'text-sm'}">${eleve?.prenom?.charAt(0) || '👤'}</span>`;
    }
}

// ============================================================
// TEMPLATE DES COLONNES
// ============================================================

function templateColonnes(colonnes, eleveSelectionneId, essaisParEleve) {
    const colonnesIds = ['g1', 'g2', 'f1', 'f2'];
    const labels = ['👦 Garçons', '👦 Garçons', '👩 Filles', '👩 Filles'];
    const classes = ['border-blue-800/30', 'border-blue-800/30', 'border-rose-800/30', 'border-rose-800/30'];

    return colonnesIds.map((colId, idx) => `
        <div class="bg-slate-900 p-2 rounded-2xl border-2 border-dashed ${classes[idx]} min-h-[200px]">
            <div class="text-xs font-bold text-slate-400 uppercase mb-2">${labels[idx]}</div>
            <div id="sprint-col-${colId}" class="space-y-2">
                ${(colonnes[colId] || []).map(e => {
                    const essais = essaisParEleve[e.id] || [];
                    const meilleur = essais.length > 0 ? Math.min(...essais) : null;
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
                            return `<span class="${isBest ? 'text-yellow-400 font-black' : 'text-slate-400'}">${val.toFixed(1)}</span>`;
                        }
                        return `<span class="text-slate-600">__</span>`;
                    }).join(' / ');

                    const menuOptions = [
                        { label: '✅ Présent', statut: 'present' },
                        { label: '🚫 Absent', statut: 'absent' },
                        { label: '⚠️ Inapte', statut: 'inapte' }
                    ];

                    return `
                        <div class="sprint-eleve-card p-2 rounded-xl border-2 cursor-pointer hover:border-blue-500 transition-all flex items-center gap-2 ${bgClass} ${estSelectionne ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''} ${estTermine ? 'border-emerald-500 bg-emerald-950/20' : ''}"
                             data-id="${e.id}" data-nom="${e.prenom} ${e.nom}">
                            <div class="sprint-photo-container w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center text-sm">
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
                                <button class="sprint-menu-btn w-6 h-6 rounded-full bg-slate-700 text-white text-xs font-black hover:bg-slate-600 flex items-center justify-center" data-id="${e.id}">
                                    •••
                                </button>
                                <div class="sprint-menu-dropdown hidden absolute right-0 top-7 z-20 bg-slate-800 border border-slate-600 rounded-xl overflow-hidden shadow-xl min-w-[120px]">
                                    ${menuOptions.map(opt => `
                                        <div class="sprint-menu-option px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer transition-colors ${opt.statut === statut ? 'bg-slate-700' : ''}" 
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
}

// ============================================================
// ACTIONS
// ============================================================

function selectionnerEleve(eleveId) {
    if (chronoRunning) {
        if (!confirm('Un chrono est en cours. Arrêter et sélectionner un autre élève ?')) return;
        arreterChrono();
    }
    eleveSelectionne = eleveId;
    afficherSprint();
}

function demarrerChrono() {
    if (!eleveSelectionne) {
        alert('Sélectionnez d\'abord un élève en cliquant sur sa carte.');
        return;
    }
    const essais = essaisParEleve[eleveSelectionne] || [];
    if (essais.length >= maxEssais) {
        alert('Cet élève a déjà 3 essais.');
        return;
    }
    if (chronoRunning) return;

    chronoRunning = true;
    chronoStart = performance.now() - chronoElapsed;
    rafId = requestAnimationFrame(updateChrono);

    const btn = document.getElementById('sprint-main-btn');
    if (btn) {
        btn.textContent = '⏹ Arrêter';
        btn.className = 'w-full py-6 rounded-2xl font-black text-3xl uppercase shadow-xl active:scale-95 transition-transform bg-red-600 text-white';
    }
}

function arreterChrono() {
    if (!chronoRunning) return;
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    const temps = chronoElapsed / 1000;

    if (eleveSelectionne) {
        if (!essaisParEleve[eleveSelectionne]) essaisParEleve[eleveSelectionne] = [];
        essaisParEleve[eleveSelectionne].push(temps);
        const meilleur = Math.min(...essaisParEleve[eleveSelectionne]);
        const groupe = groupeVitesse(meilleur);
        setResultat(currentData, eleveSelectionne, currentTestId, {
            essais: essaisParEleve[eleveSelectionne],
            meilleur: meilleur,
            groupe: groupe
        });
    }

    chronoElapsed = 0;
    const eleveSel = currentEleves.find(e => e.id === eleveSelectionne);
    const essais = essaisParEleve[eleveSelectionne] || [];
    const prochain = currentEleves.find(e => 
        e.id !== eleveSelectionne && 
        (essaisParEleve[e.id]?.length || 0) < maxEssais
    );

    if (essais.length >= maxEssais) {
        // L'élève a terminé
        if (prochain) {
            if (confirm(`🏁 ${eleveSel.prenom} a terminé ses 3 essais.\nPasser à ${prochain.prenom} ${prochain.nom} ?`)) {
                selectionnerEleve(prochain.id);
            } else {
                afficherSprint();
            }
        } else {
            alert('🎉 Tous les élèves ont terminé leurs 3 essais !');
            afficherSprint();
        }
    } else {
        // Pas encore terminé
        if (prochain) {
            const choix = confirm(`✅ Essai enregistré (${essais.length}/${maxEssais}).\n\nPasser à ${prochain.prenom} ${prochain.nom} ?\n(Annuler pour continuer avec ${eleveSel.prenom})`);
            if (choix) {
                selectionnerEleve(prochain.id);
            } else {
                afficherSprint();
            }
        } else {
            afficherSprint();
        }
    }
}

function updateChrono() {
    if (!chronoRunning) return;
    chronoElapsed = performance.now() - chronoStart;
    const display = document.getElementById('sprint-chrono-display');
    if (display) {
        display.textContent = (chronoElapsed / 1000).toFixed(1);
    }
    rafId = requestAnimationFrame(updateChrono);
}

function resetChrono() {
    if (chronoRunning) {
        chronoRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
    }
    chronoElapsed = 0;
    const display = document.getElementById('sprint-chrono-display');
    if (display) {
        display.textContent = '0.0';
    }
    const btn = document.getElementById('sprint-main-btn');
    if (btn) {
        btn.textContent = '▶ Démarrer';
        btn.className = 'w-full py-6 rounded-2xl font-black text-3xl uppercase shadow-xl active:scale-95 transition-transform bg-emerald-600 text-white';
    }
    afficherSprint();
}

function annulerEssaiSprint() {
    if (!eleveSelectionne) return;
    const essais = essaisParEleve[eleveSelectionne] || [];
    if (essais.length === 0) {
        alert('Aucun essai à annuler.');
        return;
    }
    essais.pop();
    const meilleur = essais.length > 0 ? Math.min(...essais) : null;
    const groupe = meilleur !== null ? groupeVitesse(meilleur) : null;
    
    setResultat(currentData, eleveSelectionne, currentTestId, {
        essais: essais,
        meilleur: meilleur,
        groupe: groupe
    });
    essaisParEleve[eleveSelectionne] = essais;
    afficherSprint();
}

window.evalSprintAnnulerEssai = annulerEssaiSprint;

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
        afficherSprint();
    });
}

// ============================================================
// CHARGEMENT DES PHOTOS DES COLONNES
// ============================================================

async function chargerPhotosColonnes() {
    const containers = document.querySelectorAll('.sprint-photo-container');
    for (const container of containers) {
        const card = container.closest('.sprint-eleve-card');
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
window.evalSprintReset = resetChrono;
window.evalSprintSelectionner = selectionnerEleve;
window.evalSprintSetStatut = setStatut;
window.evalSprintAnnulerEssai = annulerEssaiSprint;