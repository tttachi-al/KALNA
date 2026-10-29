/**
 * Caso de demostración — PERSONA FICTICIA.
 *
 * María no es una persona real. Su historia se usa en el Modo demostración
 * para mostrar un recorrido completo, desde su experiencia en limpieza
 * hasta una posible transición a reponedora y abastecedora.
 *
 * Las respuestas se envían al MISMO motor de diagnóstico que usan las
 * personas reales, para que la demostración sea coherente con la app.
 */
export const DEMO_CASE = {
  id: 'maria-demo',
  alias: 'María',
  label: 'María · caso ficticio',
  target: 'reponedor',
  // Respuestas por etapa del diagnóstico
  answers: {
    nombre: { text: 'María' },
    ocupaciones: { choices: ['limpieza'] },
    formalidad: { choices: ['ambos'] },
    tiempo: { choices: ['mas5'] },
    tareas: {
      text: 'Llevo ocho años en limpieza de oficinas. Cada mañana organizo los materiales en el carrito de limpieza, preparo los productos de limpieza según el área y sigo el protocolo de desinfección de los baños.',
    },
    herramientas: {
      text: 'Uso desinfectante, lejía diluida, guantes y mascarilla. También uso WhatsApp en el celular para avisar a la supervisora.',
    },
    responsabilidades: {
      text: 'Soy responsable del cuarto de limpieza. Cada semana reviso qué insumos faltan y aviso a la supervisora para que los reponga. También enseño a los compañeros nuevos.',
    },
    situaciones: {
      text: 'Una vez faltó papel higiénico en todo el piso antes de una reunión importante. Revisé el depósito, encontré cajas guardadas en otro lugar y reorganicé el depósito por tipo de material para que no vuelva a pasar.',
    },
  },
  // Ejemplos concretos por competencia (etapa de evidencias)
  evidence: {
    control_suministros:
      'Cada lunes reviso el depósito, cuento los rollos de papel, el jabón y las bolsas, y anoto en un cuaderno lo que falta. Luego le envío la lista a la supervisora por WhatsApp.',
    org_materiales:
      'Separo los materiales por área: baños, oficinas y cocina. Cada zona tiene su balde y sus trapos de un color, así nadie los mezcla y trabajamos más rápido.',
    protocolos:
      'En los baños sigo siempre los mismos pasos: me pongo guantes, pongo el letrero de piso mojado, desinfecto de arriba hacia abajo y nunca mezclo lejía con otros productos.',
    uso_productos:
      'Diluyo la lejía según la etiqueta, una tapa por balde de agua, y uso el limpiavidrios solo en ventanas para no dañar los muebles.',
    comunicacion:
      'Cuando llega alguien nuevo, primero le muestro cómo lo hago yo, después lo hace con mi ayuda y al final lo hace solo mientras lo observo.',
  },
};
