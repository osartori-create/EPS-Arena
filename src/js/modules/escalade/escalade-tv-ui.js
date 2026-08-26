import { getConfigData, getEscaladeData } from '../../core/live-engine.js';

export function renderEscaladeTV() {
    console.log("✅ FONCTION renderEscaladeTV APPELEE !");
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const config = getConfigData();
    const montees = getEscaladeData();
    console.log("Config :", config);
    console.log("Montees :", montees);

    if (!config) {
        container.innerHTML = '<p class="text-slate-500 text-center mt-20">En attente de la configuration du prof...</p>';
        return;
    }
    
    try {
        // ... (le code complet de votre fonction, tel quel) ...
        
        container.innerHTML = html;
        console.log("✅ Rendu TV effectué !");
    } catch(e) {
        console.error("❌ Erreur lors du rendu TV :", e);
        container.innerHTML = `<p style="color: red;">❌ Erreur : ${e.message}</p>`;
    }
}