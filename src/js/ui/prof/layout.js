// src/js/ui/prof/layout.js
import { db } from '../../core/firebase-service.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { 
    initIntervalTimer, 
    startTimer, 
    stopTimer, 
    resetTimer, 
    backToSettings, 
    savePreset, 
    loadPreset, 
    deletePreset 
} from '../../modules/commun/timer.js';
import { initCalculateur } from '../../modules/commun/calculateur.js';

export function initLayout() {

    // Exposer les fonctions du Timer
    window.startTimer = startTimer;
    window.stopTimer = stopTimer;
    window.resetTimer = resetTimer;
    window.backToSettings = backToSettings;
    window.savePreset = savePreset;
    window.loadPreset = loadPreset;
    window.deletePreset = deletePreset;

    window.openTool = function(toolName) {
        document.getElementById('tools-menu').classList.add('hidden');
        if (toolName === 'timer') {
            document.getElementById('tools-timer').classList.remove('hidden');
            initIntervalTimer();
        } else if (toolName === 'calculateur') {
            document.getElementById('tools-calculator').classList.remove('hidden');
            initCalculateur();
        }
    };

    window.backToToolsMenu = function() {
        document.getElementById('tools-timer').classList.add('hidden');
        document.getElementById('tools-calculator').classList.add('hidden');
        document.getElementById('tools-menu').classList.remove('hidden');
    };

    // 1. Gestion des onglets (CORRIGÉ : on n'utilise plus el.style.display pour les vues standard)
    window.switchTab = function(tabName) {
        
        // On cache TOUTES les vues standard en utilisant UNIQUEMENT la classe 'hidden'
        ['admin', 'activities', 'live', 'tools'].forEach(t => {
            const viewId = 'view' + t.charAt(0).toUpperCase() + t.slice(1);
            const el = document.getElementById(viewId);
            if (el) {
                el.classList.add('hidden'); 
                // ⚠️ NE PAS TOUCHER à el.style.display ici, sinon ça écrase la classe Tailwind !
            }
        });

        // Cas spécial TV (plein écran)
        const tvView = document.getElementById('viewTV');
        if (tvView) {
            if (tabName === 'tv') tvView.style.display = 'block';
            else tvView.style.display = 'none';
        }

        // Mise à jour des boutons d'onglets
        ['btnTab1', 'btnTab2', 'btnTab3', 'btnTab4', 'btnTab5'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('tab-active', 'text-blue-500');
                btn.classList.add('text-slate-500');
            }
        });

        const map = { 'admin': '1', 'activities': '2', 'live': '3', 'tv': '4', 'tools': '5' };

        // Afficher la vue demandée
        if (tabName !== 'tv') {
            const targetView = document.getElementById('view' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
            if (targetView) {
                targetView.classList.remove('hidden');
                targetView.style.display = ''; // Réinitialiser le style pour être sûr
            }
        }

        const targetBtn = document.getElementById('btnTab' + map[tabName]);
        if (targetBtn) targetBtn.classList.add('tab-active', 'text-blue-500');
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