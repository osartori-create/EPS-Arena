import { db } from '../../core/firebase-service.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";

export function initLayout() {
    
    // 1. Gestion des onglets
    window.switchTab = function(tabName) {
        ['admin', 'activities', 'live', 'tv'].forEach(t => {
            const viewId = 'view' + t.charAt(0).toUpperCase() + t.slice(1);
            const el = document.getElementById(viewId);
            if (el) el.classList.add('hidden');
        });

        ['btnTab1', 'btnTab2', 'btnTab3', 'btnTab4'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('tab-active', 'text-blue-500');
                btn.classList.add('text-slate-500');
            }
        });

        const map = { 'admin': '1', 'activities': '2', 'live': '3', 'tv': '4' };
        const targetView = document.getElementById('view' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
        if (targetView) targetView.classList.remove('hidden');

        const targetBtn = document.getElementById('btnTab' + map[tabName]);
        if (targetBtn) targetBtn.classList.add('tab-active', 'text-blue-500');

        // Cas spécifique pour l'onglet TV
        if (tabName === 'tv') {
            console.log("ÉTAPE 1 : on entre dans le if (tabName === 'tv')");
            
            setTimeout(() => {
                console.log("ÉTAPE 2 : le setTimeout est bien exécuté");
                const tvGlobe = document.getElementById('tvGlobe');
                if (tvGlobe) {
                    console.log("ÉTAPE 3 : tvGlobe est trouvé");
                    tvGlobe.innerHTML = '<h1 style="color:white; text-align:center; margin-top:50px;">TEST DIRECT</h1>';
                } else {
                    console.log("ÉTAPE 3 bis : tvGlobe INTROUVABLE");
                }
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