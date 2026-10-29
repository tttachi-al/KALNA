# Base de conocimiento laboral y knowledge graph

## Contenido

1. Punto de partida (lo que existe hoy)
2. Objetivos del diseño
3. Entidades y campos
4. Relaciones del grafo
5. Procedencia y validación
6. Implementación: relacional, no base de grafos (por ahora)
7. Formato de archivos de datos
8. Migración desde los catálogos actuales
9. Consultas típicas

---

## 1. Punto de partida

Hoy el conocimiento vive en **módulos JS** del frontend:

| Archivo | Contenido | Notas |
| --- | --- | --- |
| `src/data/competencies.js` | 26 competencias en 6 familias (`FAMILIES`) | `signals` son **regex** (código, no datos). `bases[{id, why}]` = base transferible. `learn[{type, text}]`, `ask` |
| `src/data/occupations.js` | 5 ocupaciones de referencia | `requires[{id, weight: 'clave'\|'complementaria'}]`, `requirements`, `nextSteps`, `interview` |
| `src/data/jobs.js` | 18 puestos para postular | Mismo formato de `requires` + `search` para Empleos Perú |
| `src/data/resources.js` | Portales del MTPE | Solo enlaces; KALLPA no inventa cursos |

Los comentarios del código lo reconocen: son **datos de demostración**. En
producción deberían reemplazarse por perfiles ocupacionales validados (por
ejemplo, estándares del MTPE). Ningún registro tiene hoy fuente ni nivel de
validación.

El perfil de la persona (`src/services/engine/profile.js`) ya modela parte del
grafo personal: `competencies[id] = { status, mentions[{quote, source}], examples[{text, level, at}] }`,
`dismissed[]` y `experience`.

## 2. Objetivos del diseño

- **Trazable**: cada dato dice de dónde salió y quién lo validó.
- **Actualizable sin tocar código**: los cambios de contenido son cambios de
  datos (archivos versionados en git o filas en la base), validados por
  esquema y cargados por el backend.
- **Compatible**: el backend puede seguir generando los mismos objetos que hoy
  consumen `matcher.js` y `routeBuilder.js` (`requires`, `bases`, `learn`).
- **Proporcional**: decenas de competencias y ocupaciones, no millones de nodos.

## 3. Entidades

Usa ids estables en `snake_case`, en español, y conserva los ids actuales
(`org_materiales`, `limpieza`, `aux_almacen`…) para no romper perfiles
guardados.

| Entidad | Campos clave |
| --- | --- |
| `Competency` | `id`, `name`, `short`, `family`, `description`, `ask` (pregunta para pedir ejemplo), `status` del dato (`draft`/`active`/`deprecated`), `version` |
| `Family` | `id`, `name`, `short`, `order` |
| `Indicator` (evidencia observable) | `id`, `competencyId`, `text` ("Revisa el stock de insumos con una frecuencia fija"), `examples[]` (frases reales o realistas de personas), `counterExamples[]` |
| `ExperienceType` | `id`, `name`, `formality` (`formal`/`informal`/`ambos`), `description`, ejemplos de cómo la gente la cuenta ("cuido la bodega de mi tía") |
| `Occupation` | `id`, `name`, `summary`, `scope` (`reference` para las 5, `job` para los puestos), `search` |
| `Requirement` | `occupationId`, `competencyId`, `weight` (`clave`/`complementaria`), `minStatus` opcional |
| `JobRequirement` (no competencia) | `occupationId`, `text` (turnos, documentos…), `kind` |
| `LearningResource` | `id`, `type` (`practica`/`observa`/`curso`/`portal`), `text` o `url`, `owner`, `cost`, `checkedAt` |
| `Source` | `id`, `title`, `publisher`, `url`, `date`, `license`, `type` (`norma`, `estandar_mtpe`, `estudio`, `equipo_kallpa`, `entrevista`) |

Entidades **de la persona** (no van en la base de conocimiento compartida;
viven en el perfil o en la sesión): `Experience` (relato), `Mention` (cita
textual), `Example` (evidencia aportada), `ProfileCompetency` (estado).

## 4. Relaciones del grafo

