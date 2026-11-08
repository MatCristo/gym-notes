import { getDatabase } from '@/database/database';
import type {
  SessionExercise,
  SessionStatus,
  SetLog,
  WorkoutSession,
} from '@/features/sessions/types/session.types';

interface WorkoutSessionRow {
  id: string;
  workout_id: string | null;
  workout_name_snapshot: string;
  started_at: string;
  completed_at: string | null;
  status: SessionStatus;
}

interface SessionExerciseRow {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  planned_rest_seconds: number;
  sort_order: number;
}

interface SetLogRow {
  id: string;
  session_exercise_id: string;
  set_number: number;
  planned_reps: number;
  actual_reps: number | null;
  planned_weight: number;
  actual_weight: number | null;
  completed_at: string | null;
}

const SESSION_COLUMNS = 'id, workout_id, workout_name_snapshot, started_at, completed_at, status';
const SET_LOG_COLUMNS =
  'sl.id, sl.session_exercise_id, sl.set_number, sl.planned_reps, sl.actual_reps, sl.planned_weight, sl.actual_weight, sl.completed_at';

/** Restringe alterações de séries a sessões ainda em andamento (sessões finalizadas são imutáveis). */
const SET_IN_PROGRESS_SESSION = `session_exercise_id IN (
  SELECT se.id FROM session_exercises se
  JOIN workout_sessions ws ON ws.id = se.session_id
  WHERE ws.status = 'in_progress'
)`;

function mapSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    workoutId: row.workout_id,
    workoutNameSnapshot: row.workout_name_snapshot,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
  };
}

function mapSetLog(row: SetLogRow): SetLog {
  return {
    id: row.id,
    sessionExerciseId: row.session_exercise_id,
    setNumber: row.set_number,
    plannedReps: row.planned_reps,
    actualReps: row.actual_reps,
    plannedWeightKg: row.planned_weight,
    actualWeightKg: row.actual_weight,
    completedAt: row.completed_at,
  };
}

export interface InsertSessionInput {
  id: string;
  workoutId: string;
  workoutNameSnapshot: string;
  startedAt: string;
}

export interface InsertSessionExerciseInput {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  plannedRestSeconds: number;
  sortOrder: number;
}

export interface InsertSetLogInput {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  plannedReps: number;
  plannedWeightKg: number;
}

/** Acesso a dados de execução. Único ponto do app que executa SQL sobre as tabelas de sessão. */
export const sessionRepository = {
  // ---------- workout_sessions ----------

  async insertSession(input: InsertSessionInput): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO workout_sessions (id, workout_id, workout_name_snapshot, started_at, completed_at, status)
       VALUES (?, ?, ?, ?, NULL, 'in_progress')`,
      [input.id, input.workoutId, input.workoutNameSnapshot, input.startedAt],
    );
  },

  async findSessionById(id: string): Promise<WorkoutSession | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<WorkoutSessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM workout_sessions WHERE id = ?`,
      [id],
    );
    return row ? mapSession(row) : null;
  },

  async findInProgressByWorkoutId(workoutId: string): Promise<WorkoutSession | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<WorkoutSessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM workout_sessions WHERE workout_id = ? AND status = 'in_progress'`,
      [workoutId],
    );
    return row ? mapSession(row) : null;
  },

  /** Quantas sessões em andamento pertencem a treinos do planejamento informado. */
  async countInProgressByProgramId(programId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total
         FROM workout_sessions ws
         JOIN workouts w ON w.id = ws.workout_id
        WHERE w.program_id = ? AND ws.status = 'in_progress'`,
      [programId],
    );
    return row?.total ?? 0;
  },

  async findAllInProgress(): Promise<WorkoutSession[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<WorkoutSessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM workout_sessions WHERE status = ? ORDER BY started_at DESC`,
      ['in_progress'],
    );
    return rows.map(mapSession);
  },

  /** Retorna `true` se a sessão estava em andamento e foi finalizada. */
  async completeSession(id: string, completedAt: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE workout_sessions SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'in_progress'`,
      [completedAt, id],
    );
    return result.changes > 0;
  },

  // ---------- session_exercises ----------

  async insertSessionExercise(input: InsertSessionExerciseInput): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO session_exercises
         (id, session_id, exercise_id, exercise_name_snapshot, planned_rest_seconds, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.sessionId,
        input.exerciseId,
        input.exerciseNameSnapshot,
        input.plannedRestSeconds,
        input.sortOrder,
      ],
    );
  },

  /** Exercícios da sessão com suas séries, na ordem do snapshot. */
  async findSessionExercisesWithSets(sessionId: string): Promise<SessionExercise[]> {
    const db = await getDatabase();
    const exerciseRows = await db.getAllAsync<SessionExerciseRow>(
      `SELECT id, session_id, exercise_id, exercise_name_snapshot, planned_rest_seconds, sort_order
         FROM session_exercises WHERE session_id = ? ORDER BY sort_order ASC`,
      [sessionId],
    );
    const setRows = await db.getAllAsync<SetLogRow>(
      `SELECT ${SET_LOG_COLUMNS}
         FROM set_logs sl
         JOIN session_exercises se ON se.id = sl.session_exercise_id
        WHERE se.session_id = ?
        ORDER BY se.sort_order ASC, sl.set_number ASC`,
      [sessionId],
    );

    const setsByExercise = new Map<string, SetLog[]>();
    for (const row of setRows) {
      const list = setsByExercise.get(row.session_exercise_id) ?? [];
      list.push(mapSetLog(row));
      setsByExercise.set(row.session_exercise_id, list);
    }

    return exerciseRows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      exerciseId: row.exercise_id,
      exerciseNameSnapshot: row.exercise_name_snapshot,
      plannedRestSeconds: row.planned_rest_seconds,
      sortOrder: row.sort_order,
      sets: setsByExercise.get(row.id) ?? [],
    }));
  },

  // ---------- set_logs ----------

  async insertSetLog(input: InsertSetLogInput): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO set_logs
         (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight, actual_weight, completed_at)
       VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL)`,
      [input.id, input.sessionExerciseId, input.setNumber, input.plannedReps, input.plannedWeightKg],
    );
  },

  async findSetLogById(id: string): Promise<SetLog | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<SetLogRow>(`SELECT ${SET_LOG_COLUMNS} FROM set_logs sl WHERE sl.id = ?`, [id]);
    return row ? mapSetLog(row) : null;
  },

  /**
   * Atualiza valores reais e conclusão da série. `completedAt = null` desmarca a conclusão.
   * Retorna `false` se a série não existe ou a sessão já foi finalizada.
   */
  async updateSetLog(
    id: string,
    values: { actualReps: number | null; actualWeightKg: number | null; completedAt: string | null },
  ): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE set_logs SET actual_reps = ?, actual_weight = ?, completed_at = ?
        WHERE id = ? AND ${SET_IN_PROGRESS_SESSION}`,
      [values.actualReps, values.actualWeightKg, values.completedAt, id],
    );
    return result.changes > 0;
  },

  /** Atualiza só os valores reais (rascunho/correção), mantendo o estado de conclusão. */
  async updateSetActuals(id: string, actualReps: number | null, actualWeightKg: number | null): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE set_logs SET actual_reps = ?, actual_weight = ? WHERE id = ? AND ${SET_IN_PROGRESS_SESSION}`,
      [actualReps, actualWeightKg, id],
    );
    return result.changes > 0;
  },
};
