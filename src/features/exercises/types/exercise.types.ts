/**
 * Exercício PLANEJADO de um treino (o que o usuário pretende fazer).
 *
 * Registros de execução (cargas/repetições realmente realizadas) NÃO pertencem a este tipo:
 * em fases futuras terão tipos e tabelas próprios, referenciando `Exercise.id`.
 */
export interface Exercise {
  id: string;
  workoutId: string;
  name: string;
  /** Séries planejadas (inteiro > 0). */
  sets: number;
  /** Repetições planejadas por série (inteiro > 0). */
  reps: number;
  /** Carga planejada em kg (>= 0; 0 = sem carga/peso corporal). */
  weightKg: number;
  /** Descanso planejado entre séries, em segundos (inteiro >= 0). */
  restSeconds: number;
  /** Observação opcional (ex.: "Manter a coluna apoiada."); null quando não informada. */
  observation: string | null;
  sortOrder: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** Dados editáveis do exercício, já validados e convertidos para número. */
export interface ExerciseInput {
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  restSeconds: number;
  /** Opcional: ausente, null ou vazio = sem observação. */
  observation?: string | null;
}

/** Valores crus do formulário (texto digitado). */
export interface ExerciseFormValues {
  name: string;
  sets: string;
  reps: string;
  weightKg: string;
  restSeconds: string;
  observation: string;
}

export type ExerciseField = keyof ExerciseFormValues;

export const EXERCISE_LIMITS = {
  nameMaxLength: 60,
  setsMax: 99,
  repsMax: 999,
  weightMaxKg: 9999,
  restMaxSeconds: 3600,
  observationMaxLength: 200,
} as const;