| Relación | De → A | Propiedades | Hoy existe como |
| --- | --- | --- | --- |
| `REQUIRES` | Occupation → Competency | `weight`, `sourceId` | `requires[]` |
| `TRANSFERS_TO` (base transferible) | Competency → Competency | `why`, `strength` opcional, `sourceId` | `bases[]` (invertido: `bases` vive en la competencia destino) |
| `BELONGS_TO` | Competency → Family | — | `family` |
| `OBSERVED_BY` | Competency → Indicator | — | (no existe) |
| `DEVELOPED_BY` | Competency → LearningResource | `order` | `learn[]` |
| `TYPICAL_IN` | ExperienceType → Competency | `frequency` (`común`/`ocasional`) — **solo para orientar preguntas, nunca para asignar** | (no existe) |
| `RELATED_TO` | Occupation → Occupation | `sharedCompetencies` (derivable) | (se calcula en `matcher.js`) |
| `SUPPORTED_BY` | cualquier dato → Source | `validation` | (no existe) |

Grafo personal (en el perfil):

- `Person -HAS {status}-> Competency`
- `Competency <-SUPPORTS- Mention|Example`
- `Person -TARGETS-> Occupation`
- `Route = brechas (REQUIRES − HAS) ordenadas por TRANSFERS_TO`

Esa última es la lógica que ya implementa `routeBuilder.js` con prioridad
alta, media o baja.

Ten cuidado con la dirección de `TRANSFERS_TO`. En `competencies.js`,
`org_materiales.bases = [org_productos, …]` significa "si la persona tiene
`org_productos`, le será más fácil aprender `org_materiales`". Es decir,
`org_productos -TRANSFERS_TO-> org_materiales`.

## 5. Procedencia y validación

Cada nodo y cada arista lleva:

```json
{
  "sourceIds": ["src_equipo_kallpa_2026"],
  "validation": "demo",
  "validatedBy": null,
  "validatedAt": null,
  "notes": ""
}
```

Niveles de `validation` (de menor a mayor):

1. `demo`: escrito por el equipo para la demostración (todo lo actual).
2. `revisado`: revisado por una persona con experiencia en el oficio o en
   orientación laboral.
3. `fuente_oficial`: respaldado por un estándar o perfil ocupacional
   publicado (indicar `Source`).

Reglas:

