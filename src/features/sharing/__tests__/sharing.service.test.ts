/// <reference types="node" />
import { Buffer } from 'node:buffer';

import { decodeShareCode } from '@/features/sharing/utils/share-codec';

import { cleanupDatabases, closeApp, startApp, type TestApp } from '../../../../test/helpers/app';

const CODE_FORMAT = /^GN1:[A-Za-z0-9+/]+\.[0-9a-f]{8}$/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const plan = (name: string, sets: number, reps: number, weightKg: number, restSeconds: number) => ({
  name,
  sets,
  reps,
  weightKg,
  restSeconds,
});

/**
 * Decodifica o código SEM usar o codec do app (Buffer do Node), para inspecionar o JSON
 * exatamente como qualquer pessoa que recebesse o código conseguiria.
 */
function rawPayloadJson(code: string): string {
  const match = /^GN1:([A-Za-z0-9+/]+)\.([0-9a-f]{8})$/.exec(code);
  if (!match) throw new Error('código fora do formato');
  return Buffer.from(match[1]!, 'base64').toString('utf8');
}

/** Todas as chaves de objetos presentes no JSON, em qualquer nível. */
function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

describe('sharingService.exportProgram', () => {
  let app: TestApp;

  beforeEach(() => {
    app = startApp();
  });
  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  const service = () => app.sharing.sharingService;

  /** "Hipertrofia": 3 treinos (um sem exercícios) com ordem personalizada de treinos e exercícios. */
  async function createHypertrophy() {
    const { programService } = app.programs;
    const { workoutService } = app.workouts;
    const { exerciseService } = app.exercises;
    const program = await programService.createProgram({ name: 'Hipertrofia', description: '4x por semana' });
    const a = await workoutService.createWorkout(program.id, 'Treino A - Peito');
    const b = await workoutService.createWorkout(program.id, 'Treino B - Costas');
    const c = await workoutService.createWorkout(program.id, 'Treino C - Mobilidade');
    const supino = await exerciseService.createExercise(a.id, plan('Supino reto', 4, 12, 40, 90));
    const crucifixo = await exerciseService.createExercise(a.id, plan('Crucifixo', 3, 15, 22.5, 0));
    const flexao = await exerciseService.createExercise(a.id, plan('Flexão', 2, 20, 0, 45));
    await exerciseService.createExercise(b.id, plan('Remada curvada', 4, 10, 50, 120));
    // Ordem definida pelo usuário (diferente da ordem de criação).
    await workoutService.reorderWorkouts(program.id, [b.id, a.id, c.id]);
    await exerciseService.reorderExercises(a.id, [flexao.id, supino.id, crucifixo.id]);
    return { program, a, b, c, supino };
  }

  it('exporta vários treinos e exercícios preservando ordem e prescrição; o codec decodifica o código', async () => {
    const { program } = await createHypertrophy();

    const exported = await service().exportProgram(program.id);

    expect(exported).toMatchObject({ programName: 'Hipertrofia', workoutCount: 3, exerciseCount: 4 });
    expect(exported.code).toMatch(CODE_FORMAT);
    expect(decodeShareCode(exported.code)).toEqual({
      ok: true,
      value: {
        name: 'Hipertrofia',
        description: '4x por semana',
        workouts: [
          { name: 'Treino B - Costas', exercises: [plan('Remada curvada', 4, 10, 50, 120)] },
          {
            name: 'Treino A - Peito',
            exercises: [plan('Flexão', 2, 20, 0, 45), plan('Supino reto', 4, 12, 40, 90), plan('Crucifixo', 3, 15, 22.5, 0)],
          },
          { name: 'Treino C - Mobilidade', exercises: [] },
        ],
      },
    });
  });

  it('o payload tem exatamente o formato GN1 (tuplas na ordem), sem descrição quando não houver', async () => {
    const { programService } = app.programs;
    const program = await programService.createProgram({ name: 'Casa 💪 & Glúteos' });
    const w = await app.workouts.workoutService.createWorkout(program.id, 'Treino único');
    await app.exercises.exerciseService.createExercise(w.id, plan('Agachamento búlgaro', 3, 10, 7.5, 60));

    const { code } = await service().exportProgram(program.id);

    expect(JSON.parse(rawPayloadJson(code))).toEqual({
      v: 1,
      p: { n: 'Casa 💪 & Glúteos', w: [{ n: 'Treino único', e: [['Agachamento búlgaro', 3, 10, 7.5, 60]] }] },
    });
  });

  it('privacidade: nenhum dado de execução, histórico, ID ou timestamp aparece no código', async () => {
    const { program, a, b, supino } = await createHypertrophy();
    const { sessionService } = app.sessions;

    // Sessão CONCLUÍDA com cargas e repetições marcantes.
    const done = await sessionService.startSession(a.id);
    const doneDetails = (await sessionService.getSessionDetails(done.sessionId))!;
    for (const set of doneDetails.exercises.flatMap((exercise) => exercise.sets)) {
      await sessionService.completeSet(set.id, { actualReps: 77, actualWeightKg: 987.5 });
    }
    await sessionService.finishSession(done.sessionId);

    // Sessão EM ANDAMENTO: uma série concluída e um rascunho não concluído.
    const live = await sessionService.startSession(b.id);
    const liveSets = (await sessionService.getSessionDetails(live.sessionId))!.exercises.flatMap((e) => e.sets);
    await sessionService.completeSet(liveSets[0]!.id, { actualReps: 66, actualWeightKg: 876.25 });
    await sessionService.saveSetActuals(liveSets[1]!.id, { actualReps: 55, actualWeightKg: 765.75 });

    // Os dados pessoais existem de fato no app...
    expect((await app.history.historyService.getExerciseProgress('Supino reto')).points[0]).toMatchObject({
      topWeightKg: 987.5,
    });

    const { code } = await service().exportProgram(program.id);
    const json = rawPayloadJson(code);
    const payload = JSON.parse(json) as { p: { w: { e: unknown[][] }[] } };

    // ...mas nenhum aparece no código.
    for (const marker of ['987.5', '987,5', '876.25', '765.75', '77', '66', '55']) expect(json).not.toContain(marker);
    expect(json).not.toMatch(UUID);
    expect(json).not.toMatch(ISO_TIMESTAMP);
    for (const id of [program.id, a.id, b.id, supino.id, done.sessionId, live.sessionId]) expect(json).not.toContain(id);
    expect(json).not.toMatch(/in_progress|completed|session|actual|history|sort|created|updated|status|record|stat/i);

    // Somente as chaves permitidas, em qualquer nível; cada exercício é uma tupla de 5 posições.
    expect([...collectKeys(payload)].sort()).toEqual(['d', 'e', 'n', 'p', 'v', 'w']);
    for (const workout of payload.p.w) for (const tuple of workout.e) expect(tuple).toHaveLength(5);
    // A prescrição continua sendo a planejada (40 kg), não a realizada.
    expect(payload.p.w[1]!.e[1]).toEqual(['Supino reto', 4, 12, 40, 90]);
  });

  it('é somente leitura: não altera banco, planejamento, sessões ou histórico', async () => {
    const { program, a } = await createHypertrophy();
    const { sessionId } = await app.sessions.sessionService.startSession(a.id);
    const db = await app.database.getDatabase();
    const snapshot = async () => ({
      totals: await db.getFirstAsync(
        `SELECT (SELECT COUNT(*) FROM training_programs) AS p, (SELECT COUNT(*) FROM workouts) AS w,
                (SELECT COUNT(*) FROM exercises) AS e, (SELECT COUNT(*) FROM workout_sessions) AS s,
                (SELECT COUNT(*) FROM set_logs) AS sl`,
      ),
      program: await app.programs.programService.getProgram(program.id),
      workouts: await app.workouts.workoutService.listWorkouts(program.id),
      session: await app.sessions.sessionService.getSessionDetails(sessionId),
    });
    const before = await snapshot();

    await service().exportProgram(program.id);
    await service().exportProgram(program.id);

    expect(await snapshot()).toEqual(before);
  });

  it('exportar duas vezes gera o mesmo código (determinístico)', async () => {
    const { program } = await createHypertrophy();
    expect((await service().exportProgram(program.id)).code).toBe((await service().exportProgram(program.id)).code);
  });

  it('planejamento inexistente → program-not-found', async () => {
    await expect(service().exportProgram('nao-existe')).rejects.toMatchObject({
      name: 'SharingServiceError',
      code: 'program-not-found',
    });
  });

  it('planejamento sem treinos → no-workouts', async () => {
    const empty = await app.programs.programService.createProgram({ name: 'Vazio' });
    await expect(service().exportProgram(empty.id)).rejects.toMatchObject({ code: 'no-workouts' });

    // Também quando todos os treinos foram excluídos.
    const w = await app.workouts.workoutService.createWorkout(empty.id, 'Treino A');
    await expect(service().exportProgram(empty.id)).resolves.toMatchObject({ workoutCount: 1, exerciseCount: 0 });
    await app.workouts.workoutService.deleteWorkout(w.id);
    await expect(service().exportProgram(empty.id)).rejects.toMatchObject({ code: 'no-workouts' });
  });

  it('acima dos limites do formato (51 treinos ou 101 exercícios) → exceeds-limits', async () => {
    const { programService } = app.programs;
    const { workoutService } = app.workouts;
    const many = await programService.createProgram({ name: 'Muitos treinos' });
    for (let i = 1; i <= 50; i += 1) await workoutService.createWorkout(many.id, `Treino ${i}`);
    await expect(service().exportProgram(many.id)).resolves.toMatchObject({ workoutCount: 50 });
    await workoutService.createWorkout(many.id, 'Treino 51');
    await expect(service().exportProgram(many.id)).rejects.toMatchObject({ code: 'exceeds-limits' });

    const big = await programService.createProgram({ name: 'Treino enorme' });
    const w = await workoutService.createWorkout(big.id, 'Treino A');
    for (let i = 1; i <= 101; i += 1) {
      await app.exercises.exerciseService.createExercise(w.id, plan(`Exercício ${i}`, 3, 10, 20, 60));
    }
    await expect(service().exportProgram(big.id)).rejects.toMatchObject({ code: 'exceeds-limits' });
  });

  it('código acima de 100 KB → too-large', async () => {
    const program = await app.programs.programService.createProgram({ name: 'Gigante' });
    const name = 'x'.repeat(60);
    await app.database.runInTransaction(async () => {
      for (let w = 0; w < 50; w += 1) {
        const workout = await app.workouts.workoutService.createWorkout(program.id, `Treino ${w}`);
        for (let e = 0; e < 100; e += 1) {
          await app.exerciseRepository.insert({
            id: `ex-${w}-${e}`,
            workoutId: workout.id,
            createdAt: '2026-01-01T00:00:00.000Z',
            ...plan(name, 99, 999, 9999, 3600),
          });
        }
      }
    });
    await expect(service().exportProgram(program.id)).rejects.toMatchObject({ code: 'too-large' });
  });

  it('o serviço expõe somente exportação, prévia e importação', () => {
    expect(Object.keys(service())).toEqual(['exportProgram', 'previewImport', 'importProgram']);
  });
});
