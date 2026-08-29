// src/js/modules/teams/team-generator.js

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function generateTeams(eleves, options) {
    let pool = [...eleves];
    let teams = [];

    // 1. Gestion de la mixité (CORRIGÉE)
    if (options.mixite === 'non-mixte') {
        // Séparation stricte
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F' || !e.sexe);
        teams = [...buildTeams(garcons, options, 0), ...buildTeams(filles, options, garcons.length)];
    } 
    else if (options.mixite === 'mixte') {
        // Pour garantir une mixité PARFAITE, on sépare, on mélange, puis on entrelace
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F');
        const autres = pool.filter(e => e.sexe !== 'M' && e.sexe !== 'F');

        shuffleArray(garcons);
        shuffleArray(filles);
        shuffleArray(autres);

        // Création d'un pool alterné : G1, F1, G2, F2, G3, F3...
        let poolMixte = [];
        let maxLength = Math.max(garcons.length, filles.length, autres.length);
        for (let i = 0; i < maxLength; i++) {
            if (garcons[i]) poolMixte.push(garcons[i]);
            if (filles[i]) poolMixte.push(filles[i]);
            if (autres[i]) poolMixte.push(autres[i]);
        }

        teams = buildTeams(poolMixte, options, 0);
    } 
    else {
        // Mode 'ignore' (non prise en compte du sexe)
        teams = buildTeams(pool, options, 0);
    }

    return teams;
}

function buildTeams(pool, options, startIndex) {
    if (pool.length === 0) return [];

    // >>> CORRECTION DU BUG DE DIVISION PAR ZÉRO <<<
    let nbEq = options.nbEquipes;
    let nbParEquipe = options.nbParEquipe;

    if ((!nbEq || nbEq <= 0) && (!nbParEquipe || nbParEquipe <= 0)) {
        nbEq = Math.max(1, Math.ceil(pool.length / 4));
    } 
    else if (nbEq && nbEq > 0 && (!nbParEquipe || nbParEquipe <= 0)) {
        nbParEquipe = Math.ceil(pool.length / nbEq);
    }
    else if ((!nbEq || nbEq <= 0) && nbParEquipe && nbParEquipe > 0) {
        nbEq = Math.ceil(pool.length / nbParEquipe);
    }

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

    // Tri selon le critère (VMA, Force, Polyvalent)
    pool.sort((a, b) => {
        if (options.critere === 'polyvalent') {
            // Rangs inversés pour le 30m (plus bas = mieux)
            const scoreA = (a.vma || 0) + ((a.longueur || 0) / 10) - (a.sprint30 || 99);
            const scoreB = (b.vma || 0) + ((b.longueur || 0) / 10) - (b.sprint30 || 99);
            return scoreB - scoreA;
        }
        if (options.critere === 'vma') {
            return (b.vma || 0) - (a.vma || 0);
        }
        return (b.force || 0) - (a.force || 0);
    });

    // >>> CORRECTION DE LA RÉPARTITION POUR GARANTIR LA MIXITÉ <<<
    // On utilise TOUJOURS l'algorithme "serpentin" (un par un) pour éviter les équipes ségréguées par blocs.
    let index = 0;
    let direction = 1;
    for (const eleve of pool) {
        teams[index].members.push(eleve);
        teams[index].totalScore += (options.critere === 'vma' ? (eleve.vma||0) : (eleve.force||0));
        
        index += direction;
        if (index >= nbEq) { index = nbEq - 1; direction = -1; }
        else if (index < 0) { index = 0; direction = 1; }
    }

    // Attribution du rang
    teams.forEach(team => {
        team.members.forEach((m, idx) => {
            m.rank = idx + 1;
        });
    });

    return teams;
}