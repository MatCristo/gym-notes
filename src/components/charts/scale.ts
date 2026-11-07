/** Utilitários de escala para gráficos (funções puras). */

export interface NiceDomain {
  min: number;
  max: number;
  ticks: number[];
}

/** Passo "redondo" (1, 2, 2,5, 5 × 10^n) para aproximadamente `targetTicks` intervalos. */
export function niceStep(range: number, targetTicks: number): number {
  const rough = range / Math.max(1, targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

/**
 * Domínio com ticks redondos que contém [min, max].
 * Valores iguais ganham folga para não colapsar a escala.
 */
export function niceDomain(min: number, max: number, targetTicks = 4, options: { includeZero?: boolean } = {}): NiceDomain {
  let low = options.includeZero ? Math.min(0, min) : min;
  let high = max;
  if (high === low) {
    const pad = Math.abs(high) * 0.1 || 1;
    low = options.includeZero ? Math.min(0, low) : low - pad;
    high += pad;
  }
  const step = niceStep(high - low, targetTicks);
  const domainMin = Math.floor(low / step) * step;
  const domainMax = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = domainMin; value <= domainMax + step / 2; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return { min: domainMin, max: domainMax, ticks };
}

/** Escala linear de [d0, d1] para [r0, r1]. */
export function linearScale(d0: number, d1: number, r0: number, r1: number) {
  return (value: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0));
}

/**
 * Reduz uma série ordenada por X para no máximo `maxPoints`, dividindo o intervalo de X em faixas
 * iguais e mantendo, em cada faixa, o ponto de MAIOR Y. Preserva picos (ex.: recordes de carga)
 * e o último ponto. Séries pequenas são devolvidas inalteradas.
 */
export function downsampleMax<T extends { x: number; y: number }>(points: readonly T[], maxPoints: number): T[] {
  if (points.length <= maxPoints || maxPoints < 2) return [...points];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const span = last.x - first.x;
  if (span <= 0) return [last];

  const bucketCount = maxPoints - 1; // reserva espaço para o último ponto
  const buckets: (T | undefined)[] = new Array(bucketCount).fill(undefined);
  for (const point of points.slice(0, -1)) {
    const index = Math.min(bucketCount - 1, Math.floor(((point.x - first.x) / span) * bucketCount));
    const current = buckets[index];
    if (!current || point.y > current.y) buckets[index] = point;
  }
  return [...buckets.filter((point): point is T => point !== undefined), last];
}

/** Índice do valor mais próximo de `target` (para tocar no gráfico e achar o ponto). */
export function nearestIndex(values: readonly number[], target: number): number {
  let best = -1;
  let bestDistance = Infinity;
  values.forEach((value, index) => {
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
