/**
 * Cronômetro de descanso baseado em timestamps (funções puras).
 *
 * Em vez de somar ticks de `setInterval` (que congelam em segundo plano), guardamos o
 * instante de término (`endsAt`). O tempo restante é sempre `endsAt - agora`, então
 * continua correto quando o app volta do segundo plano. Pausado, guardamos o restante.
 */
export type RestTimerState =
  | { status: 'idle' }
  /** Série concluída: descanso oferecido, aguardando o usuário iniciar. */
  | { status: 'offer'; durationMs: number; label: string }
  | { status: 'running'; durationMs: number; endsAt: number; label: string }
  | { status: 'paused'; durationMs: number; remainingMs: number; label: string };

export const IDLE_REST_TIMER: RestTimerState = { status: 'idle' };
export const REST_ADJUST_STEP_MS = 15_000;
export const MAX_REST_MS = 60 * 60 * 1000;

const clampDuration = (ms: number) => Math.min(MAX_REST_MS, Math.max(0, ms));

export function offerRest(durationMs: number, label: string): RestTimerState {
  return { status: 'offer', durationMs: clampDuration(durationMs), label };
}

export function startRest(state: RestTimerState, now: number): RestTimerState {
  if (state.status !== 'offer') return state;
  return { status: 'running', durationMs: state.durationMs, endsAt: now + state.durationMs, label: state.label };
}

export function getRemainingMs(state: RestTimerState, now: number): number {
  switch (state.status) {
    case 'running':
      return Math.max(0, state.endsAt - now);
    case 'paused':
      return state.remainingMs;
    case 'offer':
      return state.durationMs;
    case 'idle':
      return 0;
  }
}

/** Terminou quando o instante de término já passou (mesmo que o app estivesse em segundo plano). */
export function isRestFinished(state: RestTimerState, now: number): boolean {
  return state.status === 'running' && state.endsAt <= now;
}

export function pauseRest(state: RestTimerState, now: number): RestTimerState {
  if (state.status !== 'running' || isRestFinished(state, now)) return state;
  return { status: 'paused', durationMs: state.durationMs, remainingMs: getRemainingMs(state, now), label: state.label };
}

export function resumeRest(state: RestTimerState, now: number): RestTimerState {
  if (state.status !== 'paused') return state;
  return { status: 'running', durationMs: state.durationMs, endsAt: now + state.remainingMs, label: state.label };
}

/** Ajusta o tempo (+/-) antes de iniciar, rodando ou pausado. Nunca fica negativo. */
export function adjustRest(state: RestTimerState, deltaMs: number, now: number): RestTimerState {
  switch (state.status) {
    case 'offer':
      return { ...state, durationMs: clampDuration(state.durationMs + deltaMs) };
    case 'running': {
      if (isRestFinished(state, now)) return state;
      const remaining = clampDuration(getRemainingMs(state, now) + deltaMs);
      return { ...state, durationMs: clampDuration(state.durationMs + deltaMs), endsAt: now + remaining };
    }
    case 'paused':
      return {
        ...state,
        durationMs: clampDuration(state.durationMs + deltaMs),
        remainingMs: clampDuration(state.remainingMs + deltaMs),
      };
    case 'idle':
      return state;
  }
}
