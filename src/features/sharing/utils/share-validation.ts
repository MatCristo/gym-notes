import { isValidExerciseInput } from '@/features/exercises/services/exercise.service';
import type { ExerciseInput } from '@/features/exercises/types/exercise.types';
import {
  normalizeProgramDescription,
  normalizeProgramName,
  validateProgramDescription,
  validateProgramName,
} from '@/features/programs/services/program.service';
import type { ProgramStructure, WorkoutStructure } from '@/features/programs/types/program.types';
import { SHARE_FORMAT_VERSION, SHARE_LIMITS, type ShareResult } from '@/features/sharing/types/sharing.types';
import { normalizeWorkoutName, validateWorkoutName } from '@/features/workouts/services/workout.service';

/** Erro interno da validação; vira um `ShareResult` com o mesmo código na saída. */
class PayloadError extends Error {
  constructor(public readonly code: 'malformed' | 'invalid-content' | 'unsupported-version') {
    super(code);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) throw new PayloadError('malformed');
  return value;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new PayloadError('malformed');
  return value;
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new PayloadError('malformed');
  return value;
}

/** Número de verdade (nunca texto convertido). NaN/Infinity não existem em JSON, mas são recusados. */
function requireNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PayloadError('malformed');
  return value;
}

function parseExercise(raw: unknown): ExerciseInput {
  const tuple = requireArray(raw);
  if (tuple.length !== 5) throw new PayloadError('malformed');
  // Mapeamento explícito da tupla [nome, séries, repetições, carga, descanso].
  const input: ExerciseInput = {
    name: requireString(tuple[0]),
    sets: requireNumber(tuple[1]),
    reps: requireNumber(tuple[2]),
    weightKg: requireNumber(tuple[3]),
    restSeconds: requireNumber(tuple[4]),
  };
  // Mesma regra usada pelo exerciseService (limites de EXERCISE_LIMITS).
  if (!isValidExerciseInput(input)) throw new PayloadError('invalid-content');
  return {
    name: input.name.trim(),
    sets: input.sets,
    reps: input.reps,
    weightKg: input.weightKg,
    restSeconds: input.restSeconds,
  };
}

function parseWorkout(raw: unknown): WorkoutStructure {
  const workout = requireObject(raw);
  const name = requireString(workout.n);
  const exercises = requireArray(workout.e);
  if (validateWorkoutName(name) !== null) throw new PayloadError('invalid-content');
  if (exercises.length > SHARE_LIMITS.maxExercisesPerWorkout) throw new PayloadError('invalid-content');
  return { name: normalizeWorkoutName(name), exercises: exercises.map(parseExercise) };
}

function parseProgram(raw: unknown): ProgramStructure {
  const program = requireObject(raw);
  const name = requireString(program.n);
  const rawDescription = program.d;
  if (rawDescription !== undefined && rawDescription !== null && typeof rawDescription !== 'string') {
    throw new PayloadError('malformed');
  }
  const description = typeof rawDescription === 'string' ? rawDescription : null;
  const workouts = requireArray(program.w);

  if (validateProgramName(name) !== null) throw new PayloadError('invalid-content');
  if (validateProgramDescription(description) !== null) throw new PayloadError('invalid-content');
  if (workouts.length < SHARE_LIMITS.minWorkouts || workouts.length > SHARE_LIMITS.maxWorkouts) {
    throw new PayloadError('invalid-content');
  }

  return {
    name: normalizeProgramName(name),
    description: normalizeProgramDescription(description),
    workouts: workouts.map(parseWorkout),
  };
}

/**
 * Valida o payload JSON já decodificado e o converte em uma `ProgramStructure` normalizada.
 * Lê somente os campos conhecidos: campos extras são ignorados e nunca chegam à estrutura.
 * Função pura: não acessa o banco.
 */
export function validateSharedPayload(data: unknown): ShareResult<ProgramStructure> {
  try {
    const root = requireObject(data);
    const version = root.v;
    if (typeof version === 'number' && Number.isInteger(version) && version > SHARE_FORMAT_VERSION) {
      throw new PayloadError('unsupported-version');
    }
    if (version !== SHARE_FORMAT_VERSION) throw new PayloadError('malformed');
    return { ok: true, value: parseProgram(root.p) };
  } catch (error) {
    if (error instanceof PayloadError) return { ok: false, error: error.code };
    throw error;
  }
}
