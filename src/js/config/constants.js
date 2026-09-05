// src/js/config/constants.js

// Barème de cotation ESCALADE (source de vérité unique)
export const BAREME_ESCALADE = {
    "4a": 1, "4b": 1.1, "4c": 1.2,
    "5a": 1.3, "5b": 1.4, "5c": 1.5,
    "6a": 1.6, "6b": 1.8, "6c": 2
};

// ✅ NOUVEAU : Tableau de correspondance Palier Luc Léger → VMA extrapolée (km/h)
// Source : tableau fourni (arrondi à 1 décimale pour 19.32 -> 19.3)
export const PALIER_VMA = {
    1: 8.8,
    2: 9.5,
    3: 10.3,
    4: 11.0,
    5: 11.8,
    6: 12.3,
    7: 13.3,
    8: 14.0,
    9: 14.8,
    10: 15.5,
    11: 17.0,
    12: 17.8,
    13: 18.5,
    14: 19.3, // Arrondi à une décimale
    15: 20.0,
    16: 20.8,
    17: 21.5,
    18: 22.3,
    19: 23.0
};