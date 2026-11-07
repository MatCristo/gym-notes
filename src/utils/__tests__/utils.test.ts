import { downsampleMax, linearScale, nearestIndex, niceDomain } from '@/components/charts/scale';
import { formatExercisePlan, formatRest, formatWeight } from '@/features/exercises/utils/exercise.format';
import { startOfWeek } from '@/features/history/services/history.service';
import { formatMonthYear, formatShortDate, formatWeekdayDate } from '@/utils/date-format';
import { formatDecimal, formatKg } from '@/utils/number-format';
import { formatNumberForInput, parseNumberInput } from '@/utils/number-input';
import { formatClock, formatCountdown, formatDuration } from '@/utils/time-format';

describe('parseNumberInput', () => {
  const integer = { kind: 'integer', min: 1, max: 99, required: true } as const;
  const decimal = { kind: 'decimal', min: 0, max: 9999, required: false } as const;

  it('converte inteiros e decimais com vírgula ou ponto', () => {
    expect(parseNumberInput(' 12 ', integer)).toEqual({ value: 12 });
    expect(parseNumberInput('22,5', decimal)).toEqual({ value: 22.5 });
    expect(parseNumberInput('22.25', decimal)).toEqual({ value: 22.25 });
    expect(parseNumberInput('', decimal)).toEqual({ value: 0 });
  });

  it('classifica cada tipo de erro', () => {
    expect(parseNumberInput('', integer)).toEqual({ error: 'required' });
    expect(parseNumberInput('-1', decimal)).toEqual({ error: 'negative' });
    expect(parseNumberInput('abc', decimal)).toEqual({ error: 'invalid-number' });
    expect(parseNumberInput('1,234', decimal)).toEqual({ error: 'invalid-number' }); // até 2 casas
    expect(parseNumberInput('2.5', integer)).toEqual({ error: 'not-integer' });
    expect(parseNumberInput('0', integer)).toEqual({ error: 'not-positive' });
    expect(parseNumberInput('100', integer)).toEqual({ error: 'too-large' });
  });

  it('formata números para campos com vírgula', () => {
    expect(formatNumberForInput(22.5)).toBe('22,5');
  });
});

describe('formatação', () => {
  it('kg e números em pt-BR', () => {
    expect(formatKg(42.5)).toBe('42,5 kg');
    expect(formatKg(40)).toBe('40 kg');
    expect(formatDecimal(0.5, 1)).toBe('0,5');
    expect(formatWeight(0)).toBe('Sem carga');
    expect(formatExercisePlan({ sets: 4, reps: 12, weightKg: 40 })).toBe('4 séries × 12 repetições — 40 kg');
    expect(formatExercisePlan({ sets: 1, reps: 1, weightKg: 22.5 })).toBe('1 série × 1 repetição — 22,5 kg');
  });

  it('tempo: relógio, contagem regressiva, duração e descanso', () => {
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('00:00');
    expect(formatCountdown(59_001)).toBe('01:00');
    expect(formatCountdown(1)).toBe('00:01');
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(3_900_000)).toBe('1 h 05 min');
    expect(formatRest(0)).toBeNull();
    expect(formatRest(90)).toBe('1 min 30 s');
  });

  it('datas em pt-BR', () => {
    const iso = new Date(2026, 10, 5, 18, 30).toISOString();
    expect(formatShortDate(iso)).toBe('05/11');
    expect(formatMonthYear(iso)).toBe('Novembro de 2026');
    expect(formatWeekdayDate(iso)).toMatch(/^Qui/);
  });

  it('semanas começam na segunda-feira', () => {
    expect(startOfWeek(new Date(2026, 10, 8, 23, 0)).getDate()).toBe(2); // domingo 08/11 → seg 02/11
    expect(startOfWeek(new Date(2026, 10, 2, 0, 30)).getDate()).toBe(2);
  });
});

describe('escalas de gráfico', () => {
  it('gera domínio com ticks redondos', () => {
    expect(niceDomain(42.5, 55, 4)).toEqual({ min: 40, max: 55, ticks: [40, 45, 50, 55] });
    expect(niceDomain(0, 3, 2, { includeZero: true }).ticks).toEqual([0, 2, 4]);
    const flat = niceDomain(50, 50);
    expect(flat.min).toBeLessThan(50);
    expect(flat.max).toBeGreaterThan(50);
  });

  it('mapeia valores e encontra o ponto mais próximo do toque', () => {
    expect(linearScale(0, 10, 100, 0)(5)).toBe(50);
    expect(linearScale(5, 5, 0, 100)(5)).toBe(50);
    expect(nearestIndex([10, 50, 120], 70)).toBe(1);
  });

  it('reduz séries longas preservando picos e o último ponto', () => {
    const points = Array.from({ length: 500 }, (_, i) => ({ x: i, y: i === 123 ? 999 : i % 10 }));
    const reduced = downsampleMax(points, 60);
    expect(reduced.length).toBeLessThanOrEqual(60);
    expect(reduced.some((p) => p.y === 999)).toBe(true); // recorde preservado
    expect(reduced[reduced.length - 1]).toBe(points[499]);
    expect(reduced.every((p, i) => i === 0 || p.x > reduced[i - 1]!.x)).toBe(true); // ordem mantida
    const small = points.slice(0, 10);
    expect(downsampleMax(small, 60)).toEqual(small);
  });
});
