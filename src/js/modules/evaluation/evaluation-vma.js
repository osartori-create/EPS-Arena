// src/js/modules/evaluation/evaluation-vma.js
// Saisie de la VMA (Luc Léger) avec YouTube

import { setResultat, getResultat } from './evaluation-stockage.js';
import { groupeEndurance } from './evaluation-utils.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentData = null;
let currentTestId = 'endurance';
let currentEleves = [];
let player = null;
let offset = 34;
let palierEnCours = 0;
let palierValide = -1; // -1 = aucun palier validé (avant la fin de l'échauffement)
let tempsRestant = 0;
let isPlaying = false;
let intervalId = null;
let elevesResultats = {}; // { eleveId: palierValide }
let zoneSaisie = null;
let youtubeLoaded = false;
let historiquePaliers = [];

// Durée des paliers : palier 0 (échauffement) = 2 minutes, paliers suivants = 1 minute
const DUREE_PALIER_0 = 120; // secondes
const DUREE_PALIER_SUIVANT = 60; // secondes

/**
 * Calcule le palier en cours et le dernier palier validé
 * @param {number} tempsTest - Temps écoulé depuis le début du test (en secondes)
 * @returns {{ palierEnCours: number, palierValide: number, tempsRestant: number }}
 */
function calculerPaliers(tempsTest) {
    // Palier 0 (échauffement) : de 0 à 120s
    if (tempsTest < DUREE_PALIER_0) {
        return {
            palierEnCours: 0,
            palierValide: -1, // Aucun palier validé
            tempsRestant: Math.floor(DUREE_PALIER_0 - tempsTest)
        };
    }
    // Après l'échauffement, les paliers durent 60s
    const tempsApresPalier0 = tempsTest - DUREE_PALIER_0;
    const palierEnCours = 1 + Math.floor(tempsApresPalier0 / DUREE_PALIER_SUIVANT);
    // Le palier validé est le précédent : si on est dans le palier 1, on a validé le palier 0
    // Si on est dans le palier 2, on a validé le palier 1, etc.
    const palierValide = palierEnCours - 1;
    const restant = DUREE_PALIER_SUIVANT - (tempsApresPalier0 % DUREE_PALIER_SUIVANT);
    return {
        palierEnCours: palierEnCours,
        palierValide: palierValide,
        tempsRestant: Math.floor(restant)
    };
}

export function initSaisieVMA(zone, eleve, data, testId, eleves) {
    zoneSaisie = zone;
    currentData = data;
    currentTestId = testId;
    currentEleves = eleves.filter(e => e.statut === 'present');
    offset = data.config?.vma_offset || 34;
    historiquePaliers = [];

    elevesResultats = {};
    currentEleves.forEach(e => {
        const r = getResultat(data, e.id, testId);
        if (r && r.palier !== undefined) {
            elevesResultats[e.id] = r.palier;
        }
    });

    chargerYouTube();
    afficherVMA();
}

