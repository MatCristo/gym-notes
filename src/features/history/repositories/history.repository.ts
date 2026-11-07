import { getDatabase } from '@/database/database';

/**
 * Consultas SOMENTE LEITURA sobre as tabelas de execução, para histórico e estatísticas.
 * Considera apenas sessões com status 'completed'; nunca altera dados.
 */

export interface CompletedSessionRow {
  id: string;
  workout_name_snapshot: string;
  started_at: string;
  completed_at: string;
  total_exercises: number;
  exercises_performed: number;
  completed_sets: number;
  planned_sets: number;
}

export interface PerformedExerciseRow {
  exercise_name_snapshot: string;
  session_id: string;
  started_at: string;
  /** Maior carga concluída válida (> 0 kg com > 0 repetições) neste exercício da sessão. */
  top_weight: number | null;
}

export interface ValidSetRow {
  session_id: string;
  started_at: string;
  exercise_name_snapshot: string;
  set_number: number;
  actual_weight: number;
  actual_reps: number;
}

/** Série que conta para o histórico de carga: concluída, com carga e repetições reais positivas. */
const VALID_SET = `sl.completed_at IS NOT NULL
  AND sl.actual_weight IS NOT NULL AND sl.actual_weight > 0
  AND sl.actual_reps IS NOT NULL AND sl.actual_reps > 0`;

export const historyRepository = {
  /** Sessões concluídas, da mais recente para a mais antiga, com contagens agregadas. */
  async findCompletedSessions(): Promise<CompletedSessionRow[]> {
    const db = await getDatabase();
    return db.getAllAsync<CompletedSessionRow>(
      `SELECT ws.id, ws.workout_name_snapshot, ws.started_at, ws.completed_at,
              (SELECT COUNT(*) FROM session_exercises se WHERE se.session_id = ws.id) AS total_exercises,
              (SELECT COUNT(DISTINCT se.id)
                 FROM session_exercises se
                 JOIN set_logs sl ON sl.session_exercise_id = se.id
                WHERE se.session_id = ws.id AND sl.completed_at IS NOT NULL) AS exercises_performed,
              (SELECT COUNT(*)
                 FROM set_logs sl
                 JOIN session_exercises se ON se.id = sl.session_exercise_id
                WHERE se.session_id = ws.id AND sl.completed_at IS NOT NULL) AS completed_sets,
              (SELECT COUNT(*)
                 FROM set_logs sl
                 JOIN session_exercises se ON se.id = sl.session_exercise_id
                WHERE se.session_id = ws.id) AS planned_sets
         FROM workout_sessions ws
        WHERE ws.status = ? AND ws.completed_at IS NOT NULL
        ORDER BY ws.started_at DESC`,
      ['completed'],
    );
  },

  /** Exercícios com ao menos uma série concluída em sessões concluídas (um registro por exercício da sessão). */
  async findPerformedExercises(): Promise<PerformedExerciseRow[]> {
    const db = await getDatabase();
    return db.getAllAsync<PerformedExerciseRow>(
      `SELECT se.exercise_name_snapshot, ws.id AS session_id, ws.started_at,
              MAX(CASE WHEN sl.actual_weight > 0 AND sl.actual_reps > 0 THEN sl.actual_weight END) AS top_weight
         FROM session_exercises se
         JOIN workout_sessions ws ON ws.id = se.session_id
         JOIN set_logs sl ON sl.session_exercise_id = se.id
        WHERE ws.status = ? AND sl.completed_at IS NOT NULL
        GROUP BY se.id
        ORDER BY ws.started_at ASC`,
      ['completed'],
    );
  },

  /** Nomes distintos já registrados em sessões concluídas. */
  async findDistinctExerciseNames(): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ exercise_name_snapshot: string }>(
      `SELECT DISTINCT se.exercise_name_snapshot
         FROM session_exercises se
         JOIN workout_sessions ws ON ws.id = se.session_id
        WHERE ws.status = ?`,
      ['completed'],
    );
    return rows.map((row) => row.exercise_name_snapshot);
  },

  /** Séries válidas (ver VALID_SET) dos exercícios com os nomes informados, em ordem cronológica. */
  async findValidSetsByExerciseNames(names: readonly string[]): Promise<ValidSetRow[]> {
    if (names.length === 0) return [];
    const db = await getDatabase();
    const placeholders = names.map(() => '?').join(', ');
    return db.getAllAsync<ValidSetRow>(
      `SELECT ws.id AS session_id, ws.started_at, se.exercise_name_snapshot,
              sl.set_number, sl.actual_weight, sl.actual_reps
         FROM set_logs sl
         JOIN session_exercises se ON se.id = sl.session_exercise_id
         JOIN workout_sessions ws ON ws.id = se.session_id
        WHERE ws.status = 'completed'
          AND ${VALID_SET}
          AND se.exercise_name_snapshot IN (${placeholders})
        ORDER BY ws.started_at ASC, se.sort_order ASC, sl.set_number ASC`,
      [...names],
    );
  },
};
