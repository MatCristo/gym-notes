import { parseExerciseForm } from '@/features/exercises/services/exercise.service';

import { cleanupDatabases, closeApp, restartApp, startApp, type TestApp } from '../../../../test/helpers/app';

const input = (name: string, sets = 3, reps = 10, weightKg = 20, restSeconds = 60) => ({
  name,
  sets,
  reps,
  weightKg,
  restSeconds,
});

describe('exerciseService', () => {
  let app: TestApp;
  let workoutId: string;
  let otherWorkoutId: string;

  beforeEach(async () => {
    app = startApp();
    const [a, b] = await app.workouts.workoutService.listWorkouts();
    workoutId = a!.id;
    otherWorkoutId = b!.id;
  });
  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  describe('parseExerciseForm', () => {
    const form = (values: Partial<Record<'name' | 'sets' | 'reps' | 'weightKg' | 'restSeconds', string>>) =>
      parseExerciseForm({ name: 'Remada', sets: '3', reps: '10', weightKg: '', restSeconds: '', ...values });

    it('converte valores válidos (vírgula decimal; carga e descanso vazios = 0)', () => {
      expect(form({})).toEqual({ ok: true, input: { name: 'Remada', sets: 3, reps: 10, weightKg: 0, restSeconds: 0 } });
      expect(form({ weightKg: '17,5', restSeconds: '90' })).toMatchObject({ ok: true, input: { weightKg: 17.5, restSeconds: 90 } });
      expect(form({ weightKg: '0' })).toMatchObject({ ok: true, input: { weightKg: 0 } });
    });

    it('aponta erros por campo', () => {
      expect(form({ name: '  ', sets: '', reps: '0' })).toEqual({
        ok: false,
        errors: { name: 'required', sets: 'required', reps: 'not-positive' },
      });
      expect(form({ sets: '2.5', reps: 'abc', weightKg: '-3', restSeconds: '-10' })).toEqual({
        ok: false,
        errors: { sets: 'not-integer', reps: 'invalid-number', weightKg: 'negative', restSeconds: 'negative' },
      });
      expect(form({ sets: '100' })).toMatchObject({ ok: false, errors: { sets: 'too-large' } });
    });
  });

  it('cria, edita todos os campos e exclui, persistindo entre reinícios', async () => {
    const created = await app.exercises.exerciseService.createExercise(workoutId, input('  Supino reto ', 4, 12, 40, 90));
    expect(created).toMatchObject({ name: 'Supino reto', sets: 4, reps: 12, weightKg: 40, restSeconds: 90, sortOrder: 0 });

    const updated = await app.exercises.exerciseService.updateExercise(created.id, input('Supino inclinado', 5, 8, 42.5, 120));
    expect(updated).toMatchObject({ name: 'Supino inclinado', sets: 5, reps: 8, weightKg: 42.5, restSeconds: 120 });
    expect(updated.createdAt).toBe(created.createdAt);

    app = await restartApp(app);
    expect(await app.exercises.exerciseService.listByWorkout(workoutId)).toEqual([updated]);

    await app.exercises.exerciseService.deleteExercise(created.id);
    app = await restartApp(app);
    expect(await app.exercises.exerciseService.listByWorkout(workoutId)).toEqual([]);
  });

  it('recusa dados inválidos, treino inexistente e exercício inexistente', async () => {
    const { exerciseService } = app.exercises;
    await expect(exerciseService.createExercise(workoutId, input('X', 0))).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(exerciseService.createExercise(workoutId, input('X', 1, 1, -1))).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(exerciseService.createExercise(workoutId, input('  '))).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(exerciseService.createExercise('nao-existe', input('X'))).rejects.toMatchObject({ code: 'workout-not-found' });
    await expect(exerciseService.updateExercise('nao-existe', input('X'))).rejects.toMatchObject({ code: 'not-found' });
    expect(await exerciseService.listByWorkout(workoutId)).toEqual([]);
  });

  it('o banco também protege a integridade (FK e CHECK), mesmo fora do service', async () => {
    await expect(
      app.exerciseRepository.insert({ ...input('Órfão'), id: 'x', workoutId: 'nao-existe', createdAt: 'agora' }),
    ).rejects.toThrow(/FOREIGN KEY/);
    const e = await app.exercises.exerciseService.createExercise(workoutId, input('Supino'));
    const db = await app.database.getDatabase();
    await expect(db.runAsync('UPDATE exercises SET weight = -5 WHERE id = ?', [e.id])).rejects.toThrow(/CHECK/);
  });

  describe('reordenação', () => {
    let ids: string[];

    beforeEach(async () => {
      ids = [];
      for (const name of ['A', 'B', 'C', 'D']) {
        ids.push((await app.exercises.exerciseService.createExercise(workoutId, input(name))).id);
      }
      await app.exercises.exerciseService.createExercise(otherWorkoutId, input('Outro'));
    });

    const names = async (id = workoutId) => (await app.exercises.exerciseService.listByWorkout(id)).map((e) => e.name);

    it('persiste a nova ordem (sort_order 0..n-1) e a recupera após reiniciar', async () => {
      await app.exercises.exerciseService.reorderExercises(workoutId, [ids[3]!, ids[0]!, ids[1]!, ids[2]!]);
      app = await restartApp(app);
      const list = await app.exercises.exerciseService.listByWorkout(workoutId);
      expect(list.map((e) => e.name)).toEqual(['D', 'A', 'B', 'C']);
      expect(list.map((e) => e.sortOrder)).toEqual([0, 1, 2, 3]);
      expect(await names(otherWorkoutId)).toEqual(['Outro']);
    });

    it('recusa ordens inválidas sem alterar nada', async () => {
      const { exerciseService } = app.exercises;
      const other = (await exerciseService.listByWorkout(otherWorkoutId))[0]!.id;
      await expect(exerciseService.reorderExercises(workoutId, ids.slice(0, 3))).rejects.toMatchObject({ code: 'invalid-order' });
      await expect(exerciseService.reorderExercises(workoutId, [ids[0]!, ids[0]!, ids[1]!, ids[2]!])).rejects.toMatchObject({
        code: 'invalid-order',
      });
      await expect(exerciseService.reorderExercises(workoutId, [other, ids[1]!, ids[2]!, ids[3]!])).rejects.toMatchObject({
        code: 'invalid-order',
      });
      expect(await names()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('reordenações simultâneas são executadas em sequência (vence a última)', async () => {
      const { exerciseService } = app.exercises;
      await Promise.all([
        exerciseService.reorderExercises(workoutId, [ids[3]!, ids[2]!, ids[1]!, ids[0]!]),
        exerciseService.reorderExercises(workoutId, [ids[1]!, ids[0]!, ids[3]!, ids[2]!]),
        exerciseService.reorderExercises(workoutId, [ids[2]!, ids[3]!, ids[0]!, ids[1]!]),
      ]);
      expect(await names()).toEqual(['C', 'D', 'A', 'B']);
    });

    it('não altera a ordem de sessões já iniciadas (snapshot)', async () => {
      const { sessionId } = await app.sessions.sessionService.startSession(workoutId);
      await app.exercises.exerciseService.reorderExercises(workoutId, [ids[3]!, ids[2]!, ids[1]!, ids[0]!]);
      const details = await app.sessions.sessionService.getSessionDetails(sessionId);
      expect(details!.exercises.map((e) => e.exerciseNameSnapshot)).toEqual(['A', 'B', 'C', 'D']);
    });
  });
});
