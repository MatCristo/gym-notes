/**
 * Dados REAIS de execução de um treino.
 *
 * Os campos `*Snapshot` e `planned*` são cópias congeladas do planejamento no momento
 * em que a sessão começou; os campos `actual*` são o que o usuário realmente fez.
 * Nada aqui é lido de `workouts`/`exercises` depois do início da sessão.
 */
export type SessionStatus = 'in_progress' | 'completed';

export interface WorkoutSession {
  id: string;
  /** `null` se o treino de origem foi excluído depois (o histórico é preservado). */
  workoutId: string | null;
  workoutNameSnapshot: string;
  /** ISO 8601 */
  startedAt: string;
  /** ISO 8601; `null` enquanto em andamento. */
  completedAt: string | null;
  status: SessionStatus;
}

export interface SetLog {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  plannedReps: number;
  /** `null` até o usuário registrar. */
  actualReps: number | null;
  plannedWeightKg: number;
  actualWeightKg: number | null;
  /** ISO 8601; `null` = série não concluída. */
  completedAt: string | null;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  /** `null` se o exercício de origem foi excluído depois. */
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  plannedRestSeconds: number;
  sortOrder: number;
  sets: SetLog[];
}

export interface SessionDetails {
  session: WorkoutSession;
  exercises: SessionExercise[];
}

export interface SessionExerciseSummary {
  name: string;
  completedSets: number;
  plannedSets: number;
}

export interface SessionSummary {
  workoutName: string;
  durationMs: number;
  /** Exercícios com ao menos uma série concluída. */
  exercisesPerformed: number;
  totalExercises: number;
  completedSets: number;
  plannedSets: number;
  exercises: SessionExerciseSummary[];
}

/** Valores reais digitados para uma série, já validados. */
export interface SetActuals {
  actualReps: number;
  actualWeightKg: number;
}

export const SET_ACTUAL_LIMITS = {
  repsMax: 999,
  weightMaxKg: 9999,
} as const;