function chargerYouTube() {
    if (youtubeLoaded) return;
    if (typeof YT === 'undefined') {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    youtubeLoaded = true;
}

function afficherVMA() {
    if (isPlaying && player && typeof player.getCurrentTime === 'function') {
        try {
            const tempsVideo = player.getCurrentTime();
            const tempsTest = Math.max(0, tempsVideo - offset);
            const result = calculerPaliers(tempsTest);
            palierEnCours = result.palierEnCours;
            palierValide = result.palierValide;
            tempsRestant = result.tempsRestant;
        } catch (e) { /* ignorer */ }
    }

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

    const nbTermines = Object.keys(elevesResultats).filter(id => elevesResultats[id] !== undefined && elevesResultats[id] >= 0).length;

    zoneSaisie.innerHTML = templateVMA(colonnes, palierEnCours, palierValide, tempsRestant, nbTermines, currentEleves.length);

    window.evalVmaDemarrer = demarrerVMA;
    window.evalVmaPause = pauseVMA;
    window.evalVmaTerminer = terminerVMA;
    window.evalVmaClicEleve = clicEleveVMA;
    window.evalVmaUndo = undoVMA;

    remplirColonnesVMA(colonnes);

    if (typeof YT !== 'undefined' && YT.Player) {
        creerLecteur();
    } else {
        window.onYouTubeIframeAPIReady = creerLecteur;
    }
}

async function remplirColonnesVMA(colonnes) {
    const colonnesIds = ['g1', 'g2', 'f1', 'f2'];
    for (const colId of colonnesIds) {
        const container = document.getElementById(`eval-col-${colId}`);
        if (!container) continue;
        const eleves = colonnes[colId] || [];
        container.innerHTML = '';
        for (const e of eleves) {
            const carte = await createCarteVMA(e);
            container.appendChild(carte);
        }
    }
}

async function createCarteVMA(eleve) {
    const url = await getPhotoUrl(eleve.id);
    let bgClass = 'bg-slate-200 border-slate-400';
    if (eleve.sexe === 'M' || eleve.sexe === 'm') bgClass = 'bg-blue-200 border-blue-400';
    else if (eleve.sexe === 'F' || eleve.sexe === 'f') bgClass = 'bg-rose-200 border-rose-400';

    // PHOTO x3 : taille 24x24 au lieu de 8x8
    const photoHtml = url
        ? `<img src="${url}" class="w-12 h-12 rounded-full object-cover border-2 border-slate-500">`
        : `<div class="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-2xl text-white">${eleve.prenom?.charAt(0) || '?'}</div>`;

    const div = document.createElement('div');
    div.className = `eval-eleve-vma p-3 rounded-xl border-2 cursor-pointer hover:border-blue-500 active:scale-95 transition-all flex items-center gap-3 ${bgClass}`;
    div.dataset.id = eleve.id;

    const palier = elevesResultats[eleve.id];
    let palierText = '--';
    let palierClass = 'text-yellow-400';
    if (palier !== undefined) {
        if (palier === -1) {
            palierText = '❌ Échauff.';
            palierClass = 'text-red-400';
        } else {
            palierText = `Palier ${palier}`;
            palierClass = 'text-emerald-400';
        }
    }

    div.innerHTML = `
        ${photoHtml}
        <div class="flex-1">
            <p class="text-base font-bold text-slate-900">${eleve.prenom} ${eleve.nom}</p>
            <p class="text-xs text-slate-600">${eleve.id}</p>
        </div>
        <div class="text-right">
            <span class="text-sm font-black ${palierClass}" id="vma-palier-${eleve.id}">${palierText}</span>
        </div>
    `;

    if (palier !== undefined && palier >= 0) {
        div.classList.add('border-emerald-500', 'bg-emerald-950/20');
        div.classList.remove('hover:border-blue-500');
    } else if (palier === -1) {
        div.classList.add('border-red-400', 'bg-red-950/20');
        div.classList.remove('hover:border-blue-500');
    }

    div.addEventListener('click', (e) => {
        e.stopPropagation();
        window.evalVmaClicEleve(eleve.id);
    });

    return div;
}

function creerLecteur() {
    if (player) return;
    try {
        player = new YT.Player('eval-youtube-player', {
            height: '0',
            width: '0',
            videoId: 'gVp9kx8RKH0',
            playerVars: {
                controls: 0,
                modestbranding: 1,
                rel: 0,
                autoplay: 0,
                origin: window.location.origin
            },
            events: {
                onReady: () => { console.log('📹 YouTube prêt'); },
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.PLAYING) {
                        isPlaying = true;
                        demarrerMiseAJourPaliers();
                    } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                        isPlaying = false;
                        if (intervalId) clearInterval(intervalId);
                    }
                },
                onError: (err) => {
                    console.warn('⚠️ Erreur YouTube :', err);
                    setTimeout(() => {
                        if (player) player.playVideo();
                    }, 2000);
                }
            }
        });
    } catch (e) {
        console.error('Erreur création lecteur YouTube :', e);
    }
}

