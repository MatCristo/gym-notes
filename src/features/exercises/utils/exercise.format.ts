import type { Exercise } from '@/features/exercises/types/exercise.types';
import { formatKg } from '@/utils/number-format';

export function formatSets(sets: number): string {
  return sets === 1 ? '1 série' : `${sets} séries`;
}

export function formatReps(reps: number): string {
  return reps === 1 ? '1 repetição' : `${reps} repetições`;
}

/** "40 kg", "22,5 kg" ou "Sem carga" (0 kg, ex.: peso corporal). */
export function formatWeight(weightKg: number): string {
  return weightKg === 0 ? 'Sem carga' : formatKg(weightKg);
}

/** "45 s", "1 min", "1 min 30 s"; `null` quando não há descanso planejado. */
export function formatRest(restSeconds: number): string | null {
  if (restSeconds <= 0) return null;
  if (restSeconds < 60) return `${restSeconds} s`;
  const minutes = Math.floor(restSeconds / 60);
  const seconds = restSeconds % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

/** Ex.: "4 séries × 12 repetições — 40 kg". */
export function formatExercisePlan(exercise: Pick<Exercise, 'sets' | 'reps' | 'weightKg'>): string {
  return `${formatSets(exercise.sets)} × ${formatReps(exercise.reps)} — ${formatWeight(exercise.weightKg)}`;
}
