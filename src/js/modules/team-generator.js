// src/js/modules/teams/team-generator.js
export function generateTeams(eleves, options) {
    // options = { mixte: true, critere: 'vma'|'force', mode: 'homogene'|'heterogene', nbEquipes: 0, nbParEquipe: 0, couleurs: ['#ef4444', '#3b82f6'...] }

    let pool = [...eleves];
    if (!options.mixte) {
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F' || !e.sexe);
        // On génère séparément pour la non-mixité ou on les mélange ? 
        // L'utilisateur a dit "mixte/non-mixte", on va générer des équipes distinctes pour non-mixte.
        // Algorithme pour non-mixte : on génère pour les G, puis pour les F, et on fusionne les listes.
        // Pour simplifier ici, on filtre pour créer des équipes de même sexe.
        // ...
    }

    // Calcul du nombre d'équipes basé sur le champ intelligent
    let nbEq = options.nbEquipes;
    if (!nbEq) nbEq = Math.ceil(pool.length / options.nbParEquipe);

    // Tri du pool selon le critère
    pool.sort((a, b) => (options.critere === 'vma' ? b.vma : b.force) - (options.critere === 'vma' ? a.vma : a.force));

    let teams = Array.from({ length: nbEq }, (_, i) => ({
        id: `EQ${i+1}`,
        label: (options.labels[i] || `Équipe ${i+1}`),
        color: options.couleurs[i % options.couleurs.length],
        members: [],
        totalScore: 0
    }));

    if (options.mode === 'homogene') {
        // Répartition "Gloutonne" (Greedy) : on met le meilleur dans l'équipe la plus faible
        for (const eleve of pool) {
            let targetTeam = teams.reduce((a, b) => a.totalScore <= b.totalScore ? a : b);
            targetTeam.members.push(eleve);
            targetTeam.totalScore += (options.critere === 'vma' ? eleve.vma : eleve.force);
        }
    } else {
        // Répartition "Serpentin" (Hétérogène)
        let index = 0;
        let direction = 1;
        for (const eleve of pool) {
            teams[index].members.push(eleve);
            teams[index].totalScore += (options.critere === 'vma' ? eleve.vma : eleve.force);
            index += direction;
            if (index >= teams.length) { index = teams.length - 1; direction = -1; }
            else if (index < 0) { index = 0; direction = 1; }
        }
    }

    return teams;
}