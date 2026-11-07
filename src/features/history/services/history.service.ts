import { historyRepository, type CompletedSessionRow } from '@/features/history/repositories/history.repository';
import type {
  ExerciseHistoryEntry,
  ExerciseProgress,
  ExerciseProgressPoint,
  ExerciseSetRecord,
  PeriodBucket,
  ProgressPeriod,
  SessionHistoryItem,
  TrainingStats,
} from '@/features/history/types/history.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Chave de agrupamento de exercícios entre sessões: nome sem espaços extras e sem diferença
 * de maiúsculas ("Supino Reto" = "supino  reto"). O histórico é agrupado pelo NOME registrado
 * na execução, para sobreviver à exclusão/duplicação do exercício de origem.
 */
export function exerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function mapSessionRow(row: CompletedSessionRow): SessionHistoryItem {
  return {
    id: row.id,
    workoutName: row.workout_name_snapshot,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: Math.max(0, Date.parse(row.completed_at) - Date.parse(row.started_at)),
    exercisesPerformed: row.exercises_performed,
    totalExercises: row.total_exercises,
    completedSets: row.completed_sets,
    plannedSets: row.planned_sets,
  };
}

/** Início (00:00 local) da semana que contém `date`, começando na segunda-feira. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Calcula os indicadores gerais a partir das sessões concluídas (função pura). */
export function computeTrainingStats(sessions: readonly SessionHistoryItem[], nowMs: number): TrainingStats {
  const now = new Date(nowMs);

  const weekStarts: Date[] = [];
  const currentWeek = startOfWeek(now);
  for (let offset = 7; offset >= 0; offset -= 1) {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - offset * 7);
    weekStarts.push(start);
  }

  const monthStarts: Date[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    monthStarts.push(new Date(now.getFullYear(), now.getMonth() - offset, 1));
  }

  const weekly: PeriodBucket[] = weekStarts.map((start) => ({ start: start.toISOString(), count: 0 }));
  const monthly: PeriodBucket[] = monthStarts.map((start) => ({ start: start.toISOString(), count: 0 }));
  const weekIndex = new Map(weekStarts.map((start, index) => [start.getTime(), index]));
  const monthIndex = new Map(monthStarts.map((start, index) => [start.getTime(), index]));

  let last28Days = 0;
  for (const session of sessions) {
    const startedAt = new Date(session.startedAt);
    const w = weekIndex.get(startOfWeek(startedAt).getTime());
    if (w !== undefined) weekly[w]!.count += 1;
    const m = monthIndex.get(startOfMonth(startedAt).getTime());
    if (m !== undefined) monthly[m]!.count += 1;
    const age = nowMs - startedAt.getTime();
    if (age >= 0 && age < 28 * DAY_MS) last28Days += 1;
  }

  return {
    totalSessions: sessions.length,
    totalCompletedSets: sessions.reduce((total, session) => total + session.completedSets, 0),
    totalDurationMs: sessions.reduce((total, session) => total + session.durationMs, 0),
    weeklyAverage: last28Days / 4,
    weekly,
    monthly,
  };
}

