/**
 * Persistencia local (solo en este navegador).
 * Todas las lecturas y escrituras están protegidas: si el navegador bloquea
 * el almacenamiento, la app sigue funcionando sin guardar.
 */
const KEY = 'kallpa:v1';

export function loadState() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export function saveState(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, ...data }));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}
