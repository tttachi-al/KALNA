import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { cleanCvDraft } from '../server/cv/draft.js';
import { cvContext, validateCvWriting } from '../server/cv/content.js';
import { createCvService } from '../server/cv/service.js';
import { cvFilename, renderCvDocx } from '../server/cv/template.js';
import { readFileSync } from 'node:fs';

const profile = { profileId: '00000000-0000-4000-8000-000000000001', alias: 'Ana Pérez', experience: { formality: 'informal' }, competencies: {
  manejo_dinero: { id: 'manejo_dinero', status: 'evidencia', examples: [{ text: 'Ayer conté el dinero y comparé la caja con las ventas al cerrar la bodega.', level: 'fuerte' }], mentions: [] },
} };
const passport = { occupationId: 'cajero', target: { id: 'cajero', name: 'Cajero' }, strengths: [{ competencyId: 'manejo_dinero', quote: profile.competencies.manejo_dinero.examples[0].text }], inferred: [{ competencyId: 'registro_transacciones', name: 'Registro de transacciones' }] };
const draft = { contact: { fullName: 'Ana Pérez', email: 'ana@example.test', phone: '999000111', location: 'Lima' }, experiences: [{ organization: 'Bodega familiar', role: 'Atención y cobro', period: '2022 a 2024', responsibilities: ['Atendía a los clientes y cobraba sus compras.'], achievements: ['Reduje 2 errores en el conteo.'] }], education: [{ institution: 'Instituto de ejemplo', qualification: 'Estudios de administración', period: '2023' }], certifications: ['Curso de caja declarado por la persona'], languages: ['Español nativo'] };
const llm = { calls: 0, async generate({ history, responseFormat }) {
  this.calls++;
  if (responseFormat.json_schema.name === 'verificar_cv') return { text: JSON.stringify({ judgments: JSON.parse(history[1].content).map((p) => ({ id: p.id, supported: true })) }) };
  const context = JSON.parse(history[1].content);
  const sources = context.fuentes;
  return { text: JSON.stringify({ summary: { text: 'Experiencia en cobro y atención de compras.', sourceIds: [sources[0].id] }, bullets: sources.filter((s) => s.kind !== 'education').map((s) => ({ text: s.text, experienceId: s.experienceId, kind: s.kind, sourceIds: [s.id] })), skillIds: context.competencias_confirmadas.map((s) => s.id) }) };
} };

const xmlOf = async (buffer) => strFromU8(unzipSync(buffer)['word/document.xml']);
const service = (model = llm) => createCvService({ llm: model, passports: { get: async () => passport }, store: { load: async () => ({ data: cleanCvDraft(draft) }), save: async () => ({}) } });

test('CV Word real con contacto, formación, competencias y datos verificables', async () => {
  const file = await service().generate({ profile, occupationId: 'cajero' });
  assert.equal(file.filename, 'CV_Ana_Perez.docx');
  assert.match(file.contentType, /wordprocessingml/);
  const xml = await xmlOf(file.buffer);
  for (const expected of ['Ana Pérez', 'ana@example.test', 'Bodega familiar', '2022 a 2024', 'Instituto de ejemplo', 'Español nativo', 'Manejo de dinero']) assert.ok(xml.includes(expected), expected);
  assert.ok(xml.includes('Por confirmar; no acreditada'));
  assert.ok(!xml.includes('<w:tbl>') && !xml.includes('w:txbxContent'));
  assert.ok(!xml.includes('prioridad alta') && !xml.includes('sourceIds') && !xml.includes('QVAC'));
});

test('experiencia informal sin empleador ni fechas: conserva campos editables, no inventa cargos', async () => {
  const file = await service().generate({ profile, occupationId: 'cajero', draft: {} });
  const xml = await xmlOf(file.buffer);
  for (const expected of ['[Empresa, negocio o actividad]', '[Cargo o función]', '[Periodo]', 'Añade aquí tus cursos', 'Idioma y nivel confirmado']) assert.ok(xml.includes(expected));
  assert.ok(!xml.includes('Bodega familiar') && !xml.includes('2022') && !xml.includes('Ingeniero'));
});

