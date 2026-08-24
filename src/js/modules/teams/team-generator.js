// src/js/modules/teams/team-generator.js
export function generateTeams(eleves, options) {
    // options: { mixite: 'mixte'|'non-mixte'|'ignore', critere: 'vma'|'force', 
    //            mode: 'niveau'|'melange', nbEquipes, nbParEquipe, couleurs, formatLibelle }

    let pool = [...eleves];
    let teams = [];

    // 1. Gestion de la mixité
    if (options.mixite === 'non-mixte') {
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F' || !e.sexe); // Le sexe vide est traité comme F par défaut
        teams = [...buildTeams(garcons, options, 0), ...buildTeams(filles, options, garcons.length)];
    } else {
        // 'mixte' ou 'ignore' : on mélange tout
        teams = buildTeams(pool, options, 0);
    }

    return teams;
}

function buildTeams(pool, options, startIndex) {
    if (pool.length === 0) return [];

    // Calcul du nombre d'équipes (champ intelligent)
    let nbEq = options.nbEquipes;
    if (!nbEq) nbEq = Math.ceil(pool.length / options.nbParEquipe);

    // Génération des labels (Lettres, Chiffres, Couleurs) avec index global
    const labels = [];
    for (let i = 0; i < nbEq; i++) {
        const globalIndex = startIndex + i;
        if (options.formatLibelle === 'Lettres') labels.push(String.fromCharCode(65 + globalIndex)); // A, B, C...
        else if (options.formatLibelle === 'Chiffres') labels.push((globalIndex + 1).toString()); // 1, 2, 3...
        else if (options.formatLibelle === 'Couleurs') {
            const nomCouleurs = ['Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Violet', 'Rose', 'Cyan', 'Blanc', 'Noir'];
            labels.push(nomCouleurs[globalIndex % nomCouleurs.length]);
        } else {
            labels.push(`Équipe ${globalIndex + 1}`);
        }
    }

    // Création des équipes (avec couleurs synchronisées sur les labels)
    let teams = Array.from({ length: nbEq }, (_, i) => {
        const globalIndex = startIndex + i;
        const color = options.couleurs.length > 0 
            ? options.couleurs[globalIndex % options.couleurs.length] 
            : '#3b82f6'; // Couleur par défaut si aucune palette sélectionnée
            
        return {
            id: `EQ${globalIndex + 1}`,
            label: labels[i],
            color: color,
            members: [],
            totalScore: 0
        };
    });

    // Tri selon le critère (VMA ou Jauge de force)
    pool.sort((a, b) => {
        const valA = options.critere === 'vma' ? (a.vma || 0) : (a.force || 0);
        const valB = options.critere === 'vma' ? (b.vma || 0) : (b.force || 0);
        return valB - valA;
    });

    // Algorithme de répartition
    if (options.mode === 'niveau') {
        // "Hétérogènes entre elles, homogènes en leur sein" (Les forts ensemble)
        // On remplit équipe par équipe avec les meilleurs restants
        let index = 0;
        for (const eleve of pool) {
            teams[index].members.push(eleve);
            teams[index].totalScore += (options.critere === 'vma' ? (eleve.vma||0) : (eleve.force||0));
            index++;
            if (index >= nbEq) index = 0;
        }
    } else {
        // "Homogènes entre elles, hétérogènes en leur sein" (Mélange des forces)
        // Algorithme du serpentin
        let index = 0;
        let direction = 1;
        for (const eleve of pool) {
            teams[index].members.push(eleve);
            teams[index].totalScore += (options.critere === 'vma' ? (eleve.vma||0) : (eleve.force||0));
            
            index += direction;
            if (index >= nbEq) { index = nbEq - 1; direction = -1; }
            else if (index < 0) { index = 0; direction = 1; }
        }
    }

    return teams;
}