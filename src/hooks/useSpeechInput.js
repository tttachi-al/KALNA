import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Entrada por voz con la Web Speech API del navegador (si existe).
 * Ningún audio se envía a KALLPA: el reconocimiento lo hace el navegador.
 */
export function useSpeechInput({ lang = 'es-PE', onResult } = {}) {
  const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const cbRef = useRef(onResult);

  useEffect(() => {
    cbRef.current = onResult;
  }, [onResult]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Recognition) return;
    setError(null);
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => cbRef.current?.(e.results[0][0].transcript);
    rec.onerror = () => setError('No se pudo usar el micrófono. Puedes escribir tu respuesta.');
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [Recognition, lang]);

  useEffect(() => () => recRef.current?.abort?.(), []);

  return { supported: Boolean(Recognition), listening, error, start, stop };
}