function demarrerMiseAJourPaliers() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
        if (!player || !isPlaying) return;
        try {
            const tempsVideo = player.getCurrentTime();
            const tempsTest = Math.max(0, tempsVideo - offset);
            const result = calculerPaliers(tempsTest);
            palierEnCours = result.palierEnCours;
            palierValide = result.palierValide;
            tempsRestant = result.tempsRestant;

            const elPalier = document.querySelector('#eval-zone-saisie .text-4xl.font-black.text-yellow-400');
            if (elPalier) elPalier.textContent = `Palier ${palierEnCours}`;

            const elValid = document.querySelector('#eval-zone-saisie .text-4xl.font-black.text-emerald-400');
            if (elValid) elValid.textContent = palierValide >= 0 ? `Palier ${palierValide}` : '--';

            const elRestant = document.querySelector('#eval-zone-saisie .text-sm.text-slate-500');
            if (elRestant) elRestant.textContent = `${tempsRestant}s restantes`;
        } catch (e) { /* ignore */ }
    }, 500);
}

function demarrerVMA() {
    if (player) {
        player.playVideo();
        document.getElementById('eval-vma-start')?.classList.add('hidden');
        document.getElementById('eval-vma-pause')?.classList.remove('hidden');
        document.getElementById('eval-vma-stop')?.classList.remove('hidden');
    }
}

function pauseVMA() {
    if (player) {
        if (isPlaying) {
            player.pauseVideo();
            document.getElementById('eval-vma-start')?.classList.remove('hidden');
            document.getElementById('eval-vma-start').textContent = '▶ Reprendre';
            document.getElementById('eval-vma-pause')?.classList.add('hidden');
        } else {
            player.playVideo();
            document.getElementById('eval-vma-start')?.classList.add('hidden');
            document.getElementById('eval-vma-pause')?.classList.remove('hidden');
        }
    }
}

function terminerVMA() {
    if (player) {
        player.pauseVideo();
        isPlaying = false;
        if (intervalId) clearInterval(intervalId);
    }

    // On considère que seuls les élèves ayant un palier >= 0 (qui ont fini l'échauffement) sont évalués
    const nonEvalues = currentEleves.filter(e => {
        const palier = elevesResultats[e.id];
        return palier === undefined || palier < 0;
    });

    if (nonEvalues.length > 0) {
        if (!confirm(`${nonEvalues.length} élève(s) n'ont pas validé l'échauffement. Terminer quand même ?`)) {
            return;
        }
    }

    currentEleves.forEach(e => {
        const palier = elevesResultats[e.id];
        if (palier !== undefined && palier >= 0) {
            const groupe = groupeEndurance(palier);
            setResultat(currentData, e.id, currentTestId, {
                palier: palier,
                groupe: groupe
            });
        } else {
            // Ceux qui n'ont pas validé l'échauffement : on ne sauvegarde rien ou on met palier -1 ?
            // On peut sauvegarder -1 pour mémoire, mais le groupe sera null
            setResultat(currentData, e.id, currentTestId, {
                palier: palier !== undefined ? palier : -1,
                groupe: null
            });
        }
    });

    alert('✅ VMA terminée !');
    if (window.evalTerminerTest) window.evalTerminerTest();
}

function clicEleveVMA(eleveId) {
    if (!isPlaying) {
        alert('▶️ Lancez d\'abord le test avec "Démarrer".');
        return;
    }

    const ancienPalier = elevesResultats[eleveId] !== undefined ? elevesResultats[eleveId] : null;
    const nouveauPalier = palierValide; // On attribue le palier VALIDÉ, pas le palier en cours !

    // Vérifier qu'on ne remet pas le même palier
    if (ancienPalier === nouveauPalier) {
        alert(`ℹ️ L'élève a déjà le palier ${nouveauPalier >= 0 ? nouveauPalier : 'échauffement non validé'}.`);
        return;
    }

    historiquePaliers.push({ eleveId, ancienPalier, nouveauPalier });
    elevesResultats[eleveId] = nouveauPalier;

    // Mise à jour de l'affichage
    const el = document.querySelector(`#vma-palier-${eleveId}`);
    if (el) {
        if (nouveauPalier === -1) {
            el.textContent = '❌ Échauff.';
            el.className = 'text-sm font-black text-red-400';
        } else {
            el.textContent = `Palier ${nouveauPalier}`;
            el.className = 'text-sm font-black text-emerald-400';
        }
    }
    const parent = el?.closest('.eval-eleve-vma');
    if (parent) {
        parent.classList.remove('border-emerald-500', 'bg-emerald-950/20', 'border-red-400', 'bg-red-950/20');
        if (nouveauPalier >= 0) {
            parent.classList.add('border-emerald-500', 'bg-emerald-950/20');
        } else {
            parent.classList.add('border-red-400', 'bg-red-950/20');
        }
        parent.classList.remove('hover:border-blue-500');
    }

    const span = document.querySelector('#eval-zone-saisie .text-xs.text-slate-400');
    if (span) {
        const nbTermines = Object.keys(elevesResultats).filter(id => elevesResultats[id] !== undefined && elevesResultats[id] >= 0).length;
        span.textContent = `${nbTermines}/${currentEleves.length} terminés`;
    }

    const tousValides = currentEleves.every(e => elevesResultats[e.id] !== undefined && elevesResultats[e.id] >= 0);
    if (tousValides) {
        setTimeout(() => {
            if (confirm('✅ Tous les élèves ont un palier validé ! Terminer le test ?')) {
                terminerVMA();
            }
        }, 500);
    }
}

