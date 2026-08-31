// src/js/modules/evaluation/evaluation-saisie.js
// Saisie standard pour les tests complémentaires
// (Équilibre, Coordination, Souplesse, Endurance musculaire)

import { setResultat, getResultat } from './evaluation-stockage.js';
import { 
    FONCTIONS_GROUPE, LIBELLES_TESTS, UNITES_TESTS,
    GROUPES, LIBELLES_GROUPES
} from './evaluation-utils.js';

let currentEleve = null;
let currentData = null;
let currentTestId = '';
let zoneSaisie = null;

export function initSaisieStandard(zone, eleve, data, testId) {
    zoneSaisie = zone;
    currentEleve = eleve;
    currentData = data;
    currentTestId = testId;
    
    const resultat = getResultat(data, eleve.id, testId);
    afficherSaisie(resultat);
}

function afficherSaisie(resultat) {
    const libelle = LIBELLES_TESTS[currentTestId] || currentTestId;
    const unite = UNITES_TESTS[currentTestId] || '';
    const valeurActuelle = resultat ? getValeur(resultat) : '';
    const groupeActuel = resultat?.groupe || null;
    
    let html = `
        <div class="space-y-6">
            <div class="text-center">
                <h4 class="text-xl font-black text-white">${libelle}</h4>
                <p class="text-sm text-slate-400">${currentEleve.prenom} ${currentEleve.nom}</p>
            </div>
            
            <div class="flex items-center justify-center gap-6">
                <div class="flex-1 max-w-xs">
                    <label class="text-xs font-bold text-slate-400 uppercase">Valeur (${unite})</label>
                    <input type="number" id="eval-valeur-saisie" value="${valeurActuelle}" 
                           step="${currentTestId === 'souplesse' ? '0.5' : '1'}" 
                           class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-3xl font-black text-white">
                </div>
            </div>
            
            ${groupeActuel ? `
                <div class="text-center p-4 rounded-xl ${groupeActuel === 'satisfaisant' ? 'bg-emerald-500/20 border-emerald-500' : (groupeActuel === 'fragile' ? 'bg-amber-500/20 border-amber-500' : 'bg-red-500/20 border-red-500')} border-2">
                    <p class="text-sm text-slate-400">Groupe de maîtrise</p>
                    <p class="text-2xl font-black ${groupeActuel === 'satisfaisant' ? 'text-emerald-400' : (groupeActuel === 'fragile' ? 'text-amber-400' : 'text-red-400')}">
                        ${LIBELLES_GROUPES[groupeActuel]}
                    </p>
                </div>
            ` : ''}
            
            <button onclick="window.evalValiderStandard()" class="w-full bg-emerald-600 py-4 rounded-xl font-black text-white text-xl active:scale-95">
                ✅ Valider
            </button>
        </div>
    `;
    
    zoneSaisie.innerHTML = html;
    
    // Écouteur pour la mise à jour automatique du groupe
    const input = document.getElementById('eval-valeur-saisie');
    if (input) {
        input.addEventListener('input', () => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) {
                const groupe = FONCTIONS_GROUPE[currentTestId](val);
                if (groupe) {
                    const couleur = groupe === 'satisfaisant' ? 'text-emerald-400' : (groupe === 'fragile' ? 'text-amber-400' : 'text-red-400');
                    // Mettre à jour l'affichage du groupe en direct
                    const groupeEl = zoneSaisie.querySelector('.text-2xl.font-black');
                    if (groupeEl) {
                        groupeEl.textContent = LIBELLES_GROUPES[groupe];
                        groupeEl.className = `text-2xl font-black ${couleur}`;
                    }
                }
            }
        });
    }
    
    window.evalValiderStandard = validerStandard;
}

function getValeur(resultat) {
    switch (currentTestId) {
        case 'equilibre': return resultat.temps || '';
        case 'coordination': return resultat.nb_lancers || '';
        case 'souplesse': return resultat.meilleur || (resultat.essais ? Math.max(...resultat.essais) : '');
        case 'endurance_musculaire': return resultat.temps || '';
        default: return '';
    }
}

function validerStandard() {
    const input = document.getElementById('eval-valeur-saisie');
    const valeur = parseFloat(input.value);
    
    if (isNaN(valeur) || valeur < 0) {
        alert('Veuillez saisir une valeur valide.');
        return;
    }
    
    const groupe = FONCTIONS_GROUPE[currentTestId](valeur);
    if (!groupe) {
        alert('Erreur de calcul du groupe.');
        return;
    }
    
    // Construire l'objet résultat
    let resultat = { groupe: groupe };
    switch (currentTestId) {
        case 'equilibre':
            resultat.temps = valeur;
            break;
        case 'coordination':
            resultat.nb_lancers = valeur;
            break;
        case 'souplesse':
            resultat.essais = [valeur];
            resultat.meilleur = valeur;
            break;
        case 'endurance_musculaire':
            resultat.temps = valeur;
            break;
        default:
            resultat.valeur = valeur;
    }
    
    setResultat(currentData, currentEleve.id, currentTestId, resultat);
    
    // Passer à l'élève suivant
    if (window.evalPasserSuivant) {
        setTimeout(() => window.evalPasserSuivant(), 300);
    }
}