import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Diálogo modal accesible: foco inicial, Escape para cerrar,
 * foco atrapado dentro y retorno del foco al elemento que lo abrió.
 */
export function Dialog({ open, title, children, onClose, actions }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    const focusables = () => node.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
    (focusables()[0] || node).focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Tab') {
        const list = [...focusables()];
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>
        <div className="muted">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </>,
    document.body,
  );
}

/** Confirmación simple con acción principal y cancelar. */
export function ConfirmDialog({ open, title, children, confirmLabel = 'Confirmar', onConfirm, onClose, danger = false }) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
