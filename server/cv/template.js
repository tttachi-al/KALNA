import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun } from 'docx';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const CV_TEMPLATE = Object.freeze({ font: 'Calibri', bodySize: 22, titleSize: 36, headingSize: 24, margin: 1080 });
export const cvFilename = (name, simulation = false) => `CV_${simulation ? 'SIMULACION_' : ''}${String(name || 'Mi_Perfil').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70) || 'Mi_Perfil'}.docx`;

/** Independent ATS-friendly template. All content remains normal editable Word text. */
export async function renderCvDocx(cv) {
  const p = (value, options = {}) => new Paragraph({ children: [new TextRun({ text: String(value), ...options.run })], ...options });
  const heading = (value) => p(value, { heading: HeadingLevel.HEADING_1, keepNext: true });
  const placeholder = (value) => p(`[${value}]`, { run: { color: '666666', italics: true }, spacing: { after: 100 } });
  const bullet = (value) => p(value, { numbering: { reference: 'cv-bullets', level: 0 }, spacing: { after: 60 }, widowControl: true });
  const children = [p(cv.contact.fullName || '[Nombre completo]', { style: 'Title', alignment: AlignmentType.CENTER })];
  if (cv.contact.title) children.push(p(cv.contact.title, { alignment: AlignmentType.CENTER, run: { bold: true } }));
  children.push(p([cv.contact.phone || '[Teléfono]', cv.contact.email || '[Correo electrónico]', cv.contact.location || '[Ciudad]'].join('  |  '), { alignment: AlignmentType.CENTER, spacing: { after: 100 } }));
  if (cv.contact.links.length) children.push(p(cv.contact.links.join('  |  '), { alignment: AlignmentType.CENTER }));
  children.push(heading('PERFIL PROFESIONAL'), cv.summary ? p(cv.summary) : placeholder('Añade una presentación breve basada en tu experiencia'));
  children.push(heading('EXPERIENCIA LABORAL'));
  if (!cv.experiences.length) children.push(placeholder('Empresa, negocio o actividad · Cargo o función · Periodo'), placeholder('Describe tus responsabilidades y resultados reales'));
  for (const e of cv.experiences) {
    children.push(p(e.organization || '[Empresa, negocio o actividad]', { run: { bold: true }, keepNext: true, spacing: { before: 100, after: 40 } }));
    children.push(p([e.role || '[Cargo o función]', e.period || '[Periodo]'].join(' · '), { keepNext: true, spacing: { after: 80 } }));
    children.push(...e.responsibilities.map(bullet));
    if (e.achievements.length) children.push(p('Resultados respaldados', { run: { bold: true }, keepNext: true }), ...e.achievements.map(bullet));
  }
  children.push(heading('COMPETENCIAS Y HABILIDADES'));
  if (cv.skills.length) children.push(...cv.skills.map((s) => bullet(s.name)));
  else children.push(placeholder('Añade competencias que puedas respaldar con ejemplos'));
  if (cv.unconfirmedSkills.length) children.push(p('Competencias pendientes de validación', { run: { bold: true }, keepNext: true }), ...cv.unconfirmedSkills.map((s) => bullet(`${s.name} · Por confirmar; no acreditada`)));
  children.push(heading('FORMACIÓN ACADÉMICA'));
  if (!cv.education.length) children.push(placeholder('Institución · Estudios o grado · Periodo'));
  for (const e of cv.education) children.push(p(e.institution || '[Institución]', { run: { bold: true }, keepNext: true }), p([e.qualification, e.period].filter(Boolean).join(' · ') || '[Estudios y periodo]'));
  children.push(heading('FORMACIÓN COMPLEMENTARIA Y CERTIFICACIONES'));
  children.push(...(cv.certifications.length ? cv.certifications.map(bullet) : [placeholder('Añade aquí tus cursos o certificaciones, si los tienes')]));
  children.push(heading('IDIOMAS'));
  children.push(...(cv.languages.length ? cv.languages.map(bullet) : [placeholder('Idioma y nivel confirmado') ]));
  if (cv.additional.length) children.push(heading('INFORMACIÓN ADICIONAL'), ...cv.additional.map(bullet));
  return Packer.toBuffer(new Document({ creator: 'KALLPA', title: `CV ${cv.contact.fullName || ''}`.trim(),
    styles: { default: { document: { run: { font: CV_TEMPLATE.font, size: CV_TEMPLATE.bodySize, color: '000000' }, paragraph: { spacing: { after: 100, line: 260 }, widowControl: true } } }, paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: CV_TEMPLATE.font, size: CV_TEMPLATE.titleSize, bold: true, color: '000000' }, paragraph: { spacing: { after: 100 }, keepNext: true } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: CV_TEMPLATE.font, size: CV_TEMPLATE.headingSize, bold: true, color: '000000' }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true } },
    ] },
    numbering: { config: [{ reference: 'cv-bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 280, hanging: 180 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: CV_TEMPLATE.margin, bottom: CV_TEMPLATE.margin, left: CV_TEMPLATE.margin, right: CV_TEMPLATE.margin } } }, children }],
  }));
}
