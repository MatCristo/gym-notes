/**
 * Tipos do histórico e das estatísticas. Tudo aqui é derivado de sessões CONCLUÍDAS
 * e de séries efetivamente concluídas — nunca de valores planejados.
 */

/** Uma sessão concluída, resumida para a lista do histórico. */
export interface SessionHistoryItem {
  id: string;
  /** Nome do treino registrado no momento da execução (snapshot). */
  workoutName: string;
  /** ISO 8601 */
  startedAt: string;
  /** ISO 8601 */
  completedAt: string;
  durationMs: number;
  /** Exercícios com ao menos uma série concluída. */
  exercisesPerformed: number;
  totalExercises: number;
  completedSets: number;
  plannedSets: number;
}

/** Uma série concluída com carga e repetições reais válidas (carga > 0 e repetições > 0). */
export interface ExerciseSetRecord {
  sessionId: string;
  /** ISO 8601 — início da sessão (data usada no eixo do gráfico). */
  sessionStartedAt: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
}

/** Um ponto da evolução: uma sessão, representada pela maior carga concluída nela. */
export interface ExerciseProgressPoint {
  sessionId: string;
  /** ISO 8601 */
  date: string;
  /** Maior carga concluída na sessão. */
  topWeightKg: number;
  /** Repetições feitas na série de maior carga (a de mais repetições, em caso de empate). */
  topWeightReps: number;
  /** Todas as séries válidas da sessão, na ordem de execução. */
  sets: { weightKg: number; reps: number }[];
}

export interface ExerciseProgress {
  /** Chave de agrupamento (nome normalizado). */
  key: string;
  /** Nome exibido (o registrado mais recentemente). */
  name: string;
  /** Pontos em ordem cronológica crescente. */
  points: ExerciseProgressPoint[];
}

/** Resumo de um exercício que já foi executado (lista de "Evolução por exercício"). */
export interface ExerciseHistoryEntry {
  key: string;
  name: string;
  sessionsCount: number;
  /** ISO 8601 */
  lastPerformedAt: string;
  /** Maior carga da última sessão; `null` se só houve séries sem carga. */
  lastTopWeightKg: number | null;
}

export type ProgressPeriod = '30d' | '90d' | '6m' | 'all';

export interface PeriodBucket {
  /** ISO 8601 do início do período (semana começando na segunda / primeiro dia do mês). */
  start: string;
  count: number;
}

export interface TrainingStats {
  totalSessions: number;
  totalCompletedSets: number;
  totalDurationMs: number;
  /** Média de treinos por semana nas últimas 4 semanas (28 dias). */
  weeklyAverage: number;
  /** Últimas 8 semanas, da mais antiga para a atual. */
  weekly: PeriodBucket[];
  /** Últimos 6 meses, do mais antigo para o atual. */
  monthly: PeriodBucket[];
}