- La UI y las explicaciones del agente pueden **decir** el nivel ("referencia
  inicial, no oficial"). Nunca presentes un dato `demo` como estándar oficial.
- Las recomendaciones basadas solo en datos `demo` deben seguir mostrando el
  aviso actual: prototipo, no es certificación.

## 6. Implementación: relacional, no base de grafos

**Recomendación: base relacional (SQLite para el prototipo, PostgreSQL si se
despliega) con tablas de nodos y una tabla de aristas tipadas.**

Por qué basta:

- El tamaño es pequeño (decenas de competencias, decenas de ocupaciones,
  cientos de indicadores).
- Las consultas tienen uno o dos saltos ("requisitos de X", "bases de Y",
  "recursos para Z"); no hay recorridos profundos ni algoritmos de grafos.
- Una base relacional da transacciones, migraciones y respaldos conocidos.
  Además, SQLite‑vector (citado en la documentación de QVAC) o pgvector
  pueden guardar los embeddings en la misma base.

Reevalúa una base de grafos (Neo4j u otra) solo si aparecen recorridos de
profundidad variable (rutas de varios pasos entre ocupaciones), cientos de
ocupaciones con taxonomías externas enlazadas o consultas de caminos que no
se resuelvan con CTE recursivas.

Esquema mínimo:

```sql
CREATE TABLE source (id TEXT PRIMARY KEY, title TEXT, publisher TEXT, url TEXT, date TEXT, type TEXT);
CREATE TABLE family (id TEXT PRIMARY KEY, name TEXT, short TEXT, ord INTEGER);
CREATE TABLE competency (
  id TEXT PRIMARY KEY, family_id TEXT REFERENCES family(id),
  name TEXT, short TEXT, description TEXT, ask TEXT,
  status TEXT DEFAULT 'active', version INTEGER DEFAULT 1,
  validation TEXT DEFAULT 'demo'
);
CREATE TABLE indicator (id TEXT PRIMARY KEY, competency_id TEXT REFERENCES competency(id), text TEXT, validation TEXT);
CREATE TABLE occupation (id TEXT PRIMARY KEY, name TEXT, short TEXT, summary TEXT, scope TEXT, search TEXT, validation TEXT);
CREATE TABLE resource (id TEXT PRIMARY KEY, type TEXT, text TEXT, url TEXT, owner TEXT, checked_at TEXT);
CREATE TABLE edge (
  type TEXT NOT NULL,           -- REQUIRES | TRANSFERS_TO | DEVELOPED_BY | TYPICAL_IN | OBSERVED_BY
  from_id TEXT NOT NULL, to_id TEXT NOT NULL,
  props TEXT,                   -- JSON: weight, why, order…
  validation TEXT DEFAULT 'demo',
  PRIMARY KEY (type, from_id, to_id)
);
CREATE TABLE edge_source (type TEXT, from_id TEXT, to_id TEXT, source_id TEXT REFERENCES source(id));
CREATE TABLE node_source (node_id TEXT, source_id TEXT REFERENCES source(id));
```

Los vectores van en tablas aparte (`retrieval.md`) que referencian estos ids.

## 7. Formato de archivos de datos

Para que el equipo actualice el contenido sin programar, la fuente de verdad
puede ser una carpeta versionada (por ejemplo, `server/knowledge/`):

```
knowledge/
  sources.json
  families.json
  competencies/org_materiales.json
  occupations/limpieza.json
  jobs/aux_almacen.json
  resources.json
  schema/*.schema.json      ← JSON Schema para validar
```

Ejemplo `competencies/control_suministros.json`:

```json
{
  "id": "control_suministros",
  "name": "Control de suministros",
  "short": "Control de suministros",
  "family": "inventario",
  "description": "Revisar qué insumos quedan y avisar o reponer a tiempo.",
  "ask": "¿Cómo sabes cuándo falta un insumo? Cuéntame qué revisas y cada cuánto.",
  "indicators": [
    { "id": "cs_revision_periodica", "text": "Revisa existencias con una frecuencia fija", "examples": ["cada lunes reviso el depósito y anoto lo que falta"] }
  ],
  "transfersFrom": [{ "id": "control_existencias", "why": "…" }],
  "learn": [{ "type": "practica", "text": "…" }],
  "sourceIds": ["src_equipo_kallpa_2026"],
  "validation": "demo"
}
```

Un script de carga valida contra el esquema y comprueba la integridad
referencial: todo `requires`, `transfersFrom` y `family` debe existir. Es la
misma comprobación que ya hace `tests/engine.test.js`. El script carga la
base y regenera los embeddings que cambiaron.

Las **regex `signals`** del motor de demostración son código y se quedan en
el motor `mock`. En la base de conocimiento, su papel lo cumplen los
`indicators` y sus `examples`, que sí son datos y se pueden embeber.

## 8. Migración desde los catálogos actuales

1. Escribe un script de exportación que lea `src/data/*.js` y genere los JSON
   con `validation: "demo"` y la fuente `src_equipo_kallpa_2026`.
2. Invierte `bases` → `transfersFrom` sin perder `why`.
3. Añade la validación de integridad y una prueba de paridad: los objetos
   que reconstruye el backend deben ser iguales a los de `src/data` hasta
   que alguien cambie el contenido a propósito.
4. Solo entonces el backend sirve el catálogo. El frontend en modo `mock`
   puede seguir usando `src/data`. Decide con el equipo si el frontend en
   modo `qvac` también pide el catálogo al backend. Sería un cambio de
   contrato: hoy las pantallas importan `COMPETENCIES` y `OCCUPATIONS`
   directamente.

## 9. Consultas típicas

```sql
-- Requisitos de una ocupación
SELECT c.*, json_extract(e.props,'$.weight') AS weight
FROM edge e JOIN competency c ON c.id = e.to_id
WHERE e.type='REQUIRES' AND e.from_id = :occupation;

-- Competencias que la persona ya tiene y sirven de base para una brecha
SELECT e.from_id AS base, json_extract(e.props,'$.why') AS why
FROM edge e WHERE e.type='TRANSFERS_TO' AND e.to_id = :gap AND e.from_id IN (:own);
```
