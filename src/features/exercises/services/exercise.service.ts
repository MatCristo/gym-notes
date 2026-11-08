import { randomUUID } from 'expo-crypto';

import { runInTransaction } from '@/database/database';
import { exerciseRepository } from '@/features/exercises/repositories/exercise.repository';
import {
  EXERCISE_LIMITS,
  type Exercise,
  type ExerciseField,
  type ExerciseFormValues,
  type ExerciseInput,
} from '@/features/exercises/types/exercise.types';
import { workoutRepository } from '@/features/workouts/repositories/workout.repository';
import { isPermutationOf } from '@/utils/move-item';
import {
  formatNumberForInput,
  parseNumberInput,
  type NumberInputError,
  type NumberInputRule,
} from '@/utils/number-input';

export type ExerciseFieldError = 'too-long' | NumberInputError;

export type ExerciseFormErrors = Partial<Record<ExerciseField, ExerciseFieldError>>;

export type ParseExerciseFormResult =
  | { ok: true; input: ExerciseInput }
  | { ok: false; errors: ExerciseFormErrors };

const NUMBER_RULES: Record<Exclude<ExerciseField, 'name' | 'observation'>, NumberInputRule> = {
  sets: { kind: 'integer', min: 1, max: EXERCISE_LIMITS.setsMax, required: true },
  reps: { kind: 'integer', min: 1, max: EXERCISE_LIMITS.repsMax, required: true },
  // Carga e descanso são opcionais no formulário: vazio = 0.
  weightKg: { kind: 'decimal', min: 0, max: EXERCISE_LIMITS.weightMaxKg, required: false },
  restSeconds: { kind: 'integer', min: 0, max: EXERCISE_LIMITS.restMaxSeconds, required: false },
};

/** Converte e valida os valores digitados. Usado pelo formulário para mostrar erros por campo. */
export function parseExerciseForm(values: ExerciseFormValues): ParseExerciseFormResult {
  const errors: ExerciseFormErrors = {};

  const name = values.name.trim();
  if (name.length === 0) errors.name = 'required';
  else if (name.length > EXERCISE_LIMITS.nameMaxLength) errors.name = 'too-long';

  const observation = normalizeExerciseObservation(values.observation);
  if (observation !== null && observation.length > EXERCISE_LIMITS.observationMaxLength) {
    errors.observation = 'too-long';
  }

  const numbers: Partial<Record<keyof typeof NUMBER_RULES, number>> = {};
  for (const field of Object.keys(NUMBER_RULES) as (keyof typeof NUMBER_RULES)[]) {
    const result = parseNumberInput(values[field], NUMBER_RULES[field]);
    if ('error' in result) errors[field] = result.error;
    else numbers[field] = result.value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name,
      sets: numbers.sets ?? 0,
      reps: numbers.reps ?? 0,
      weightKg: numbers.weightKg ?? 0,
      restSeconds: numbers.restSeconds ?? 0,
      observation,
    },
  };
}

/** Converte um exercício salvo em valores de formulário (para edição). */
export function exerciseToFormValues(exercise: Exercise): ExerciseFormValues {
  return {
    name: exercise.name,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weightKg: exercise.weightKg === 0 ? '' : formatNumberForInput(exercise.weightKg),
    restSeconds: exercise.restSeconds === 0 ? '' : String(exercise.restSeconds),
    observation: exercise.observation ?? '',
  };
}

export type ExerciseServiceErrorCode = 'invalid-input' | 'workout-not-found' | 'not-found' | 'invalid-order';

export class ExerciseServiceError extends Error {
  constructor(
    public readonly code: ExerciseServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ExerciseServiceError';
  }
}

/** Observação opcional: espaços nas pontas são removidos e texto vazio (ou ausente) vira `null`. */
export function normalizeExerciseObservation(raw: string | null | undefined): string | null {
  const observation = (raw ?? '').trim();
  return observation.length === 0 ? null : observation;
}

/**
 * Regra única de validade de um exercício planejado (já numérico). Pura: usada pelo service
 * e pela importação de planejamentos compartilhados. O nome é considerado após `trim`.
 */
export function isValidExerciseInput(input: ExerciseInput): boolean {
  const name = input.name.trim();
  return (
    name.length > 0 &&
    name.length <= EXERCISE_LIMITS.nameMaxLength &&
    Number.isInteger(input.sets) &&
    input.sets >= 1 &&
    input.sets <= EXERCISE_LIMITS.setsMax &&
    Number.isInteger(input.reps) &&
    input.reps >= 1 &&
    input.reps <= EXERCISE_LIMITS.repsMax &&
    Number.isFinite(input.weightKg) &&
    input.weightKg >= 0 &&
    input.weightKg <= EXERCISE_LIMITS.weightMaxKg &&
    Number.isInteger(input.restSeconds) &&
    input.restSeconds >= 0 &&
    input.restSeconds <= EXERCISE_LIMITS.restMaxSeconds &&
    (input.observation === undefined || input.observation === null || typeof input.observation === 'string') &&
    (normalizeExerciseObservation(input.observation)?.length ?? 0) <= EXERCISE_LIMITS.observationMaxLength
  );
}

