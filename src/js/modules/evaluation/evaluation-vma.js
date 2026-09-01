// src/js/modules/evaluation/evaluation-vma.js
// Saisie de la VMA (Luc Léger) avec fichier audio local importé

import { setResultat, getResultat } from './evaluation-stockage.js';
import { groupeEndurance } from './evaluation-utils.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentData = null;
let currentTestId = 'endurance';
let currentEleves = [];
let audioElement = null;
let offset = 34; // décalage en secondes (modifiable)
let palierEnCours = 0;
let palierValide = -1;
let tempsRestant = 0;
let isPlaying = false;
let intervalId = null;
let elevesResultats = {};
let zoneSaisie = null;
let historiquePaliers = [];

const DUREE_PALIER_0 = 120;
const DUREE_PALIER_SUIVANT = 60;
const AUDIO_STORAGE_KEY = 'eps_arena_luc_leger_audio';

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
// INITIALISATION
// ============================================================

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

    if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.id = 'eval-audio-player';
        audioElement.style.display = 'none';
        audioElement.preload = 'auto';
        document.body.appendChild(audioElement);
        
        audioElement.addEventListener('play', () => {
            console.log('🔊 Audio play event');
            isPlaying = true;
            demarrerMiseAJourPaliers();
        });
        audioElement.addEventListener('pause', () => {
            console.log('🔇 Audio pause event');
            isPlaying = false;
            if (intervalId) clearInterval(intervalId);
        });
        audioElement.addEventListener('ended', () => {
            console.log('🔚 Audio ended');
            isPlaying = false;
            if (intervalId) clearInterval(intervalId);
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
        hasAudio || false,
        offset
    );

    window.evalVmaDemarrer = demarrerVMA;
    window.evalVmaPause = pauseVMA;
    window.evalVmaTerminer = terminerVMA;
    window.evalVmaClicEleve = clicEleveVMA;
    window.evalVmaUndo = undoVMA;
    window.evalVmaImporterAudio = importerAudio;
    window.evalVmaSetOffset = setOffset;

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
// IMPORT DU FICHIER AUDIO (compatible iPad)
// ============================================================

async function importerAudio() {
    // Méthode 1 : input file avec accept large
    const input = document.createElement('input');
    input.type = 'file';
    // Sur iPad, il faut accepter plusieurs types MIME
    input.accept = '.mp3,.m4a,.wav,.aac,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav';
    input.multiple = false;
    
    // Méthode 2 : drag & drop si l'utilisateur préfère
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
        input.value = ''; // reset
    };
    input.click();
}

// ============================================================
// RÉGLAGE DE L'OFFSET
// ============================================================

function setOffset() {
    const newOffset = prompt(`Entrez le décalage en secondes (actuel : ${offset}s) :`, offset);
    if (newOffset !== null) {
        const val = parseFloat(newOffset);
        if (!isNaN(val) && val >= 0) {
            offset = val;
            // Sauvegarder dans la config
            if (currentData && currentData.config) {
                currentData.config.vma_offset = offset;
            }
            alert(`✅ Offset réglé à ${offset}s`);
            afficherVMA(true);
        } else {
            alert('❌ Valeur invalide. Entrez un nombre de secondes (ex: 34).');
        }
    }
}

// ============================================================
// CONTROLES AUDIO (avec synchronisation robuste)
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

    // Forcer le démarrage à l'offset
    audioElement.currentTime = offset;
    
    // Mettre à jour l'interface
    document.getElementById('eval-vma-start')?.classList.add('hidden');
    document.getElementById('eval-vma-pause')?.classList.remove('hidden');
    document.getElementById('eval-vma-stop')?.classList.remove('hidden');

    // Jouer l'audio
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log('▶️ Lecture audio démarrée à', audioElement.currentTime);
            // Forcer isPlaying = true et lancer le chrono
            isPlaying = true;
            demarrerMiseAJourPaliers();
        }).catch(err => {
            console.warn('❌ Erreur lecture audio :', err);
            alert('❌ Impossible de lire le son. Vérifiez que le fichier est valide.');
            document.getElementById('eval-vma-start')?.classList.remove('hidden');
            document.getElementById('eval-vma-pause')?.classList.add('hidden');
            document.getElementById('eval-vma-stop')?.classList.add('hidden');
        });
    } else {
        // Fallback si play() ne retourne pas de promesse (vieux navigateurs)
        isPlaying = true;
        demarrerMiseAJourPaliers();
    }
}

function pauseVMA() {
    if (!audioElement) return;
    if (audioElement.paused) {
        // Reprendre
        audioElement.play().catch(err => console.warn(err));
        document.getElementById('eval-vma-start')?.classList.add('hidden');
        document.getElementById('eval-vma-pause')?.classList.remove('hidden');
        isPlaying = true;
        demarrerMiseAJourPaliers();
    } else {
        audioElement.pause();
        document.getElementById('eval-vma-start')?.classList.remove('hidden');
        document.getElementById('eval-vma-start').textContent = '▶ Reprendre';
        document.getElementById('eval-vma-pause')?.classList.add('hidden');
        isPlaying = false;
        if (intervalId) clearInterval(intervalId);
    }
}

function terminerVMA() {
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
        isPlaying = false;
        if (intervalId) clearInterval(intervalId);
    }

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
            setResultat(currentData, e.id, currentTestId, {
                palier: palier !== undefined ? palier : -1,
                groupe: null
            });
        }
    });

    alert('✅ VMA terminée !');
    if (window.evalTerminerTest) window.evalTerminerTest();
}

// ============================================================
// MISE À JOUR DES PALIERS (robuste)
// ============================================================

function demarrerMiseAJourPaliers() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
        mettreAJourPaliers();
    }, 300); // mise à jour plus rapide (300ms)
}

function mettreAJourPaliers() {
    if (!audioElement) return;
    // On lit currentTime même si isPlaying est faux (pour la synchro)
    const tempsVideo = audioElement.currentTime;
    const tempsTest = Math.max(0, tempsVideo - offset);
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
// TEMPLATE VMA
// ============================================================

function templateVMA(colonnes, palierEnCours, palierValide, tempsRestant, nbTermines, totalEleves, hasAudio, offset) {
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
                <button onclick="window.evalVmaSetOffset()" class="bg-slate-600 px-4 py-3 rounded-xl font-black text-xs text-white active:scale-95">
                    ⏱️ Offset : ${offset}s
                </button>
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

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${htmlColonnes}
            </div>
        </div>
    `;
}