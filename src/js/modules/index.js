// src/js/modules/index.js
// Baril public du dossier modules — n'expose que le registre, sans effets de bord.
// Les sous-modules (badminton, relais, natation, etc.) possèdent leur propre
// index.js et s'enregistrent via registerModule() lors de leur import dédié.

export * from './registry.js';