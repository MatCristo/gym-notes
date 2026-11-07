import { getDatabase } from '@/database/database';
import type { Exercise, ExerciseInput } from '@/features/exercises/types/exercise.types';

/** Formato da linha na tabela `exercises` (snake_case, como no SQL). */
interface ExerciseRow {
  id: string;
  workout_id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  rest_seconds: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS =
  'id, workout_id, name, sets, reps, weight, rest_seconds, sort_order, created_at, updated_at';

function mapRowToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    workoutId: row.workout_id,
    name: row.name,
    sets: row.sets,
    reps: row.reps,
    weightKg: row.weight,
    restSeconds: row.rest_seconds,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface InsertExerciseInput extends ExerciseInput {
  id: string;
  workoutId: string;
  createdAt: string;
  /** Posição explícita (ex.: duplicação). Se omitida, vai para o fim da lista do treino. */
  sortOrder?: number;
}

/** Acesso a dados de exercícios. Único ponto do app que executa SQL sobre `exercises`. */
export const exerciseRepository = {
  async findByWorkoutId(workoutId: string): Promise<Exercise[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ExerciseRow>(
      `SELECT ${SELECT_COLUMNS} FROM exercises WHERE workout_id = ? ORDER BY sort_order ASC, created_at ASC`,
      [workoutId],
    );
    return rows.map(mapRowToExercise);
  },

  async findById(id: string): Promise<Exercise | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ExerciseRow>(`SELECT ${SELECT_COLUMNS} FROM exercises WHERE id = ?`, [id]);
    return row ? mapRowToExercise(row) : null;
  },

  /** Insere na posição informada ou no fim da lista do treino (calculado no próprio INSERT, atômico). */
  async insert(input: InsertExerciseInput): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO exercises
         (id, workout_id, name, sets, reps, weight, rest_seconds, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?,
         COALESCE(?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM exercises WHERE workout_id = ?)), ?, ?)`,
      [
        input.id,
        input.workoutId,
        input.name,
        input.sets,
        input.reps,
        input.weightKg,
        input.restSeconds,
        input.sortOrder ?? null,
        input.workoutId,
        input.createdAt,
        input.createdAt,
      ],
    );
  },

  /** Retorna `true` se algum registro foi alterado. */
  async update(id: string, input: ExerciseInput, updatedAt: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE exercises
          SET name = ?, sets = ?, reps = ?, weight = ?, rest_seconds = ?, updated_at = ?
        WHERE id = ?`,
      [input.name, input.sets, input.reps, input.weightKg, input.restSeconds, updatedAt, id],
    );
    return result.changes > 0;
  },

  /** Define a posição de um exercício. Restrito ao treino informado (não move exercícios de outro treino). */
  async updateSortOrder(id: string, workoutId: string, sortOrder: number): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('UPDATE exercises SET sort_order = ? WHERE id = ? AND workout_id = ?', [
      sortOrder,
      id,
      workoutId,
    ]);
    return result.changes > 0;
  },

  /** Retorna `true` se o registro existia e foi removido. */
  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
    return result.changes > 0;
  },
};
