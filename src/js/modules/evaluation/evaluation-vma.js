// src/js/modules/evaluation/evaluation-vma.js
// Saisie de la VMA (Luc Léger) avec YouTube

import { templateVMA } from './evaluation-templates.js';
import { setResultat, getResultat, getElevesActifs } from './evaluation-stockage.js';
import { groupeEndurance } from './evaluation-utils.js';

let currentData = null;
let currentTestId = 'endurance';
let currentEleves = [];
let player = null;
let offset = 34; // secondes avant le début du test
let palierActuel = 0;
let palierValide = 0;
let tempsRestant = 0;
let isPlaying = false;
let intervalId = null;
let elevesResultats = {}; // { eleveId: palier }
let zoneSaisie = null;
let youtubeLoaded = false;

export function initSaisieVMA(zone, eleve, data, testId, eleves) {
    zoneSaisie = zone;
    currentData = data;
    currentTestId = testId;
    currentEleves = eleves.filter(e => e.statut === 'present');
    offset = data.config?.vma_offset || 34;
    
    // Charger les résultats existants
    elevesResultats = {};
    currentEleves.forEach(e => {
        const r = getResultat(data, e.id, testId);
        if (r && r.palier !== undefined) {
            elevesResultats[e.id] = r.palier;
        }
    });
    
    // Initialiser le lecteur YouTube
    chargerYouTube();
    afficherVMA();
}

function chargerYouTube() {
    if (youtubeLoaded) return;
    
    // Charger l'API YouTube
    if (typeof YT === 'undefined') {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    
    youtubeLoaded = true;
}

function afficherVMA() {
    // Calculer le palier actuel en fonction du temps si la vidéo tourne
    if (isPlaying && player && typeof player.getCurrentTime === 'function') {
        const tempsVideo = player.getCurrentTime();
        const tempsTest = Math.max(0, tempsVideo - offset);
        palierActuel = Math.floor(tempsTest / 60);
        tempsRestant = Math.floor(60 - (tempsTest % 60));
        if (tempsRestant < 0) tempsRestant = 0;
        if (tempsRestant > 60) tempsRestant = 60;
    }
    
    // Répartir les élèves en 4 colonnes (garçons/filles)
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
    
    // Ajouter les "autres" à g1
    colonnes.g1 = [...colonnes.g1, ...autres];
    
    zoneSaisie.innerHTML = templateVMA(colonnes, palierActuel, palierValide, tempsRestant);
    
    // Initialiser les contrôles
    window.evalVmaDemarrer = demarrerVMA;
    window.evalVmaPause = pauseVMA;
    window.evalVmaTerminer = terminerVMA;
    window.evalVmaClicEleve = clicEleveVMA;
    
    // Créer le lecteur YouTube
    if (typeof YT !== 'undefined' && YT.Player) {
        creerLecteur();
    } else {
        window.onYouTubeIframeAPIReady = creerLecteur;
    }
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
                autoplay: 0
            },
            events: {
                onReady: (e) => { console.log('📹 YouTube prêt'); },
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.PLAYING) {
                        isPlaying = true;
                        demarrerMiseAJourPaliers();
                    } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                        isPlaying = false;
                        if (intervalId) clearInterval(intervalId);
                    }
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
            palierActuel = Math.floor(tempsTest / 60);
            tempsRestant = Math.floor(60 - (tempsTest % 60));
            if (tempsRestant < 0) tempsRestant = 0;
            if (tempsRestant > 60) tempsRestant = 60;
            
            // Mettre à jour l'affichage
            const palierCourantEl = document.querySelector('#eval-zone-saisie .text-4xl.font-black.text-yellow-400');
            if (palierCourantEl) palierCourantEl.textContent = `Palier ${palierActuel}`;
            
            const tempsRestantEl = document.querySelector('#eval-zone-saisie .text-sm.text-slate-500');
            if (tempsRestantEl) tempsRestantEl.textContent = `${tempsRestant}s restantes`;
        } catch (e) { /* ignore */ }
    }, 500);
}

function demarrerVMA() {
    if (player) {
        player.playVideo();
        document.getElementById('eval-vma-start').classList.add('hidden');
        document.getElementById('eval-vma-pause').classList.remove('hidden');
        document.getElementById('eval-vma-stop').classList.remove('hidden');
    }
}

function pauseVMA() {
    if (player) {
        if (isPlaying) {
            player.pauseVideo();
            document.getElementById('eval-vma-start').classList.remove('hidden');
            document.getElementById('eval-vma-start').textContent = '▶ Reprendre';
            document.getElementById('eval-vma-pause').classList.add('hidden');
        } else {
            player.playVideo();
            document.getElementById('eval-vma-start').classList.add('hidden');
            document.getElementById('eval-vma-pause').classList.remove('hidden');
        }
    }
}

function terminerVMA() {
    if (player) {
        player.pauseVideo();
        isPlaying = false;
        if (intervalId) clearInterval(intervalId);
    }
    
    // Vérifier que tous les élèves ont un palier
    const tousValides = currentEleves.every(e => elevesResultats[e.id] !== undefined);
    if (!tousValides) {
        if (!confirm('Tous les élèves n\'ont pas encore de palier validé. Terminer quand même ?')) {
            return;
        }
    }
    
    // Sauvegarder les résultats
    currentEleves.forEach(e => {
        if (elevesResultats[e.id] !== undefined) {
            const palier = elevesResultats[e.id];
            const groupe = groupeEndurance(palier);
            setResultat(currentData, e.id, currentTestId, {
                palier: palier,
                groupe: groupe
            });
        }
    });
    
    alert('✅ VMA terminée !');
    if (window.evalTerminerTest) window.evalTerminerTest();
}

function clicEleveVMA(eleveId) {
    // Attribuer le palier actuel à l'élève
    elevesResultats[eleveId] = palierActuel;
    
    // Mettre à jour l'affichage
    const el = document.querySelector(`#vma-palier-${eleveId}`);
    if (el) {
        el.textContent = `Palier ${palierActuel}`;
        el.className = 'text-xs font-black text-emerald-400';
    }
    
    // Marquer la fiche comme terminée
    const parent = el?.closest('.eval-eleve-vma');
    if (parent) {
        parent.classList.add('border-emerald-500', 'bg-emerald-950/20');
        parent.classList.remove('hover:border-blue-500');
    }
    
    // Vérifier si tous les élèves ont un palier
    const tousValides = currentEleves.every(e => elevesResultats[e.id] !== undefined);
    if (tousValides) {
        // Proposer de terminer
        setTimeout(() => {
            if (confirm('✅ Tous les élèves ont un palier ! Terminer le test ?')) {
                terminerVMA();
            }
        }, 500);
    }
}