// src/js/modules/registry.js
// Registre central des modules (disciplines)

export const moduleRegistry = {};

/**
 * Enregistre un module dans le registre
 * @param {Object} module - Le module à enregistrer
 * @param {string} module.id - Identifiant unique (ex: 'escalade', 'multi')
 * @param {string} module.label - Libellé affiché dans l'interface
 * @param {string} module.icon - Icône (optionnel)
 * @param {Function} module.initProf - Fonction d'initialisation professeur (classe)
 * @param {Function} module.initKiosk - Fonction d'initialisation élève (classe, code)
 * @param {Function} module.transmettre - Fonction de transmission Firebase (classe)
 * @param {Function} module.generateTeams - Fonction de génération des équipes (classe, eleves)
 * @param {Function} module.renderLive - Fonction d'affichage Live
 * @param {Function} module.renderTV - Fonction d'affichage TV
 * @param {boolean} module.isDefault - Si true, le module est sélectionné par défaut
 */
export function registerModule(module) {
    if (!module.id) {
        console.error('❌ Un module doit avoir un id');
        return;
    }
    if (moduleRegistry[module.id]) {
        console.warn(`⚠️ Le module "${module.id}" est déjà enregistré. Il sera remplacé.`);
    }
    moduleRegistry[module.id] = module;
    console.log(`✅ Module "${module.id}" enregistré`);
}

/**
 * Récupère un module par son id
 */
export function getModule(id) {
    return moduleRegistry[id] || null;
}

/**
 * Récupère tous les modules
 */
export function getAllModules() {
    return Object.values(moduleRegistry);
}

/**
 * Récupère les modules par défaut
 */
export function getDefaultModules() {
    return Object.values(moduleRegistry).filter(m => m.isDefault);
}