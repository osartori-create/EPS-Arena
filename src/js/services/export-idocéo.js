// src/js/services/export-idocéo.js

export function exportIDoceo({ students, results, className, activityName }) {
    // 1. Filtrer les élèves et calculer les statistiques
    let exportData = students.map(e => {
        let score = 0;
        let max = 0;
        let timeSec = 999999; // Valeur max pour trier les non-partants à la fin

        // On récupère les données pour cet élève (results doit être un objet indexé par ID ou Code)
        const studentResult = results[e.id] || results[e.code] || null;

        if (studentResult && e.code !== 'ABS' && e.code !== 'INAPTE') {
            score = studentResult.points || 0;
            max = studentResult.objectif || 0;
            timeSec = studentResult.time || 0;

            // Note sur 20
            let note = "";
            if (max > 0) {
                note = ((score / max) * 20).toFixed(1).replace('.', ',');
            }
            
            // Temps formaté
            let timeStr = formatTime(timeSec);

            return { nomComplet: `${e.prenom} ${e.nom}`, score, max, note, timeStr, timeSec };
        } else {
            // Absent / Inapte
            return { nomComplet: `${e.prenom} ${e.nom}`, score: "", max: "", note: "", timeStr: "", timeSec };
        }
    });

    // 2. Trier : Score desc, puis Temps asc
    exportData.sort((a, b) => {
        if (a.score === "" && b.score === "") return 0;
        if (a.score === "") return 1;
        if (b.score === "") return -1;
        if (b.score !== a.score) return b.score - a.score;
        return a.timeSec - b.timeSec;
    });

    // 3. Construire le CSV (même structure que CO-Logic)
    let csv = "\uFEFF\"Rang\",\"Equipe\",\"Score\",\"Objectif\",\"Note /20\",\"Temps\"\n";
    exportData.forEach((r, idx) => {
        let rang = (r.score !== "") ? (idx + 1) : "";
        csv += `"${rang}","${r.nomComplet}","${r.score}","${r.max}","${r.note}","${r.timeStr}"\n`;
    });

    // 4. Générer le fichier
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `EPS_Arena_${activityName}_${className}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatTime(s) { 
    if(!s) return ""; 
    const min = Math.floor(s/60); 
    const sec = s % 60; 
    return `${min}:${sec < 10 ? '0' : ''}${sec}`; 
}