function undoVMA() {
    if (historiquePaliers.length === 0) {
        alert('Aucune action à annuler.');
        return;
    }
    const dernier = historiquePaliers.pop();
    const { eleveId, ancienPalier } = dernier;

    if (ancienPalier !== null) {
        elevesResultats[eleveId] = ancienPalier;
    } else {
        delete elevesResultats[eleveId];
    }

    const el = document.querySelector(`#vma-palier-${eleveId}`);
    if (el) {
        if (ancienPalier !== null) {
            if (ancienPalier === -1) {
                el.textContent = '❌ Échauff.';
                el.className = 'text-sm font-black text-red-400';
            } else {
                el.textContent = `Palier ${ancienPalier}`;
                el.className = 'text-sm font-black text-emerald-400';
            }
        } else {
            el.textContent = '--';
            el.className = 'text-sm font-black text-yellow-400';
        }
    }
    const parent = el?.closest('.eval-eleve-vma');
    if (parent) {
        parent.classList.remove('border-emerald-500', 'bg-emerald-950/20', 'border-red-400', 'bg-red-950/20');
        if (ancienPalier !== null) {
            if (ancienPalier >= 0) {
                parent.classList.add('border-emerald-500', 'bg-emerald-950/20');
            } else {
                parent.classList.add('border-red-400', 'bg-red-950/20');
            }
            parent.classList.remove('hover:border-blue-500');
        } else {
            parent.classList.add('hover:border-blue-500');
        }
    }

    const span = document.querySelector('#eval-zone-saisie .text-xs.text-slate-400');
    if (span) {
        const nbTermines = Object.keys(elevesResultats).filter(id => elevesResultats[id] !== undefined && elevesResultats[id] >= 0).length;
        span.textContent = `${nbTermines}/${currentEleves.length} terminés`;
    }
}

function templateVMA(colonnes, palierEnCours, palierValide, tempsRestant, nbTermines, totalEleves) {
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
                <button onclick="window.evalVmaDemarrer()" id="eval-vma-start" class="flex-1 min-w-[100px] bg-emerald-600 py-3 rounded-xl font-black text-white active:scale-95">
                    ▶ Démarrer
                </button>
                <button onclick="window.evalVmaPause()" id="eval-vma-pause" class="hidden flex-1 min-w-[100px] bg-yellow-600 py-3 rounded-xl font-black text-white active:scale-95">
                    ⏸ Pause
                </button>
                <button onclick="window.evalVmaTerminer()" id="eval-vma-stop" class="hidden flex-1 min-w-[100px] bg-red-600 py-3 rounded-xl font-black text-white active:scale-95">
                    ⏹ Terminer
                </button>
                <button onclick="window.evalVmaUndo()" class="bg-slate-600 px-4 py-3 rounded-xl font-black text-xs text-white active:scale-95">
                    ↩ Annuler
                </button>
            </div>

            <div id="eval-youtube-player" class="w-full h-0"></div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${htmlColonnes}
            </div>
        </div>
    `;
}