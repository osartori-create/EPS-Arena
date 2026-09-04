// src/js/modules/evaluation/evaluation-vma.js
// Saisie de la VMA (Luc Léger) avec fichier audio local importé
// Chrono indépendant basé sur performance.now()
// Palier 0 = 154s (2min échauffement + 34s intro)

import { setResultat, getResultat } from './evaluation-stockage.js';
import { groupeEndurance } from './evaluation-utils.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentData = null;
let currentTestId = 'endurance';
let currentEleves = [];
let audioElement = null;
let tempsTest = 0; // temps de test en secondes (commence à 0)
let tempsTestStart = 0; // référence performance.now() au démarrage
let palierEnCours = 0;
let palierValide = -1;
let tempsRestant = 0;
let isPlaying = false;
let intervalId = null;
let elevesResultats = {};
let zoneSaisie = null;
let historiquePaliers = [];

// Palier 0 = 154s (2min + 34s d'intro), les suivants = 60s
const DUREE_PALIER_0 = 154;
const DUREE_PALIER_SUIVANT = 60;

// ============================================================
// GESTION DU FICHIER AUDIO EN INDEXEDDB
// ============================================================

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EPS_Arena_AudioDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('audio')) {
                db.createObjectStore('audio', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveAudioToDB(blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('audio', 'readwrite');
        const store = tx.objectStore('audio');
        const request = store.put({ id: 'luc_leger', blob: blob });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

async function loadAudioFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('audio', 'readonly');
        const store = tx.objectStore('audio');
        const request = store.get('luc_leger');
        request.onsuccess = () => resolve(request.result ? request.result.blob : null);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function chargerAudioDepuisDB() {
    try {
        const blob = await loadAudioFromDB();
        if (blob) {
            const url = URL.createObjectURL(blob);
            if (audioElement) {
                audioElement.src = url;
                audioElement.load();
                console.log('✅ Audio chargé depuis IndexedDB, durée :', audioElement.duration);
                return true;
            }
        }
        return false;
    } catch (e) {
        console.warn('Erreur chargement audio :', e);
        return false;
    }
}

// ============================================================
// CALCUL DES PALIERS (avant utilisation)
// ============================================================

function calculerPaliers(tempsTest) {
    if (tempsTest < DUREE_PALIER_0) {
        return {
            palierEnCours: 0,
            palierValide: -1,
            tempsRestant: Math.floor(DUREE_PALIER_0 - tempsTest)
        };
    }
    const tempsApresPalier0 = tempsTest - DUREE_PALIER_0;
    const palierEnCours = 1 + Math.floor(tempsApresPalier0 / DUREE_PALIER_SUIVANT);
    const palierValide = palierEnCours - 1;
    const restant = DUREE_PALIER_SUIVANT - (tempsApresPalier0 % DUREE_PALIER_SUIVANT);
    return {
        palierEnCours: palierEnCours,
        palierValide: palierValide,
        tempsRestant: Math.floor(restant)
    };
}

// ============================================================
// INITIALISATION
// ============================================================

export function initSaisieVMA(zone, eleve, data, testId, eleves) {
    zoneSaisie = zone;
    currentData = data;
    currentTestId = testId;
    currentEleves = eleves.filter(e => e.statut === 'present');
    historiquePaliers = [];

    // Réinitialiser le chrono
    tempsTest = 0;
    palierEnCours = 0;
    palierValide = -1;
    tempsRestant = DUREE_PALIER_0;

    elevesResultats = {};
    currentEleves.forEach(e => {
        const r = getResultat(data, e.id, testId);
        if (r && r.palier !== undefined) {
            elevesResultats[e.id] = r.palier;
        }
    });

    if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.id = 'eval-audio-player';
        audioElement.style.display = 'none';
        audioElement.preload = 'auto';
        document.body.appendChild(audioElement);
        
        audioElement.addEventListener('play', () => {
            console.log('🔊 Audio play event');
            isPlaying = true;
        });
        audioElement.addEventListener('ended', () => {
            console.log('🔚 Audio ended');
            isPlaying = false;
        });
        audioElement.addEventListener('loadedmetadata', () => {
            console.log('📋 Audio metadata chargée, durée :', audioElement.duration);
        });
        audioElement.addEventListener('canplaythrough', () => {
            console.log('✅ Audio prêt à être joué');
        });
    }

    chargerAudioDepuisDB().then((loaded) => {
        afficherVMA(loaded);
    }).catch(() => {
        afficherVMA(false);
    });
}

// ============================================================
// AFFICHAGE
// ============================================================

function afficherVMA(hasAudio) {
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

    zoneSaisie.innerHTML = templateVMA(
        colonnes,
        palierEnCours,
        palierValide,
        tempsRestant,
        nbTermines,
        currentEleves.length,
        hasAudio || false
    );

    window.evalVmaDemarrer = demarrerVMA;
    window.evalVmaTerminer = terminerVMA;
    window.evalVmaClicEleve = clicEleveVMA;
    window.evalVmaUndo = undoVMA;
    window.evalVmaImporterAudio = importerAudio;

    remplirColonnesVMA(colonnes);
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

// ============================================================
// IMPORT DU FICHIER AUDIO
// ============================================================

async function importerAudio() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3,.m4a,.wav,.aac,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav';
    input.multiple = false;
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        console.log('📁 Fichier sélectionné :', file.name, file.type, file.size);
        try {
            await saveAudioToDB(file);
            const loaded = await chargerAudioDepuisDB();
            if (loaded) {
                alert('✅ Fichier audio importé avec succès !');
                afficherVMA(true);
            } else {
                alert('❌ Erreur lors du chargement du fichier.');
            }
        } catch (err) {
            console.error(err);
            alert('❌ Erreur d\'import : ' + err.message);
        }
        input.value = '';
    };
    input.click();
}

// ============================================================
// MISE À JOUR DU CHRONO
// ============================================================

function demarrerMiseAJourPaliers() {
    if (intervalId) clearInterval(intervalId);
    console.log('⏱️ Démarrage du chrono VMA');
    intervalId = setInterval(() => {
        mettreAJourPaliers();
    }, 200);
}

function mettreAJourPaliers() {
    if (tempsTestStart > 0) {
        const elapsed = (performance.now() - tempsTestStart) / 1000;
        tempsTest = elapsed;
    }
    
    const result = calculerPaliers(tempsTest);
    palierEnCours = result.palierEnCours;
    palierValide = result.palierValide;
    tempsRestant = result.tempsRestant;

    // Mettre à jour l'affichage
    const elPalier = document.querySelector('#eval-zone-saisie .text-4xl.font-black.text-yellow-400');
    if (elPalier) elPalier.textContent = `Palier ${palierEnCours}`;

    const elValid = document.querySelector('#eval-zone-saisie .text-4xl.font-black.text-emerald-400');
    if (elValid) elValid.textContent = palierValide >= 0 ? `Palier ${palierValide}` : '--';

    const elRestant = document.querySelector('#eval-zone-saisie .text-sm.text-slate-500');
    if (elRestant) elRestant.textContent = `${tempsRestant}s restantes`;
}

// ============================================================
// CONTROLES (Démarrer / Terminer)
// ============================================================

function demarrerVMA() {
    if (!audioElement || !audioElement.src) {
        alert('⚠️ Aucun fichier audio importé. Cliquez sur "📁 Importer bande son" d\'abord.');
        return;
    }

    if (audioElement.readyState < 2) {
        alert('⏳ Fichier audio en cours de chargement... Réessayez dans quelques secondes.');
        return;
    }

    // Lancer le chrono
    tempsTestStart = performance.now();
    tempsTest = 0;
    demarrerMiseAJourPaliers();
    isPlaying = true;

    // Mettre à jour l'interface
    document.getElementById('eval-vma-start')?.classList.add('hidden');
    document.getElementById('eval-vma-stop')?.classList.remove('hidden');

    // Lancer le son au début (0s)
    audioElement.currentTime = 0;
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
        playPromise.catch(err => {
            console.warn('❌ Erreur lecture audio :', err);
            // Le chrono continue de tourner même sans son
        });
    }
}

