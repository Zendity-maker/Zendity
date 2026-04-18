import { useEffect, useRef } from "react";

/**
 * Hook de polling declarativo basado en el patrón de Dan Abramov.
 *
 * - `callback` se ejecuta cada `delay` ms.
 * - Si `delay` es `null`, el intervalo se pausa (útil para pausar cuando
 *   el tab está oculto vía `document.visibilityState`).
 * - El `callback` más reciente siempre se invoca (guardado en ref),
 *   evitando closures rancios sin reiniciar el intervalo en cada render.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
