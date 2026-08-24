// src/js/modules/teams/team-generator.js
export function generateTeams(eleves, options) {
    // options = { mixte, critere: 'vma'|'force', mode: 'homogene'|'heterogene', nbEquipes, nbParEquipe, couleurs, labels }

    // 1. Séparer les sexes si non-mixte
    let pool = [...eleves];
    if (!options.mixte) {
        // Pour la non-mixité, on filtre pour créer des équipes unisexes
        const garcons = pool.filter(e => e.sexe === 'M');
        const filles = pool.filter(e => e.sexe === 'F' || !e.sexe);
        
        // On génère des équipes pour les garçons, puis pour les filles
        const teamsGarcons = buildTeams(garcons, options);
        const teamsFilles = buildTeams(filles, options);
        return [...teamsGarcons, ...teamsFilles];
    } else {
        return buildTeams(pool, options);
    }
}

function buildTeams(pool, options) {
    if (pool.length === 0) return [];

    // 2. Calcul du nombre d'équipes basé sur le champ intelligent
    let nbEq = options.nbEquipes;
    if (!nbEq) nbEq = Math.ceil(pool.length / options.nbParEquipe);
    
    // Création des conteneurs d'équipes
    let teams = Array.from({ length: nbEq }, (_, i) => ({
        id: `EQ${i+1}`,
        label: (options.labels[i] || `Équipe ${i+1}`),
        color: options.couleurs[i % options.couleurs.length],
        members: [],
        totalScore: 0
    }));

    // 3. Tri des élèves selon le critère (VMA ou Force)
    pool.sort((a, b) => (options.critere === 'vma' ? b.vma : b.force) - (options.critere === 'vma' ? a.vma : a.force));

    // 4. Algorithme de répartition
    if (options.mode === 'homogene') {
        // GLOUTON : On place le meilleur dans l'équipe la plus faible
        for (const eleve of pool) {
            let targetTeam = teams.reduce((a, b) => a.totalScore <= b.totalScore ? a : b);
            targetTeam.members.push(eleve);
            targetTeam.totalScore += (options.critere === 'vma' ? eleve.vma : eleve.force);
        }
    } else {
        // SERPENTIN : Répartition en zigzag pour équilibrer les niveaux
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