import { Banknote, BadgeCheck, Boxes, CircleDashed, FolderOpen, MessageSquareQuote, SprayCan, Store } from 'lucide-react';

/** Íconos por ocupación (una sola familia: Lucide, trazo 2px). */
export const OCC_ICONS = {
  limpieza: SprayCan,
  administrativo: FolderOpen,
  reponedor: Boxes,
  vendedor: Store,
  cajero: Banknote,
};

/** Íconos por estado de competencia (el estado nunca depende solo del color). */
export const STATUS_ICONS = {
  evidencia: BadgeCheck,
  declarada: MessageSquareQuote,
  por_validar: CircleDashed,
};
