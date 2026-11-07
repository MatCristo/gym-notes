/// <reference types="node" />
/* eslint-disable @typescript-eslint/no-require-imports -- os módulos são recarregados para simular reinícios do app */
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type DatabaseModule = typeof import('@/database/database');
type MigrationsModule = typeof import('@/database/migrations');
type WorkoutServiceModule = typeof import('@/features/workouts/services/workout.service');
type ExerciseServiceModule = typeof import('@/features/exercises/services/exercise.service');
type ExerciseRepositoryModule = typeof import('@/features/exercises/repositories/exercise.repository');
type SessionServiceModule = typeof import('@/features/sessions/services/session.service');
type HistoryServiceModule = typeof import('@/features/history/services/history.service');

export interface TestApp {
  dbPath: string;
  database: DatabaseModule;
  migrations: MigrationsModule;
  workouts: WorkoutServiceModule;
  exercises: ExerciseServiceModule;
  exerciseRepository: ExerciseRepositoryModule['exerciseRepository'];
  sessions: SessionServiceModule;
  history: HistoryServiceModule;
}

function load(dbPath: string): TestApp {
  return {
    dbPath,
    database: require('@/database/database'),
    migrations: require('@/database/migrations'),
    workouts: require('@/features/workouts/services/workout.service'),
    exercises: require('@/features/exercises/services/exercise.service'),
    exerciseRepository: require('@/features/exercises/repositories/exercise.repository').exerciseRepository,
    sessions: require('@/features/sessions/services/session.service'),
    history: require('@/features/history/services/history.service'),
  };
}

const createdFiles: string[] = [];

/** Caminho de um arquivo de banco novo e vazio (um por teste). */
export function newDatabasePath(): string {
  const path = join(tmpdir(), `gym-notes-test-${randomUUID()}.db`);
  createdFiles.push(path);
  return path;
}

/** "Abre o app" com um banco em arquivo (novo por padrão). */
export function startApp(dbPath: string = newDatabasePath()): TestApp {
  process.env.GYM_NOTES_TEST_DB = dbPath;
  jest.resetModules();
  return load(dbPath);
}

/** Fecha a conexão atual (se aberta). */
export async function closeApp(app: TestApp): Promise<void> {
  try {
    const db = await app.database.getDatabase();
    await db.closeAsync();
  } catch {
    // Banco nunca aberto ou falhou na inicialização: nada a fechar.
  }
}

/** Simula fechar completamente o app e abri-lo de novo, com o mesmo arquivo de banco. */
export async function restartApp(app: TestApp): Promise<TestApp> {
  await closeApp(app);
  return startApp(app.dbPath);
}

/** Remove os arquivos de banco temporários criados pelos testes. */
export function cleanupDatabases(): void {
  for (const file of createdFiles.splice(0)) {
    for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true });
  }
}

/** Data local (fuso fixo dos testes) em ISO 8601. */
export function localIso(year: number, month: number, day: number, hour = 18, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}
