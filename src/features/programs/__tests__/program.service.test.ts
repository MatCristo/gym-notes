import {
  cleanupDatabases,
  closeApp,
  defaultProgramId,
  restartApp,
  startApp,
  type TestApp,
} from '../../../../test/helpers/app';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const plan = (name: string, sets = 3, reps = 10, weightKg = 20, restSeconds = 60) => ({
  name,
  sets,
  reps,
  weightKg,
  restSeconds,
});

describe('programService', () => {
  let app: TestApp;

  beforeEach(() => {
    app = startApp();
  });
  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  const programs = () => app.programs.programService;
  const workouts = () => app.workouts.workoutService;
  const exercises = () => app.exercises.exerciseService;

  /** Contagem de linhas de todas as tabelas (para provar que nada mudou). */
  async function totals() {
    const db = await app.database.getDatabase();
    return db.getFirstAsync<Record<string, number>>(
      `SELECT (SELECT COUNT(*) FROM training_programs) AS p, (SELECT COUNT(*) FROM workouts) AS w,
              (SELECT COUNT(*) FROM exercises) AS e, (SELECT COUNT(*) FROM workout_sessions) AS s,
              (SELECT COUNT(*) FROM session_exercises) AS se, (SELECT COUNT(*) FROM set_logs) AS sl`,
    );
  }

  /** Planejamento "Hipertrofia" com 3 treinos e exercícios variados. */
  async function createHypertrophy() {
    const program = await programs().createProgram({ name: 'Hipertrofia', description: '4x por semana' });
    const a = await workouts().createWorkout(program.id, 'Treino A - Peito');
    const b = await workouts().createWorkout(program.id, 'Treino B - Costas');
    const c = await workouts().createWorkout(program.id, 'Treino C - Pernas');
    await exercises().createExercise(a.id, plan('Supino reto', 4, 12, 40, 90));
    await exercises().createExercise(a.id, plan('Crucifixo', 3, 15, 22.5, 0));
    await exercises().createExercise(b.id, plan('Remada', 4, 10, 50, 120));
    await exercises().createExercise(c.id, plan('Agachamento', 5, 5, 100, 180));
    await exercises().createExercise(c.id, plan('Leg press', 3, 12, 200, 90));
    return { program, a, b, c };
  }

  describe('validação', () => {
    it('normaliza espaços e recusa nome vazio, só espaços ou longo demais; descrição opcional', () => {
      const m = app.programs;
      expect(m.normalizeProgramName('  Hipertrofia  ')).toBe('Hipertrofia');
      expect(m.validateProgramName('')).toBe('empty');
      expect(m.validateProgramName('     ')).toBe('empty');
      expect(m.validateProgramName('x'.repeat(41))).toBe('too-long');
      expect(m.validateProgramName('x'.repeat(40))).toBeNull();
      expect(m.normalizeProgramDescription('   ')).toBeNull();
      expect(m.normalizeProgramDescription(undefined)).toBeNull();
      expect(m.normalizeProgramDescription('  foco em força ')).toBe('foco em força');
      expect(m.validateProgramDescription('x'.repeat(201))).toBe('too-long');
      expect(m.validateProgramDescription('x'.repeat(200))).toBeNull();
    });

    it('recusa criar ou renomear com dados inválidos sem gravar nada', async () => {
      const before = await totals();
      await expect(programs().createProgram({ name: '   ' })).rejects.toMatchObject({ code: 'invalid-name' });
      await expect(programs().createProgram({ name: 'Ok', description: 'x'.repeat(201) })).rejects.toMatchObject({
        code: 'invalid-description',
      });
      const id = await defaultProgramId(app);
      await expect(programs().updateProgram(id, { name: '' })).rejects.toMatchObject({ code: 'invalid-name' });
      expect(await totals()).toEqual(before);
      expect((await programs().getProgram(id))!.name).toBe('Meu planejamento');
    });
  });

  it('cria (UUID, nome normalizado, fim da lista), lista e persiste após reiniciar', async () => {
    const created = await programs().createProgram({ name: '  Treino em casa ', description: '   ' });
    expect(created.id).toMatch(UUID_V4);
    expect(created).toMatchObject({ name: 'Treino em casa', description: null, workoutCount: 0, sortOrder: 1 });

    app = await restartApp(app);
    expect((await programs().listPrograms()).map((p) => p.name)).toEqual(['Meu planejamento', 'Treino em casa']);
  });

  it('renomeia e altera a descrição mantendo createdAt; recusa ID inexistente', async () => {
    const created = await programs().createProgram({ name: 'Hipertrofia' });
    const updated = await programs().updateProgram(created.id, { name: ' Força ', description: ' 3x por semana ' });
    expect(updated).toMatchObject({ name: 'Força', description: '3x por semana', createdAt: created.createdAt });

    app = await restartApp(app);
    expect(await programs().getProgram(created.id)).toMatchObject({ name: 'Força', description: '3x por semana' });
    await expect(programs().updateProgram('nao-existe', { name: 'X' })).rejects.toMatchObject({ code: 'not-found' });
  });

  describe('treinos por planejamento', () => {
    it('lista só os treinos do planejamento e conta treinos por planejamento', async () => {
      const { program } = await createHypertrophy();
      const defaultId = await defaultProgramId(app);

      expect((await workouts().listWorkouts(program.id)).map((w) => w.name)).toEqual([
        'Treino A - Peito',
        'Treino B - Costas',
        'Treino C - Pernas',
      ]);
      expect((await workouts().listWorkouts(defaultId)).map((w) => w.name)).toEqual(['Treino A', 'Treino B', 'Treino C']);
      expect((await programs().listPrograms()).map((p) => [p.name, p.workoutCount])).toEqual([
        ['Meu planejamento', 3],
        ['Hipertrofia', 3],
      ]);
    });

    it('cria treinos no fim do próprio planejamento (ordem independente) e recusa planejamento inexistente', async () => {
      const home = await programs().createProgram({ name: 'Casa' });
      const first = await workouts().createWorkout(home.id, 'Treino 1');
      const second = await workouts().createWorkout(home.id, 'Treino 2');
      expect([first.sortOrder, second.sortOrder]).toEqual([0, 1]);
      expect(first.programId).toBe(home.id);

      const defaultId = await defaultProgramId(app);
      expect((await workouts().createWorkout(defaultId, 'Treino D')).sortOrder).toBe(3);

      await expect(workouts().createWorkout('nao-existe', 'X')).rejects.toMatchObject({ code: 'program-not-found' });
    });

    it('duplicar um treino mantém a cópia no mesmo planejamento, no fim da lista', async () => {
      const { program, a } = await createHypertrophy();
      const copy = await workouts().duplicateWorkout(a.id);
      expect(copy.programId).toBe(program.id);
      expect((await workouts().listWorkouts(program.id)).map((w) => w.name)).toEqual([
        'Treino A - Peito',
        'Treino B - Costas',
        'Treino C - Pernas',
        'Treino A - Peito (Cópia)',
      ]);
      expect(await workouts().listWorkouts(await defaultProgramId(app))).toHaveLength(3);
    });
  });

  describe('reordenação de treinos', () => {
    it('persiste a nova ordem (0..n-1) e a recupera após reiniciar', async () => {
      const { program, a, b, c } = await createHypertrophy();
      await workouts().reorderWorkouts(program.id, [c.id, a.id, b.id]);

      app = await restartApp(app);
      const reordered = await app.workouts.workoutService.listWorkouts(program.id);
      expect(reordered.map((w) => [w.id, w.sortOrder])).toEqual([
        [c.id, 0],
        [a.id, 1],
        [b.id, 2],
      ]);
    });

    it('não altera a ordem dos treinos de outro planejamento', async () => {
      const { program, a, b, c } = await createHypertrophy();
      const defaultId = await defaultProgramId(app);
      const before = await workouts().listWorkouts(defaultId);

      await workouts().reorderWorkouts(program.id, [b.id, c.id, a.id]);

      expect(await workouts().listWorkouts(defaultId)).toEqual(before);
    });

    it('recusa ordens inválidas (incompletas, repetidas ou com treino de outro planejamento) sem alterar nada', async () => {
      const { program, a, b, c } = await createHypertrophy();
      const [other] = await workouts().listWorkouts(await defaultProgramId(app));
      const before = await workouts().listWorkouts(program.id);

      for (const order of [[a.id, b.id], [a.id, a.id, b.id], [a.id, b.id, other!.id], [a.id, b.id, c.id, other!.id]]) {
        await expect(workouts().reorderWorkouts(program.id, order)).rejects.toMatchObject({ code: 'invalid-order' });
      }
      expect(await workouts().listWorkouts(program.id)).toEqual(before);
    });
  });

  describe('exclusão', () => {
    it('exclui um planejamento vazio', async () => {
      const empty = await programs().createProgram({ name: 'Vazio' });
      await programs().deleteProgram(empty.id);
      expect(await programs().getProgram(empty.id)).toBeNull();
      // Excluir de novo não é erro.
      await expect(programs().deleteProgram(empty.id)).resolves.toBeUndefined();
    });

    it('exclui o planejamento com treinos e exercícios, preservando histórico e outros planejamentos', async () => {
      const { program, a, c } = await createHypertrophy();
      const { sessionId } = await app.sessions.sessionService.startSession(a.id);
      const details = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
      await app.sessions.sessionService.completeSet(details.exercises[0]!.sets[0]!.id, {
        actualReps: 12,
        actualWeightKg: 42.5,
      });
      await app.sessions.sessionService.finishSession(sessionId);
      const defaultId = await defaultProgramId(app);

      await programs().deleteProgram(program.id);

      expect(await programs().getProgram(program.id)).toBeNull();
      expect(await workouts().listWorkouts(program.id)).toEqual([]);
      expect(await workouts().getWorkout(c.id)).toBeNull();
      expect(await exercises().listByWorkout(c.id)).toEqual([]);
      expect(await workouts().listWorkouts(defaultId)).toHaveLength(3);

      // Histórico, estatísticas e evolução continuam disponíveis.
      app = await restartApp(app);
      const history = await app.history.historyService.listCompletedSessions();
      expect(history.map((h) => [h.id, h.workoutName])).toEqual([[sessionId, 'Treino A - Peito']]);
      const kept = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
      expect(kept.session.workoutId).toBeNull();
      expect(kept.exercises[0]!.sets[0]).toMatchObject({ actualWeightKg: 42.5, actualReps: 12 });
      expect((await app.history.historyService.getExerciseProgress('Supino reto')).points).toHaveLength(1);
      expect((await app.history.historyService.getTrainingStats()).totalSessions).toBe(1);

      const db = await app.database.getDatabase();
      const orphans = await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM workouts w LEFT JOIN training_programs p ON p.id = w.program_id WHERE p.id IS NULL',
      );
      expect(orphans!.n).toBe(0);
    });

    it('bloqueia a exclusão se algum treino tiver sessão em andamento, sem remover nada', async () => {
      const { program, b } = await createHypertrophy();
      const { sessionId } = await app.sessions.sessionService.startSession(b.id);
      const before = await totals();

      await expect(programs().deleteProgram(program.id)).rejects.toMatchObject({ code: 'has-session-in-progress' });

      expect(await totals()).toEqual(before);
      expect(await app.sessions.sessionService.startSession(b.id)).toEqual({ sessionId, resumed: true });

      // Depois de finalizar o treino, a exclusão é permitida.
      await app.sessions.sessionService.finishSession(sessionId);
      await programs().deleteProgram(program.id);
      expect(await programs().getProgram(program.id)).toBeNull();
      expect(await app.history.historyService.listCompletedSessions()).toHaveLength(1);
    });

    it('sessão em andamento de outro planejamento não bloqueia a exclusão', async () => {
      const { program } = await createHypertrophy();
      const [defaultA] = await workouts().listWorkouts(await defaultProgramId(app));
      await exercises().createExercise(defaultA!.id, plan('Supino'));
      await app.sessions.sessionService.startSession(defaultA!.id);

      await expect(programs().deleteProgram(program.id)).resolves.toBeUndefined();
      expect(await app.sessions.sessionService.listInProgressSessions()).toHaveLength(1);
    });

    it('se falhar no meio, nada é removido (transação)', async () => {
      const { program } = await createHypertrophy();
      const before = await totals();
      const spy = jest.spyOn(app.programRepository, 'delete').mockRejectedValue(new Error('falha simulada'));

      await expect(programs().deleteProgram(program.id)).rejects.toThrow('falha simulada');
      spy.mockRestore();

      expect(await totals()).toEqual(before);
      expect(await workouts().listWorkouts(program.id)).toHaveLength(3);
    });
  });

  describe('duplicação', () => {
    it('copia planejamento, treinos e exercícios com novos UUIDs, mesma prescrição e mesma ordem', async () => {
      const { program, a, b, c } = await createHypertrophy();
      // Ordem personalizada para provar que a ordem (e não a criação) é copiada.
      await workouts().reorderWorkouts(program.id, [c.id, a.id, b.id]);
      const originalWorkouts = await workouts().listWorkouts(program.id);
      const prescription = async (workoutId: string) =>
        (await exercises().listByWorkout(workoutId)).map((e) => [e.name, e.sets, e.reps, e.weightKg, e.restSeconds, e.sortOrder]);

      const copy = await programs().duplicateProgram(program.id);

      expect(copy.id).toMatch(UUID_V4);
      expect(copy.id).not.toBe(program.id);
      expect(copy).toMatchObject({ name: 'Hipertrofia (Cópia)', description: '4x por semana', workoutCount: 3, sortOrder: 2 });

      const copiedWorkouts = await workouts().listWorkouts(copy.id);
      expect(copiedWorkouts.map((w) => [w.name, w.sortOrder])).toEqual(originalWorkouts.map((w) => [w.name, w.sortOrder]));
      const originalExerciseIds = new Set<string>();
      for (const w of originalWorkouts) for (const e of await exercises().listByWorkout(w.id)) originalExerciseIds.add(e.id);

      for (const [index, copied] of copiedWorkouts.entries()) {
        const original = originalWorkouts[index]!;
        expect(copied.id).toMatch(UUID_V4);
        expect(originalWorkouts.some((w) => w.id === copied.id)).toBe(false);
        expect(copied.programId).toBe(copy.id);
        expect(await prescription(copied.id)).toEqual(await prescription(original.id));
        for (const exercise of await exercises().listByWorkout(copied.id)) {
          expect(exercise.id).toMatch(UUID_V4);
          expect(originalExerciseIds.has(exercise.id)).toBe(false);
        }
      }
    });

    it('não copia sessões, séries registradas nem histórico', async () => {
      const { program, a } = await createHypertrophy();
      const { sessionId } = await app.sessions.sessionService.startSession(a.id);
      const details = (await app.sessions.sessionService.getSessionDetails(sessionId))!;
      await app.sessions.sessionService.completeSet(details.exercises[0]!.sets[0]!.id, { actualReps: 10, actualWeightKg: 60 });
      await app.sessions.sessionService.finishSession(sessionId);
      const historyBefore = await app.history.historyService.listCompletedSessions();
      const statsBefore = await app.history.historyService.getTrainingStats();
      const before = await totals();

      const copy = await programs().duplicateProgram(program.id);

      const after = await totals();
      expect(after).toEqual({ ...before!, p: before!.p! + 1, w: before!.w! + 3, e: before!.e! + 5 });
      expect(await app.history.historyService.listCompletedSessions()).toEqual(historyBefore);
      expect(await app.history.historyService.getTrainingStats()).toEqual(statsBefore);
      for (const w of await workouts().listWorkouts(copy.id)) {
        expect(await app.sessions.sessionService.getInProgressSessionForWorkout(w.id)).toBeNull();
      }
    });

    it('o original permanece inalterado e independente da cópia', async () => {
      const { program, a } = await createHypertrophy();
      const snapshot = async (id: string) => ({
        program: await programs().getProgram(id),
        workouts: await Promise.all(
          (await workouts().listWorkouts(id)).map(async (w) => ({ w, e: await exercises().listByWorkout(w.id) })),
        ),
      });
      const before = await snapshot(program.id);

      const copy = await programs().duplicateProgram(program.id);
      expect(await snapshot(program.id)).toEqual(before);

      // Alterar ou excluir a cópia não afeta o original.
      const [copiedA] = await workouts().listWorkouts(copy.id);
      const [copiedExercise] = await exercises().listByWorkout(copiedA!.id);
      await exercises().updateExercise(copiedExercise!.id, plan('Supino inclinado', 2, 8, 30));
      await programs().updateProgram(copy.id, { name: 'Hipertrofia 2' });
      await programs().deleteProgram(copy.id);
      expect(await snapshot(program.id)).toEqual(before);
      expect((await exercises().listByWorkout(a.id))[0]!.name).toBe('Supino reto');
    });

    it('se falhar no meio, não deixa cópia parcial (rollback integral)', async () => {
      const { program } = await createHypertrophy();
      const before = await totals();
      const realInsert = app.exerciseRepository.insert;
      let calls = 0;
      const spy = jest.spyOn(app.exerciseRepository, 'insert').mockImplementation(async (input) => {
        calls += 1;
        if (calls === 4) throw new Error('falha simulada');
        return realInsert.call(app.exerciseRepository, input);
      });

      await expect(programs().duplicateProgram(program.id)).rejects.toThrow('falha simulada');
      spy.mockRestore();

      expect(await totals()).toEqual(before);
      expect((await programs().listPrograms()).map((p) => p.name)).toEqual(['Meu planejamento', 'Hipertrofia']);
    });

    it('respeita o limite de 40 caracteres no nome da cópia e recusa ID inexistente', async () => {
      const long = await programs().createProgram({ name: 'x'.repeat(40) });
      const copy = await programs().duplicateProgram(long.id);
      expect(copy.name).toHaveLength(40);
      expect(copy.name.endsWith(' (Cópia)')).toBe(true);
      await expect(programs().duplicateProgram('nao-existe')).rejects.toMatchObject({ code: 'not-found' });
    });
  });
});
