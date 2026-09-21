// src/js/modules/cross/cross-transmit.js
// Envoie la config Cross (courses + dossards + noms) sur Firebase
// pour que les iPads kiosks puissent l'afficher

import { db, ref, set } from '../../core/firebase-service.js';
import { getCrossBasePath, getDossards, getStatutsCross, getClassesParticipantes } from './cross-config.js';
import { COURSES_DEFAUT } from './cross-core.js';
import { getExistingEleves } from '../../services/admin-service.js';

export async function transmettreCrossConfig() {
    const basePath = getCrossBasePath();
    const statuts = getStatutsCross();
    const dossards = getDossards();
    const classes = getClassesParticipantes();

    // Mapping dossard → données ANONYMISÉES
    const elevesFirebase = {};
    let nbEleves = 0;

    Object.entries(dossards).forEach(([dossard, eleveId]) => {
        let trouve = null;
        for (const classe of classes) {
            const list = getExistingEleves(classe);
            const e = list.find(x => x.id === eleveId);
            if (e) { trouve = { ...e, classe }; break; }
        }
        if (!trouve) return;

        // ✅ RGPD : AUCUN nom, AUCUN prénom
        elevesFirebase[dossard] = {
            classe: trouve.classe,
            sexe: trouve.sexe,
            vma: parseFloat(trouve.vma) || null,
            statut: statuts[eleveId] || 'present'
        };
        nbEleves++;
    });

    await set(ref(db, `${basePath}/config/courses`), COURSES_DEFAUT);
    await set(ref(db, `${basePath}/config/eleves`), elevesFirebase);
    await set(ref(db, `${basePath}/config/meta`), {
        dateTransmission: Date.now(),
        nbEleves: nbEleves,
        nbClasses: classes.length
    });

    return { nbEleves, nbClasses: classes.length };
}