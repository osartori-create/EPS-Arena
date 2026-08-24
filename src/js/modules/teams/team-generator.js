// src/js/modules/teams/team-generator.js
export function generateTeams(eleves, options) {
    // options: { mixite, critere, mode, nbEquipes, nbParEquipe, couleurs, formatLibelle }
    
    let pool = [...eleves];
    let teams = [];

    // 1. Gestion de la mixité
    if (options.mixite === 'non-mixte') {
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F' || !e.sexe);
        teams = [...buildTeams(garcons, options, 0), ...buildTeams(filles, options, garcons.length)];
    } else {
        teams = buildTeams(pool, options, 0);
    }

    return teams;
}

function buildTeams(pool, options, startIndex) {
    if (pool.length === 0) return [];

    // Calcul du nombre d'équipes
    let nbEq = options.nbEquipes;
    if (!nbEq) nbEq = Math.ceil(pool.length / options.nbParEquipe);

    // Génération des labels selon le format choisi (Lettres, Chiffres, Couleurs)
    const nomsCouleurs = ['Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Violet', 'Rose', 'Cyan', 'Blanc', 'Noir'];
    const labels = [];
    for (let i = 0; i < nbEq; i++) {
        const globalIndex = startIndex + i;
        if (options.formatLibelle === 'Lettres') labels.push(String.fromCharCode(65 + globalIndex));
        else if (options.formatLibelle === 'Chiffres') labels.push((globalIndex + 1).toString());
        else labels.push(nomsCouleurs[globalIndex % nomsCouleurs.length]);
    }

    // Création des équipes
    let teams = Array.from({ length: nbEq }, (_, i) => {
        const globalIndex = startIndex + i;
        const color = options.couleurs && options.couleurs.length > 0 
            ? options.couleurs[globalIndex % options.couleurs.length] 
            : '#3b82f6';

        return {
            id: `EQ${globalIndex + 1}`,
            label: labels[i], // Ici, c'est A, B, C... ou 1, 2, 3... ou Rouge, Bleu...
            color: color,
            members: [],
            totalScore: 0
        };
    });

    // Tri selon le critère (VMA ou Jauge de puissance)
    pool.sort((a, b) => {
        const valA = options.critere === 'vma' ? (a.vma || 0) : (a.force || 0);
        const valB = options.critere === 'vma' ? (b.vma || 0) : (b.force || 0);
        return valB - valA;
    });

    // Algorithme de répartition
    if (options.mode === 'niveau') {
        // "Hétérogènes entre elles, homogènes en leur sein" (Les forts ensemble)
        // On remplit équipe par équipe
        let index = 0;
        for (const eleve of pool) {
            teams[index].members.push(eleve);
            teams[index].totalScore += (options.critere === 'vma' ? (eleve.vma||0) : (eleve.force||0));
            index++;
            if (index >= nbEq) index = 0;
        }
    } else {
        // "Homogènes entre elles, hétérogènes en leur sein" (Mélange des forces)
        // Algorithme du SERPENTIN
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

    // Attribution du rang dans l'équipe (1, 2, 3...)
    teams.forEach(team => {
        team.members.forEach((m, idx) => {
            m.rank = idx + 1;
        });
    });

    return teams;
}