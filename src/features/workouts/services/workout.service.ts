import { randomUUID } from 'expo-crypto';

import { runInTransaction } from '@/database/database';
import { exerciseRepository } from '@/features/exercises/repositories/exercise.repository';
import { programRepository } from '@/features/programs/repositories/program.repository';
import { sessionRepository } from '@/features/sessions/repositories/session.repository';
import { workoutRepository } from '@/features/workouts/repositories/workout.repository';
import { WORKOUT_NAME_MAX_LENGTH, type Workout } from '@/features/workouts/types/workout.types';
import { buildCopyName as buildCopyNameWithLimit } from '@/utils/copy-name';
import { isPermutationOf } from '@/utils/move-item';

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

export type WorkoutServiceErrorCode =
  | 'invalid-name'
  | 'not-found'
  | 'program-not-found'
  | 'invalid-order'
  | 'has-session-in-progress';

export class WorkoutServiceError extends Error {
  constructor(
    public readonly code: WorkoutServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WorkoutServiceError';
  }
}

/** "Treino A" → "Treino A (Cópia)", cortando o original se necessário para respeitar o limite. */
export function buildCopyName(name: string): string {
  return buildCopyNameWithLimit(name, WORKOUT_NAME_MAX_LENGTH);
}

function assertValidName(rawName: string): string {
  const error = validateWorkoutName(rawName);
  if (error !== null) {
    throw new WorkoutServiceError('invalid-name', `Nome de treino inválido (${error}).`);
  }
  return normalizeWorkoutName(rawName);
}

export interface CopyWorkoutOptions {
  /** Planejamento que recebe a cópia. */
  programId: string;
  name: string;
  createdAt: string;
  /** Posição explícita; se omitida, a cópia vai para o fim do planejamento. */
  sortOrder?: number;
}

/**
 * Copia um treino e todos os seus exercícios planejados (novos UUIDs; mesma prescrição e ordem).
 * Sessões, séries registradas e histórico NUNCA são copiados.
 * Não abre transação própria: DEVE ser chamada dentro de `runInTransaction`.
 */
export async function copyWorkoutStructure(source: Workout, options: CopyWorkoutOptions): Promise<string> {
  const copyId = randomUUID();
  await workoutRepository.insert({
    id: copyId,
    programId: options.programId,
    name: options.name,
    createdAt: options.createdAt,
    sortOrder: options.sortOrder,
  });

  const exercises = await exerciseRepository.findByWorkoutId(source.id);
  for (const exercise of exercises) {
    await exerciseRepository.insert({
      id: randomUUID(),
      workoutId: copyId,
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      weightKg: exercise.weightKg,
      restSeconds: exercise.restSeconds,
      observation: exercise.observation,
      sortOrder: exercise.sortOrder,
      createdAt: options.createdAt,
    });
  }
  return copyId;
}

/** Regras de negócio dos treinos. Toda leitura/escrita passa pelo repository. */
export const workoutService = {
  /** Treinos de um planejamento, na ordem definida pelo usuário. */
  listWorkouts(programId: string): Promise<Workout[]> {
    return workoutRepository.findByProgramId(programId);
  },

  getWorkout(id: string): Promise<Workout | null> {
    return workoutRepository.findById(id);
  },

  /** Cria o treino no fim do planejamento informado e retorna o registro como ficou salvo no banco. */
  async createWorkout(programId: string, rawName: string): Promise<Workout> {
    const name = assertValidName(rawName);
    // A FK garante a integridade; a checagem prévia só gera um erro mais claro.
    if (!(await programRepository.findById(programId))) {
      throw new WorkoutServiceError('program-not-found', 'Planejamento não encontrado.');
    }
    const id = randomUUID();
    await workoutRepository.insert({ id, programId, name, createdAt: new Date().toISOString() });

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
   * A cópia fica no MESMO planejamento, no fim da lista. Gera novos UUIDs e timestamps;
   * preserva séries, repetições, carga, descanso e ordem. Sessões e histórico NÃO são copiados.
   */
  async duplicateWorkout(id: string): Promise<Workout> {
    return runInTransaction(async () => {
      const original = await workoutRepository.findById(id);
      if (!original) throw new WorkoutServiceError('not-found', 'Treino não encontrado.');

      const copyId = await copyWorkoutStructure(original, {
        programId: original.programId,
        name: buildCopyName(original.name),
        createdAt: new Date().toISOString(),
      });

      const copy = await workoutRepository.findById(copyId);
      if (!copy) throw new Error('Cópia do treino não foi encontrada no banco.');
      return copy;
    });
  },

  /**
   * Persiste a nova ordem (sort_order = posição em `orderedIds`) em uma única transação.
   * `orderedIds` deve conter exatamente os treinos atuais do planejamento; treinos de outros
   * planejamentos nunca são alterados.
   */
  async reorderWorkouts(programId: string, orderedIds: readonly string[]): Promise<void> {
    await runInTransaction(async () => {
      const current = await workoutRepository.findByProgramId(programId);
      if (!isPermutationOf(orderedIds, current.map((workout) => workout.id))) {
        throw new WorkoutServiceError('invalid-order', 'A lista de treinos mudou. Recarregue e tente novamente.');
      }

      const currentOrder = new Map(current.map((workout) => [workout.id, workout.sortOrder]));
      for (const [index, id] of orderedIds.entries()) {
        if (currentOrder.get(id) !== index) await workoutRepository.updateSortOrder(id, programId, index);
      }
    });
  },

  /**
   * Exclui o treino (e seus exercícios planejados) pelo ID.
   * Bloqueia com `has-session-in-progress` se o treino tiver uma sessão em andamento: sem isso,
   * a FK (ON DELETE SET NULL) desvincularia a sessão do treino e do planejamento.
   * Sessões concluídas e histórico são preservados. Excluir um treino que já não existe não é erro.
   */
  async deleteWorkout(id: string): Promise<void> {
    await runInTransaction(async () => {
      // Mesma fila de transações de `startSession`: não há corrida entre a checagem e a exclusão.
      if (await sessionRepository.findInProgressByWorkoutId(id)) {
        throw new WorkoutServiceError(
          'has-session-in-progress',
          'Este treino está em andamento. Finalize-o antes de excluir.',
        );
      }
      await workoutRepository.delete(id);
    });
  },
};
