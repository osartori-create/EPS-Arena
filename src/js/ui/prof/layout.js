// src/js/ui/prof/layout.js
import { db } from '../../core/firebase-service.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js';

export function initLayout() {
    // Gestion des onglets
    window.switchTab = function(tabName) {
        ['admin', 'activities', 'live'].forEach(t => {
            document.getElementById('view' + t.charAt(0).toUpperCase() + t.slice(1)).classList.add('hidden');
        });
        ['btnTab1', 'btnTab2', 'btnTab3'].forEach(b => {
            document.getElementById(b).classList.remove('tab-active', 'text-blue-500');
            document.getElementById(b).classList.add('text-slate-500');
        });

        const map = { 'admin': '1', 'activities': '2', 'live': '3' };
        document.getElementById('view' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.remove('hidden');
        document.getElementById('btnTab' + map[tabName]).classList.add('tab-active', 'text-blue-500');
    };

    // Gestion des classes
    function initClassesSelect() {
        const select = document.getElementById('selectClasse');
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
                const option = document.createElement('option');
                option.value = nom; option.textContent = nom;
                select.appendChild(option); select.value = nom;
                select.dispatchEvent(new Event('change'));
                alert("Classe ajoutée !");
            } else {
                alert("Cette classe existe déjà.");
                const select = document.getElementById('selectClasse');
                select.value = nom; select.dispatchEvent(new Event('change'));
            }
        }
    };

    // Gestion de la connexion Firebase
    onValue(ref(db, '.info/connected'), (snap) => {
        const dot = document.getElementById('connDot');
        const label = document.getElementById('connLabel');
        if (dot && label) {
            dot.className = "w-3 h-3 rounded-full " + (snap.val() ? "bg-emerald-500" : "bg-red-500");
            label.textContent = snap.val() ? "En ligne" : "Hors ligne";
        }
    });
}