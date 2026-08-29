// src/js/ui/prof/layout.js
import { db } from '../../core/firebase-service.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { initIntervalTimer, startTimer, stopTimer, resetTimer, backToSettings, savePreset, loadPreset, deletePreset } from '../../modules/commun/timer.js';
import { initConvertisseur } from '../../modules/commun/convertisseur.js';

export function initLayout() {

    // Exposer les fonctions du Timer pour le HTML (onclick)
    window.startTimer = startTimer;
    window.stopTimer = stopTimer;
    window.resetTimer = resetTimer;
    window.backToSettings = backToSettings;
    window.savePreset = savePreset;
    window.loadPreset = loadPreset;
    window.deletePreset = deletePreset;

    // 1. Gestion des onglets (sans Tailwind pour la TV)
    window.switchTab = function(tabName) {
        
        // Cacher toutes les vues standard (Admin, Activités, Live, Outils)
        ['admin', 'activities', 'live', 'tools'].forEach(t => {
            const viewId = 'view' + t.charAt(0).toUpperCase() + t.slice(1);
            const el = document.getElementById(viewId);
            if (el) {
                el.classList.add('hidden');
                el.style.display = ''; // Reset pour éviter les conflits
            }
        });

        // Cas spécial pour TV : on utilise style.display (car elle gère le plein écran)
        const tvView = document.getElementById('viewTV');
        if (tvView) {
            if (tabName === 'tv') {
                tvView.style.display = 'block'; // On affiche
            } else {
                tvView.style.display = 'none'; // On cache
            }
        }

        // Mettre à jour les boutons d'onglets (Admin, Activités, Live, TV, Outils)
        ['btnTab1', 'btnTab2', 'btnTab3', 'btnTab4', 'btnTab5'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('tab-active', 'text-blue-500');
                btn.classList.add('text-slate-500');
            }
        });

        // Mapping des onglets vers les boutons
        const map = { 'admin': '1', 'activities': '2', 'live': '3', 'tv': '4', 'tools': '5' };

        // Afficher la vue correspondante
        if (tabName !== 'tv') {
            const targetView = document.getElementById('view' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
            if (targetView) targetView.classList.remove('hidden');
        }

        // Activer le bouton d'onglet correspondant
        const targetBtn = document.getElementById('btnTab' + map[tabName]);
        if (targetBtn) targetBtn.classList.add('tab-active', 'text-blue-500');

        // Logique spéciale lors de l'ouverture de l'onglet OUTILS
        if (tabName === 'tools') {
            const viewTools = document.getElementById('viewTools');
    viewTools.classList.remove('hidden');
    initIntervalTimer(); // Remet le chrono à zéro
    initConvertisseur(); // Initialise le convertisseur
        }

        // Logique spéciale pour l'onglet TV
        if (tabName === 'tv') {
            const discipline = localStorage.getItem('eps_arena_current_discipline') || 'multi';
            setTimeout(() => {
                const renderer = discipline === 'orientshow'
                    ? import('../../modules/orientshow/orientshow-tv.js')
                    : import('../../modules/escalade/escalade-tv-ui.js');
                renderer
                    .then(module => module[discipline === 'orientshow' ? 'renderOrientShowTV' : 'renderEscaladeTV']())
                    .catch(err => console.error('Erreur TV:', err));
            }, 100);
        }

        // Appel pour le Live si onglet live
        if (tabName === 'live') {
            setTimeout(() => {
                // Recharger le live selon la discipline
                import('../../ui/prof/live.js')
                    .then(module => {
                        if (typeof module.renderLive === 'function') {
                            module.renderLive();
                        }
                    })
                    .catch(err => console.error("Erreur import Live:", err));
            }, 100);
        }
    };

    // 2. Gestion des classes
    function initClassesSelect() {
        const select = document.getElementById('selectClasse');
        if (!select) return; 
        select.innerHTML = '<option value="">-- Classe --</option>';
        let classes = JSON.parse(localStorage.getItem('eps_arena_classes')) || [];
        classes.forEach(nom => {
            const option = document.createElement('option');
            option.value = nom;
            option.textContent = nom;
            select.appendChild(option);
        });
    }
    initClassesSelect();

    window.addClasse = function() {
        const nom = prompt("Nom de la classe ?");
        if (nom) {
            let classes = JSON.parse(localStorage.getItem('eps_arena_classes')) || [];
            if (!classes.includes(nom)) {
                classes.push(nom);
                localStorage.setItem('eps_arena_classes', JSON.stringify(classes));
                
                const select = document.getElementById('selectClasse');
                if (select) {
                    const option = document.createElement('option');
                    option.value = nom; option.textContent = nom;
                    select.appendChild(option); select.value = nom;
                    select.dispatchEvent(new Event('change'));
                }
                alert("Classe ajoutée !");
            } else {
                alert("Cette classe existe déjà.");
                const select = document.getElementById('selectClasse');
                if (select) {
                    select.value = nom; select.dispatchEvent(new Event('change'));
                }
            }
        }
    };

    // 3. Gestion du Code Prof
    const profInput = document.getElementById('profCode');
    if (profInput) {
        profInput.value = localStorage.getItem('eps_arena_profCode') || '';
        profInput.addEventListener('change', (e) => {
            localStorage.setItem('eps_arena_profCode', e.target.value.toUpperCase());
            alert("Code Prof enregistré !");
        });
    }

    // 4. Connexion Firebase
    onValue(ref(db, '.info/connected'), (snap) => {
        const dot = document.getElementById('connDot');
        const label = document.getElementById('connLabel');
        if (dot && label) {
            dot.className = "w-3 h-3 rounded-full " + (snap.val() ? "bg-emerald-500" : "bg-red-500");
            label.textContent = snap.val() ? "En ligne" : "Hors ligne";
        }
    });
}