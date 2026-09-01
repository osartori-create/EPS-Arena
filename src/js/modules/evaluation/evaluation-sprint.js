// src/js/modules/evaluation/evaluation-sprint.js
// Saisie du Sprint 30m (style VMA : colonnes, sélection, gros bouton central)

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

    essaisParEleve = {};
    currentEleves.forEach(e => {
        const r = getResultat(data, e.id, testId);
        if (r && r.essais) {
            essaisParEleve[e.id] = [...r.essais];
        } else {
            essaisParEleve[e.id] = [];
        }
    });

    // Sélectionner le premier élève sans 3 essais
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

    zoneSaisie.innerHTML = templateSprint(
        colonnes,
        eleveSelectionne,
        eleveSel,
        essaisParEleve,
        nbTermines,
        currentEleves.length,
        chronoRunning,
        chronoElapsed
    );

    // Exposer les fonctions
    window.evalSprintDemarrer = demarrerChrono;
    window.evalSprintArreter = arreterChrono;
    window.evalSprintReset = resetChrono;
    window.evalSprintSelectionner = selectionnerEleve;
    window.evalSprintSetStatut = setStatut;

    // Attacher les événements aux cartes
    document.querySelectorAll('.sprint-eleve-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            selectionnerEleve(id);
        });
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const id = card.dataset.id;
            const eleve = currentData.eleves[id];
            if (!eleve) return;
            const statutActuel = eleve.statut || 'present';
            const choix = prompt(
                `Changer le statut de ${eleve.prenom} ${eleve.nom} :\n1 - Présent\n2 - Absent\n3 - Inapte`,
                statutActuel === 'present' ? '1' : (statutActuel === 'absent' ? '2' : '3')
            );
            if (choix === '1') setStatut(id, 'present');
            else if (choix === '2') setStatut(id, 'absent');
            else if (choix === '3') setStatut(id, 'inapte');
        });
    });

    // Charger les photos après rendu
    setTimeout(() => chargerPhotos(), 100);
}

// ============================================================
// TEMPLATE
// ============================================================

