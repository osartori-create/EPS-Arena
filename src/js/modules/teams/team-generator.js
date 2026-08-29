// src/js/modules/teams/team-generator.js

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Fonction de tri par critère (utilisée en interne)
function sortByCriteria(pool, critere) {
    return [...pool].sort((a, b) => {
        if (critere === 'polyvalent') {
            // Calcul inversé pour le 30m (plus bas = mieux)
            const scoreA = (a.vma || 0) + ((a.longueur || 0) / 10) - (a.sprint30 || 99);
            const scoreB = (b.vma || 0) + ((b.longueur || 0) / 10) - (b.sprint30 || 99);
            return scoreB - scoreA;
        }
        if (critere === 'vma') {
            return (b.vma || 0) - (a.vma || 0);
        }
        return (b.force || 0) - (a.force || 0); // Critère Force
    });
}

export function generateTeams(eleves, options) {
    let pool = [...eleves];
    let teams = [];

    // 1. Gestion de la mixité
    if (options.mixite === 'non-mixte') {
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F' || !e.sexe);
        
        // Tri par critère à l'intérieur de chaque groupe
        garcons.sort((a, b) => (options.critere === 'vma' ? (b.vma||0)-(a.vma||0) : (b.force||0)-(a.force||0)));
        filles.sort((a, b) => (options.critere === 'vma' ? (b.vma||0)-(a.vma||0) : (b.force||0)-(a.force||0)));

        teams = [...buildTeams(garcons, options, 0, false), ...buildTeams(filles, options, garcons.length, false)];
    } 
    else if (options.mixite === 'mixte') {
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F');
        const autres = pool.filter(e => e.sexe !== 'M' && e.sexe !== 'F');

        // 1. Trier chaque groupe par critère
        const garconsTries = sortByCriteria(garcons, options.critere);
        const fillesTries = sortByCriteria(filles, options.critere);
        const autresTries = sortByCriteria(autres, options.critere);

        // 2. Entrelacer G1, F1, G2, F2... (préserver le niveau)
        let poolMixte = [];
        let maxLength = Math.max(garconsTries.length, fillesTries.length, autresTries.length);
        for (let i = 0; i < maxLength; i++) {
            if (garconsTries[i]) poolMixte.push(garconsTries[i]);
            if (fillesTries[i]) poolMixte.push(fillesTries[i]);
            if (autresTries[i]) poolMixte.push(autresTries[i]);
        }

        // 3. Passer le pool mixte SANS re-tri
        teams = buildTeams(poolMixte, options, 0, false);
    } 
    else {
        // Mode 'ignore' (non prise en compte du sexe)
        teams = buildTeams(pool, options, 0, true); // on garde le tri
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

    // Si le tri est demandé (mode ignore), on trie le pool
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

    // >>> RÉPARTITION SERPENTIN UNIQUE (garantie une mixité parfaite) <<<
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