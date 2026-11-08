import { randomUUID } from 'expo-crypto';

import { runInTransaction } from '@/database/database';
import { exerciseRepository } from '@/features/exercises/repositories/exercise.repository';
import { sessionRepository } from '@/features/sessions/repositories/session.repository';
import {
  SET_ACTUAL_LIMITS,
  type SessionDetails,
  type SessionSummary,
  type SetActuals,
  type SetLog,
  type WorkoutSession,
} from '@/features/sessions/types/session.types';
import { workoutRepository } from '@/features/workouts/repositories/workout.repository';
import { parseNumberInput, type NumberInputError } from '@/utils/number-input';

export type SessionServiceErrorCode =
  | 'workout-not-found'
  | 'no-exercises'
  | 'session-not-found'
  | 'session-not-editable'
  | 'invalid-actuals';

export class SessionServiceError extends Error {
  constructor(
    public readonly code: SessionServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SessionServiceError';
  }
}

export interface StartSessionResult {
  sessionId: string;
  /** `true` quando já havia uma sessão em andamento deste treino e ela foi retomada. */
  resumed: boolean;
}

export type SetActualsField = 'actualReps' | 'actualWeightKg';
export type ParseSetActualsResult =
  | { ok: true; actuals: SetActuals }
  | { ok: false; errors: Partial<Record<SetActualsField, NumberInputError>> };

/** Valida os valores reais digitados em uma série (repetições inteiras >= 0; carga >= 0). */
export function parseSetActuals(rawReps: string, rawWeight: string): ParseSetActualsResult {
  const reps = parseNumberInput(rawReps, { kind: 'integer', min: 0, max: SET_ACTUAL_LIMITS.repsMax, required: true });
  const weight = parseNumberInput(rawWeight, {
    kind: 'decimal',
    min: 0,
    max: SET_ACTUAL_LIMITS.weightMaxKg,
    required: false,
  });
  if ('value' in reps && 'value' in weight) {
    return { ok: true, actuals: { actualReps: reps.value, actualWeightKg: weight.value } };
  }
  const errors: Partial<Record<SetActualsField, NumberInputError>> = {};
  if ('error' in reps) errors.actualReps = reps.error;
  if ('error' in weight) errors.actualWeightKg = weight.error;
  return { ok: false, errors };
}

function assertValidActuals({ actualReps, actualWeightKg }: SetActuals): void {
  const valid =
    Number.isInteger(actualReps) &&
    actualReps >= 0 &&
    actualReps <= SET_ACTUAL_LIMITS.repsMax &&
    Number.isFinite(actualWeightKg) &&
    actualWeightKg >= 0 &&
    actualWeightKg <= SET_ACTUAL_LIMITS.weightMaxKg;
  if (!valid) throw new SessionServiceError('invalid-actuals', 'Valores da série inválidos.');
}

/** Calcula o resumo de uma sessão (puro: não acessa o banco). */
export function computeSessionSummary(details: SessionDetails, nowMs: number): SessionSummary {
  const { session, exercises } = details;
  const endMs = session.completedAt ? Date.parse(session.completedAt) : nowMs;

  const exerciseSummaries = exercises.map((exercise) => ({
    name: exercise.exerciseNameSnapshot,
    completedSets: exercise.sets.filter((set) => set.completedAt !== null).length,
    plannedSets: exercise.sets.length,
  }));

  return {
    workoutName: session.workoutNameSnapshot,
    durationMs: Math.max(0, endMs - Date.parse(session.startedAt)),
    exercisesPerformed: exerciseSummaries.filter((exercise) => exercise.completedSets > 0).length,
    totalExercises: exercises.length,
    completedSets: exerciseSummaries.reduce((total, exercise) => total + exercise.completedSets, 0),
    plannedSets: exerciseSummaries.reduce((total, exercise) => total + exercise.plannedSets, 0),
    exercises: exerciseSummaries,
  };
}

async function requireSetLog(id: string): Promise<SetLog> {
  const set = await sessionRepository.findSetLogById(id);
  if (!set) throw new SessionServiceError('session-not-found', 'Série não encontrada.');
  return set;
}