test('validador rechaza cifras, niveles y logros inventados, así como competencias no confirmadas', () => {
  const context = cvContext(profile, passport, {});
  const base = { summary: { text: '', sourceIds: [] }, bullets: [{ text: 'Conté el dinero al cerrar la bodega.', sourceIds: ['relato-1'], experienceId: 'relatos', kind: 'responsibility' }], skillIds: ['manejo_dinero'] };
  assert.ok(validateCvWriting(base, context));
  for (const text of ['Ahorré 500 soles.', 'Soy experto certificado en caja.', 'Aprende a cobrar siguiendo la ruta laboral.']) assert.throws(() => validateCvWriting({ ...base, bullets: [{ ...base.bullets[0], text }] }, context));
  assert.throws(() => validateCvWriting({ ...base, skillIds: ['medios_pago'] }, context));
  assert.throws(() => validateCvWriting({ ...base, bullets: [{ ...base.bullets[0], kind: 'achievement' }] }, context));
});

test('inferencia o verificación fallida no producen una descarga ficticia', async () => {
  await assert.rejects(service({ generate: async () => { throw new Error('Modelo no disponible'); } }).generate({ profile, occupationId: 'cajero' }));
  const denying = { async generate(request) {
    if (request.responseFormat.json_schema.name === 'verificar_cv') return { text: JSON.stringify({ judgments: JSON.parse(request.history[1].content).map((p) => ({ id: p.id, supported: false })) }) };
    return llm.generate(request);
  } };
  await assert.rejects(service(denying).generate({ profile, occupationId: 'cajero' }), /no se pudo respaldar/);
});

test('plantilla independiente, nombre seguro y datos incompletos editables', async () => {
  assert.equal(cvFilename('../../Ana\r\nInjected:yes'), 'CV_Ana_Injected_yes.docx');
  assert.throws(() => cleanCvDraft({ contact: { email: 'no-es-correo' } }));
  const buffer = await renderCvDocx({ ...cleanCvDraft({}), summary: '', experiences: [], skills: [], unconfirmedSkills: [] });
  const xml = await xmlOf(buffer);
  for (const expected of ['Nombre completo', 'PERFIL PROFESIONAL', 'EXPERIENCIA LABORAL', 'FORMACIÓN ACADÉMICA', 'CERTIFICACIONES', 'IDIOMAS']) assert.ok(xml.includes(expected));
});

test('puesto incorrecto o ausencia de experiencia fallan antes de llamar a QVAC', async () => {
  await assert.rejects(service().generate({ profile, occupationId: 'limpieza' }), /pasaporte/);
  await assert.rejects(service().generate({ profile: { ...profile, competencies: {} }, occupationId: 'cajero', draft: {} }), /al menos un ejemplo/);
});

test('persona sin experiencia laboral puede comenzar con sus estudios sin inventar trabajo', async () => {
  const academic = { async generate(request) {
    if (request.responseFormat.json_schema.name === 'verificar_cv') return { text: JSON.stringify({ judgments: [{ id: 'p0', supported: true }] }) };
    return { text: JSON.stringify({ summary: { text: 'Estudios de administración.', sourceIds: ['estudio-1'] }, bullets: [], skillIds: [] }) };
  } };
  const file = await service(academic).generate({ profile: { ...profile, competencies: {} }, occupationId: 'cajero', draft: { education: [{ qualification: 'Estudios de administración' }] } });
  const xml = await xmlOf(file.buffer);
  assert.ok(xml.includes('Estudios de administración'));
  assert.ok(xml.includes('Describe tus responsabilidades y resultados reales'));
  assert.ok(!xml.includes('Conté el dinero'));
});

test('interfaz conserva el botón Word y elimina los botones anteriores', () => {
  const page = readFileSync(new URL('../src/pages/PassportPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /Generar CV en Word/);
  assert.doesNotMatch(page, /Copiar presentación|Descargar datos/);
});
