// src/js/services/import-service.js
import { getExistingEleves, saveEleves } from './admin-service.js';
import Papa from 'papaparse';

/**
 * Détecte automatiquement le séparateur d'un fichier CSV
 */
function detectSeparator(csvString) {
    const lines = csvString.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return ';';
    
    const firstLine = lines[0];
    const separators = [';', ',', '\t', '|'];
    let bestSep = ';';
    let bestCount = 0;
    
    for (const sep of separators) {
        const count = firstLine.split(sep).length;
        if (count > bestCount) {
            bestCount = count;
            bestSep = sep;
        }
    }
    return bestSep;
}

/**
 * Nettoie les noms : 
 * - Prénom : première lettre majuscule, reste minuscule
 * - Nom : tout en majuscule
 */
function cleanName(name, type = 'prenom') {
    if (!name) return '';
    name = name.trim();
    if (type === 'prenom') {
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    } else {
        return name.toUpperCase();
    }
}

/**
 * Detecte les colonnes dans un tableau d'en-têtes
 */
function detectColumns(headers) {
    const mapping = {
        prenom: null,
        nom: null,
        date: null,
        sexe: null
    };
    
    const keywords = {
        prenom: ['name', 'prenom', 'prénom', 'firstname', 'givenname', '@name'],
        nom: ['lastname', 'nom', 'surname', 'familyname', '@lastname'],
        date: ['birthday', 'birth', 'naissance', 'date', '@birthday'],
        sexe: ['sexe', 'gender', 'sex', '@sexe']
    };
    
    // Nettoyer les en-têtes (enlever les guillemets, espaces)
    const cleanHeaders = headers.map(h => h.replace(/^["']|["']$/g, '').trim());
    
    for (const [key, words] of Object.entries(keywords)) {
        for (let i = 0; i < cleanHeaders.length; i++) {
            const h = cleanHeaders[i].toLowerCase();
            if (words.some(w => h.includes(w.toLowerCase()) || w.toLowerCase().includes(h))) {
                mapping[key] = i;
                break;
            }
        }
    }
    
    return mapping;
}

/**
 * Parse une date dans différents formats
 */
function parseDate(dateStr) {
    if (!dateStr) return '';
    dateStr = dateStr.trim();
    
    // Formats possibles : JJ/MM/AAAA, JJ-MM-AAAA, AAAA-MM-JJ, AAAA/MM/JJ
    const patterns = [
        /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/, // JJ/MM/AAAA
        /^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/, // AAAA-MM-JJ
    ];
    
    for (const pattern of patterns) {
        const match = dateStr.match(pattern);
        if (match) {
            if (match[1].length === 4) {
                // AAAA-MM-JJ
                return `${match[2]}/${match[3]}/${match[1]}`;
            } else {
                // JJ/MM/AAAA
                return `${match[1]}/${match[2]}/${match[3]}`;
            }
        }
    }
    
    return dateStr; // retour tel quel si non reconnu
}

/**
 * Importe un fichier CSV depuis iDoceo
 */
export function importerIDoceo(file, classeName, onProgress, onComplete) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvString = e.target.result;
        const separator = detectSeparator(csvString);
        
        // Parser avec Papa Parse
        const result = Papa.parse(csvString, {
            delimiter: separator,
            header: true,
            skipEmptyLines: true,
            trimHeaders: false,
            transformHeader: (header) => header.trim().replace(/^["']|["']$/g, '')
        });
        
        if (result.errors.length > 0) {
            if (onComplete) onComplete({ success: false, error: result.errors[0].message });
            return;
        }
        
        const data = result.data;
        if (data.length === 0) {
            if (onComplete) onComplete({ success: false, error: 'Fichier vide' });
            return;
        }
        
        // Détecter les colonnes
        const headers = result.meta.fields || [];
        const mapping = detectColumns(headers);
        
        // Vérifier qu'on a au moins prénom et nom
        if (mapping.prenom === null || mapping.nom === null) {
            // Si la détection automatique échoue, on propose un mapping manuel
            if (onComplete) onComplete({ 
                success: false, 
                error: 'Détection automatique impossible',
                headers: headers,
                mapping: mapping,
                data: data.slice(0, 5)
            });
            return;
        }
        
        // Construire les données des élèves
        const elevesExistants = getExistingEleves(classeName);
        const nouveauxEleves = [];
        const updatedEleves = [];
        
        for (const row of data) {
            const rowValues = Object.values(row);
            const prenom = cleanName(rowValues[mapping.prenom] || '', 'prenom');
            const nom = cleanName(rowValues[mapping.nom] || '', 'nom');
            
            if (!prenom || !nom) continue;
            
            const date = mapping.date !== null ? parseDate(rowValues[mapping.date] || '') : '';
            const sexe = mapping.sexe !== null ? (rowValues[mapping.sexe] || '').toUpperCase() : '';
            
            // Générer un ID unique
            const normalizedNom = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            const normalizedPrenom = prenom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            const id = `${normalizedNom}_${normalizedPrenom.charAt(0)}`;
            
            // Vérifier si l'élève existe déjà
            const existing = elevesExistants.find(e => e.id === id);
            if (existing) {
                // Mettre à jour les infos
                let modifie = false;
                if (existing.prenom !== prenom) { existing.prenom = prenom; modifie = true; }
                if (existing.nom !== nom) { existing.nom = nom; modifie = true; }
                if (date && existing.dateNaissance !== date) { existing.dateNaissance = date; modifie = true; }
                if (sexe && existing.sexe !== sexe) { existing.sexe = sexe; modifie = true; }
                if (modifie) updatedEleves.push(existing);
            } else {
                // Créer un nouvel élève
                const newEleve = {
                    id: id,
                    prenom: prenom,
                    nom: nom,
                    sexe: sexe || '',
                    dateNaissance: date || '',
                    vma: 0,
                    palier: 0,
                    longueur: null,
                    sprint30: null,
                    force: 0
                };
                nouveauxEleves.push(newEleve);
                elevesExistants.push(newEleve);
            }
        }
        
        // Sauvegarder
        if (nouveauxEleves.length > 0 || updatedEleves.length > 0) {
            saveEleves(classeName, elevesExistants);
        }
        
        if (onComplete) {
            onComplete({
                success: true,
                nouveaux: nouveauxEleves.length,
                updated: updatedEleves.length,
                total: data.length
            });
        }
    };
    reader.onerror = function() {
        if (onComplete) onComplete({ success: false, error: 'Erreur de lecture du fichier' });
    };
    reader.readAsText(file);
}

/**
 * Interface modale pour l'import iDoceo
 */
export function openImportModal(classeName) {
    // Créer la modale
    const modal = document.createElement('div');
    modal.id = 'import-idoceo-modal';
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-black text-blue-400 uppercase">📥 Import iDoceo</h3>
                <button onclick="window.closeImportModal()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white">✖ Fermer</button>
            </div>
            
            <div id="import-step-1">
                <p class="text-sm text-slate-400 mb-4">Sélectionne le fichier CSV exporté depuis iDoceo.</p>
                <div class="border-2 border-dashed border-slate-600 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer" id="import-drop-zone">
                    <div class="text-4xl mb-2">📂</div>
                    <p class="text-slate-400">Clique ou glisse un fichier CSV</p>
                    <input type="file" id="import-file-input" accept=".csv" class="hidden">
                </div>
                <div id="import-preview" class="hidden mt-4"></div>
            </div>
            
            <div id="import-step-2" class="hidden">
                <div id="import-mapping" class="mt-4"></div>
                <div id="import-progress" class="mt-4 hidden">
                    <div class="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                        <div id="import-progress-bar" class="bg-emerald-500 h-full transition-all" style="width:0%"></div>
                    </div>
                    <p id="import-progress-text" class="text-xs text-slate-400 mt-2 text-center">Import en cours...</p>
                </div>
            </div>
            
            <div id="import-result" class="hidden mt-4"></div>
            
            <div class="flex gap-3 mt-6" id="import-actions">
                <button onclick="window.closeImportModal()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white text-sm active:scale-95">Annuler</button>
                <button id="import-confirm-btn" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95 hidden">✅ Importer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Gestion du drop et du click
    const dropZone = document.getElementById('import-drop-zone');
    const fileInput = document.getElementById('import-file-input');
    const step1 = document.getElementById('import-step-1');
    const step2 = document.getElementById('import-step-2');
    const preview = document.getElementById('import-preview');
    const mappingDiv = document.getElementById('import-mapping');
    const confirmBtn = document.getElementById('import-confirm-btn');
    
    let parsedData = null;
    let detectedMapping = null;
    let headers = [];
    
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-500/10');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        }
    });
    
    function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('Veuillez sélectionner un fichier CSV.');
            return;
        }
        
        // Lire et analyser
        const reader = new FileReader();
        reader.onload = function(e) {
            const csvString = e.target.result;
            const separator = detectSeparator(csvString);
            
            const result = Papa.parse(csvString, {
                delimiter: separator,
                header: true,
                skipEmptyLines: true,
                trimHeaders: false,
                transformHeader: (header) => header.trim().replace(/^["']|["']$/g, '')
            });
            
            if (result.errors.length > 0) {
                alert('Erreur de parsing : ' + result.errors[0].message);
                return;
            }
            
            const data = result.data;
            if (data.length === 0) {
                alert('Fichier vide.');
                return;
            }
            
            headers = result.meta.fields || [];
            detectedMapping = detectColumns(headers);
            parsedData = data;
            
            // Afficher l'aperçu
            showPreview(data, headers, detectedMapping);
            
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            confirmBtn.classList.remove('hidden');
        };
        reader.readAsText(file);
    }
    
    function showPreview(data, headers, mapping) {
        // Aperçu des 5 premières lignes
        let html = `
            <div class="mt-4">
                <p class="text-xs font-bold text-slate-400 uppercase mb-2">Aperçu des données (5 premières lignes)</p>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs border-collapse">
                        <thead>
                            <tr class="bg-slate-800">
                                ${headers.map(h => `<th class="p-2 border border-slate-700 text-left">${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                `;
        data.slice(0, 5).forEach(row => {
            const values = headers.map(h => row[h] || '');
            html += `<tr class="border-b border-slate-700">${values.map(v => `<td class="p-2 border border-slate-700">${v || '—'}</td>`).join('')}</tr>`;
        });
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Mapping des colonnes
        html += `
            <div class="mt-4">
                <p class="text-xs font-bold text-slate-400 uppercase mb-2">Mapping des colonnes</p>
                <div class="grid grid-cols-2 gap-2">
        `;
        const fields = [
            { key: 'prenom', label: 'Prénom', required: true },
            { key: 'nom', label: 'Nom', required: true },
            { key: 'date', label: 'Date de naissance', required: false },
            { key: 'sexe', label: 'Sexe', required: false }
        ];
        
        for (const field of fields) {
            const selected = mapping[field.key] !== null ? mapping[field.key] : '';
            html += `
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-400 w-20">${field.label}${field.required ? ' *' : ''}</span>
                    <select class="mapping-select flex-1 bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white" data-field="${field.key}">
                        <option value="">-- Ignorer --</option>
                        ${headers.map((h, idx) => `<option value="${idx}" ${idx === selected ? 'selected' : ''}>${h}</option>`).join('')}
                    </select>
                </div>
            `;
        }
        html += `
                </div>
                <p class="text-[10px] text-slate-500 mt-2">* Champs obligatoires : Prénom et Nom</p>
            </div>
        `;
        
        preview.innerHTML = html;
        preview.classList.remove('hidden');
        
        // Mettre à jour le mapping lors du changement
        document.querySelectorAll('.mapping-select').forEach(select => {
            select.addEventListener('change', () => {
                // Mettre à jour detectedMapping
                const field = select.dataset.field;
                const value = select.value !== '' ? parseInt(select.value) : null;
                detectedMapping[field] = value;
            });
        });
        
        // Confirmer l'import
        confirmBtn.onclick = function() {
            // Vérifier que prénom et nom sont mappés
            if (detectedMapping.prenom === null || detectedMapping.nom === null) {
                alert('Les colonnes "Prénom" et "Nom" sont obligatoires.');
                return;
            }
            
            // Lancer l'import
            const progressBar = document.getElementById('import-progress-bar');
            const progressText = document.getElementById('import-progress-text');
            const progressDiv = document.getElementById('import-progress');
            progressDiv.classList.remove('hidden');
            confirmBtn.disabled = true;
            confirmBtn.textContent = '⏳ Import en cours...';
            
            // Simuler une progression
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                progressBar.style.width = Math.min(progress, 90) + '%';
                progressText.textContent = `Import en cours... ${Math.min(progress, 90)}%`;
            }, 200);
            
            // Importer les données
            const result = importerDonnees(parsedData, headers, detectedMapping, classeName);
            
            clearInterval(interval);
            progressBar.style.width = '100%';
            progressText.textContent = '✅ Import terminé !';
            
            setTimeout(() => {
                if (result.success) {
                    progressDiv.classList.add('hidden');
                    confirmBtn.classList.add('hidden');
                    document.getElementById('import-actions').innerHTML = `
                        <button onclick="window.closeImportModal()" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                            ✅ Fermer
                        </button>
                    `;
                    // Afficher le résultat
                    const resultDiv = document.getElementById('import-result');
                    resultDiv.classList.remove('hidden');
                    resultDiv.innerHTML = `
                        <div class="bg-emerald-500/20 border border-emerald-500 p-4 rounded-xl text-center">
                            <p class="text-emerald-400 font-bold text-lg">✅ Import réussi !</p>
                            <p class="text-sm text-slate-300">${result.nouveaux} élève(s) créé(s), ${result.updated} mis à jour.</p>
                        </div>
                    `;
                } else {
                    alert('Erreur : ' + result.error);
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '✅ Importer';
                }
            }, 500);
        };
    }
    
    function importerDonnees(data, headers, mapping, classeName) {
        const elevesExistants = getExistingEleves(classeName);
        const nouveauxEleves = [];
        const updatedEleves = [];
        
        for (const row of data) {
            const rowValues = headers.map(h => row[h] || '');
            const prenom = cleanName(rowValues[mapping.prenom] || '', 'prenom');
            const nom = cleanName(rowValues[mapping.nom] || '', 'nom');
            
            if (!prenom || !nom) continue;
            
            const date = mapping.date !== null ? parseDate(rowValues[mapping.date] || '') : '';
            const sexe = mapping.sexe !== null ? (rowValues[mapping.sexe] || '').toUpperCase() : '';
            
            // Générer un ID unique
            const normalizedNom = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            const normalizedPrenom = prenom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            const id = `${normalizedNom}_${normalizedPrenom.charAt(0)}`;
            
            // Vérifier si l'élève existe déjà
            const existing = elevesExistants.find(e => e.id === id);
            if (existing) {
                let modifie = false;
                if (existing.prenom !== prenom) { existing.prenom = prenom; modifie = true; }
                if (existing.nom !== nom) { existing.nom = nom; modifie = true; }
                if (date && existing.dateNaissance !== date) { existing.dateNaissance = date; modifie = true; }
                if (sexe && existing.sexe !== sexe) { existing.sexe = sexe; modifie = true; }
                if (modifie) updatedEleves.push(existing);
            } else {
                const newEleve = {
                    id: id,
                    prenom: prenom,
                    nom: nom,
                    sexe: sexe || '',
                    dateNaissance: date || '',
                    vma: 0,
                    palier: 0,
                    longueur: null,
                    sprint30: null,
                    force: 0
                };
                nouveauxEleves.push(newEleve);
                elevesExistants.push(newEleve);
            }
        }
        
        if (nouveauxEleves.length > 0 || updatedEleves.length > 0) {
            saveEleves(classeName, elevesExistants);
        }
        
        return {
            success: true,
            nouveaux: nouveauxEleves.length,
            updated: updatedEleves.length
        };
    }
}

// Exposition globale pour les appels HTML
window.openImportModal = function() {
    const classe = document.getElementById('selectClasse').value;
    if (!classe) {
        alert('Sélectionnez une classe d\'abord.');
        return;
    }
    openImportModal(classe);
};

window.closeImportModal = function() {
    const modal = document.getElementById('import-idoceo-modal');
    if (modal) modal.remove();
};