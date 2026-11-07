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

const NUMBER_RULES: Record<Exclude<ExerciseField, 'name'>, NumberInputRule> = {
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

/** Revalida a entrada já numérica (defesa contra chamadas que não passaram pelo formulário). */
function assertValidInput(input: ExerciseInput): ExerciseInput {
  const name = input.name.trim();
  const valid =
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
    input.restSeconds <= EXERCISE_LIMITS.restMaxSeconds;
  if (!valid) throw new ExerciseServiceError('invalid-input', 'Dados do exercício inválidos.');
  return { ...input, name };
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
      const currentIds = new Set(current.map((exercise) => exercise.id));
      const isPermutation =
        orderedIds.length === current.length &&
        new Set(orderedIds).size === orderedIds.length &&
        orderedIds.every((id) => currentIds.has(id));
      if (!isPermutation) {
        throw new ExerciseServiceError('invalid-order', 'A lista de exercícios mudou. Recarregue e tente novamente.');
      }

      const currentOrder = new Map(current.map((exercise) => [exercise.id, exercise.sortOrder]));
      for (const [index, id] of orderedIds.entries()) {
        if (currentOrder.get(id) !== index) await exerciseRepository.updateSortOrder(id, workoutId, index);
      }
    });
  },

  /** Exclui pelo ID. Excluir um exercício que já não existe não é tratado como erro. */
  async deleteExercise(id: string): Promise<void> {
    await exerciseRepository.delete(id);
  },
};
