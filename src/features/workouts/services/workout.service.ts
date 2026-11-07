import { randomUUID } from 'expo-crypto';

import { runInTransaction } from '@/database/database';
import { exerciseRepository } from '@/features/exercises/repositories/exercise.repository';
import { workoutRepository } from '@/features/workouts/repositories/workout.repository';
import { WORKOUT_NAME_MAX_LENGTH, type Workout } from '@/features/workouts/types/workout.types';

export type WorkoutNameValidationError = 'empty' | 'too-long';

export function normalizeWorkoutName(rawName: string): string {
  return rawName.trim();
}

export function validateWorkoutName(rawName: string): WorkoutNameValidationError | null {
  const name = normalizeWorkoutName(rawName);
  if (name.length === 0) return 'empty';
  if (name.length > WORKOUT_NAME_MAX_LENGTH) return 'too-long';
  return null;
}

export type WorkoutServiceErrorCode = 'invalid-name' | 'not-found';

export class WorkoutServiceError extends Error {
  constructor(
    public readonly code: WorkoutServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WorkoutServiceError';
  }
}

const COPY_SUFFIX = ' (Cópia)';

/** "Treino A" → "Treino A (Cópia)", cortando o original se necessário para respeitar o limite. */
export function buildCopyName(name: string): string {
  const base = name.slice(0, WORKOUT_NAME_MAX_LENGTH - COPY_SUFFIX.length).trimEnd();
  return `${base}${COPY_SUFFIX}`;
}

function assertValidName(rawName: string): string {
  const error = validateWorkoutName(rawName);
  if (error !== null) {
    throw new WorkoutServiceError('invalid-name', `Nome de treino inválido (${error}).`);
  }
  return normalizeWorkoutName(rawName);
}

/** Regras de negócio dos treinos. Toda leitura/escrita passa pelo repository. */
export const workoutService = {
  listWorkouts(): Promise<Workout[]> {
    return workoutRepository.findAll();
  },

  getWorkout(id: string): Promise<Workout | null> {
    return workoutRepository.findById(id);
  },

  /** Cria o treino e retorna o registro como ficou salvo no banco. */
  async createWorkout(rawName: string): Promise<Workout> {
    const name = assertValidName(rawName);
    const id = randomUUID();
    await workoutRepository.insert({ id, name, createdAt: new Date().toISOString() });

    const created = await workoutRepository.findById(id);
    if (!created) throw new Error('Treino criado não foi encontrado no banco.');
    return created;
  },

  /** Renomeia o treino e retorna o registro atualizado. Nome igual ao atual não altera o banco. */
  async renameWorkout(id: string, rawName: string): Promise<Workout> {
    const name = assertValidName(rawName);
    const current = await workoutRepository.findById(id);
    if (!current) throw new WorkoutServiceError('not-found', 'Treino não encontrado.');
    if (current.name === name) return current;

    await workoutRepository.update(id, { name, updatedAt: new Date().toISOString() });
    const updated = await workoutRepository.findById(id);
    if (!updated) throw new WorkoutServiceError('not-found', 'Treino não encontrado.');
    return updated;
  },

  /**
   * Duplica o treino e todos os seus exercícios em uma única transação (tudo ou nada).
   * Gera novos UUIDs e timestamps; preserva séries, repetições, carga, descanso e ordem.
   * Sessões e histórico de execução NÃO são copiados.
   */
  async duplicateWorkout(id: string): Promise<Workout> {
    return runInTransaction(async () => {
      const original = await workoutRepository.findById(id);
      if (!original) throw new WorkoutServiceError('not-found', 'Treino não encontrado.');

      const copyId = randomUUID();
      const now = new Date().toISOString();
      await workoutRepository.insert({ id: copyId, name: buildCopyName(original.name), createdAt: now });

      const exercises = await exerciseRepository.findByWorkoutId(id);
      for (const exercise of exercises) {
        await exerciseRepository.insert({
          id: randomUUID(),
          workoutId: copyId,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weightKg: exercise.weightKg,
          restSeconds: exercise.restSeconds,
          sortOrder: exercise.sortOrder,
          createdAt: now,
        });
      }

      const copy = await workoutRepository.findById(copyId);
      if (!copy) throw new Error('Cópia do treino não foi encontrada no banco.');
      return copy;
    });
  },

  /** Exclui pelo ID. Excluir um treino que já não existe não é tratado como erro. */
  async deleteWorkout(id: string): Promise<void> {
    await workoutRepository.delete(id);
  },
};
