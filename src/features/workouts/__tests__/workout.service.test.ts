import { cleanupDatabases, closeApp, restartApp, startApp, type TestApp } from '../../../../test/helpers/app';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const plan = (name: string, sets = 3, reps = 10, weightKg = 20, restSeconds = 60) => ({
  name,
  sets,
  reps,
  weightKg,
  restSeconds,
});

describe('workoutService', () => {
  let app: TestApp;

  beforeEach(() => {
    app = startApp();
  });
  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  describe('validação de nome', () => {
    it('normaliza espaços e recusa nome vazio ou longo demais', () => {
      const { validateWorkoutName, normalizeWorkoutName } = app.workouts;
      expect(normalizeWorkoutName('  Treino D  ')).toBe('Treino D');
      expect(validateWorkoutName('   ')).toBe('empty');
      expect(validateWorkoutName('x'.repeat(41))).toBe('too-long');
      expect(validateWorkoutName('x'.repeat(40))).toBeNull();
    });
  });

  it('cria um treino com UUID, nome normalizado e no fim da lista; persiste após reiniciar', async () => {
    const created = await app.workouts.workoutService.createWorkout('  Peito e tríceps  ');
    expect(created.id).toMatch(UUID_V4);
    expect(created.name).toBe('Peito e tríceps');
    expect(created.exerciseCount).toBe(0);
    expect(created.sortOrder).toBe(3);

    app = await restartApp(app);
    const names = (await app.workouts.workoutService.listWorkouts()).map((w) => w.name);
    expect(names).toEqual(['Treino A', 'Treino B', 'Treino C', 'Peito e tríceps']);
  });

  it('recusa criar com nome inválido sem gravar nada', async () => {
    await expect(app.workouts.workoutService.createWorkout('   ')).rejects.toMatchObject({ code: 'invalid-name' });
    expect(await app.workouts.workoutService.listWorkouts()).toHaveLength(3);
  });

  it('renomeia mantendo createdAt e recusa ID inexistente', async () => {
    const [first] = await app.workouts.workoutService.listWorkouts();
    const renamed = await app.workouts.workoutService.renameWorkout(first!.id, 'Costas');
    expect(renamed.name).toBe('Costas');
    expect(renamed.createdAt).toBe(first!.createdAt);
    await expect(app.workouts.workoutService.renameWorkout('nao-existe', 'X')).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('trata nomes com aspas e SQL como texto comum (consultas parametrizadas)', async () => {
    const tricky = "Robert'); DROP TABLE workouts;--";
    const created = await app.workouts.workoutService.createWorkout(tricky);
    expect((await app.workouts.workoutService.getWorkout(created.id))!.name).toBe(tricky);
    expect(await app.workouts.workoutService.listWorkouts()).toHaveLength(4);
  });

  it('exclui pelo ID removendo os exercícios em cascata, sem afetar outros treinos', async () => {
    const [a, b] = await app.workouts.workoutService.listWorkouts();
    await app.exercises.exerciseService.createExercise(a!.id, plan('Supino'));
    await app.exercises.exerciseService.createExercise(b!.id, plan('Agachamento'));

    await app.workouts.workoutService.deleteWorkout(a!.id);

    expect(await app.workouts.workoutService.getWorkout(a!.id)).toBeNull();
    expect(await app.exercises.exerciseService.listByWorkout(a!.id)).toEqual([]);
    expect((await app.exercises.exerciseService.listByWorkout(b!.id)).map((e) => e.name)).toEqual(['Agachamento']);
    // Excluir de novo não é erro.
    await expect(app.workouts.workoutService.deleteWorkout(a!.id)).resolves.toBeUndefined();
  });

  it('a contagem de exercícios reflete o banco', async () => {
    const [a] = await app.workouts.workoutService.listWorkouts();
    const e1 = await app.exercises.exerciseService.createExercise(a!.id, plan('Supino'));
    await app.exercises.exerciseService.createExercise(a!.id, plan('Crucifixo'));
    expect((await app.workouts.workoutService.getWorkout(a!.id))!.exerciseCount).toBe(2);
    await app.exercises.exerciseService.deleteExercise(e1.id);
    expect((await app.workouts.workoutService.getWorkout(a!.id))!.exerciseCount).toBe(1);
  });

  describe('duplicação', () => {
    it('copia treino e exercícios com novos UUIDs e timestamps, preservando valores e ordem', async () => {
      const [a] = await app.workouts.workoutService.listWorkouts();
      await app.exercises.exerciseService.createExercise(a!.id, plan('Supino reto', 4, 12, 40, 90));
      await app.exercises.exerciseService.createExercise(a!.id, plan('Crucifixo', 3, 15, 22.5, 0));
      const original = await app.exercises.exerciseService.listByWorkout(a!.id);

      const copy = await app.workouts.workoutService.duplicateWorkout(a!.id);

      expect(copy.id).toMatch(UUID_V4);
      expect(copy.id).not.toBe(a!.id);
      expect(copy.name).toBe('Treino A (Cópia)');
      expect(copy.exerciseCount).toBe(2);
      expect(copy.createdAt >= a!.createdAt).toBe(true);
      const copied = await app.exercises.exerciseService.listByWorkout(copy.id);
      expect(copied.map((e) => [e.name, e.sets, e.reps, e.weightKg, e.restSeconds, e.sortOrder])).toEqual(
        original.map((e) => [e.name, e.sets, e.reps, e.weightKg, e.restSeconds, e.sortOrder]),
      );
      for (const exercise of copied) {
        expect(exercise.id).toMatch(UUID_V4);
        expect(original.some((o) => o.id === exercise.id)).toBe(false);
        expect(exercise.workoutId).toBe(copy.id);
      }
    });

    it('original e cópia são independentes', async () => {
      const [a] = await app.workouts.workoutService.listWorkouts();
      const e = await app.exercises.exerciseService.createExercise(a!.id, plan('Supino', 4, 12, 40));
      const copy = await app.workouts.workoutService.duplicateWorkout(a!.id);
      const [copied] = await app.exercises.exerciseService.listByWorkout(copy.id);

      await app.exercises.exerciseService.updateExercise(copied!.id, plan('Supino inclinado', 2, 8, 30));
      await app.workouts.workoutService.renameWorkout(copy.id, 'Treino A2');

      expect((await app.exercises.exerciseService.listByWorkout(a!.id))[0]).toMatchObject({
        id: e.id,
        name: 'Supino',
        weightKg: 40,
      });
      expect((await app.workouts.workoutService.getWorkout(a!.id))!.name).toBe('Treino A');
      await app.workouts.workoutService.deleteWorkout(a!.id);
      expect(await app.exercises.exerciseService.listByWorkout(copy.id)).toHaveLength(1);
    });

    it('não copia sessões nem histórico', async () => {
      const [a] = await app.workouts.workoutService.listWorkouts();
      await app.exercises.exerciseService.createExercise(a!.id, plan('Supino'));
      const { sessionId } = await app.sessions.sessionService.startSession(a!.id);
      await app.sessions.sessionService.finishSession(sessionId);

      const copy = await app.workouts.workoutService.duplicateWorkout(a!.id);

      expect(await app.sessions.sessionService.getInProgressSessionForWorkout(copy.id)).toBeNull();
      const db = await app.database.getDatabase();
      const sessionsOfCopy = await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM workout_sessions WHERE workout_id = ?',
        [copy.id],
      );
      expect(sessionsOfCopy!.n).toBe(0);
    });

    it('se falhar no meio, não deixa cópia parcial (transação)', async () => {
      const [a] = await app.workouts.workoutService.listWorkouts();
      for (const name of ['E1', 'E2', 'E3']) await app.exercises.exerciseService.createExercise(a!.id, plan(name));
      const db = await app.database.getDatabase();
      const totals = async () =>
        db.getFirstAsync<{ w: number; e: number }>(
          'SELECT (SELECT COUNT(*) FROM workouts) AS w, (SELECT COUNT(*) FROM exercises) AS e',
        );
      const before = await totals();

      const realInsert = app.exerciseRepository.insert;
      let calls = 0;
      const spy = jest.spyOn(app.exerciseRepository, 'insert').mockImplementation(async (input) => {
        calls += 1;
        if (calls === 2) throw new Error('falha simulada');
        return realInsert.call(app.exerciseRepository, input);
      });

      await expect(app.workouts.workoutService.duplicateWorkout(a!.id)).rejects.toThrow('falha simulada');
      spy.mockRestore();

      expect(await totals()).toEqual(before);
    });

    it('respeita o limite de 40 caracteres no nome da cópia', async () => {
      expect(app.workouts.buildCopyName('Treino A')).toBe('Treino A (Cópia)');
      const long = app.workouts.buildCopyName('x'.repeat(40));
      expect(long).toHaveLength(40);
      expect(long.endsWith(' (Cópia)')).toBe(true);
    });
  });
});