/** Regras de negócio da execução de treinos. Toda leitura/escrita passa pelos repositories. */
export const sessionService = {
  /**
   * Inicia uma sessão copiando (snapshot) os exercícios e séries planejados, tudo em uma transação.
   * Se já houver uma sessão em andamento deste treino, ela é retomada em vez de criar outra.
   */
  async startSession(workoutId: string): Promise<StartSessionResult> {
    try {
      return await runInTransaction(async () => {
        const existing = await sessionRepository.findInProgressByWorkoutId(workoutId);
        if (existing) return { sessionId: existing.id, resumed: true };

        const workout = await workoutRepository.findById(workoutId);
        if (!workout) throw new SessionServiceError('workout-not-found', 'Treino não encontrado.');

        const exercises = await exerciseRepository.findByWorkoutId(workoutId);
        if (exercises.length === 0) {
          throw new SessionServiceError('no-exercises', 'Adicione exercícios antes de iniciar o treino.');
        }

        const sessionId = randomUUID();
        await sessionRepository.insertSession({
          id: sessionId,
          workoutId,
          workoutNameSnapshot: workout.name,
          startedAt: new Date().toISOString(),
        });

        for (const [index, exercise] of exercises.entries()) {
          const sessionExerciseId = randomUUID();
          await sessionRepository.insertSessionExercise({
            id: sessionExerciseId,
            sessionId,
            exerciseId: exercise.id,
            exerciseNameSnapshot: exercise.name,
            // Congelada agora: editar ou remover a observação depois não muda esta sessão.
            observationSnapshot: exercise.observation,
            plannedRestSeconds: exercise.restSeconds,
            sortOrder: index,
          });
          for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
            await sessionRepository.insertSetLog({
              id: randomUUID(),
              sessionExerciseId,
              setNumber,
              plannedReps: exercise.reps,
              plannedWeightKg: exercise.weightKg,
            });
          }
        }

        return { sessionId, resumed: false };
      });
    } catch (error) {
      // Corrida rara (dois inícios simultâneos): o índice único barra a segunda sessão.
      if (error instanceof Error && /UNIQUE constraint failed: workout_sessions/.test(error.message)) {
        const existing = await sessionRepository.findInProgressByWorkoutId(workoutId);
        if (existing) return { sessionId: existing.id, resumed: true };
      }
      throw error;
    }
  },

  getInProgressSessionForWorkout(workoutId: string): Promise<WorkoutSession | null> {
    return sessionRepository.findInProgressByWorkoutId(workoutId);
  },

  listInProgressSessions(): Promise<WorkoutSession[]> {
    return sessionRepository.findAllInProgress();
  },

  async getSessionDetails(sessionId: string): Promise<SessionDetails | null> {
    const session = await sessionRepository.findSessionById(sessionId);
    if (!session) return null;
    const exercises = await sessionRepository.findSessionExercisesWithSets(sessionId);
    return { session, exercises };
  },

  /** Marca a série como concluída salvando os valores reais. */
  async completeSet(setId: string, actuals: SetActuals): Promise<SetLog> {
    assertValidActuals(actuals);
    const updated = await sessionRepository.updateSetLog(setId, {
      ...actuals,
      completedAt: new Date().toISOString(),
    });
    if (!updated) throw new SessionServiceError('session-not-editable', 'Não é possível alterar esta série.');
    return requireSetLog(setId);
  },

  /** Desmarca a conclusão (os valores reais digitados são mantidos). */
  async uncompleteSet(setId: string): Promise<SetLog> {
    const current = await requireSetLog(setId);
    const updated = await sessionRepository.updateSetLog(setId, {
      actualReps: current.actualReps,
      actualWeightKg: current.actualWeightKg,
      completedAt: null,
    });
    if (!updated) throw new SessionServiceError('session-not-editable', 'Não é possível alterar esta série.');
    return requireSetLog(setId);
  },

  /** Salva valores reais sem mudar a conclusão (corrige uma série concluída ou guarda o rascunho). */
  async saveSetActuals(setId: string, actuals: SetActuals): Promise<SetLog> {
    assertValidActuals(actuals);
    const updated = await sessionRepository.updateSetActuals(setId, actuals.actualReps, actuals.actualWeightKg);
    if (!updated) throw new SessionServiceError('session-not-editable', 'Não é possível alterar esta série.');
    return requireSetLog(setId);
  },

  /**
   * Finaliza a sessão. Séries não concluídas são preservadas como estão (completed_at nulo).
   * Finalizar uma sessão já finalizada não altera nada.
   */
  async finishSession(sessionId: string): Promise<SessionDetails> {
    const session = await sessionRepository.findSessionById(sessionId);
    if (!session) throw new SessionServiceError('session-not-found', 'Sessão não encontrada.');
    if (session.status === 'in_progress') {
      await sessionRepository.completeSession(sessionId, new Date().toISOString());
    }
    const details = await sessionService.getSessionDetails(sessionId);
    if (!details) throw new SessionServiceError('session-not-found', 'Sessão não encontrada.');
    return details;
  },
};
