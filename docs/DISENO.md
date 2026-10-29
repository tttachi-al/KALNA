# KALLPA · Sistema de diseño

Generado a partir de la guía **ui-ux-pro-max** (estilo *Accessible & Ethical*) y adaptado a la identidad de KALLPA.

## Principios

- **Accesible primero:** texto ≥ 4.5:1 de contraste en claro y oscuro, foco visible (3 px), objetivos táctiles ≥ 44 px, `prefers-reduced-motion` respetado.
- **Lenguaje sencillo:** frases cortas, verbos directos, ejemplos concretos. Pensado para personas con poca experiencia digital.
- **El estado nunca depende solo del color:** cada estado y ocupación tiene ícono y texto.
- **Honestidad visible:** avisos de “ficticio”, “no oficial” y “sin datos” donde corresponde.

## Tokens (`src/styles/tokens.css`)

| Rol | Claro | Oscuro |
| --- | --- | --- |
| Fondo | `#f6f3ec` | `#0e1626` |
| Superficie | `#ffffff` | `#16213a` |
| Texto | `#18212f` | `#eef1f6` |
| Texto secundario | `#5a6475` | `#9aa6b8` |
| Marca (terracota) | `#a63d1a` | `#f08a5d` |
| Noche (cabeceras, mapa) | `#14213a` | `#0a1222` |
| Oro (acento sobre noche) | `#f2b84b` | `#f2b84b` |
| Con evidencia | `#0b6b63` / `#daf1ec` | `#6fdccd` / `#10332f` |
| Declarada | `#364152` / `#e8ebf0` | `#c9d1de` / `#263450` |
| Por validar | `#7a4a00` / `#fcefd0` | `#f3c66b` / `#3a2d10` |

Colores por ocupación (texto/ícono sobre claro): limpieza `#0e7490`, administrativo `#3b5ba9`, reponedor `#9a5b0b`, vendedor `#a8326e`, cajero `#11703a`. En oscuro y en el mapa se usan sus versiones claras.

## Tipografía

- **Títulos y botones:** Lexend (diseñada para mejorar la lectura), pesos 500–600.
- **Texto, formularios y etiquetas:** Source Sans 3 variable (humanista, sobria, latin-ext completo para el español; pesos 400–700).
- Escala ≈1.2: 12 · 13.5 · 15 · 17 (base) · 20 · 24 · 32 px; portada 34–54 px.
- Pesos: 400 texto, 500 botones, 600 títulos, etiquetas y énfasis; 700 solo la marca.
- Interlineado: 1.6 párrafos, 1.3 subtítulos y etiquetas, 1.15 títulos.
- Mayúsculas pequeñas con +0.06em; títulos con −0.02em.
- Todo vive en `src/styles/tokens.css` (`--font-*`, `--text-*`, `--fw-*`, `--lh-*`, `--tracking-*`).

## Espaciado, radios y movimiento

- Ritmo de 4/8 px: 4, 8, 12, 16, 24, 32, 48, 64.
- Radios: 8, 12, 18, 26 y píldora.
- Movimiento: 140 ms (micro), 220 ms (estándar), 380 ms (entradas). Entrada escalonada suave; todo se desactiva con movimiento reducido.

## Identidad

La marca son **tres peldaños que suben** (crecimiento, fuerza) inspirados en los escalonados de los tejidos andinos, con un punto dorado. La franja tejida aparece en el inicio y el pasaporte.
