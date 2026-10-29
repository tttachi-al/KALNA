import { ChartNoAxesColumn } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { kallpaService } from '../../services/kallpaService.js';

/** Demanda laboral regional: solo se muestra si hay datos verificables. */
export function DemandPanel({ occupationId }) {
  const { data, loading } = useAsync(
    () => kallpaService.getRegionalDemand(occupationId),
    [occupationId],
  );
  return (
    <div className="demand" aria-busy={loading}>
      <ChartNoAxesColumn aria-hidden="true" />
      <div>
        <strong>Demanda laboral regional</strong>
        {data?.available ? (
          <p className="text-sm">
            Fuente: {data.source} · Actualizado: {data.updatedAt}
          </p>
        ) : (
          <p className="text-sm muted">
            Aún no hay datos de demanda para este puesto. Cuando se conecte una fuente oficial,
            aparecerán aquí. Kalna no hace estimaciones sin datos que las respalden.
          </p>
        )}
      </div>
    </div>
  );
}

/** Barra segmentada: ya la tienes / tienes una base / por desarrollar. */
export function SegBar({ cmp }) {
  const total = cmp.matches.length + cmp.transferable.length + cmp.gaps.length;
  return (
    <div
      className="segbar"
      role="img"
      aria-label={`${cmp.matches.length} de ${total} ya las tienes, ${cmp.transferable.length} con una base, ${cmp.gaps.length} por desarrollar`}
    >
      {cmp.matches.map((m) => (
        <span key={m.id} className="is-match" />
      ))}
      {cmp.transferable.map((t) => (
        <span key={t.id} className="is-transfer" />
      ))}
      {cmp.gaps.map((g) => (
        <span key={g.id} />
      ))}
    </div>
  );
}