function templateSprint(colonnes, eleveSelectionneId, eleveSel, essaisParEleve, nbTermines, totalEleves, chronoRunning, chronoElapsed) {
    const colonnesIds = ['g1', 'g2', 'f1', 'f2'];
    const labels = ['👦 Garçons', '👦 Garçons', '👩 Filles', '👩 Filles'];
    const classes = ['border-blue-800/30', 'border-blue-800/30', 'border-rose-800/30', 'border-rose-800/30'];

    const htmlColonnes = colonnesIds.map((colId, idx) => `
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

                    const statutBadge = isAbsent ? '🚫 Absent' : (isInapte ? '⚠️ Inapte' : '');

                    // Construction de l'affichage des essais
                    let essaisHtml = '';
                    if (estTermine) {
                        essaisHtml = `<div class="text-xs font-black text-emerald-600">✅ Terminé</div>`;
                    }
                    // Affichage des 3 essais : 5.2 / 4.9 / __
                    const affichageEssais = Array.from({ length: maxEssais }, (_, i) => {
                        if (i < essais.length) {
                            const val = essais[i];
                            const isBest = (val === meilleur);
                            return `<span class="${isBest ? 'text-yellow-400 font-black' : 'text-slate-400'}">${val.toFixed(1)}</span>`;
                        }
                        return `<span class="text-slate-600">__</span>`;
                    }).join(' / ');

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
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');

    const affichageChrono = chronoElapsed > 0 ? (chronoElapsed / 1000).toFixed(1) : '0.0';
    const nomEleveSel = eleveSel ? `${eleveSel.prenom} ${eleveSel.nom}` : 'Aucun';
    const essaisSel = eleveSel ? (essaisParEleve[eleveSel.id] || []) : [];
    const estTermineSel = essaisSel.length >= maxEssais;

    return `
        <div class="space-y-4">
            <!-- Barre de navigation -->
            <div class="flex justify-between items-center bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <button onclick="window.evalRetourMenu()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">
                    ← Retour
                </button>
                <h3 class="font-black text-blue-400 uppercase text-sm">🏃 Sprint 30m</h3>
                <span class="text-xs text-slate-400">${nbTermines}/${totalEleves} terminés</span>
            </div>

            <!-- Chrono central - GROS BOUTON -->
            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-blue-500">
                <div class="text-center">
                    <p class="text-xs text-slate-400">Élève sélectionné : <span class="font-bold text-white">${nomEleveSel}</span></p>
                    <div class="text-8xl font-black tabular-nums text-yellow-400" id="sprint-chrono-display">${affichageChrono}</div>
                    <p class="text-sm text-slate-400">secondes</p>
                    ${estTermineSel ? `
                        <div class="mt-2 text-emerald-400 font-bold text-sm">✅ 3 essais terminés</div>
                    ` : `
                        <button onclick="window.evalSprintDemarrer()" id="sprint-main-btn" 
                                class="w-full mt-3 py-6 rounded-2xl font-black text-2xl uppercase shadow-xl active:scale-95 transition-transform ${chronoRunning ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}">
                            ${chronoRunning ? '⏹ Arrêter' : '▶ Démarrer'}
                        </button>
                    `}
                    <button onclick="window.evalSprintReset()" class="mt-2 bg-slate-600 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        ↺ Réinitialiser
                    </button>
                    <div class="mt-2 text-xs text-slate-500">
                        Essais : ${essaisSel.map((t, i) => `
                            <span class="${t === Math.min(...essaisSel) ? 'text-yellow-400 font-black' : 'text-slate-400'}">${t.toFixed(1)}s</span>
                        `).join(' / ')}
                        ${essaisSel.length === 0 ? '<span class="text-slate-600">Aucun essai</span>' : ''}
                    </div>
                </div>
            </div>

            <!-- 4 colonnes -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${htmlColonnes}
            </div>

            <!-- Légende -->
            <div class="flex justify-center gap-4 text-xs text-slate-400">
                <span class="flex items-center gap-1">🔵 Clic = sélectionner</span>
                <span class="flex items-center gap-1">🟢 ✅ 3 essais</span>
                <span class="flex items-center gap-1">🔄 Clic droit = statut</span>
                <span class="flex items-center gap-1">🟡 Meilleur temps en jaune</span>
            </div>
        </div>
    `;
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
    afficherSprint();
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
    afficherSprint();

    // Vérifier si l'élève a fini ses 3 essais
    const essais = essaisParEleve[eleveSelectionne] || [];
    if (essais.length >= maxEssais) {
        const suivant = currentEleves.find(e => (essaisParEleve[e.id]?.length || 0) < maxEssais && e.id !== eleveSelectionne);
        if (suivant) {
            setTimeout(() => {
                selectionnerEleve(suivant.id);
            }, 500);
        } else {
            setTimeout(() => {
                alert('🎉 Tous les élèves ont terminé leurs 3 essais !');
            }, 300);
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
    const btn = document.getElementById('sprint-main-btn');
    if (btn && chronoRunning) {
        btn.textContent = '⏹ Arrêter';
        btn.className = 'w-full mt-3 py-6 rounded-2xl font-black text-2xl uppercase shadow-xl active:scale-95 transition-transform bg-red-600 text-white';
    }
    rafId = requestAnimationFrame(updateChrono);
}

function resetChrono() {
    if (chronoRunning) {
        chronoRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
    }
    chronoElapsed = 0;
    afficherSprint();
}

function setStatut(eleveId, statut) {
    setStatutEleve(currentData, eleveId, statut);
    // Recharger les élèves
    const elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentData.classe}`) || '[]');
    import('./evaluation-stockage.js').then(module => {
        currentData = module.loadOrCreateData(currentData.classe, elevesData);
        currentData.classe = currentData.classe;
        // Mettre à jour les essais depuis les données rechargées
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
// CHARGEMENT DES PHOTOS
// ============================================================

async function chargerPhotos() {
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

// Exposer les fonctions
window.evalSprintDemarrer = demarrerChrono;
window.evalSprintArreter = arreterChrono;
window.evalSprintReset = resetChrono;
window.evalSprintSelectionner = selectionnerEleve;
window.evalSprintSetStatut = setStatut;