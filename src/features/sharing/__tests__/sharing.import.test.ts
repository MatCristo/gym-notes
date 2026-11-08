import type { ProgramStructure } from '@/features/programs/types/program.types';
import { base64Encode, crc32Hex, decodeShareCode, encodeShareCode, utf8Encode } from '@/features/sharing/utils/share-codec';

import { cleanupDatabases, closeApp, restartApp, startApp, type TestApp } from '../../../../test/helpers/app';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ex = (name: string, sets: number, reps: number, weightKg: number, restSeconds: number) => ({
  name,
  sets,
  reps,
  weightKg,
  restSeconds,
});

const shared: ProgramStructure = {
  name: 'Força 💪 Total',
  description: 'Enviado por um amigo',
  workouts: [
    { name: 'Treino A - Peito', exercises: [ex('Supino reto', 4, 12, 40, 90), ex('Crucifixo', 3, 15, 22.5, 0)] },
    { name: 'Treino B - Mobilidade', exercises: [] },
    {
      name: 'Treino C - Pernas',
      exercises: [ex('Agachamento', 5, 5, 100, 180), ex('Leg press', 3, 12, 200, 90), ex('Panturrilha', 4, 20, 0, 30)],
    },
  ],
};

function codeOf(structure: ProgramStructure): string {
  const result = encodeShareCode(structure);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** Envelope GN1 íntegro (Base64 + CRC corretos) a partir de qualquer JSON. */
function envelopeOf(json: string): string {
  const bytes = utf8Encode(json);
  return `GN1:${base64Encode(bytes)}.${crc32Hex(bytes)}`;
}

describe('sharingService: prévia e importação', () => {
  let app: TestApp;

  beforeEach(() => {
    app = startApp();
  });
  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  const service = () => app.sharing.sharingService;
  const programs = () => app.programs.programService;

  /** Estrutura de um planejamento lida do banco (via exportação + decodificação). */
  async function structureOf(programId: string): Promise<ProgramStructure> {
    const decoded = decodeShareCode((await service().exportProgram(programId)).code);
    if (!decoded.ok) throw new Error(decoded.error);
    return decoded.value;
  }

  /** Cópia completa de TODAS as tabelas (para provar que nada existente mudou). */
  async function dumpAll() {
    const db = await app.database.getDatabase();
    const all = (table: string) => db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
    return {
      programs: await all('training_programs'),
      workouts: await all('workouts'),
      exercises: await all('exercises'),
      sessions: await all('workout_sessions'),
      sessionExercises: await all('session_exercises'),
      setLogs: await all('set_logs'),
    };
  }

  /** Cenário com dados reais: "Meu planejamento" com sessão concluída e outra em andamento. */
  async function seedHistory() {
    const [a, b] = await app.workouts.workoutService.listWorkouts((await programs().listPrograms())[0]!.id);
    const { exerciseService } = app.exercises;
    const { sessionService } = app.sessions;
    await exerciseService.createExercise(a!.id, ex('Supino reto', 3, 10, 60, 90));
    await exerciseService.createExercise(b!.id, ex('Remada', 3, 10, 50, 90));
    const done = await sessionService.startSession(a!.id);
    for (const set of (await sessionService.getSessionDetails(done.sessionId))!.exercises.flatMap((e) => e.sets)) {
      await sessionService.completeSet(set.id, { actualReps: 10, actualWeightKg: 987.5 });
    }
    await sessionService.finishSession(done.sessionId);
    const live = await sessionService.startSession(b!.id);
    const [firstLiveSet] = (await sessionService.getSessionDetails(live.sessionId))!.exercises[0]!.sets;
    await sessionService.completeSet(firstLiveSet!.id, { actualReps: 8, actualWeightKg: 55 });
    return { doneId: done.sessionId, liveId: live.sessionId, workoutB: b! };
  }

  describe('importação', () => {
    it('cria um planejamento novo no fim da lista, com estrutura e prescrições idênticas', async () => {
      const startedAt = new Date().toISOString();

      const created = await service().importProgram(codeOf(shared));

      expect(created).toMatchObject({ name: 'Força 💪 Total', description: 'Enviado por um amigo', workoutCount: 3 });
      expect(created.id).toMatch(UUID_V4);
      expect(created.createdAt >= startedAt).toBe(true);
      expect((await programs().listPrograms()).map((p) => p.name)).toEqual(['Meu planejamento', 'Força 💪 Total']);
      expect(await structureOf(created.id)).toEqual(shared);
    });

    it('preserva a ordem (sort_order 0..n-1) e importa treino sem exercícios; persiste após reiniciar', async () => {
      const created = await service().importProgram(codeOf(shared));
      app = await restartApp(app);

      const workouts = await app.workouts.workoutService.listWorkouts(created.id);
      expect(workouts.map((w) => [w.name, w.sortOrder, w.exerciseCount])).toEqual([
        ['Treino A - Peito', 0, 2],
        ['Treino B - Mobilidade', 1, 0],
        ['Treino C - Pernas', 2, 3],
      ]);
      const legs = await app.exercises.exerciseService.listByWorkout(workouts[2]!.id);
      expect(legs.map((e) => [e.name, e.sortOrder, e.sets, e.reps, e.weightKg, e.restSeconds])).toEqual([
        ['Agachamento', 0, 5, 5, 100, 180],
        ['Leg press', 1, 3, 12, 200, 90],
        ['Panturrilha', 2, 4, 20, 0, 30],
      ]);
    });

    it('gera UUIDs e timestamps novos para tudo e ignora IDs/datas presentes no código', async () => {
      const code = envelopeOf(
        JSON.stringify({
          v: 1,
          id: '11111111-1111-4111-8111-111111111111',
          p: {
            n: 'Plano com lixo',
            id: '22222222-2222-4222-8222-222222222222',
            createdAt: '2001-01-01T00:00:00.000Z',
            w: [{ n: 'Treino A', id: '33333333-3333-4333-8333-333333333333', e: [['Supino', 3, 10, 20, 60]] }],
          },
        }),
      );
      const startedAt = new Date().toISOString();

      const created = await service().importProgram(code);

      const [workout] = await app.workouts.workoutService.listWorkouts(created.id);
      const [exercise] = await app.exercises.exerciseService.listByWorkout(workout!.id);
      for (const record of [created, workout!, exercise!]) {
        expect(record.id).toMatch(UUID_V4);
        expect(record.createdAt >= startedAt).toBe(true);
        expect(record.updatedAt).toBe(record.createdAt);
      }
      const json = JSON.stringify(await dumpAll());
      expect(json).not.toMatch(/11111111|22222222|33333333|2001-01-01/);
    });

    it('importa planejamento com vários treinos (até o limite de 50)', async () => {
      const many: ProgramStructure = {
        name: 'Muitos treinos',
        description: null,
        workouts: Array.from({ length: 50 }, (_, i) => ({ name: `Treino ${i + 1}`, exercises: [ex(`Ex ${i + 1}`, 3, 10, i, 60)] })),
      };
      const created = await service().importProgram(codeOf(many));
      expect(created.workoutCount).toBe(50);
      expect(await structureOf(created.id)).toEqual(many);
    });

    it('não importa histórico nem cria sessões; dados existentes ficam idênticos', async () => {
      const { doneId, liveId, workoutB } = await seedHistory();
      const before = await dumpAll();
      const historyBefore = await app.history.historyService.listCompletedSessions();
      const statsBefore = await app.history.historyService.getTrainingStats(Date.parse('2026-12-01'));
      const progressBefore = await app.history.historyService.getExerciseProgress('Supino reto');

      const created = await service().importProgram(codeOf(shared));

      const after = await dumpAll();
      // Tudo que existia continua exatamente igual (linha a linha)...
      const createdIds = new Set([created.id]);
      expect(after.programs.filter((row) => !createdIds.has((row as { id: string }).id))).toEqual(before.programs);
      expect(after.workouts.filter((row) => (row as { program_id: string }).program_id !== created.id)).toEqual(
        before.workouts,
      );
      // ...e nenhuma sessão, série ou histórico foi criado ou alterado.
      expect(after.sessions).toEqual(before.sessions);
      expect(after.sessionExercises).toEqual(before.sessionExercises);
      expect(after.setLogs).toEqual(before.setLogs);
      expect(after.exercises.length - before.exercises.length).toBe(5);
      expect(await app.history.historyService.listCompletedSessions()).toEqual(historyBefore);
      expect(await app.history.historyService.getTrainingStats(Date.parse('2026-12-01'))).toEqual(statsBefore);
      expect(await app.history.historyService.getExerciseProgress('Supino reto')).toEqual(progressBefore);

      // A sessão em andamento continua retomável e a concluída continua no histórico.
      expect(await app.sessions.sessionService.startSession(workoutB.id)).toEqual({ sessionId: liveId, resumed: true });
      expect((await app.sessions.sessionService.getSessionDetails(doneId))!.session.status).toBe('completed');
      for (const workout of await app.workouts.workoutService.listWorkouts(created.id)) {
        expect(await app.sessions.sessionService.getInProgressSessionForWorkout(workout.id)).toBeNull();
      }
    });
  });

  describe('nomes duplicados', () => {
    it('importar o mesmo código várias vezes cria planejamentos independentes com nomes únicos', async () => {
      const code = codeOf(shared);
      const first = await service().importProgram(code);
      const second = await service().importProgram(code);
      const third = await service().importProgram(code);

      expect([first.name, second.name, third.name]).toEqual([
        'Força 💪 Total',
        'Força 💪 Total (Importado)',
        'Força 💪 Total (Importado 2)',
      ]);
      expect(new Set([first.id, second.id, third.id]).size).toBe(3);
      for (const program of [first, second, third]) expect(await structureOf(program.id)).toEqual({ ...shared, name: program.name });

      // Independentes: alterar ou excluir uma cópia não afeta as outras.
      const [secondA] = await app.workouts.workoutService.listWorkouts(second.id);
      const [secondSupino] = await app.exercises.exerciseService.listByWorkout(secondA!.id);
      await app.exercises.exerciseService.updateExercise(secondSupino!.id, ex('Supino inclinado', 2, 8, 30, 60));
      await programs().deleteProgram(third.id);
      expect(await structureOf(first.id)).toEqual(shared);
    });

    it('compara com a normalização do projeto (trim) e não toca no planejamento homônimo', async () => {
      const existing = await programs().createProgram({ name: 'Força 💪 Total', description: 'meu' });
      const created = await service().importProgram(codeOf({ ...shared, name: '  Força 💪 Total  ' }));
      expect(created.name).toBe('Força 💪 Total (Importado)');
      expect(await programs().getProgram(existing.id)).toEqual(existing);
    });

    it('o nome alternativo respeita 40 caracteres, inclusive com variações e emoji no corte', async () => {
      const long = 'x'.repeat(40);
      const code = codeOf({ ...shared, name: long });
      const names = [];
      for (let i = 0; i < 3; i += 1) names.push((await service().importProgram(code)).name);
      expect(names[0]).toBe(long);
      expect(names[1]).toBe(`${'x'.repeat(28)} (Importado)`);
      expect(names[2]).toBe(`${'x'.repeat(26)} (Importado 2)`);
      for (const name of names) expect(name.length).toBeLessThanOrEqual(40);

      // Corte exatamente no meio de um emoji: o emoji é removido inteiro (sem caractere inválido).
      const emojiName = `${'y'.repeat(27)}💪yyyyyyyyy`;
      const emojiCode = codeOf({ ...shared, name: emojiName });
      await service().importProgram(emojiCode);
      const renamed = await service().importProgram(emojiCode);
      expect(renamed.name).toBe(`${'y'.repeat(27)} (Importado)`);
      expect(renamed.name.length).toBeLessThanOrEqual(40);
    });

    it('resolveImportedProgramName encontra o próximo nome livre', () => {
      const { resolveImportedProgramName } = app.sharing;
      expect(resolveImportedProgramName('A', [])).toBe('A');
      expect(resolveImportedProgramName('A', ['A'])).toBe('A (Importado)');
      expect(resolveImportedProgramName('A', ['A', 'A (Importado)', 'A (Importado 2)'])).toBe('A (Importado 3)');
      expect(resolveImportedProgramName('A', ['A', 'A (Importado 2)'])).toBe('A (Importado)');
    });

    it('importações simultâneas do mesmo código recebem nomes diferentes', async () => {
      const code = codeOf(shared);
      const results = await Promise.all([1, 2, 3].map(() => service().importProgram(code)));
      expect(new Set(results.map((p) => p.name)).size).toBe(3);
    });
  });

  describe('prévia', () => {
    it('resume o código sem gravar nada no banco', async () => {
      await seedHistory();
      const before = await dumpAll();

      const preview = await service().previewImport(`Olha esse treino: ${codeOf(shared)} 👍`);

      expect(preview).toEqual({
        name: 'Força 💪 Total',
        finalName: 'Força 💪 Total',
        description: 'Enviado por um amigo',
        workoutCount: 3,
        exerciseCount: 5,
        workouts: [
          { name: 'Treino A - Peito', exerciseCount: 2 },
          { name: 'Treino B - Mobilidade', exerciseCount: 0 },
          { name: 'Treino C - Pernas', exerciseCount: 3 },
        ],
      });
      expect(await dumpAll()).toEqual(before);
    });

    it('mostra o nome alternativo quando o nome já existe', async () => {
      await programs().createProgram({ name: 'Força 💪 Total' });
      expect((await service().previewImport(codeOf(shared))).finalName).toBe('Força 💪 Total (Importado)');
    });

    it('a importação revalida tudo na confirmação (não confia em uma prévia antiga)', async () => {
      const code = codeOf(shared);
      const preview = await service().previewImport(code);
      expect(preview.finalName).toBe('Força 💪 Total');

      // Depois da prévia, surge um planejamento com o mesmo nome.
      await programs().createProgram({ name: 'Força 💪 Total' });
      const created = await service().importProgram(code);
      expect(created.name).toBe('Força 💪 Total (Importado)');
    });
  });

  describe('códigos inválidos', () => {
    it.each<[string, (valid: string) => string, string]>([
      ['vazio', () => '   ', 'empty'],
      ['sem código', () => 'bom dia!', 'not-found'],
      ['corrompido', (valid) => valid.slice(0, 12) + (valid[12] === 'A' ? 'B' : 'A') + valid.slice(13), 'corrupted'],
      ['truncado', (valid) => valid.slice(0, -15), 'corrupted'],
      ['versão futura', (valid) => valid.replace('GN1:', 'GN3:'), 'unsupported-version'],
      ['estrutura inválida', () => envelopeOf('{"v":1,"p":{"n":"X","w":"nada"}}'), 'malformed'],
      ['fora dos limites', () => envelopeOf('{"v":1,"p":{"n":"X","w":[{"n":"A","e":[["S",0,1,0,0]]}]}}'), 'invalid-content'],
      ['grande demais', () => 'GN1:' + 'A'.repeat(200 * 1024), 'too-large'],
    ])('%s → prévia e importação recusam sem gravar nada', async (_label, build, expected) => {
      const code = build(codeOf(shared));
      const before = await dumpAll();
      await expect(service().previewImport(code)).rejects.toMatchObject({ name: 'SharingServiceError', code: expected });
      await expect(service().importProgram(code)).rejects.toMatchObject({ name: 'SharingServiceError', code: expected });
      expect(await dumpAll()).toEqual(before);
    });
  });

  describe('rollback', () => {
    it.each<[string, 'programRepository' | 'workoutRepository' | 'exerciseRepository', number]>([
      ['ao criar o planejamento', 'programRepository', 1],
      ['no primeiro treino', 'workoutRepository', 1],
      ['no último treino', 'workoutRepository', 3],
      ['no primeiro exercício', 'exerciseRepository', 1],
      ['no último exercício', 'exerciseRepository', 5],
    ])('falha %s → nada é gravado', async (_label, repository, failingCall) => {
      await seedHistory();
      const before = await dumpAll();
      const target = app[repository] as { insert: (input: never) => Promise<void> };
      const realInsert = target.insert;
      let calls = 0;
      const spy = jest.spyOn(target, 'insert').mockImplementation(async (input: never) => {
        calls += 1;
        if (calls === failingCall) throw new Error('falha simulada');
        return realInsert.call(target, input);
      });

      await expect(service().importProgram(codeOf(shared))).rejects.toThrow('falha simulada');
      spy.mockRestore();

      expect(await dumpAll()).toEqual(before);
      // Depois da falha, uma nova importação funciona normalmente (com o nome original).
      expect((await service().importProgram(codeOf(shared))).name).toBe('Força 💪 Total');
    });
  });

  describe('ida e volta com dados reais', () => {
    it('exportar e importar um planejamento do banco (com buracos na ordenação) reproduz a estrutura', async () => {
      const { workoutService } = app.workouts;
      const { exerciseService } = app.exercises;
      const source = await programs().createProgram({ name: 'Origem', description: 'teste' });
      const a = await workoutService.createWorkout(source.id, 'A');
      const removed = await workoutService.createWorkout(source.id, 'Removido');
      const c = await workoutService.createWorkout(source.id, 'C');
      const e1 = await exerciseService.createExercise(c.id, ex('Primeiro', 3, 10, 20, 60));
      const e2 = await exerciseService.createExercise(c.id, ex('Apagado', 3, 10, 20, 60));
      const e3 = await exerciseService.createExercise(c.id, ex('Último', 5, 5, 102.5, 180));
      await workoutService.deleteWorkout(removed.id);
      await exerciseService.deleteExercise(e2.id);
      await workoutService.reorderWorkouts(source.id, [c.id, a.id]); // C antes de A
      expect([e1.sortOrder, e3.sortOrder]).toEqual([0, 2]); // buraco nos exercícios
      const sourceStructure = await structureOf(source.id);
      const before = await dumpAll();

      const { code } = await service().exportProgram(source.id);
      const imported = await service().importProgram(`Te mandei: ${code}`);

      expect(imported.name).toBe('Origem (Importado)');
      expect(await structureOf(imported.id)).toEqual({ ...sourceStructure, name: 'Origem (Importado)' });
      const importedWorkouts = await workoutService.listWorkouts(imported.id);
      expect(importedWorkouts.map((w) => [w.name, w.sortOrder])).toEqual([
        ['C', 0],
        ['A', 1],
      ]);
      expect((await exerciseService.listByWorkout(importedWorkouts[0]!.id)).map((e) => [e.name, e.sortOrder])).toEqual([
        ['Primeiro', 0],
        ['Último', 1],
      ]);
      // A origem continua exatamente igual.
      const after = await dumpAll();
      for (const table of ['programs', 'workouts', 'exercises'] as const) {
        expect(after[table]).toEqual(expect.arrayContaining(before[table]));
      }
      expect(await structureOf(source.id)).toEqual(sourceStructure);
    });
  });

  describe('regressão da duplicação', () => {
    it('duplicar um planejamento importado copia a estrutura e usa o sufixo " (Cópia)"', async () => {
      const imported = await service().importProgram(codeOf(shared));
      const copy = await programs().duplicateProgram(imported.id);
      expect(copy.name).toBe('Força 💪 Total (Cópia)');
      expect(await structureOf(copy.id)).toEqual({ ...shared, name: 'Força 💪 Total (Cópia)' });
    });

    it('a duplicação continua preservando os valores de sort_order originais (inclusive buracos)', async () => {
      const program = await programs().createProgram({ name: 'Com buracos' });
      const a = await app.workouts.workoutService.createWorkout(program.id, 'A');
      const b = await app.workouts.workoutService.createWorkout(program.id, 'B');
      const c = await app.workouts.workoutService.createWorkout(program.id, 'C');
      await app.workouts.workoutService.deleteWorkout(b.id); // sort_order: 0, 2
      const copy = await programs().duplicateProgram(program.id);
      expect((await app.workouts.workoutService.listWorkouts(copy.id)).map((w) => [w.name, w.sortOrder])).toEqual([
        ['A', a.sortOrder],
        ['C', c.sortOrder],
      ]);
    });

    it('o nome da cópia com emoji no corte não gera caractere inválido', async () => {
      const program = await programs().createProgram({ name: `${'z'.repeat(31)}💪zzzzzzz` });
      const copy = await programs().duplicateProgram(program.id);
      expect(copy.name).toBe(`${'z'.repeat(31)} (Cópia)`);
    });
  });
});
