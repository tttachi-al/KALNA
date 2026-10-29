/**
 * Configuración de la capa de datos.
 *
 * VITE_KALLPA_MODE:
 *   - 'mock' (por defecto): motor de demostración local, sin backend.
 *   - 'qvac': usa src/services/adapters/qvacAdapter.js (backend + QVAC).
 *
 * Define estas variables en un archivo `.env` (ver `.env.example`).
 */
export const KALLPA_MODE = (import.meta.env?.VITE_KALLPA_MODE || 'mock').toLowerCase();
export const API_URL = import.meta.env?.VITE_KALLPA_API_URL || 'http://localhost:8000/api';

/** Latencia simulada del modo demostración (ms), para mostrar estados de carga reales. */
export const MOCK_LATENCY = { chat: 900, query: 250 };

export const IS_MOCK = KALLPA_MODE !== 'qvac';

/**
 * Empleos Perú (MTPE), donde la persona postula a las ofertas vigentes.
 *   - VITE_EMPLEOS_PERU_URL:        portal de búsqueda de empleo.
 *   - VITE_EMPLEOS_PERU_SEARCH_URL: plantilla con {q} para abrir la búsqueda de un puesto
 *     (por ejemplo, cuando el MTPE habilite un enlace o API de búsqueda por palabra clave).
 */
export const EMPLEOS_PERU_URL = import.meta.env?.VITE_EMPLEOS_PERU_URL || 'https://www.empleosperu.gob.pe';
const EMPLEOS_PERU_SEARCH_URL = import.meta.env?.VITE_EMPLEOS_PERU_SEARCH_URL || '';

/** Enlace para buscar un puesto en Empleos Perú (o el portal, si no hay plantilla de búsqueda). */
export function empleosPeruUrl(term) {
  if (EMPLEOS_PERU_SEARCH_URL.includes('{q}')) {
    return EMPLEOS_PERU_SEARCH_URL.replace('{q}', encodeURIComponent(term));
  }
  return EMPLEOS_PERU_URL;
}
