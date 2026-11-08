import { getDatabase } from '@/database/database';
import type { TrainingProgram } from '@/features/programs/types/program.types';

/** Formato da linha na tabela `training_programs` (snake_case, como no SQL). */
interface ProgramRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  workout_count: number;
}

/** Colunas do planejamento + contagem real de treinos (usa o índice idx_workouts_program_id). */
const SELECT_COLUMNS = `p.id, p.name, p.description, p.sort_order, p.created_at, p.updated_at,
  (SELECT COUNT(*) FROM workouts w WHERE w.program_id = p.id) AS workout_count`;

function mapRowToProgram(row: ProgramRow): TrainingProgram {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    workoutCount: row.workout_count,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface InsertProgramInput {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface UpdateProgramInput {
  name: string;
  description: string | null;
  updatedAt: string;
}

/** Acesso a dados de planejamentos. Único ponto do app que executa SQL sobre `training_programs`. */
export const programRepository = {
  async findAll(): Promise<TrainingProgram[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ProgramRow>(
      `SELECT ${SELECT_COLUMNS} FROM training_programs p ORDER BY p.sort_order ASC, p.created_at ASC`,
    );
    return rows.map(mapRowToProgram);
  },

  async findById(id: string): Promise<TrainingProgram | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ProgramRow>(
      `SELECT ${SELECT_COLUMNS} FROM training_programs p WHERE p.id = ?`,
      [id],
    );
    return row ? mapRowToProgram(row) : null;
  },

  /** Insere no fim da lista; `sort_order` é calculado no próprio INSERT (atômico). */
  async insert({ id, name, description, createdAt }: InsertProgramInput): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO training_programs (id, name, description, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM training_programs), ?, ?)`,
      [id, name, description, createdAt, createdAt],
    );
  },

  /** Retorna `true` se algum registro foi alterado. */
  async update(id: string, { name, description, updatedAt }: UpdateProgramInput): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      'UPDATE training_programs SET name = ?, description = ?, updated_at = ? WHERE id = ?',
      [name, description, updatedAt, id],
    );
    return result.changes > 0;
  },

  /**
   * Retorna `true` se o registro existia e foi removido.
   * A FK de `workouts.program_id` não tem cascata: os treinos precisam ser removidos antes
   * (o service faz isso em transação); caso contrário o banco recusa a exclusão.
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM training_programs WHERE id = ?', [id]);
    return result.changes > 0;
  },
};
