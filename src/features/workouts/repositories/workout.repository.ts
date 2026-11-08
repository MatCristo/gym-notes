import { getDatabase } from '@/database/database';
import type { Workout } from '@/features/workouts/types/workout.types';

/** Formato da linha na tabela `workouts` (snake_case, como no SQL). */
interface WorkoutRow {
  id: string;
  program_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
  exercise_count: number;
}

/** Colunas do treino + contagem real de exercícios (usa o índice idx_exercises_workout_id). */
const SELECT_COLUMNS = `w.id, w.program_id, w.name, w.created_at, w.updated_at, w.sort_order,
  (SELECT COUNT(*) FROM exercises e WHERE e.workout_id = w.id) AS exercise_count`;

function mapRowToWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    exerciseCount: row.exercise_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sortOrder: row.sort_order,
  };
}

export interface InsertWorkoutInput {
  id: string;
  programId: string;
  name: string;
  createdAt: string;
  /** Posição explícita (ex.: duplicação de planejamento). Se omitida, vai para o fim do planejamento. */
  sortOrder?: number;
}

export interface UpdateWorkoutInput {
  name: string;
  updatedAt: string;
}

/** Acesso a dados de treinos. Único ponto do app que executa SQL sobre `workouts`. */
export const workoutRepository = {
  /** Treinos de um planejamento, na ordem definida pelo usuário. */
  async findByProgramId(programId: string): Promise<Workout[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<WorkoutRow>(
      `SELECT ${SELECT_COLUMNS} FROM workouts w WHERE w.program_id = ?
        ORDER BY w.sort_order ASC, w.created_at ASC`,
      [programId],
    );
    return rows.map(mapRowToWorkout);
  },

  async findById(id: string): Promise<Workout | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<WorkoutRow>(`SELECT ${SELECT_COLUMNS} FROM workouts w WHERE w.id = ?`, [
      id,
    ]);
    return row ? mapRowToWorkout(row) : null;
  },

  /** Insere na posição informada ou no fim do planejamento (calculado no próprio INSERT, atômico). */
  async insert({ id, programId, name, createdAt, sortOrder }: InsertWorkoutInput): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO workouts (id, program_id, name, created_at, updated_at, sort_order)
       VALUES (?, ?, ?, ?, ?,
         COALESCE(?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM workouts WHERE program_id = ?)))`,
      [id, programId, name, createdAt, createdAt, sortOrder ?? null, programId],
    );
  },

  /** Retorna `true` se algum registro foi alterado. */
  async update(id: string, { name, updatedAt }: UpdateWorkoutInput): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('UPDATE workouts SET name = ?, updated_at = ? WHERE id = ?', [
      name,
      updatedAt,
      id,
    ]);
    return result.changes > 0;
  },

  /** Define a posição de um treino. Restrito ao planejamento informado (não move treinos de outro). */
  async updateSortOrder(id: string, programId: string, sortOrder: number): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('UPDATE workouts SET sort_order = ? WHERE id = ? AND program_id = ?', [
      sortOrder,
      id,
      programId,
    ]);
    return result.changes > 0;
  },

  /** Retorna `true` se o registro existia e foi removido. Os exercícios são removidos em cascata (FK). */
  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM workouts WHERE id = ?', [id]);
    return result.changes > 0;
  },

  /**
   * Remove todos os treinos de um planejamento (exercícios em cascata; sessões e histórico
   * ficam preservados via ON DELETE SET NULL). Deve ser chamado dentro de uma transação.
   */
  async deleteByProgramId(programId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM workouts WHERE program_id = ?', [programId]);
    return result.changes;
  },
};
