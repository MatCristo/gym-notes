import type { SQLiteDatabase } from 'expo-sqlite';

import {
  cleanupDatabases,
  closeApp,
  defaultProgramId,
  listDefaultWorkouts,
  newDatabasePath,
  restartApp,
  startApp,
  type TestApp,
} from '../../../test/helpers/app';

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
    expect(tables).toEqual([
      'exercises',
      'session_exercises',
      'set_logs',
      'training_programs',
      'workout_sessions',
      'workouts',
    ]);

    const exerciseFks = await db.getAllAsync<{ table: string; on_delete: string }>('PRAGMA foreign_key_list(exercises)');
    expect(exerciseFks).toEqual([expect.objectContaining({ table: 'workouts', on_delete: 'CASCADE' })]);
    const sessionFks = await db.getAllAsync<{ table: string; on_delete: string }>(
      'PRAGMA foreign_key_list(workout_sessions)',
    );
    expect(sessionFks).toEqual([expect.objectContaining({ table: 'workouts', on_delete: 'SET NULL' })]);
  });

  it('insere os treinos de demonstração uma única vez, mesmo após reinícios', async () => {
    app = startApp();
    expect((await listDefaultWorkouts(app)).map((w) => w.name)).toEqual([
      'Treino A',
      'Treino B',
      'Treino C',
    ]);

    app = await restartApp(app);
    app = await restartApp(app);
    expect(await listDefaultWorkouts(app)).toHaveLength(3);
  });

  it('se o usuário excluir todos os treinos, os de demonstração não voltam', async () => {
    app = startApp();
    for (const workout of await listDefaultWorkouts(app)) {
      await app.workouts.workoutService.deleteWorkout(workout.id);
    }
    app = await restartApp(app);
    expect(await listDefaultWorkouts(app)).toEqual([]);
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
    const names = (await listDefaultWorkouts(app)).map((w) => w.name);
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
    expect(await listDefaultWorkouts(app)).toHaveLength(3);
  });

  describe('migration v6 (planejamentos)', () => {
    const rawSqlite = () =>
      jest.requireActual<typeof import('../../../test/mocks/expo-sqlite')>('../../../test/mocks/expo-sqlite');

    it('em banco novo cria "Meu planejamento" com os treinos de demonstração e FK sem cascata', async () => {
      app = startApp();
      const db = await app.database.getDatabase();

      const programs = await app.programs.programService.listPrograms();
      expect(programs).toHaveLength(1);
      expect(programs[0]).toMatchObject({ name: 'Meu planejamento', description: null, workoutCount: 3, sortOrder: 0 });
      expect((await listDefaultWorkouts(app)).map((w) => w.name)).toEqual(['Treino A', 'Treino B', 'Treino C']);
      expect(await count(db, 'SELECT COUNT(*) AS n FROM workouts WHERE program_id IS NULL')).toBe(0);

      const workoutFks = await db.getAllAsync<{ table: string; from: string; on_delete: string }>(
        'PRAGMA foreign_key_list(workouts)',
      );
      expect(workoutFks).toEqual([
        expect.objectContaining({ table: 'training_programs', from: 'program_id', on_delete: 'NO ACTION' }),
      ]);
    });

    it('o banco recusa treino sem planejamento e exclusão de planejamento com treinos', async () => {
      app = startApp();
      const db = await app.database.getDatabase();
      const programId = await defaultProgramId(app);
      const now = new Date().toISOString();

      await expect(
        db.runAsync('INSERT INTO workouts (id, name, created_at, updated_at, sort_order) VALUES (?, ?, ?, ?, 0)', [
          'w-sem-plano',
          'X',
          now,
          now,
        ]),
      ).rejects.toThrow(/program_id é obrigatório/);
      await expect(db.runAsync('UPDATE workouts SET program_id = NULL')).rejects.toThrow(/program_id é obrigatório/);
      await expect(
        db.runAsync(
          'INSERT INTO workouts (id, program_id, name, created_at, updated_at, sort_order) VALUES (?, ?, ?, ?, ?, 0)',
          ['w-plano-inexistente', 'nao-existe', 'X', now, now],
        ),
      ).rejects.toThrow(/FOREIGN KEY/);
      await expect(db.runAsync('DELETE FROM training_programs WHERE id = ?', [programId])).rejects.toThrow(
        /FOREIGN KEY/,
      );
      expect(await listDefaultWorkouts(app)).toHaveLength(3);
    });

    it('migra um banco v5 com dados reais sem perder treinos, exercícios, histórico ou sessão em andamento', async () => {
      const dbPath = newDatabasePath();
      app = startApp(dbPath);
      const raw = await rawSqlite().openDatabaseAsync('v5');
      await raw.execAsync('PRAGMA foreign_keys = ON;');
      for (const migration of app.migrations.MIGRATIONS.filter((m) => m.version <= 5)) {
        await migration.up(raw as unknown as SQLiteDatabase);
      }
      await raw.execAsync('PRAGMA user_version = 5');
      const before = await raw.getAllAsync<{ id: string; name: string }>(
        'SELECT id, name FROM workouts ORDER BY sort_order',
      );
      // Ordem personalizada e com buracos (como fica após exclusões/reordenações na versão 5).
      await raw.runAsync("UPDATE workouts SET sort_order = 7 WHERE name = 'Treino A'");
      await raw.runAsync("UPDATE workouts SET sort_order = 2 WHERE name = 'Treino C'");
      const wa = before[0]!.id;
      const wb = before[1]!.id;
      const t = '2026-10-01T10:00:00.000Z';
      await raw.runAsync(
        `INSERT INTO exercises (id, workout_id, name, sets, reps, weight, rest_seconds, sort_order, created_at, updated_at)
         VALUES ('ex-1', ?, 'Supino', 3, 10, 40, 90, 0, ?, ?), ('ex-2', ?, 'Remada', 2, 12, 30, 60, 0, ?, ?)`,
        [wa, t, t, wb, t, t],
      );
      // Sessão concluída (histórico) do Treino A e sessão em andamento do Treino B.
      await raw.runAsync(
        `INSERT INTO workout_sessions (id, workout_id, workout_name_snapshot, started_at, completed_at, status)
         VALUES ('s-done', ?, 'Treino A', ?, ?, 'completed'), ('s-live', ?, 'Treino B', ?, NULL, 'in_progress')`,
        [wa, t, '2026-10-01T11:00:00.000Z', wb, t],
      );
      await raw.runAsync(
        `INSERT INTO session_exercises (id, session_id, exercise_id, exercise_name_snapshot, planned_rest_seconds, sort_order)
         VALUES ('se-done', 's-done', 'ex-1', 'Supino', 90, 0), ('se-live', 's-live', 'ex-2', 'Remada', 60, 0)`,
      );
      await raw.runAsync(
        `INSERT INTO set_logs (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight, actual_weight, completed_at)
         VALUES ('sl-1', 'se-done', 1, 10, 10, 40, 42.5, ?), ('sl-2', 'se-live', 1, 12, 12, 30, 32, ?)`,
        [t, t],
      );
      await raw.closeAsync();

      app = startApp(dbPath);
      const db = await app.database.getDatabase();
      expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(
        app.migrations.LATEST_DATABASE_VERSION,
      );

      const programs = await app.programs.programService.listPrograms();
      expect(programs.map((p) => [p.name, p.workoutCount])).toEqual([['Meu planejamento', 3]]);
      // Mesmos IDs, nomes e ordem.
      const workouts = await listDefaultWorkouts(app);
      expect(workouts.map((w) => [w.name, w.sortOrder])).toEqual([
        ['Treino B', 1],
        ['Treino C', 2],
        ['Treino A', 7],
      ]);
      expect(new Set(workouts.map((w) => w.id))).toEqual(new Set(before.map((w) => w.id)));
      expect(workouts.every((w) => w.programId === programs[0]!.id)).toBe(true);
      expect((await app.exercises.exerciseService.listByWorkout(wa)).map((e) => [e.id, e.weightKg])).toEqual([
        ['ex-1', 40],
      ]);

      // Histórico, estatísticas e evolução continuam iguais.
      expect((await app.history.historyService.listCompletedSessions()).map((h) => h.id)).toEqual(['s-done']);
      const progress = await app.history.historyService.getExerciseProgress('Supino');
      expect(progress.points).toHaveLength(1);
      expect((await app.history.historyService.getTrainingStats()).totalSessions).toBe(1);

      // A sessão em andamento continua retomável, com o que já foi registrado.
      expect(await app.sessions.sessionService.startSession(wb)).toEqual({ sessionId: 's-live', resumed: true });
      const live = (await app.sessions.sessionService.getSessionDetails('s-live'))!;
      expect(live.exercises[0]!.sets[0]).toMatchObject({ actualWeightKg: 32, actualReps: 12 });
      expect(await count(db, 'SELECT COUNT(*) AS n FROM set_logs')).toBe(2);
    });

    it('reexecutar a migration v6 não duplica o planejamento padrão nem altera os dados', async () => {
      app = startApp();
      const db = await app.database.getDatabase();
      const programId = await defaultProgramId(app);
      const v6 = app.migrations.MIGRATIONS.find((m) => m.version === 6)!;

      await db.withTransactionAsync(() => v6.up(db));

      expect(await count(db, 'SELECT COUNT(*) AS n FROM training_programs')).toBe(1);
      expect(await defaultProgramId(app)).toBe(programId);
      expect(await count(db, 'SELECT COUNT(*) AS n FROM workouts WHERE program_id = ?', [programId])).toBe(3);

      app = await restartApp(app);
      expect(await app.programs.programService.listPrograms()).toHaveLength(1);
    });
  });

  describe('migration v7 (observação dos exercícios)', () => {
    it('banco novo: exercises tem a coluna observation, que aceita nulo', async () => {
      app = startApp();
      const db = await app.database.getDatabase();
      const columns = await db.getAllAsync<{ name: string; notnull: number; dflt_value: unknown }>(
        'PRAGMA table_info(exercises)',
      );
      expect(columns.find((c) => c.name === 'observation')).toMatchObject({ notnull: 0, dflt_value: null });
    });

    it('migra um banco v6 com dados: exercícios antigos ficam com observação nula e nada mais muda', async () => {
      const dbPath = newDatabasePath();
      app = startApp(dbPath);
      const raw = await jest
        .requireActual<typeof import('../../../test/mocks/expo-sqlite')>('../../../test/mocks/expo-sqlite')
        .openDatabaseAsync('v6');
      await raw.execAsync('PRAGMA foreign_keys = ON;');
      for (const migration of app.migrations.MIGRATIONS.filter((m) => m.version <= 6)) {
        await migration.up(raw as unknown as SQLiteDatabase);
      }
      await raw.execAsync('PRAGMA user_version = 6');
      const [workout] = await raw.getAllAsync<{ id: string }>('SELECT id FROM workouts ORDER BY sort_order');
      const t = '2026-10-01T10:00:00.000Z';
      await raw.runAsync(
        `INSERT INTO exercises (id, workout_id, name, sets, reps, weight, rest_seconds, sort_order, created_at, updated_at)
         VALUES ('ex-1', ?, 'Supino', 4, 12, 42.5, 90, 0, ?, ?)`,
        [workout!.id, t, t],
      );
      await raw.runAsync(
        `INSERT INTO workout_sessions (id, workout_id, workout_name_snapshot, started_at, completed_at, status)
         VALUES ('s-1', ?, 'Treino A', ?, ?, 'completed')`,
        [workout!.id, t, t],
      );
      const before = {
        sessions: await raw.getAllAsync('SELECT * FROM workout_sessions'),
        workouts: await raw.getAllAsync('SELECT * FROM workouts ORDER BY id'),
      };
      await raw.closeAsync();

      app = startApp(dbPath);
      const db = await app.database.getDatabase();
      expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(
        app.migrations.LATEST_DATABASE_VERSION,
      );
      expect(await app.exerciseRepository.findById('ex-1')).toMatchObject({
        name: 'Supino',
        sets: 4,
        reps: 12,
        weightKg: 42.5,
        restSeconds: 90,
        observation: null,
        createdAt: t,
        updatedAt: t,
      });
      expect(await db.getAllAsync('SELECT * FROM workout_sessions')).toEqual(before.sessions);
      expect(await db.getAllAsync('SELECT * FROM workouts ORDER BY id')).toEqual(before.workouts);
    });

    it('reexecutar a migration v7 não falha nem altera dados', async () => {
      app = startApp();
      const db = await app.database.getDatabase();
      const [w] = await listDefaultWorkouts(app);
      await app.exercises.exerciseService.createExercise(w!.id, {
        name: 'Supino',
        sets: 3,
        reps: 10,
        weightKg: 20,
        restSeconds: 60,
        observation: 'Coluna apoiada',
      });
      const before = await db.getAllAsync('SELECT * FROM exercises');
      const v7 = app.migrations.MIGRATIONS.find((m) => m.version === 7)!;

      await db.withTransactionAsync(() => v7.up(db));

      expect(await db.getAllAsync('SELECT * FROM exercises')).toEqual(before);
    });
  });

  describe('migration v8 (observação congelada nas sessões)', () => {
    it('migra um banco v7 com sessões: elas ficam com observação nula e continuam funcionando', async () => {
      const dbPath = newDatabasePath();
      app = startApp(dbPath);
      const raw = await jest
        .requireActual<typeof import('../../../test/mocks/expo-sqlite')>('../../../test/mocks/expo-sqlite')
        .openDatabaseAsync('v7');
      await raw.execAsync('PRAGMA foreign_keys = ON;');
      for (const migration of app.migrations.MIGRATIONS.filter((m) => m.version <= 7)) {
        await migration.up(raw as unknown as SQLiteDatabase);
      }
      await raw.execAsync('PRAGMA user_version = 7');
      const [a, b] = await raw.getAllAsync<{ id: string }>('SELECT id FROM workouts ORDER BY sort_order');
      const t = '2026-10-01T10:00:00.000Z';
      await raw.runAsync(
        `INSERT INTO exercises (id, workout_id, name, sets, reps, weight, rest_seconds, observation, sort_order, created_at, updated_at)
         VALUES ('ex-a', ?, 'Supino', 1, 10, 40, 90, 'Coluna apoiada', 0, ?, ?), ('ex-b', ?, 'Remada', 1, 10, 30, 60, NULL, 0, ?, ?)`,
        [a!.id, t, t, b!.id, t, t],
      );
      await raw.runAsync(
        `INSERT INTO workout_sessions (id, workout_id, workout_name_snapshot, started_at, completed_at, status)
         VALUES ('s-done', ?, 'Treino A', ?, ?, 'completed'), ('s-live', ?, 'Treino B', ?, NULL, 'in_progress')`,
        [a!.id, t, t, b!.id, t],
      );
      await raw.runAsync(
        `INSERT INTO session_exercises (id, session_id, exercise_id, exercise_name_snapshot, planned_rest_seconds, sort_order)
         VALUES ('se-done', 's-done', 'ex-a', 'Supino', 90, 0), ('se-live', 's-live', 'ex-b', 'Remada', 60, 0)`,
      );
      await raw.runAsync(
        `INSERT INTO set_logs (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight, actual_weight, completed_at)
         VALUES ('sl-1', 'se-done', 1, 10, 10, 40, 42.5, ?), ('sl-2', 'se-live', 1, 10, 8, 30, 32, ?)`,
        [t, t],
      );
      const before = {
        sessions: await raw.getAllAsync('SELECT * FROM workout_sessions ORDER BY id'),
        setLogs: await raw.getAllAsync('SELECT * FROM set_logs ORDER BY id'),
      };
      await raw.closeAsync();

      app = startApp(dbPath);
      const db = await app.database.getDatabase();
      expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(8);
      // Sessões antigas: observação nula (não é inventada a partir do exercício atual).
      const done = (await app.sessions.sessionService.getSessionDetails('s-done'))!;
      expect(done.exercises[0]).toMatchObject({ exerciseNameSnapshot: 'Supino', observationSnapshot: null });
      expect(done.exercises[0]!.sets[0]).toMatchObject({ actualWeightKg: 42.5 });
      expect(await app.sessions.sessionService.startSession(b!.id)).toEqual({ sessionId: 's-live', resumed: true });
      expect((await app.history.historyService.listCompletedSessions()).map((s) => s.id)).toEqual(['s-done']);
      // Histórico intacto.
      expect(await db.getAllAsync('SELECT * FROM workout_sessions ORDER BY id')).toEqual(before.sessions);
      expect(await db.getAllAsync('SELECT * FROM set_logs ORDER BY id')).toEqual(before.setLogs);
    });

    it('reexecutar a migration v8 não falha nem altera dados', async () => {
      app = startApp();
      const db = await app.database.getDatabase();
      const before = await db.getAllAsync('SELECT * FROM session_exercises');
      const v8 = app.migrations.MIGRATIONS.find((m) => m.version === 8)!;
      await db.withTransactionAsync(() => v8.up(db));
      expect(await db.getAllAsync('SELECT * FROM session_exercises')).toEqual(before);
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(session_exercises)');
      expect(columns.filter((c) => c.name === 'observation_snapshot')).toHaveLength(1);
    });
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