// Dans la fonction terminerVMA, ajouter la sauvegarde pour tous les élèves
function terminerVMA() {
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }
    isPlaying = false;
    if (intervalId) clearInterval(intervalId);
    tempsTestStart = 0;
    tempsTest = 0;

    // Sauvegarder les résultats pour chaque élève qui a un palier validé
    let aDesResultats = false;
    currentEleves.forEach(e => {
        const palier = elevesResultats[e.id];
        if (palier !== undefined && palier >= 0) {
            const groupe = groupeEndurance(palier);
            setResultat(currentData, e.id, currentTestId, {
                palier: palier,
                groupe: groupe
            });
            aDesResultats = true;
        }
    });

    // Revenir à l'état initial
    document.getElementById('eval-vma-start')?.classList.remove('hidden');
    document.getElementById('eval-vma-stop')?.classList.add('hidden');
    
    // Arrêter la mise à jour du chrono
    if (intervalId) clearInterval(intervalId);
    
    // Mettre à jour l'interface pour refléter la fin
    afficherVMA(chargerAudioDepuisDB);
    
    if (aDesResultats) {
        alert('✅ VMA terminée ! Résultats sauvegardés.');
    } else {
        alert('ℹ️ Aucun résultat enregistré. Cliquez sur les élèves pour valider leurs paliers.');
    }
    
    // Retourner au menu
    if (window.evalTerminerTest) window.evalTerminerTest();
}

// ============================================================
// GESTION DES ÉLÈVES
// ============================================================

function clicEleveVMA(eleveId) {
    if (!isPlaying) {
        alert('▶️ Lancez d\'abord le test avec "Démarrer".');
        return;
    }

    const ancienPalier = elevesResultats[eleveId] !== undefined ? elevesResultats[eleveId] : null;
    const nouveauPalier = palierValide;

    if (ancienPalier === nouveauPalier) {
        alert(`ℹ️ L'élève a déjà le palier ${nouveauPalier >= 0 ? nouveauPalier : 'échauffement non validé'}.`);
        return;
    }

    historiquePaliers.push({ eleveId, ancienPalier, nouveauPalier });
    elevesResultats[eleveId] = nouveauPalier;

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

// ============================================================
// TEMPLATE VMA (sans pause, sans offset)
// ============================================================

function templateVMA(colonnes, palierEnCours, palierValide, tempsRestant, nbTermines, totalEleves, hasAudio) {
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