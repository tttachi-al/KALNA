// Deterministic template fixtures, independent from QVAC.
import { mkdir, writeFile } from 'node:fs/promises';
import { cleanCvDraft } from './draft.js';
import { renderCvDocx } from './template.js';

const directory = new URL('../../tmp/cv-qa/', import.meta.url);
await mkdir(directory, { recursive: true });
const blank = { ...cleanCvDraft({}), summary: '', experiences: [], skills: [], unconfirmedSkills: [] };
await writeFile(new URL('CV_Plantilla_Base.docx', directory), await renderCvDocx(blank));
const example = { ...cleanCvDraft({ contact: { fullName: 'Ana Pérez', title: 'Atención al cliente y cobro', phone: '999 000 111', email: 'ana@example.test', location: 'Lima' },
  education: [{ institution: 'Institución de ejemplo', qualification: 'Educación secundaria completa', period: '2018' }], languages: ['Español nativo'],
}), summary: 'Experiencia en atención de clientes y cobro en un negocio familiar. Manejo de dinero respaldado por el conteo y la revisión de caja al cierre del día.',
  experiences: [{ organization: 'Negocio familiar', role: 'Atención y cobro', period: '2022 a 2024', responsibilities: ['Atendí a los clientes y cobré sus compras.', 'Conté el dinero al cierre y comparé la caja con las ventas registradas.', 'Organicé los pedidos para entregarlos a los clientes.'], achievements: [] }],
  skills: [{ name: 'Manejo de dinero' }, { name: 'Atención al cliente' }], unconfirmedSkills: [],
};
await writeFile(new URL('CV_Ejemplo_Revision.docx', directory), await renderCvDocx(example));
console.log('Plantilla y ejemplo creados en tmp/cv-qa.');
