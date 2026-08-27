// src/js/modules/eleve/escalade-kiosk.js
import { getDB, getSelectedClass, getSelectedCode, resetToLogin } from '../../ui/eleve/eleve-app.js';
import { calculateClimbingPoints } from '../escalade/escalade-calculations.js';
import { BAREME } from '../escalade/escalade-calculations.js';
import { getPerformancePath } from '../../core/firebase-service.js';
import { ref, push } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { showFeedback } from '../../ui/eleve/eleve-actions.js';

export function initEscaladeKiosk(selectedClass, selectedCode) {
    const cotationGrid = document.getElementById('cotation-grid');
    cotationGrid.innerHTML = '';
    
    Object.keys(BAREME).forEach(cot => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-700 p-3 rounded-xl font-black text-white border-2 border-slate-500";
        btn.innerText = cot.toUpperCase();
        btn.dataset.cotation = cot;
        btn.onclick = () => {
            cotationGrid.querySelectorAll('button').forEach(b => b.classList.remove('bg-blue-600', 'border-white'));
            btn.classList.add('bg-blue-600', 'border-white');
        };
        cotationGrid.appendChild(btn);
    });

    const defaultBtn = cotationGrid.querySelector('button[data-cotation="5a"]');
    if (defaultBtn) defaultBtn.classList.add('bg-blue-600', 'border-white');

    document.getElementById('voie-select').value = "1";
    document.getElementById('hauteur-select').value = "9";
}

// Fonction appelée par le bouton Envoyer
export async function sendEscalade() {
    const db = getDB();
    const selectedClass = getSelectedClass();
    const selectedCode = getSelectedCode();
    const voie = document.getElementById('voie-select').value;
    const couleur = document.getElementById('couleur-select').value;
    const hauteur = parseFloat(document.getElementById('hauteur-select').value);
    const selectedCotationBtn = document.querySelector('#cotation-grid button.bg-blue-600');
    const cotation = selectedCotationBtn ? selectedCotationBtn.dataset.cotation : '5a';
    
    const points = calculateClimbingPoints({ hauteur, cotation, couleur, essai: 1 });
    const chemin = getPerformancePath(selectedClass, 'escalade');
    
    await push(ref(db, chemin), {
        groupe: selectedCode.slice(0, -1),
        role: selectedCode.slice(-1),
        voie_num: voie,
        couleur: couleur,
        cotation: cotation,
        hauteur: hauteur,
        points: points,
        timestamp: Date.now()
    });
    
    showFeedback(`Montée : Voie ${voie} - ${hauteur}m<br>Points : ${points} m !`, 5000);
}