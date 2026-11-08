import { parseSetActuals } from '@/features/sessions/services/session.service';

import { cleanupDatabases, closeApp, listDefaultWorkouts, restartApp, startApp, type TestApp } from '../../../../test/helpers/app';

describe('sessionService', () => {
  let app: TestApp;
  let workoutId: string;

  const allSets = (details: { exercises: { sets: { completedAt: string | null }[] }[] }) =>
    details.exercises.flatMap((exercise) => exercise.sets);

  beforeEach(async () => {
    app = startApp();
    workoutId = (await listDefaultWorkouts(app))[0]!.id;
  });
  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  async function addPlan() {
    const { exerciseService } = app.exercises;
    const supino = await exerciseService.createExercise(workoutId, { name: 'Supino reto', sets: 4, reps: 12, weightKg: 40, restSeconds: 90 });
    await exerciseService.createExercise(workoutId, { name: 'Crucifixo', sets: 3, reps: 12, weightKg: 15, restSeconds: 0 });
    return supino;
  }

  describe('parseSetActuals', () => {
    it('aceita repetições inteiras >= 0 e carga decimal >= 0 (vazia = 0)', () => {
      expect(parseSetActuals('10', '22,5')).toEqual({ ok: true, actuals: { actualReps: 10, actualWeightKg: 22.5 } });
      expect(parseSetActuals('0', '')).toEqual({ ok: true, actuals: { actualReps: 0, actualWeightKg: 0 } });
      expect(parseSetActuals('', '-2')).toEqual({ ok: false, errors: { actualReps: 'required', actualWeightKg: 'negative' } });
      expect(parseSetActuals('8.5', 'abc')).toEqual({ ok: false, errors: { actualReps: 'not-integer', actualWeightKg: 'invalid-number' } });
    });
  });

  it('não inicia um treino sem exercícios', async () => {
    await expect(app.sessions.sessionService.startSession(workoutId)).rejects.toMatchObject({ code: 'no-exercises' });
    await expect(app.sessions.sessionService.startSession('nao-existe')).rejects.toMatchObject({ code: 'workout-not-found' });
  });

  it('ao iniciar, copia (snapshot) exercícios e séries planejadas, sem valores reais', async () => {
    await addPlan();
    const { sessionId, resumed } = await app.sessions.sessionService.startSession(workoutId);
    expect(resumed).toBe(false);

    const details = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
    expect(details.session).toMatchObject({ status: 'in_progress', completedAt: null, workoutNameSnapshot: 'Treino A' });
    expect(details.exercises.map((e) => [e.exerciseNameSnapshot, e.plannedRestSeconds, e.sets.length])).toEqual([
      ['Supino reto', 90, 4],
      ['Crucifixo', 0, 3],
    ]);
    expect(details.exercises[0]!.sets[0]).toMatchObject({
      setNumber: 1,
      plannedReps: 12,
      plannedWeightKg: 40,
      actualReps: null,
      actualWeightKg: null,
      completedAt: null,
    });
  });

  it('nunca cria duas sessões simultâneas do mesmo treino (retoma a existente)', async () => {
    await addPlan();
    const first = await app.sessions.sessionService.startSession(workoutId);
    const second = await app.sessions.sessionService.startSession(workoutId);
    expect(second).toEqual({ sessionId: first.sessionId, resumed: true });

    // O próprio banco impede uma segunda sessão em andamento do mesmo treino.
    const db = await app.database.getDatabase();
    await expect(
      db.runAsync(
        "INSERT INTO workout_sessions (id, workout_id, workout_name_snapshot, started_at, status) VALUES ('dup', ?, 'x', 'agora', 'in_progress')",
        [workoutId],
      ),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('registra séries: concluir, corrigir, desmarcar; real separado do planejado', async () => {
    await addPlan();
    const { sessionId } = await app.sessions.sessionService.startSession(workoutId);
    const [s1, s2] = (await app.sessions.sessionService.getSessionDetails(sessionId))!.exercises[0]!.sets;
    const { sessionService } = app.sessions;

    const done = await sessionService.completeSet(s1!.id, { actualReps: 10, actualWeightKg: 42.5 });
    expect(done).toMatchObject({ actualReps: 10, actualWeightKg: 42.5, plannedReps: 12, plannedWeightKg: 40 });
    expect(done.completedAt).not.toBeNull();

    const fixed = await sessionService.saveSetActuals(s1!.id, { actualReps: 9, actualWeightKg: 42.5 });
    expect(fixed.actualReps).toBe(9);
    expect(fixed.completedAt).toBe(done.completedAt);

    await sessionService.completeSet(s2!.id, { actualReps: 8, actualWeightKg: 40 });
    const undone = await sessionService.uncompleteSet(s2!.id);
    expect(undone).toMatchObject({ completedAt: null, actualReps: 8 });

    await expect(sessionService.completeSet(s2!.id, { actualReps: -1, actualWeightKg: 0 })).rejects.toMatchObject({
      code: 'invalid-actuals',
    });
  });

  it('alterar o planejamento depois de iniciar não muda a sessão', async () => {
    const supino = await addPlan();
    const { sessionId } = await app.sessions.sessionService.startSession(workoutId);
    await app.exercises.exerciseService.updateExercise(supino.id, { name: 'Outro nome', sets: 1, reps: 1, weightKg: 999, restSeconds: 5 });
    await app.workouts.workoutService.renameWorkout(workoutId, 'Renomeado');

    const details = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
    expect(details.session.workoutNameSnapshot).toBe('Treino A');
    expect(details.exercises[0]).toMatchObject({ exerciseNameSnapshot: 'Supino reto', plannedRestSeconds: 90 });
    expect(details.exercises[0]!.sets).toHaveLength(4);
  });

  it('recupera a sessão em andamento após fechar o app, com séries e horário de início', async () => {
    await addPlan();
    const { sessionId } = await app.sessions.sessionService.startSession(workoutId);
    const first = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
    await app.sessions.sessionService.completeSet(first.exercises[0]!.sets[0]!.id, { actualReps: 12, actualWeightKg: 40 });

    app = await restartApp(app);

    const inProgress = await app.sessions.sessionService.listInProgressSessions();
    expect(inProgress.map((s) => s.id)).toEqual([sessionId]);
    const recovered = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
    expect(recovered.session.startedAt).toBe(first.session.startedAt);
    expect(allSets(recovered).filter((s) => s.completedAt !== null)).toHaveLength(1);
  });

  it('finaliza preservando todas as séries e bloqueia alterações posteriores', async () => {
    await addPlan();
    const { sessionId } = await app.sessions.sessionService.startSession(workoutId);
    const d = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
    await app.sessions.sessionService.completeSet(d.exercises[0]!.sets[0]!.id, { actualReps: 12, actualWeightKg: 40 });
    await app.sessions.sessionService.completeSet(d.exercises[1]!.sets[0]!.id, { actualReps: 12, actualWeightKg: 15 });

    const finished = await app.sessions.sessionService.finishSession(sessionId);
    expect(finished.session.status).toBe('completed');
    expect(finished.session.completedAt).not.toBeNull();
    expect(allSets(finished)).toHaveLength(7);

    const again = await app.sessions.sessionService.finishSession(sessionId);
    expect(again.session.completedAt).toBe(finished.session.completedAt);
    await expect(
      app.sessions.sessionService.completeSet(d.exercises[0]!.sets[1]!.id, { actualReps: 1, actualWeightKg: 1 }),
    ).rejects.toMatchObject({ code: 'session-not-editable' });
    expect(await app.sessions.sessionService.listInProgressSessions()).toEqual([]);

    const summary = app.sessions.computeSessionSummary(finished, 0);
    expect(summary).toMatchObject({ exercisesPerformed: 2, totalExercises: 2, completedSets: 2, plannedSets: 7 });

    // Com a anterior finalizada, uma nova sessão do mesmo treino é permitida.
    expect((await app.sessions.sessionService.startSession(workoutId)).resumed).toBe(false);
  });

  it('excluir o treino não apaga sessões nem histórico', async () => {
    await addPlan();
    const { sessionId } = await app.sessions.sessionService.startSession(workoutId);
    await app.sessions.sessionService.finishSession(sessionId);

    await app.workouts.workoutService.deleteWorkout(workoutId);

    const details = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
    expect(details.session.workoutId).toBeNull();
    expect(details.exercises[0]!.exerciseId).toBeNull();
    expect(details.exercises[0]!.exerciseNameSnapshot).toBe('Supino reto');
    expect(allSets(details)).toHaveLength(7);
  });

  it('sessão inexistente retorna null / erro claro', async () => {
    expect(await app.sessions.sessionService.getSessionDetails('nao-existe')).toBeNull();
    await expect(app.sessions.sessionService.finishSession('nao-existe')).rejects.toMatchObject({ code: 'session-not-found' });
  });
});