/** Revalida a entrada já numérica (defesa contra chamadas que não passaram pelo formulário). */
function assertValidInput(input: ExerciseInput): ExerciseInput {
  if (!isValidExerciseInput(input)) {
    throw new ExerciseServiceError('invalid-input', 'Dados do exercício inválidos.');
  }
  return { ...input, name: input.name.trim(), observation: normalizeExerciseObservation(input.observation) };
}

/** Regras de negócio dos exercícios planejados. Toda leitura/escrita passa pelo repository. */
export const exerciseService = {
  listByWorkout(workoutId: string): Promise<Exercise[]> {
    return exerciseRepository.findByWorkoutId(workoutId);
  },

  async createExercise(workoutId: string, rawInput: ExerciseInput): Promise<Exercise> {
    const input = assertValidInput(rawInput);
    // A FK garante a integridade; a checagem prévia só gera um erro mais claro.
    if (!(await workoutRepository.findById(workoutId))) {
      throw new ExerciseServiceError('workout-not-found', 'Treino não encontrado.');
    }

    const id = randomUUID();
    await exerciseRepository.insert({ ...input, id, workoutId, createdAt: new Date().toISOString() });
    const created = await exerciseRepository.findById(id);
    if (!created) throw new Error('Exercício criado não foi encontrado no banco.');
    return created;
  },

  async updateExercise(id: string, rawInput: ExerciseInput): Promise<Exercise> {
    const input = assertValidInput(rawInput);
    const changed = await exerciseRepository.update(id, input, new Date().toISOString());
    if (!changed) throw new ExerciseServiceError('not-found', 'Exercício não encontrado.');
    const updated = await exerciseRepository.findById(id);
    if (!updated) throw new ExerciseServiceError('not-found', 'Exercício não encontrado.');
    return updated;
  },

  /**
   * Persiste a nova ordem (sort_order = posição em `orderedIds`) em uma única transação.
   * `orderedIds` deve conter exatamente os exercícios atuais do treino. Afeta apenas a tabela
   * `exercises`: sessões existentes têm sua própria ordem (snapshot) e não mudam.
   */
  async reorderExercises(workoutId: string, orderedIds: readonly string[]): Promise<void> {
    await runInTransaction(async () => {
      const current = await exerciseRepository.findByWorkoutId(workoutId);
      if (!isPermutationOf(orderedIds, current.map((exercise) => exercise.id))) {
        throw new ExerciseServiceError('invalid-order', 'A lista de exercícios mudou. Recarregue e tente novamente.');
      }

      const currentOrder = new Map(current.map((exercise) => [exercise.id, exercise.sortOrder]));
      for (const [index, id] of orderedIds.entries()) {
        if (currentOrder.get(id) !== index) await exerciseRepository.updateSortOrder(id, workoutId, index);
      }
    });
  },

  /**
   * Duplica o exercício no mesmo treino, logo abaixo do original, em uma única transação.
   * Copia nome, prescrição (séries, repetições, carga e descanso) e observação com novo UUID; a lista do
   * treino é renumerada (0..n-1). O original e as sessões/histórico não são alterados.
   */
  async duplicateExercise(id: string): Promise<Exercise> {
    return runInTransaction(async () => {
      const original = await exerciseRepository.findById(id);
      if (!original) throw new ExerciseServiceError('not-found', 'Exercício não encontrado.');

      const current = await exerciseRepository.findByWorkoutId(original.workoutId);
      const originalIndex = current.findIndex((exercise) => exercise.id === id);
      const copyId = randomUUID();
      const copyIndex = originalIndex + 1;

      // Abre espaço: quem estava depois do original desce uma posição (e corrige eventuais buracos).
      for (const [index, exercise] of current.entries()) {
        const target = index < copyIndex ? index : index + 1;
        if (exercise.sortOrder !== target) {
          await exerciseRepository.updateSortOrder(exercise.id, original.workoutId, target);
        }
      }
      await exerciseRepository.insert({
        id: copyId,
        workoutId: original.workoutId,
        name: original.name,
        sets: original.sets,
        reps: original.reps,
        weightKg: original.weightKg,
        restSeconds: original.restSeconds,
        observation: original.observation,
        sortOrder: copyIndex,
        createdAt: new Date().toISOString(),
      });

      const copy = await exerciseRepository.findById(copyId);
      if (!copy) throw new Error('Cópia do exercício não foi encontrada no banco.');
      return copy;
    });
  },

  /** Exclui pelo ID. Excluir um exercício que já não existe não é tratado como erro. */
  async deleteExercise(id: string): Promise<void> {
    await exerciseRepository.delete(id);
  },
};
