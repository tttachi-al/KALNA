import { BriefcaseBusiness, CircleHelp, House, MessagesSquare, UserRound } from 'lucide-react';

/**
 * Secciones de KALLPA. `step` = orden del recorrido sugerido.
 * «Mi ruta» y «Pasaporte» no son pasos del recorrido: se generan para un puesto
 * concreto desde su tarjeta en «Puestos» (botones «Crear mi ruta» y «Pasaporte»).
 * El CV en Word se descarga desde el pasaporte del puesto elegido.
 */
export const NAV_ITEMS = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/diagnostico', label: 'Diagnóstico', icon: MessagesSquare, step: 1, hint: 'Conversa sobre tu experiencia' },
  { to: '/perfil', label: 'Mi perfil', icon: UserRound, step: 2, hint: 'Tus competencias' },
  { to: '/ocupaciones', label: 'Puestos', icon: BriefcaseBusiness, step: 3, hint: 'Para postular' },
];

/** Enlaces de la cabecera (y del menú en móvil). */
export const HEADER_ITEMS = [
  NAV_ITEMS[0],
  { to: '/preguntas-frecuentes', label: 'Preguntas frecuentes', icon: CircleHelp },
];

/** Barra inferior en móvil (máximo 5 destinos). */
export const BOTTOM_ITEMS = ['/diagnostico', '/perfil', '/ocupaciones'];

/** Páginas que usan el ancho amplio (pasos del recorrido y las que se abren desde un puesto). */
export const WIDE_ROUTES = ['/diagnostico', '/perfil', '/ocupaciones', '/ruta', '/pasaporte', '/cv'];
