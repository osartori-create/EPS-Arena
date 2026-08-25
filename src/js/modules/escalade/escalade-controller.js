// src/js/modules/escalade/escalade-controller.js

// ==========================================
// CONFIGURATION ET BARÈME
// ==========================================

// Barème de cotation (coefficient multiplicateur pour les mètres virtuels)
export const BAREME = {
    "4a": 1, "4b": 1.1, "4c": 1.2,
    "5a": 1.3, "5b": 1.4, "5c": 1.5,
    "6a": 1.6, "6b": 1.8, "6c": 2
};

// Longueur de base d'une voie (en mètres) pour le calcul des points
const LONGUEUR_VOIE = 9;

// Objectif du challenge (en mètres virtuels)
export const OBJECTIF_METRES = 1000;

// ==========================================
// CALCUL DES POINTS (MÈTRES VIRTUELS)
// ==========================================

/**
 * Calcule les points (mètres virtuels) gagnés pour une montée.
 * @param {string} cotation - Ex: "5b", "6a"...
 * @param {string} couleur - Ex: "bleue", "tc"...
 * @param {number} essai - Numéro de l'essai (1er essai = bonus, 2e = normal, etc.)
 * @returns {number} - Points arrondis à 1 décimale
 */
export function calculerPoints(cotation, couleur, essai = 1) {
    const coeff = BAREME[cotation] || 1;
    
    // Malus pour les essais multiples (encourage la réussite du 1er coup)
    let bonusEssai = 1;
    if (essai === 1) bonusEssai = 1.2;      // Bonus de 20% au 1er essai
    else if (essai === 2) bonusEssai = 1;   // Normal au 2e
    else bonusEssai = 0.8;                  // Malus de 20% à partir du 3e
    
    // Malus pour la couleur "TC" (Toutes Couleurs, souvent plus dure)
    let bonusCouleur = (couleur === 'tc') ? 0.9 : 1;
    
    // Calcul final
    const points = LONGUEUR_VOIE * coeff * bonusEssai * bonusCouleur;
    return Math.round(points * 10) / 10; // Arrondi à 1 décimale
}

// ==========================================
// GESTION DE L'EXPORT IDOCEO
// ==========================================

/**
 * Génère et télécharge un fichier CSV formaté pour iDoceo.
 * @param {Array} students - Liste des élèves
 * @param {Object} montees - Objet Firebase contenant toutes les montées
 * @param {Object} assignments - Objet associant les élèves à leur code (A1, B2...)
 * @param {string} className - Nom de la classe
 */
export function exportIDoceo(students, montees, assignments, className) {
    let csv = "\uFEFFNom,Total_Metres,Nb_Voies,Meilleure_Cotation\n";
    
    students.forEach(name => {
        const post = assignments[name] || "";
        const gNum = post.slice(0, -1); // "A" pour A1
        const rLet = post.slice(-1);    // "1" pour A1
        
        // On filtre les montées de cet élève selon son code
        const perf = Object.values(montees).filter(m => 
            post && m.groupe === gNum && m.role === rLet
        );
        
        // Calcul du total de mètres virtuels
        const totalMetres = perf.reduce((a, b) => a + (parseFloat(b.points) || 0), 0).toFixed(1);
        
        // Calcul de la meilleure cotation
        let meilleureCotation = "";
        perf.forEach(m => {
            if (!meilleureCotation || BAREME[m.cotation] > BAREME[meilleureCotation]) {
                meilleureCotation = m.cotation;
            }
        });
        
        csv += `${name},${totalMetres},${perf.length},${meilleureCotation}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Escalade_${className}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ==========================================
// STATISTIQUES ET CHALLENGE 1000M
// ==========================================

/**
 * Calcule les statistiques globales de la classe.
 * @param {Object} montees - Objet Firebase contenant toutes les montées
 * @returns {Object} - { totalMetres, nbMontees, progressionPct, top5, parGroupe }
 */
export function calculerStatsGlobales(montees) {
    const allMontees = Object.values(montees || {});
    
    // Total des mètres virtuels
    const totalMetres = allMontees.reduce((sum, m) => sum + (parseFloat(m.points) || 0), 0);
    
    // Progression vers l'objectif 1000m
    const progressionPct = Math.min((totalMetres / OBJECTIF_METRES) * 100, 100);
    
    // Top 5 des élèves (par total de points)
    // Note : Nécessite les assignments pour associer les élèves aux montées, mais ici on regroupe par code
    const scoresParCode = {};
    allMontees.forEach(m => {
        const code = `${m.groupe}${m.role}`;
        if (!scoresParCode[code]) scoresParCode[code] = 0;
        scoresParCode[code] += parseFloat(m.points) || 0;
    });
    
    const top5 = Object.entries(scoresParCode)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, score]) => ({ code, score: Math.round(score * 10) / 10 }));
    
    // Total par groupe (pour le classement des équipes)
    const parGroupe = {};
    allMontees.forEach(m => {
        if (!parGroupe[m.groupe]) parGroupe[m.groupe] = { voies: 0, metres: 0 };
        parGroupe[m.groupe].voies++;
        parGroupe[m.groupe].metres += parseFloat(m.points) || 0;
    });
    
    return {
        totalMetres: Math.round(totalMetres),
        nbMontees: allMontees.length,
        progressionPct,
        top5,
        parGroupe
    };
}

// ==========================================
// INITIALISATION ET ÉCOUTE FIREBASE
// ==========================================

/**
 * Initialise l'écoute des montées en temps réel pour une classe donnée.
 * @param {string} className - Nom de la classe (ex: "504")
 * @param {Function} callback - Fonction appelée à chaque mise à jour des montées
 */
export function initEscaladeListener(className, callback) {
    // On suppose que la base est structurée comme suit :
    // etablissements/0680013V/profs/{codeProf}/escalade/{className}/montees
    // (À adapter selon votre structure Firebase réelle)
    
    const db = firebase.database();
    const refMontees = db.ref(`escalade/${className}/montees`);
    
    refMontees.on('value', snap => {
        const montees = snap.val() || {};
        callback(montees);
    });
    
    // Retourne une fonction pour arrêter l'écoute si nécessaire
    return () => refMontees.off();
}

// ==========================================
// ENVOI D'UNE MONTÉE (Pour le module élève / test manuel)
// ==========================================

/**
 * Envoie une montée vers Firebase.
 * @param {string} className - Classe
 * @param {string} groupe - Ex: "A"
 * @param {string} role - Ex: "1"
 * @param {number} voieNum - Numéro de la voie
 * @param {string} couleur - Couleur des prises
 * @param {string} cotation - Ex: "5b"
 * @param {number} essai - Numéro de l'essai
 */
export async function envoyerMontee(className, groupe, role, voieNum, couleur, cotation, essai = 1) {
    const db = firebase.database();
    const points = calculerPoints(cotation, couleur, essai);
    
    await db.ref(`escalade/${className}/montees`).push({
        groupe: groupe,
        role: role,
        voie_num: voieNum,
        couleur: couleur,
        cotation: cotation,
        points: points,
        timestamp: Date.now()
    });
    
    return points;
}