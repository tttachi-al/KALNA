/**
 * Utilidades de texto para el motor de demostración.
 */

/** Minúsculas, sin tildes ni diéresis (la ñ pasa a n). */
export function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Oculta los nombres de ocupación para que una competencia no se detecte
 * solo porque la persona nombró su puesto ("trabajé como vendedora").
 */
const OCCUPATION_WORDS =
  /\b(vendedor|vendedora|vendedores|cajero|cajera|cajeros|reponedor|reponedora|reponedores|abastecedor\w*|auxiliar(es)? administrativ\w*|personal de limpieza|limpiador\w*|conserje\w*)\b/g;

export function maskOccupationWords(normalizedText) {
  return normalizedText.replace(OCCUPATION_WORDS, '[puesto]');
}

/**
 * Divide un texto en fragmentos (frases) conservando el texto original,
 * para poder citar exactamente lo que dijo la persona.
 */
export function splitFragments(original = '') {
  return String(original)
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Recorta una cita a una longitud legible sin cortar palabras. */
export function trimQuote(text, max = 160) {
  const t = String(text).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Limpia un nombre o apodo escrito por la persona. */
export function cleanAlias(text = '') {
  const t = String(text)
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(me llamo|soy|mi nombre es|dime|llamame|llámame)\s+/i, '')
    .split(' ')
    .slice(0, 2)
    .join(' ')
    .slice(0, 24);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

export function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

let counter = 0;
export function uid(prefix = 'id') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}
