import type { SQLiteDatabase } from 'expo-sqlite';

import { cleanupDatabases, closeApp, newDatabasePath, restartApp, startApp, type TestApp } from '../../../test/helpers/app';

const count = async (db: SQLiteDatabase, sql: string, params: (string | number)[] = []) =>
  (await db.getFirstAsync<{ n: number }>(sql, params))!.n;

describe('inicialização do banco e migrations', () => {
  let app: TestApp;

  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  it('em um banco novo aplica todas as migrations, ativa FKs e WAL e cria só as tabelas esperadas', async () => {
    app = startApp();
    const db = await app.database.getDatabase();

    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(
      app.migrations.LATEST_DATABASE_VERSION,
    );
    expect((await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))!.foreign_keys).toBe(1);
    expect((await db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode'))!.journal_mode).toBe('wal');

    const tables = (
      await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
    ).map((row) => row.name);
    expect(tables).toEqual(['exercises', 'session_exercises', 'set_logs', 'workout_sessions', 'workouts']);

    const exerciseFks = await db.getAllAsync<{ table: string; on_delete: string }>('PRAGMA foreign_key_list(exercises)');
    expect(exerciseFks).toEqual([expect.objectContaining({ table: 'workouts', on_delete: 'CASCADE' })]);
    const sessionFks = await db.getAllAsync<{ table: string; on_delete: string }>(
      'PRAGMA foreign_key_list(workout_sessions)',
    );
    expect(sessionFks).toEqual([expect.objectContaining({ table: 'workouts', on_delete: 'SET NULL' })]);
  });

  it('insere os treinos de demonstração uma única vez, mesmo após reinícios', async () => {
    app = startApp();
    expect((await app.workouts.workoutService.listWorkouts()).map((w) => w.name)).toEqual([
      'Treino A',
      'Treino B',
      'Treino C',
    ]);

    app = await restartApp(app);
    app = await restartApp(app);
    expect(await app.workouts.workoutService.listWorkouts()).toHaveLength(3);
  });

  it('se o usuário excluir todos os treinos, os de demonstração não voltam', async () => {
    app = startApp();
    for (const workout of await app.workouts.workoutService.listWorkouts()) {
      await app.workouts.workoutService.deleteWorkout(workout.id);
    }
    app = await restartApp(app);
    expect(await app.workouts.workoutService.listWorkouts()).toEqual([]);
  });

  it('atualiza um banco antigo (versão 2) sem perder dados do usuário', async () => {
    const dbPath = newDatabasePath();
    // Banco exatamente como a Fase 3 o deixava: migrations 1 e 2 aplicadas.
    app = startApp(dbPath);
    const { openDatabaseAsync } = jest.requireActual<typeof import('../../../test/mocks/expo-sqlite')>(
      '../../../test/mocks/expo-sqlite',
    );
    const raw = await openDatabaseAsync('legacy');
    await raw.execAsync('PRAGMA foreign_keys = ON;');
    for (const migration of app.migrations.MIGRATIONS.filter((m) => m.version <= 2)) {
      await migration.up(raw as unknown as SQLiteDatabase);
    }
    await raw.runAsync("UPDATE workouts SET name = 'Pernas (meu treino)' WHERE name = 'Treino B'");
    await raw.execAsync('PRAGMA user_version = 2');
    await raw.closeAsync();

    app = startApp(dbPath);
    const db = await app.database.getDatabase();
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(
      app.migrations.LATEST_DATABASE_VERSION,
    );
    const names = (await app.workouts.workoutService.listWorkouts()).map((w) => w.name);
    expect(names).toEqual(['Treino A', 'Pernas (meu treino)', 'Treino C']);
  });

  it('desfaz por completo uma migration que falha e mantém a versão anterior', async () => {
    app = startApp();
    const { openDatabaseAsync } = jest.requireActual<typeof import('../../../test/mocks/expo-sqlite')>(
      '../../../test/mocks/expo-sqlite',
    );
    const db = (await openDatabaseAsync('x')) as unknown as SQLiteDatabase;
    const migrations = [
      { version: 1, description: 'ok', up: (d: SQLiteDatabase) => d.execAsync('CREATE TABLE a (id INTEGER)') },
      {
        version: 2,
        description: 'falha no meio',
        up: async (d: SQLiteDatabase) => {
          await d.execAsync('CREATE TABLE b (id INTEGER)');
          throw new Error('falha simulada');
        },
      },
    ];

    await expect(app.migrations.runMigrations(db, migrations)).rejects.toThrow('falha simulada');
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(1);
    expect(await count(db, "SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'b'")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'a'")).toBe(1);
    await db.closeAsync();
  });

  it('recusa abrir um banco de versão mais nova que o app, sem alterá-lo', async () => {
    app = startApp();
    const { openDatabaseAsync } = jest.requireActual<typeof import('../../../test/mocks/expo-sqlite')>(
      '../../../test/mocks/expo-sqlite',
    );
    const raw = await openDatabaseAsync('future');
    await raw.execAsync('CREATE TABLE workouts (id TEXT); PRAGMA user_version = 99;');
    await raw.closeAsync();

    await expect(app.database.getDatabase()).rejects.toThrow(/mais nova/);
    const check = await openDatabaseAsync('check');
    expect((await check.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(99);
    await check.closeAsync();
  });

  it('após falhar na inicialização, uma nova tentativa funciona (sem apagar o banco)', async () => {
    app = startApp();
    const { openDatabaseAsync } = jest.requireActual<typeof import('../../../test/mocks/expo-sqlite')>(
      '../../../test/mocks/expo-sqlite',
    );
    const raw = await openDatabaseAsync('future');
    await raw.execAsync('PRAGMA user_version = 99;');
    await raw.closeAsync();
    await expect(app.database.getDatabase()).rejects.toThrow();

    const fix = await openDatabaseAsync('fix');
    await fix.execAsync('PRAGMA user_version = 0;');
    await fix.closeAsync();
    await expect(app.database.getDatabase()).resolves.toBeDefined();
    expect(await app.workouts.workoutService.listWorkouts()).toHaveLength(3);
  });

  it('valida que as versões das migrations são sequenciais', () => {
    app = startApp();
    const noop = async () => undefined;
    expect(() => app.migrations.assertSequentialVersions(app.migrations.MIGRATIONS)).not.toThrow();
    expect(() =>
      app.migrations.assertSequentialVersions([
        { version: 1, description: '', up: noop },
        { version: 3, description: '', up: noop },
      ]),
    ).toThrow(/fora de sequência/);
  });
});
