// src/js/services/export-idocéo.js

export function exportIDoceo({ students, results, className, activityName }) {
    // 1. Construire les lignes du CSV
    let exportData = students.map(e => {
        const result = results[e.code] || results[e.id] || null;
        
        // Gestion des absents / inaptes (pas de résultat)
        if (!result || e.code === 'ABS' || e.code === 'INAPTE') {
            return { 
                nomComplet: `${e.prenom} ${e.nom}`.trim(), 
                groupe: e.code || '', 
                score: "", 
                max: "", 
                note: "", 
                temps: "",
                tempsSec: 999999 // Pour le tri
            };
        }

        let score = result.points || 0;
        let max = result.objectif || 0;
        let tempsSec = result.time || 0;
        
        let note = "";
        if (max > 0) {
            note = ((score / max) * 20).toFixed(1).replace('.', ',');
        }

        let temps = "";
        if (tempsSec > 0) {
            const min = Math.floor(tempsSec / 60);
            const sec = tempsSec % 60;
            temps = `${min}:${sec < 10 ? '0' : ''}${sec}`;
        }

        return { 
            nomComplet: `${e.prenom} ${e.nom}`.trim(), 
            groupe: e.code || '', 
            score, 
            max, 
            note, 
            temps,
            tempsSec
        };
    });

    // 2. Trier : Score desc, puis Temps asc (les absents à la fin)
    exportData.sort((a, b) => {
        if (a.score === "" && b.score === "") return 0;
        if (a.score === "") return 1;
        if (b.score === "") return -1;
        if (b.score !== a.score) return b.score - a.score;
        return a.tempsSec - b.tempsSec;
    });

    // 3. Générer le CSV (avec BOM UTF-8 et guillemets)
    // IMPORTANT : On préfixe les colonnes d'identité avec "!" pour qu'iDoceo les garde groupées
    let csv = "\uFEFF\"!groupe\",\"Nom\",\"Score\",\"Objectif\",\"Note /20\",\"Temps\"\n";
    exportData.forEach((r, idx) => {
        let rang = (r.score !== "") ? (idx + 1) : "";
        csv += `"${r.groupe}","${r.nomComplet}","${r.score}","${r.max}","${r.note}","${r.temps}"\n`;
    });

    // 4. Télécharger
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `EPS_Arena_${activityName}_${className}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}