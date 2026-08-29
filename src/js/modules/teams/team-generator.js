// src/js/modules/teams/team-generator.js

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Tri par critère (VMA, Force)
function sortByCriteria(pool, critere) {
    return [...pool].sort((a, b) => {
        if (critere === 'vma') return (b.vma || 0) - (a.vma || 0);
        return (b.force || 0) - (a.force || 0);
    });
}

export function generateTeams(eleves, options) {
    let pool = [...eleves];
    let teams = [];

    // 1. Gestion de la mixité
    if (options.mixite === 'non-mixte') {
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F' || !e.sexe);
        teams = [...buildTeams(garcons, options, 0, false), ...buildTeams(filles, options, garcons.length, false)];
    } 
    else if (options.mixite === 'mixte') {
        // On trie chaque sexe par niveau
        const garconsTries = sortByCriteria(pool.filter(e => e.sexe === 'M'), options.critere);
        const fillesTries = sortByCriteria(pool.filter(e => e.sexe === 'F'), options.critere);
        const autresTries = sortByCriteria(pool.filter(e => e.sexe !== 'M' && e.sexe !== 'F'), options.critere);

        // Création du pool mixte entrelacé : G1, F1, G2, F2...
        let poolMixte = [];
        let maxLength = Math.max(garconsTries.length, fillesTries.length, autresTries.length);
        for (let i = 0; i < maxLength; i++) {
            if (garconsTries[i]) poolMixte.push(garconsTries[i]);
            if (fillesTries[i]) poolMixte.push(fillesTries[i]);
            if (autresTries[i]) poolMixte.push(autresTries[i]);
        }

        // On passe le pool mixte sans re-tri pour ne pas casser l'alternance
        teams = buildTeams(poolMixte, options, 0, false);
    } 
    else {
        // Mode 'ignore'
        teams = buildTeams(pool, options, 0, true);
    }

    return teams;
}

function buildTeams(pool, options, startIndex, doSort) {
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

    // Si doSort est true (mode ignore), on trie par niveau
    if (doSort) {
        pool.sort((a, b) => {
            if (options.critere === 'vma') return (b.vma || 0) - (a.vma || 0);
            return (b.force || 0) - (a.force || 0);
        });
    }

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

    // >>> RÉPARTITION SELON LE MODE <<<
    if (options.mode === 'niveau') {
        // Mode HÉTÉROGÈNE : On regroupe par niveau (blocs)
        const perTeam = Math.ceil(pool.length / nbEq);
        for (let i = 0; i < pool.length; i++) {
            const teamIndex = Math.floor(i / perTeam);
            if (teams[teamIndex]) {
                teams[teamIndex].members.push(pool[i]);
                teams[teamIndex].totalScore += (options.critere === 'vma' ? (pool[i].vma || 0) : (pool[i].force || 0));
            }
        }
    } else {
        // Mode MÉLANGE (homogène) : Répartition en serpentin
        let index = 0;
        let direction = 1;
        for (const eleve of pool) {
            teams[index].members.push(eleve);
            teams[index].totalScore += (options.critere === 'vma' ? (eleve.vma || 0) : (eleve.force || 0));
            
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