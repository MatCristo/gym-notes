import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface Migration {
  /** Versão resultante após aplicar a migration. Deve ser sequencial a partir de 1. */
  version: number;
  description: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

/**
 * Lista ordenada de migrations. NUNCA altere uma migration já publicada:
 * para mudar o schema, adicione uma nova entrada com a próxima versão.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Cria a tabela workouts',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS workouts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL CHECK (length(trim(name)) > 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sort_order INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_workouts_sort_order ON workouts (sort_order);
      `);
    },
  },
  {
    version: 2,
    description: 'Insere os treinos de demonstração (executa uma única vez)',
    up: async (db) => {
      const demoNames = ['Treino A', 'Treino B', 'Treino C'];
      const now = new Date().toISOString();
      for (const [index, name] of demoNames.entries()) {
        await db.runAsync(
          'INSERT INTO workouts (id, name, created_at, updated_at, sort_order) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), name, now, now, index],
        );
      }
    },
  },
  {
    version: 3,
    description: 'Cria a tabela exercises (planejamento dos exercícios de cada treino)',
    up: async (db) => {
      // Apenas cria a nova tabela: os dados de `workouts` não são tocados.
      // Os valores aqui são o PLANEJAMENTO; registros de execução terão tabelas próprias no futuro.
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY NOT NULL,
          workout_id TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
          name TEXT NOT NULL CHECK (length(trim(name)) > 0),
          sets INTEGER NOT NULL CHECK (sets > 0),
          reps INTEGER NOT NULL CHECK (reps > 0),
          weight REAL NOT NULL DEFAULT 0 CHECK (weight >= 0),
          rest_seconds INTEGER NOT NULL DEFAULT 0 CHECK (rest_seconds >= 0),
          sort_order INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises (workout_id, sort_order);
      `);
    },
  },
  {
    version: 4,
    description: 'Cria as tabelas de execução: workout_sessions, session_exercises e set_logs',
    up: async (db) => {
      // Dados REAIS de execução, separados do planejamento (workouts/exercises).
      // Os *_snapshot e planned_* congelam o plano no início da sessão: editar ou excluir
      // treinos/exercícios depois não altera o histórico (FKs com ON DELETE SET NULL).
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          workout_id TEXT REFERENCES workouts (id) ON DELETE SET NULL,
          workout_name_snapshot TEXT NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
          CHECK ((status = 'completed') = (completed_at IS NOT NULL))
        );
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_workout_id ON workout_sessions (workout_id);
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions (status);
        -- No máximo uma sessão em andamento por treino (garantido pelo próprio banco).
        CREATE UNIQUE INDEX IF NOT EXISTS ux_workout_sessions_in_progress
          ON workout_sessions (workout_id) WHERE status = 'in_progress';

        CREATE TABLE IF NOT EXISTS session_exercises (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
          exercise_id TEXT REFERENCES exercises (id) ON DELETE SET NULL,
          exercise_name_snapshot TEXT NOT NULL,
          planned_rest_seconds INTEGER NOT NULL DEFAULT 0 CHECK (planned_rest_seconds >= 0),
          sort_order INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_session_exercises_session_id ON session_exercises (session_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_session_exercises_exercise_id ON session_exercises (exercise_id);

        CREATE TABLE IF NOT EXISTS set_logs (
          id TEXT PRIMARY KEY NOT NULL,
          session_exercise_id TEXT NOT NULL REFERENCES session_exercises (id) ON DELETE CASCADE,
          set_number INTEGER NOT NULL CHECK (set_number > 0),
          planned_reps INTEGER NOT NULL CHECK (planned_reps > 0),
          actual_reps INTEGER CHECK (actual_reps IS NULL OR actual_reps >= 0),
          planned_weight REAL NOT NULL CHECK (planned_weight >= 0),
          actual_weight REAL CHECK (actual_weight IS NULL OR actual_weight >= 0),
          completed_at TEXT,
          UNIQUE (session_exercise_id, set_number)
        );
      `);
    },
  },
  {
    version: 5,
    description: 'Índices para consultas de histórico e evolução (sem alterar tabelas ou dados)',
    up: async (db) => {
      await db.execAsync(`
        -- Lista de sessões concluídas em ordem cronológica decrescente.
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_status_started_at
          ON workout_sessions (status, started_at);
        -- Evolução por exercício: busca pelo nome registrado no momento da execução.
        CREATE INDEX IF NOT EXISTS idx_session_exercises_name_snapshot
          ON session_exercises (exercise_name_snapshot);
      `);
    },
  },
];

export const LATEST_DATABASE_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

/** Garante versões 1, 2, 3... sem buracos nem repetições (erro de programação, detectado cedo). */
export function assertSequentialVersions(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(`Migrations fora de sequência: esperado ${index + 1}, encontrado ${migration.version}.`);
    }
  });
}

/**
 * Aplica apenas as migrations com versão maior que `PRAGMA user_version`.
 * Cada migration roda em uma transação junto com a atualização da versão:
 * ou ela é aplicada por completo, ou nada muda.
 */
export async function runMigrations(
  db: SQLiteDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<void> {
  assertSequentialVersions(migrations);
  const latestVersion = migrations[migrations.length - 1]?.version ?? 0;

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > latestVersion) {
    // Ex.: o usuário voltou para uma versão antiga do app. Não tocamos no banco para não perder dados.
    throw new Error(`Versão do banco (${currentVersion}) é mais nova que a suportada pelo app (${latestVersion}).`);
  }

  const pending = migrations.filter((migration) => migration.version > currentVersion);
  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      // PRAGMA não aceita parâmetros; `version` é um inteiro definido no código, não entrada do usuário.
      await db.execAsync(`PRAGMA user_version = ${Math.trunc(migration.version)}`);
    });
  }
}
