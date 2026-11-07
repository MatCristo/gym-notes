import { cleanupDatabases, closeApp, localIso, restartApp, startApp, type TestApp } from '../../../../test/helpers/app';

type SetPlan = ({ actualReps: number; actualWeightKg: number } | null)[];

/** "Agora" fixo: sábado, 07/11/2026 12:00 (America/Sao_Paulo). */
const NOW = new Date(2026, 10, 7, 12, 0).getTime();

describe('historyService', () => {
  let app: TestApp;
  let ids: { A: string; B: string; s1: string; s2: string; s3: string; s4: string; live: string };

  /** Executa e finaliza uma sessão com as séries indicadas; depois fixa as datas para o cenário. */
  async function runSession(workoutId: string, plan: SetPlan[], startedAt: string, minutes: number) {
    const { sessionService } = app.sessions;
    const { sessionId } = await sessionService.startSession(workoutId);
    const details = (await sessionService.getSessionDetails(sessionId))!;
    for (const [exerciseIndex, sets] of plan.entries()) {
      for (const [setIndex, actual] of sets.entries()) {
        if (actual) await sessionService.completeSet(details.exercises[exerciseIndex]!.sets[setIndex]!.id, actual);
      }
    }
    await sessionService.finishSession(sessionId);
    const db = await app.database.getDatabase();
    const end = new Date(Date.parse(startedAt) + minutes * 60_000).toISOString();
    await db.runAsync('UPDATE workout_sessions SET started_at = ?, completed_at = ? WHERE id = ?', [startedAt, end, sessionId]);
    return sessionId;
  }

  beforeEach(async () => {
    app = startApp();
    const [A, B] = await app.workouts.workoutService.listWorkouts();
    const { exerciseService } = app.exercises;
    await exerciseService.createExercise(A!.id, { name: 'Supino reto', sets: 3, reps: 10, weightKg: 100, restSeconds: 90 });
    await exerciseService.createExercise(A!.id, { name: 'Flexão', sets: 2, reps: 15, weightKg: 0, restSeconds: 60 });
    // Mesmo exercício em outro treino, com grafia diferente.
    await exerciseService.createExercise(B!.id, { name: 'supino  RETO', sets: 2, reps: 8, weightKg: 100, restSeconds: 90 });

    const s1 = await runSession(A!.id, [[{ actualReps: 10, actualWeightKg: 40 }, { actualReps: 9, actualWeightKg: 42.5 }, null], [{ actualReps: 15, actualWeightKg: 0 }]], localIso(2026, 5, 20), 50);
    const s2 = await runSession(A!.id, [[{ actualReps: 10, actualWeightKg: 45 }, { actualReps: 8, actualWeightKg: 50 }, { actualReps: 0, actualWeightKg: 80 }], []], localIso(2026, 9, 1), 61);
    const s3 = await runSession(B!.id, [[{ actualReps: 6, actualWeightKg: 55 }, { actualReps: 8, actualWeightKg: 47.5 }]], localIso(2026, 10, 20), 40);
    const s4 = await runSession(A!.id, [[{ actualReps: 10, actualWeightKg: 50 }, { actualReps: 10, actualWeightKg: 50 }, null], [null, null]], localIso(2026, 11, 3), 45);

    // Sessão em andamento: uma série concluída (300 kg) e um rascunho não concluído (200 kg).
    const { sessionService } = app.sessions;
    const live = await sessionService.startSession(A!.id);
    const liveDetails = (await sessionService.getSessionDetails(live.sessionId))!;
    await sessionService.saveSetActuals(liveDetails.exercises[0]!.sets[0]!.id, { actualReps: 1, actualWeightKg: 200 });
    await sessionService.completeSet(liveDetails.exercises[0]!.sets[1]!.id, { actualReps: 5, actualWeightKg: 300 });

    ids = { A: A!.id, B: B!.id, s1, s2, s3, s4, live: live.sessionId };
  });
  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  describe('histórico de sessões', () => {
    it('lista só sessões concluídas, da mais recente para a mais antiga, com os totais corretos', async () => {
      const list = await app.history.historyService.listCompletedSessions();
      expect(list.map((s) => s.id)).toEqual([ids.s4, ids.s3, ids.s2, ids.s1]);
      expect(list.some((s) => s.id === ids.live)).toBe(false);
      expect(
        list.map((s) => [s.workoutName, Math.round(s.durationMs / 60_000), s.exercisesPerformed, s.totalExercises, s.completedSets, s.plannedSets]),
      ).toEqual([
        ['Treino A', 45, 1, 2, 2, 5],
        ['Treino B', 40, 1, 1, 2, 2],
        ['Treino A', 61, 1, 2, 3, 5],
        ['Treino A', 50, 2, 2, 3, 5],
      ]);
    });

    it('não muda quando o treino atual é editado, renomeado ou excluído (após reiniciar)', async () => {
      const exercises = await app.exercises.exerciseService.listByWorkout(ids.A);
      await app.exercises.exerciseService.updateExercise(exercises[0]!.id, { name: 'Supino máquina', sets: 5, reps: 5, weightKg: 999, restSeconds: 10 });
      await app.workouts.workoutService.renameWorkout(ids.A, 'Treino A — novo');
      app = await restartApp(app);
      await app.workouts.workoutService.deleteWorkout(ids.A);

      const details = (await app.sessions.sessionService.getSessionDetails(ids.s1))!;
      expect(details.session.workoutNameSnapshot).toBe('Treino A');
      expect(details.exercises.map((e) => e.exerciseNameSnapshot)).toEqual(['Supino reto', 'Flexão']);
      expect(details.exercises[0]!.sets.map((s) => [s.plannedWeightKg, s.actualWeightKg, s.completedAt !== null])).toEqual([
        [100, 40, true],
        [100, 42.5, true],
        [100, null, false],
      ]);
      expect(await app.history.historyService.listCompletedSessions()).toHaveLength(4);
    });
  });

  describe('estatísticas', () => {
    it('calcula totais, semanas (começando na segunda), meses e média semanal a partir dos registros', async () => {
      const list = await app.history.historyService.listCompletedSessions();
      const stats = app.history.computeTrainingStats(list, NOW);

      expect(stats.totalSessions).toBe(4);
      expect(stats.totalCompletedSets).toBe(10);
      expect(Math.round(stats.totalDurationMs / 60_000)).toBe(196);
      expect(stats.weekly).toHaveLength(8);
      expect(new Date(stats.weekly[7]!.start).getDay()).toBe(1);
      expect(stats.weekly.map((w) => w.count)).toEqual([0, 0, 0, 0, 0, 1, 0, 1]);
      expect(stats.monthly.map((m) => [new Date(m.start).getMonth() + 1, m.count])).toEqual([
        [6, 0],
        [7, 0],
        [8, 0],
        [9, 1],
        [10, 1],
        [11, 1],
      ]);
      expect(stats.weeklyAverage).toBe(0.5);
    });

    it('sem sessões, tudo é zero (sem valores inventados)', () => {
      const stats = app.history.computeTrainingStats([], NOW);
      expect(stats).toMatchObject({ totalSessions: 0, totalCompletedSets: 0, totalDurationMs: 0, weeklyAverage: 0 });
      expect(stats.weekly.every((w) => w.count === 0)).toBe(true);
    });
  });

  describe('evolução de cargas', () => {
    it('usa só séries concluídas com carga e repetições reais, agrupando pelo nome', async () => {
      const progress = await app.history.historyService.getExerciseProgress('Supino Reto');
      expect(progress.key).toBe('supino reto');
      expect(progress.points.map((p) => [p.sessionId, p.topWeightKg, p.topWeightReps, p.sets.length])).toEqual([
        [ids.s1, 42.5, 9, 2],
        [ids.s2, 50, 8, 2], // 80 kg × 0 repetições não conta
        [ids.s3, 55, 6, 2], // outro treino, grafia diferente → mesmo exercício
        [ids.s4, 50, 10, 2],
      ]);
      // Nada de planejado (100 kg), rascunho (200 kg) ou sessão em andamento (300 kg).
      const weights = progress.points.flatMap((p) => p.sets.map((s) => s.weightKg));
      expect(weights).not.toContain(100);
      expect(weights).not.toContain(200);
      expect(weights).not.toContain(300);
    });

    it('maior carga = maior peso concluído; última carga = série mais pesada da sessão mais recente', async () => {
      const { points } = await app.history.historyService.getExerciseProgress('supino reto');
      expect(app.history.getMaxWeight(points)).toEqual({ weightKg: 55, reps: 6, date: localIso(2026, 10, 20) });
      expect(app.history.getLastWeight(points)).toEqual({ weightKg: 50, reps: 10, date: localIso(2026, 11, 3) });
    });

    it('filtra por período: 30 dias, 90 dias, 6 meses e tudo', async () => {
      const { points } = await app.history.historyService.getExerciseProgress('Supino reto');
      const filter = (period: '30d' | '90d' | '6m' | 'all') =>
        app.history.filterPointsByPeriod(points, period, NOW).map((p) => p.topWeightKg);
      expect(filter('30d')).toEqual([55, 50]);
      expect(filter('90d')).toEqual([50, 55, 50]);
      expect(filter('6m')).toEqual([42.5, 50, 55, 50]);
      expect(filter('all')).toEqual([42.5, 50, 55, 50]);
    });

    it('sem registros válidos não inventa resultados', async () => {
      const bodyweight = await app.history.historyService.getExerciseProgress('Flexão');
      expect(bodyweight.points).toEqual([]);
      expect(app.history.getMaxWeight(bodyweight.points)).toBeNull();
      expect(app.history.getLastWeight(bodyweight.points)).toBeNull();
      expect((await app.history.historyService.getExerciseProgress('Nunca feito')).points).toEqual([]);
    });

    it('a sessão em andamento passa a contar só depois de finalizada, e o rascunho nunca conta', async () => {
      await app.sessions.sessionService.finishSession(ids.live);
      const { points } = await app.history.historyService.getExerciseProgress('Supino reto');
      expect(app.history.getMaxWeight(points)!.weightKg).toBe(300);
      expect(points.flatMap((p) => p.sets.map((s) => s.weightKg))).not.toContain(200);
    });

    it('lista os exercícios já executados com última carga e número de sessões', async () => {
      const entries = await app.history.historyService.listPerformedExercises();
      expect(entries.map((e) => [e.key, e.sessionsCount, e.lastTopWeightKg])).toEqual([
        ['supino reto', 4, 50],
        ['flexão', 1, null],
      ]);
    });
  });
});
