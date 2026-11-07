import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Timestamp atual (ms), atualizado a cada `intervalMs` enquanto `active`.
 *
 * O intervalo serve APENAS para redesenhar: os tempos exibidos devem ser calculados
 * pela diferença entre timestamps (ex.: `now - startedAt`), nunca somando ticks.
 * Ao voltar do segundo plano, o valor é atualizado na hora.
 */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    // Atualiza logo ao ativar (ex.: ao iniciar o descanso), sem esperar o primeiro intervalo.
    const immediate = setTimeout(tick, 0);
    const interval = setInterval(tick, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs, active]);

  return now;
}