/** Agrupa séries válidas em pontos por sessão (maior carga da sessão). Função pura. */
export function buildProgressPoints(records: readonly ExerciseSetRecord[]): ExerciseProgressPoint[] {
  const bySession = new Map<string, ExerciseProgressPoint>();
  for (const record of records) {
    const point = bySession.get(record.sessionId) ?? {
      sessionId: record.sessionId,
      date: record.sessionStartedAt,
      topWeightKg: 0,
      topWeightReps: 0,
      sets: [],
    };
    point.sets.push({ weightKg: record.weightKg, reps: record.reps });
    if (
      record.weightKg > point.topWeightKg ||
      (record.weightKg === point.topWeightKg && record.reps > point.topWeightReps)
    ) {
      point.topWeightKg = record.weightKg;
      point.topWeightReps = record.reps;
    }
    bySession.set(record.sessionId, point);
  }
  return [...bySession.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

/** Data de corte do período (inclusive). `null` = todo o período. */
export function periodCutoffMs(period: ProgressPeriod, nowMs: number): number | null {
  switch (period) {
    case '30d':
      return nowMs - 30 * DAY_MS;
    case '90d':
      return nowMs - 90 * DAY_MS;
    case '6m': {
      const cutoff = new Date(nowMs);
      cutoff.setMonth(cutoff.getMonth() - 6);
      return cutoff.getTime();
    }
    case 'all':
      return null;
  }
}

export function filterPointsByPeriod(
  points: readonly ExerciseProgressPoint[],
  period: ProgressPeriod,
  nowMs: number,
): ExerciseProgressPoint[] {
  const cutoff = periodCutoffMs(period, nowMs);
  return cutoff === null ? [...points] : points.filter((point) => Date.parse(point.date) >= cutoff);
}

export interface WeightRecord {
  weightKg: number;
  reps: number;
  date: string;
}

/** Maior carga da sessão mais recente; `null` sem registros. */
export function getLastWeight(points: readonly ExerciseProgressPoint[]): WeightRecord | null {
  const last = points[points.length - 1];
  return last ? { weightKg: last.topWeightKg, reps: last.topWeightReps, date: last.date } : null;
}

/** Maior carga já concluída (primeira vez em que foi atingida); `null` sem registros. */
export function getMaxWeight(points: readonly ExerciseProgressPoint[]): WeightRecord | null {
  let best: WeightRecord | null = null;
  for (const point of points) {
    if (!best || point.topWeightKg > best.weightKg) {
      best = { weightKg: point.topWeightKg, reps: point.topWeightReps, date: point.date };
    }
  }
  return best;
}

/** Histórico e estatísticas, sempre a partir de sessões concluídas e séries reais. */
export const historyService = {
  async listCompletedSessions(): Promise<SessionHistoryItem[]> {
    const rows = await historyRepository.findCompletedSessions();
    return rows.map(mapSessionRow);
  },

  async getTrainingStats(nowMs: number = Date.now()): Promise<TrainingStats> {
    return computeTrainingStats(await historyService.listCompletedSessions(), nowMs);
  },

  /** Exercícios já executados, do mais recente para o mais antigo. */
  async listPerformedExercises(): Promise<ExerciseHistoryEntry[]> {
    const rows = await historyRepository.findPerformedExercises();

    // chave → sessão → { início, nome, maior carga da sessão }
    const grouped = new Map<string, Map<string, { startedAt: string; name: string; top: number | null }>>();
    for (const row of rows) {
      const key = exerciseKey(row.exercise_name_snapshot);
      const sessions = grouped.get(key) ?? new Map();
      const current = sessions.get(row.session_id);
      const top =
        current?.top == null ? row.top_weight : row.top_weight == null ? current.top : Math.max(current.top, row.top_weight);
      sessions.set(row.session_id, { startedAt: row.started_at, name: row.exercise_name_snapshot, top });
      grouped.set(key, sessions);
    }

    const entries: ExerciseHistoryEntry[] = [];
    for (const [key, sessions] of grouped) {
      const latest = [...sessions.values()].reduce((a, b) => (Date.parse(b.startedAt) > Date.parse(a.startedAt) ? b : a));
      entries.push({
        key,
        name: latest.name,
        sessionsCount: sessions.size,
        lastPerformedAt: latest.startedAt,
        lastTopWeightKg: latest.top,
      });
    }
    return entries.sort((a, b) => Date.parse(b.lastPerformedAt) - Date.parse(a.lastPerformedAt));
  },

  /** Evolução de carga de um exercício (agrupado pelo nome normalizado). */
  async getExerciseProgress(name: string): Promise<ExerciseProgress> {
    const key = exerciseKey(name);
    const allNames = await historyRepository.findDistinctExerciseNames();
    const matchingNames = allNames.filter((candidate) => exerciseKey(candidate) === key);
    const rows = await historyRepository.findValidSetsByExerciseNames(matchingNames);
    const records: ExerciseSetRecord[] = rows.map((row) => ({
      sessionId: row.session_id,
      sessionStartedAt: row.started_at,
      exerciseName: row.exercise_name_snapshot,
      setNumber: row.set_number,
      weightKg: row.actual_weight,
      reps: row.actual_reps,
    }));
    const latestName = rows[rows.length - 1]?.exercise_name_snapshot ?? name.trim();
    return { key, name: latestName, points: buildProgressPoints(records) };
  },
};
