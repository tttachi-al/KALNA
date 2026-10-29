import { ArrowRight, BadgeCheck, Info, Lightbulb, RotateCcw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COMPETENCIES } from '../../data/competencies.js';
import { OCCUPATION_IDS, OCCUPATIONS } from '../../data/occupations.js';
import { LogoMark } from '../ui/Logo.jsx';
import { OccPill } from '../ui/OccIcon.jsx';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { SkillPips } from './GameBits.jsx';

function SkillChips({ ids, status }) {
  return (
    <ul className="msg-skills" role="list">
      {ids.map((id, i) => {
        const s = typeof status === 'function' ? status(id) : status;
        return (
          <li key={id} style={{ '--i': i }}>
            <span>{COMPETENCIES[id]?.name}</span>
            {s && <SkillPips status={s} />}
          </li>
        );
      })}
    </ul>
  );
}

/** Un mensaje de la conversación, con formato según su tipo. */
export function ChatMessage({ message, actions, statusOf, onRestart }) {
  const { role, kind, text, data } = message;

  if (role === 'user') {
    return (
      <li className="msg msg-user">
        <span className="sr-only">Tú dijiste: </span>
        <p>{text}</p>
      </li>
    );
  }

  let body;
  let tone = '';
  switch (kind) {
    case 'scope':
      body = (
        <>
          <p>{text}</p>
          <div className="msg-occs">
            {OCCUPATION_IDS.map((id) => (
              <OccPill key={id} id={id}>
                {OCCUPATIONS[id].name}
              </OccPill>
            ))}
          </div>
        </>
      );
      break;
    case 'privacy':
      tone = 'msg-soft';
      body = (
        <p className="msg-iconline">
          <ShieldCheck aria-hidden="true" />
          <span>{text}</span>
        </p>
      );
      break;
    case 'principle':
      tone = 'msg-principle';
      body = (
        <p className="msg-iconline">
          <Info aria-hidden="true" />
          <span>{text}</span>
        </p>
      );
      break;
    case 'legend':
      body = (
        <>
          <p>{text}</p>
          <div className="row" style={{ gap: 6 }}>
            <StatusBadge status="evidencia" />
            <StatusBadge status="declarada" />
            <StatusBadge status="por_validar" />
          </div>
        </>
      );
      break;
    case 'findings':
      tone = 'msg-findings';
      body = (
        <>
          <p className="msg-label">
            {data?.source === 'herramientas'
              ? 'Indicios por validar'
              : 'Competencias identificadas en tu relato'}
          </p>
          <SkillChips
            ids={data?.ids || []}
            status={data?.source === 'herramientas' ? 'por_validar' : 'declarada'}
          />
        </>
      );
      break;
    case 'reinforce':
      body = <p>{text}</p>;
      break;
    case 'summary':
      tone = 'msg-findings';
      body = (
        <>
          <p>{text}</p>
          <SkillChips ids={data?.ids || []} status={statusOf} />
        </>
      );
      break;
    case 'ask-evidence': {
      const c = COMPETENCIES[data?.competencyId];
      tone = 'msg-ask';
      body = (
        <>
          <div className="quest-head">
            <span className="msg-label">
              Ejemplo {data.index + 1} de {data.total}
            </span>
            <span className="quest-dots" aria-hidden="true">
              {Array.from({ length: data.total }, (_, n) => (
                <i
                  key={n}
                  className={n < data.index ? 'is-done' : n === data.index ? 'is-now' : ''}
                />
              ))}
            </span>
          </div>
          <p className="msg-title">{c?.name}</p>
          <p>{c?.ask}</p>
          <p className="msg-note">
            Con un ejemplo concreto, esta competencia queda respaldada con evidencia.
          </p>
        </>
      );
      break;
    }
    case 'evidence-ok':
      tone = 'msg-ok';
      body = (
        <div className="unlock">
          <span className="unlock-medal" aria-hidden="true">
            <BadgeCheck />
          </span>
          <span className="unlock-text">
            <span className="msg-label">Respaldada con evidencia</span>
            <span className="msg-title">{COMPETENCIES[data?.competencyId]?.name}</span>
          </span>
          <span className="sr-only">{text}</span>
        </div>
      );
      break;
    case 'evidence-partial':
      tone = 'msg-tip';
      body = (
        <>
          <p className="msg-label">Falta un poco de detalle</p>
          <p className="msg-iconline">
            <Lightbulb aria-hidden="true" />
            <span>{text}</span>
          </p>
        </>
      );
      break;
    case 'result':
      tone = 'msg-result';
      body = (
        <>
          <p>{text}</p>
          {data?.counts?.total > 0 && <ResultScore counts={data.counts} />}
          {actions?.length > 0 && (
            <div className="row msg-actions">
              {actions.map((a) =>
                a.restart ? (
                  <button
                    key={a.id}
                    type="button"
                    className={`btn ${a.primary ? 'btn-primary' : ''}`}
                    onClick={onRestart}
                  >
                    <RotateCcw aria-hidden="true" />
                    {a.label}
                  </button>
                ) : (
                  <Link key={a.id} to={a.to} className={`btn ${a.primary ? 'btn-primary' : ''}`}>
                    {a.label}
                    {a.primary && <ArrowRight aria-hidden="true" />}
                  </Link>
                ),
              )}
            </div>
          )}
        </>
      );
      break;
    default:
      body = <p>{text}</p>;
  }

  return (
    <li className={`msg msg-bot ${tone}`}>
      <span className="msg-avatar" aria-hidden="true">
        <LogoMark size={28} />
      </span>
      <div className="msg-bubble">
        <span className="sr-only">Kalna: </span>
        {body}
      </div>
    </li>
  );
}

function ResultScore({ counts }) {
  const tiles = [
    { id: 'evidencia', n: counts.evidencia, label: 'con evidencia' },
    { id: 'declarada', n: counts.declarada, label: 'declaradas' },
    { id: 'por_validar', n: counts.por_validar, label: 'por validar' },
  ];
  return (
    <ul className="score-tiles" role="list">
      {tiles.map((t) => (
        <li key={t.id} className={`score-tile is-${t.id}`}>
          <strong>{t.n}</strong>
          <span>{t.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function TypingIndicator({ label = 'Kalna está analizando tu respuesta' }) {
  return (
    <li className="msg msg-bot" aria-live="polite">
      <span className="msg-avatar" aria-hidden="true">
        <LogoMark size={28} />
      </span>
      <div className="msg-bubble msg-typing">
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="sr-only">{label}</span>
      </div>
    </li>
  );
}
