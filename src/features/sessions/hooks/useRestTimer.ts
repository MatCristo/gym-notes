import { useCallback, useState } from 'react';

import {
  IDLE_REST_TIMER,
  adjustRest,
  isRestFinished,
  offerRest,
  pauseRest,
  resumeRest,
  startRest,
  type RestTimerState,
} from '@/features/sessions/utils/rest-timer';

/** Descanso padrão quando o exercício não tem descanso planejado. */
export const DEFAULT_REST_SECONDS = 60;

export interface UseRestTimerResult {
  state: RestTimerState;
  /** Oferece o descanso (após concluir uma série). Não interrompe um descanso em andamento. */
  offer: (restSeconds: number, label: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  adjust: (deltaMs: number) => void;
  /** Encerra antecipadamente ou fecha o aviso de término. */
  dismiss: () => void;
}

/**
 * Estado do cronômetro de descanso. Guarda apenas timestamps; quem exibe calcula
 * o restante com `getRemainingMs(state, now)` usando um relógio (`useNow`).
 */
export function useRestTimer(): UseRestTimerResult {
  const [state, setState] = useState<RestTimerState>(IDLE_REST_TIMER);

  const offer = useCallback((restSeconds: number, label: string) => {
    const seconds = restSeconds > 0 ? restSeconds : DEFAULT_REST_SECONDS;
    setState((current) => {
      const busy =
        current.status === 'paused' || (current.status === 'running' && !isRestFinished(current, Date.now()));
      return busy ? current : offerRest(seconds * 1000, label);
    });
  }, []);

  const start = useCallback(() => setState((current) => startRest(current, Date.now())), []);
  const pause = useCallback(() => setState((current) => pauseRest(current, Date.now())), []);
  const resume = useCallback(() => setState((current) => resumeRest(current, Date.now())), []);
  const adjust = useCallback((deltaMs: number) => setState((current) => adjustRest(current, deltaMs, Date.now())), []);
  const dismiss = useCallback(() => setState(IDLE_REST_TIMER), []);

  return { state, offer, start, pause, resume, adjust, dismiss };
}
