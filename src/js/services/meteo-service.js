// src/js/services/meteo-service.js
// Météo du calendrier — Open-Meteo (gratuit, sans clé API).
// RGPD : aucune donnée personnelle transmise (simple ville + prévisions).
// Hors ligne : on relit le cache localStorage (prévisions précédentes).

const KEY_VILLE = 'eps_arena_meteo_ville';
const KEY_CACHE = 'eps_arena_meteo_cache';
const DUREE_CACHE = 3 * 3600 * 1000; // 3 h
const VERSION = 3; // 1 = { jours }, 2 = { daily, hourly }, 3 = + vent/rafales/UV

export function lireVille() {
    return localStorage.getItem(KEY_VILLE) || '';
}

export function enregistrerVille(ville) {
    const v = (ville || '').trim();
    if (v) localStorage.setItem(KEY_VILLE, v);
    else localStorage.removeItem(KEY_VILLE);
    try {
        const cache = JSON.parse(localStorage.getItem(KEY_CACHE) || 'null');
        if (cache && cache.ville !== v) localStorage.removeItem(KEY_CACHE);
    } catch (e) { /* ignore */ }
    return v;
}

function lireCache() {
    try { return JSON.parse(localStorage.getItem(KEY_CACHE) || 'null'); } catch (e) { return null; }
}
function ecrireCache(cache) { localStorage.setItem(KEY_CACHE, JSON.stringify(cache)); }

// Cache déjà présent (sans vérifier la fraîcheur) — affichage immédiat hors ligne.
export function lireMeteoCache() {
    const ville = lireVille();
    const cache = lireCache();
    if (cache && cache.ville === ville) {
        const daily = cache.daily || cache.jours || null; // migration ancien format
        if (daily) return { daily, hourly: cache.hourly || {} };
    }
    return { daily: {}, hourly: {} };
}

// Codes WMO → emoji.
const CODES_EMOJI = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
    45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
    61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
    71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
    80: '🌧️', 81: '🌧️', 82: '🌧️',
    85: '🌨️', 86: '🌨️',
    95: '⛈️', 96: '⛈️', 99: '⛈️'
};
export function meteoEmoji(code) {
    return CODES_EMOJI[Number(code)] || '🌡️';
}

async function geocoder(ville) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr&format=json`;
    const rep = await fetch(url);
    if (!rep.ok) throw new Error('Geocodage HTTP ' + rep.status);
    const json = await rep.json();
    const r = (json.results && json.results[0]) || null;
    if (!r) throw new Error('Ville introuvable : ' + ville);
    return { latitude: r.latitude, longitude: r.longitude };
}

async function previsions(latitude, longitude) {
    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,uv_index_max',
        hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,uv_index',
        timezone: 'Europe/Paris',
        forecast_days: '7'
    });
    const rep = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!rep.ok) throw new Error('Météo HTTP ' + rep.status);
    const json = await rep.json();

    const daily = {};
    const d = json.daily || {};
    (d.time || []).forEach((date, i) => {
        daily[date] = {
            emoji: meteoEmoji(d.weather_code ? d.weather_code[i] : 0),
            tmin: Math.round(d.temperature_2m_min ? d.temperature_2m_min[i] : 0),
            tmax: Math.round(d.temperature_2m_max ? d.temperature_2m_max[i] : 0),
            precip: Math.round(d.precipitation_probability_max ? d.precipitation_probability_max[i] : 0),
            uv: Math.round(d.uv_index_max ? d.uv_index_max[i] : 0)
        };
    });

    const hourly = {};
    const h = json.hourly || {};
    (h.time || []).forEach((iso, i) => {
        const [date, time] = String(iso).split('T');
        if (!date || !time) return;
        const heure = time.slice(0, 5); // "HH:MM"
        hourly[date] = hourly[date] || {};
        hourly[date][heure] = {
            emoji: meteoEmoji(h.weather_code ? h.weather_code[i] : 0),
            temp: Math.round(h.temperature_2m ? h.temperature_2m[i] : 0),
            precip: Math.round(h.precipitation_probability ? h.precipitation_probability[i] : 0),
            vent: Math.round(h.wind_speed_10m ? h.wind_speed_10m[i] : 0),
            rafales: Math.round(h.wind_gusts_10m ? h.wind_gusts_10m[i] : 0),
            uv: Math.round(h.uv_index ? h.uv_index[i] : 0)
        };
    });

    return { daily, hourly };
}

// Récupère les prévisions (fraîches sinon réseau, avec repli sur le cache).
export async function recupererMeteo(force = false) {
    const ville = lireVille();
    if (!ville) return { daily: {}, hourly: {} };
    const cache = lireCache();
    const cacheValide = !!(cache && cache.ville === ville && cache.version === VERSION && cache.daily);
    if (!force && cacheValide && cache.maj && (Date.now() - cache.maj) < DUREE_CACHE) {
        return { daily: cache.daily, hourly: cache.hourly || {} };
    }
    try {
        const { latitude, longitude } = await geocoder(ville);
        const data = await previsions(latitude, longitude);
        ecrireCache({ ville, maj: Date.now(), version: VERSION, daily: data.daily, hourly: data.hourly });
        return data;
    } catch (err) {
        console.warn('[Météo] Récupération impossible (hors ligne ?) :', err);
        // Repli : cache (nouveau ou ancien format) si disponible.
        const daily = (cache && cache.ville === ville) ? (cache.daily || cache.jours || null) : null;
        if (daily) return { daily, hourly: cache.hourly || {} };
        return { daily: {}, hourly: {} };
    }
}
