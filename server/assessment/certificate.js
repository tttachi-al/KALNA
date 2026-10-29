import PDFDocument from 'pdfkit';

/**
 * Constancia de evaluación de KALLPA en PDF (pdfkit, fuentes estándar).
 * Solo se construye con resultados ya corregidos por el backend.
 */
export const PDF_MIME = 'application/pdf';
export const CERTIFICATE_TITLE = 'Constancia de Evaluación de Competencias — KALLPA';
export const LEGEND = 'Documento informativo emitido por KALLPA con base en las respuestas registradas en esta evaluación. No constituye una certificación profesional oficial, no ha sido emitido ni reconocido por el Estado ni por otra institución externa y no acredita por sí solo el dominio integral de las competencias.';

const INK = '#1f1f1f';
const MUTED = '#5c5c5c';
const BRAND = '#b3162b';

export function formatDate(iso) {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date(iso));
}

export const evaluationCode = (attemptId, competencyId = null) => `KALLPA-EV-${attemptId.slice(0, 8).toUpperCase()}${competencyId ? `-${competencyId.toUpperCase()}` : ''}`;

export function certificateFilename(attemptId, competencyId = null) {
  return `Constancia_KALLPA_${competencyId ? competencyId : 'consolidada'}_${attemptId.slice(0, 8)}.pdf`;
}

/**
 * @param {{ attemptId, participantName?: string|null, context: string, completedAt: string, simulation: boolean,
 *           competencies: { competencyId, name, correct, total, sources: string[] }[], evaluatedCount: number, consolidated: boolean }} data
 * @returns {Promise<Buffer>}
 */
export function renderCertificatePdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 64, right: 64 }, info: { Title: CERTIFICATE_TITLE, Author: 'KALLPA', Subject: 'Constancia informativa de evaluación de competencias' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const width = doc.page.width - 128;
    const field = (label, value) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text(label.toUpperCase(), { characterSpacing: 0.4 });
      doc.font('Helvetica').fontSize(12).fillColor(INK).text(value).moveDown(0.6);
    };

    doc.rect(64, 56, width, 4).fill(BRAND);
    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(CERTIFICATE_TITLE);
    doc.font('Helvetica').fontSize(11).fillColor(MUTED).text(data.consolidated ? 'Constancia consolidada de las competencias aprobadas en esta evaluación' : 'Constancia de una competencia aprobada en esta evaluación').moveDown(1.2);
    if (data.simulation) doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND).text('Modo demostración: el perfil no está guardado ni verificado en el servidor de KALLPA.').moveDown(0.8);

    field('Participante', data.participantName || 'No indicado');
    field('Puesto o contexto laboral', data.context);
    field('Fecha de evaluación', formatDate(data.completedAt));
    field('Identificador de evaluación', evaluationCode(data.attemptId, data.consolidated ? null : data.competencies[0].competencyId));

    doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text(data.consolidated ? 'COMPETENCIAS APROBADAS' : 'COMPETENCIA APROBADA', { characterSpacing: 0.4 });
    for (const c of data.competencies) {
      doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(c.name);
      const count = (source) => c.sources.filter((s) => s === source).length;
      const origin = [
        count('qvac') && `${count('qvac')} generada${count('qvac') > 1 ? 's' : ''} con QVAC y verificada${count('qvac') > 1 ? 's' : ''} automáticamente`,
        count('banco') && `${count('banco')} del banco validado de KALLPA`,
      ].filter(Boolean).join('; ');
      doc.font('Helvetica').fontSize(11).fillColor(INK).text(`Respondió correctamente ${c.correct} de ${c.total} preguntas situacionales (${origin}).`).moveDown(0.5);
    }
    if (data.consolidated) doc.font('Helvetica').fontSize(11).fillColor(MUTED).text(`Competencias evaluadas en este intento: ${data.evaluatedCount}. Aprobadas: ${data.competencies.length}.`);
    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Criterio: una competencia se registra como aprobada en esta evaluación cuando las dos respuestas coinciden con la clave validada por KALLPA. El resultado describe el desempeño en esas situaciones.', { width });
    doc.moveDown(1.2);
    doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(MUTED).text(LEGEND, { width });
    doc.end();
  });
}
