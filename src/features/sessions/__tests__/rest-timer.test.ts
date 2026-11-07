import {
  IDLE_REST_TIMER,
  MAX_REST_MS,
  adjustRest,
  getRemainingMs,
  isRestFinished,
  offerRest,
  pauseRest,
  resumeRest,
  startRest,
} from '@/features/sessions/utils/rest-timer';

describe('cronômetro de descanso (baseado em timestamps)', () => {
  const T0 = 1_000_000;

  it('oferece, inicia e conta regressivamente pelo instante de término', () => {
    const offered = offerRest(90_000, 'Supino');
    expect(offered).toEqual({ status: 'offer', durationMs: 90_000, label: 'Supino' });
    expect(getRemainingMs(offered, T0)).toBe(90_000);

    const running = startRest(offered, T0);
    expect(getRemainingMs(running, T0 + 30_000)).toBe(60_000);
    expect(isRestFinished(running, T0 + 89_999)).toBe(false);
  });

  it('continua correto após o app ficar em segundo plano (nenhum tick acontece)', () => {
    const running = startRest(offerRest(60_000, 'x'), T0);
    // 50 s em segundo plano: ao voltar, o restante é calculado pela diferença de tempo.
    expect(getRemainingMs(running, T0 + 50_000)).toBe(10_000);
    // Terminou enquanto estava em segundo plano: detectado ao voltar, nunca negativo.
    expect(isRestFinished(running, T0 + 10 * 60_000)).toBe(true);
    expect(getRemainingMs(running, T0 + 10 * 60_000)).toBe(0);
  });

  it('pausa congela o restante e retomar recalcula o término', () => {
    const running = startRest(offerRest(90_000, 'x'), T0);
    const paused = pauseRest(running, T0 + 30_000);
    expect(paused).toMatchObject({ status: 'paused', remainingMs: 60_000 });
    expect(getRemainingMs(paused, T0 + 999_999)).toBe(60_000);

    const resumed = resumeRest(paused, T0 + 500_000);
    expect(getRemainingMs(resumed, T0 + 510_000)).toBe(50_000);
  });

  it('ajusta ±15 s em qualquer estado, sem ficar negativo nem passar do máximo', () => {
    expect(adjustRest(offerRest(30_000, 'x'), 15_000, T0)).toMatchObject({ durationMs: 45_000 });
    const running = startRest(offerRest(30_000, 'x'), T0);
    const less = adjustRest(running, -60_000, T0 + 10_000);
    expect(getRemainingMs(less, T0 + 10_000)).toBe(0);
    expect(adjustRest(offerRest(MAX_REST_MS, 'x'), 15_000, T0)).toMatchObject({ durationMs: MAX_REST_MS });
    const paused = pauseRest(startRest(offerRest(30_000, 'x'), T0), T0);
    expect(adjustRest(paused, 15_000, T0)).toMatchObject({ remainingMs: 45_000 });
  });

  it('ignora transições inválidas', () => {
    const finished = startRest(offerRest(1_000, 'x'), T0);
    expect(pauseRest(finished, T0 + 5_000)).toBe(finished); // já terminou
    expect(adjustRest(finished, 15_000, T0 + 5_000)).toBe(finished);
    expect(startRest(IDLE_REST_TIMER, T0)).toBe(IDLE_REST_TIMER);
    expect(resumeRest(finished, T0)).toBe(finished); // não está pausado
    expect(getRemainingMs(IDLE_REST_TIMER, T0)).toBe(0);
  });
});
