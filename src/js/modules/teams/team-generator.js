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

    // >>> CORRECTION DU BUG DE DIVISION PAR ZÉRO <<<
    let nbEq = options.nbEquipes;
    let nbParEquipe = options.nbParEquipe;

    // Si les deux champs sont vides, on prend une valeur par défaut raisonnable (max 4 par équipe)
    if ((!nbEq || nbEq <= 0) && (!nbParEquipe || nbParEquipe <= 0)) {
        nbEq = Math.max(1, Math.ceil(pool.length / 4));
    } 
    // Si seul le nombre d'équipes est défini, on calcule les joueurs par équipe
    else if (nbEq && nbEq > 0 && (!nbParEquipe || nbParEquipe <= 0)) {
        nbParEquipe = Math.ceil(pool.length / nbEq);
    }
    // Si seul les joueurs par équipe sont définis, on calcule le nombre d'équipes
    else if ((!nbEq || nbEq <= 0) && nbParEquipe && nbParEquipe > 0) {
        nbEq = Math.ceil(pool.length / nbParEquipe);
    }

    // Sécurité ultime contre les valeurs invalides (NaN, Infinity, négatif)
    if (!nbEq || nbEq < 1 || isNaN(nbEq) || nbEq > pool.length) {
        nbEq = Math.max(1, Math.min(pool.length, 4));
    }
    // <<< FIN DE LA CORRECTION >>>

    // Génération des labels
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
            label: labels[i],
            color: color,
            members: [],
            totalScore: 0
        };
    });

    // Tri selon le critère
    pool.sort((a, b) => {
        // CRITÈRE POLYVALENT (VMA + Longueur + 30m)
        if (options.critere === 'polyvalent') {
            // Calcul des rangs inversés pour le 30m (plus bas = mieux)
            const scoreA = (a.vma || 0) + ((a.longueur || 0) / 10) - (a.sprint30 || 99);
            const scoreB = (b.vma || 0) + ((b.longueur || 0) / 10) - (b.sprint30 || 99);
            return scoreB - scoreA;
        }
        
        // CRITÈRE VMA
        if (options.critere === 'vma') {
            return (b.vma || 0) - (a.vma || 0);
        }
        
        // CRITÈRE FORCE (Étoiles)
        return (b.force || 0) - (a.force || 0);
    });

    // Algorithme de répartition
    if (options.mode === 'niveau') {
        const perTeam = Math.ceil(pool.length / nbEq);
        for (let i = 0; i < pool.length; i++) {
            const teamIndex = Math.floor(i / perTeam);
            if (teams[teamIndex]) {
                teams[teamIndex].members.push(pool[i]);
                teams[teamIndex].totalScore += (options.critere === 'vma' ? (pool[i].vma||0) : (pool[i].force||0));
            }
        }
    } else {
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

    // Attribution du rang
    teams.forEach(team => {
        team.members.forEach((m, idx) => {
            m.rank = idx + 1;
        });
    });

    return teams;
}