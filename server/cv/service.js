import { cvContext, writeCvContent } from './content.js';
import { cvFilename, DOCX_MIME, renderCvDocx } from './template.js';
import { COMPETENCIES } from '../../src/data/competencies.js';

export function createCvService({ llm, store, passports }) {
  return { store,
    async generate({ profile, occupationId, simulation = false, passport: supplied, draft: input }) {
      const passport = simulation ? supplied : await passports?.get(profile.profileId, occupationId);
      if (!passport || passport.occupationId !== occupationId || passport.target?.id !== occupationId) throw Object.assign(new Error('Primero genera el pasaporte para este puesto.'), { status: 409 });
      const saved = !simulation && store ? await store.load(profile.profileId) : null;
      const context = cvContext(profile, passport, input ?? saved?.data ?? {});
      if (!context.sources.length) throw Object.assign(new Error('Añade al menos un ejemplo de tu experiencia para generar el CV.'), { status: 422 });
      const written = await writeCvContent(context, llm);
      const position = (group) => { const index = written.bullets.findIndex((p) => p.experienceId === group.id); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
      const groups = [...context.groups].sort((a, b) => position(a) - position(b));
      const cv = { ...context.draft, contact: { ...context.draft.contact, fullName: context.draft.contact.fullName || profile.alias || '' }, summary: written.summary?.text || '',
        experiences: groups.map((g) => ({ organization: g.organization, role: g.role, period: g.period,
          responsibilities: written.bullets.filter((p) => p.experienceId === g.id && p.kind === 'responsibility').map((p) => p.text),
          achievements: written.bullets.filter((p) => p.experienceId === g.id && p.kind === 'achievement').map((p) => p.text),
        })).filter((e) => e.responsibilities.length || e.achievements.length || e.organization || e.role),
        skills: written.skillIds.map((id) => context.skills.find((s) => s.id === id)),
        unconfirmedSkills: (passport.inferred || []).filter((s) => COMPETENCIES[s.competencyId] && !(profile.dismissed || []).includes(s.competencyId)).map((s) => ({ name: COMPETENCIES[s.competencyId].name })),
      };
      const buffer = await renderCvDocx(cv);
      if (!Buffer.isBuffer(buffer) || buffer.length < 500 || buffer.readUInt16LE(0) !== 0x4b50) throw new Error('No se pudo construir el documento Word.');
      if (!simulation && store && input) await store.save(profile.profileId, context.draft, occupationId);
      return { buffer, filename: cvFilename(cv.contact.fullName, simulation), contentType: DOCX_MIME };
    },
  };
}
