/// <reference types="node" />
import { Buffer } from 'node:buffer';

import type { ProgramStructure } from '@/features/programs/types/program.types';
import {
  base64Encode,
  crc32Hex,
  decodeShareCode,
  encodeShareCode,
  toSharedPayload,
  utf8Encode,
} from '@/features/sharing/utils/share-codec';

import { cleanupDatabases, closeApp, startApp, type TestApp } from '../../../../test/helpers/app';

/**
 * Código GN1 no formato anterior à observação (9B): [nome, séries, reps, carga, descanso].
 * Literal fixo, para garantir que códigos já enviados continuem sendo importados.
 */
const LEGACY_GN1 =
  'GN1:eyJ2IjoxLCJwIjp7Im4iOiJQbGFubyBhbnRpZ28iLCJ3IjpbeyJuIjoiVHJlaW5vIEEiLCJlIjpbWyJTdXBpbm8gcmV0byIsNCwxMiw0MCw5MF0sWyJDcnVjaWZpeG8iLDMsMTUsMjIuNSwwXV19LHsibiI6IlRyZWlubyBCIiwiZSI6W119XSwiZCI6IkdlcmFkbyBwZWxhIHZlcnPDo28gOUIifX0.1ef8271e';

const OBS = 'Manter a coluna apoiada.';

const withObservation: ProgramStructure = {
  name: 'Força',
  description: null,
  workouts: [
    {
      name: 'Treino A',
      exercises: [
        { name: 'Supino', sets: 4, reps: 12, weightKg: 40, restSeconds: 90, observation: OBS },
        { name: 'Crucifixo', sets: 3, reps: 15, weightKg: 22.5, restSeconds: 0 },
      ],
    },
    { name: 'Treino B', exercises: [{ name: 'Remada', sets: 3, reps: 10, weightKg: 50, restSeconds: 60, observation: '🙂 Evitar compensar com o tronco.' }] },
  ],
};

const withoutObservation: ProgramStructure = {
  name: 'Força',
  description: null,
  workouts: [{ name: 'Treino A', exercises: [{ name: 'Supino', sets: 4, reps: 12, weightKg: 40, restSeconds: 90 }] }],
};

function code(structure: ProgramStructure): string {
  const result = encodeShareCode(structure);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function envelopeOf(json: string, version = 2): string {
  const bytes = utf8Encode(json);
  return `GN${version}:${base64Encode(bytes)}.${crc32Hex(bytes)}`;
}

const rawJson = (value: string) => Buffer.from(value.slice(4, value.lastIndexOf('.')), 'base64').toString('utf8');
const errorOf = (raw: string) => {
  const result = decodeShareCode(raw);
  return result.ok ? 'ok' : result.error;
};
const v2 = (tuple: unknown[]) => envelopeOf(JSON.stringify({ v: 2, p: { n: 'P', w: [{ n: 'A', e: [tuple] }] } }));

describe('observação no código de compartilhamento (formato)', () => {
  it('sem nenhuma observação continua gerando GN1, sem a 6ª posição', () => {
    expect(toSharedPayload(withoutObservation)).toEqual({
      v: 1,
      p: { n: 'Força', w: [{ n: 'Treino A', e: [['Supino', 4, 12, 40, 90]] }] },
    });
    expect(code(withoutObservation)).toMatch(/^GN1:/);
    // Observações vazias ou só com espaços também não exigem GN2.
    const blank = structuredClone(withoutObservation);
    blank.workouts[0]!.exercises[0]!.observation = '   ';
    expect(code(blank)).toBe(code(withoutObservation));
  });

  it('com observação gera GN2; a 6ª posição só aparece nos exercícios que têm observação', () => {
    const generated = code(withObservation);
    expect(generated).toMatch(/^GN2:[A-Za-z0-9+/]+\.[0-9a-f]{8}$/);
    expect(JSON.parse(rawJson(generated))).toEqual({
      v: 2,
      p: {
        n: 'Força',
        w: [
          { n: 'Treino A', e: [['Supino', 4, 12, 40, 90, OBS], ['Crucifixo', 3, 15, 22.5, 0]] },
          { n: 'Treino B', e: [['Remada', 3, 10, 50, 60, '🙂 Evitar compensar com o tronco.']] },
        ],
      },
    });
    expect(decodeShareCode(generated)).toEqual({ ok: true, value: withObservation });
  });

  it('códigos GN1 antigos continuam válidos (observação ausente = nula)', () => {
    const decoded = decodeShareCode(`Olha esse plano: ${LEGACY_GN1}`);
    expect(decoded).toEqual({
      ok: true,
      value: {
        name: 'Plano antigo',
        description: 'Gerado pela versão 9B',
        workouts: [
          {
            name: 'Treino A',
            exercises: [
              { name: 'Supino reto', sets: 4, reps: 12, weightKg: 40, restSeconds: 90 },
              { name: 'Crucifixo', sets: 3, reps: 15, weightKg: 22.5, restSeconds: 0 },
            ],
          },
          { name: 'Treino B', exercises: [] },
        ],
      },
    });
  });

  it('validação da 6ª posição', () => {
    // v1 nunca aceita a 6ª posição.
    expect(errorOf(envelopeOf('{"v":1,"p":{"n":"P","w":[{"n":"A","e":[["S",3,10,0,0,"obs"]]}]}}', 1))).toBe('malformed');
    // v2: 5 posições continuam válidas; 6ª precisa ser texto; 7 posições não existem.
    expect(errorOf(v2(['S', 3, 10, 0, 0]))).toBe('ok');
    expect(errorOf(v2(['S', 3, 10, 0, 0, 42]))).toBe('malformed');
    expect(errorOf(v2(['S', 3, 10, 0, 0, null]))).toBe('malformed');
    expect(errorOf(v2(['S', 3, 10, 0, 0, 'obs', 'extra']))).toBe('malformed');
    // Mesmo limite do app (200 caracteres).
    expect(errorOf(v2(['S', 3, 10, 0, 0, 'x'.repeat(200)]))).toBe('ok');
    expect(errorOf(v2(['S', 3, 10, 0, 0, 'x'.repeat(201)]))).toBe('invalid-content');
    // Texto vazio é tratado como "sem observação".
    expect(decodeShareCode(v2(['S', 3, 10, 0, 0, '   ']))).toEqual({
      ok: true,
      value: { name: 'P', description: null, workouts: [{ name: 'A', exercises: [{ name: 'S', sets: 3, reps: 10, weightKg: 0, restSeconds: 0 }] }] },
    });
  });

  it('cabeçalho e conteúdo precisam indicar a mesma versão', () => {
    expect(errorOf(code(withObservation).replace('GN2:', 'GN1:'))).toBe('malformed');
    expect(errorOf(code(withoutObservation).replace('GN1:', 'GN2:'))).toBe('malformed');
  });
});

describe('observação no compartilhamento (exportação e importação com o banco)', () => {
  let app: TestApp;

  beforeEach(() => {
    app = startApp();
  });
  afterEach(async () => {
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  async function createProgram(observation: string | null) {
    const program = await app.programs.programService.createProgram({ name: 'Hipertrofia' });
    const workout = await app.workouts.workoutService.createWorkout(program.id, 'Treino A');
    const { exerciseService } = app.exercises;
    const supino = await exerciseService.createExercise(workout.id, {
      name: 'Supino',
      sets: 4,
      reps: 12,
      weightKg: 40,
      restSeconds: 90,
      observation,
    });
    await exerciseService.createExercise(workout.id, { name: 'Remada', sets: 3, reps: 10, weightKg: 50, restSeconds: 60 });
    return { program, workout, supino };
  }

  const observationsOf = async (programId: string) => {
    const [workout] = await app.workouts.workoutService.listWorkouts(programId);
    return (await app.exercises.exerciseService.listByWorkout(workout!.id)).map((e) => [e.name, e.observation]);
  };

  it('exporta (GN2), importa e persiste as observações; ida e volta preserva tudo', async () => {
    const { program } = await createProgram(OBS);
    const { code: exported } = await app.sharing.sharingService.exportProgram(program.id);
    expect(exported).toMatch(/^GN2:/);

    const imported = await app.sharing.sharingService.importProgram(exported);

    expect(await observationsOf(imported.id)).toEqual([
      ['Supino', OBS],
      ['Remada', null],
    ]);
    expect(await observationsOf(program.id)).toEqual(await observationsOf(imported.id));
  });

  it('sem observações, a exportação continua em GN1', async () => {
    const { program } = await createProgram(null);
    expect((await app.sharing.sharingService.exportProgram(program.id)).code).toMatch(/^GN1:/);
  });

  it('importa um código GN1 antigo com observações nulas', async () => {
    const imported = await app.sharing.sharingService.importProgram(LEGACY_GN1);
    expect(await observationsOf(imported.id)).toEqual([
      ['Supino reto', null],
      ['Crucifixo', null],
    ]);
  });

  it('privacidade: com observação, continua sem histórico, desempenho, IDs ou datas', async () => {
    const { program, workout, supino } = await createProgram(OBS);
    const { sessionService } = app.sessions;
    const { sessionId } = await sessionService.startSession(workout.id);
    for (const set of (await sessionService.getSessionDetails(sessionId))!.exercises.flatMap((e) => e.sets)) {
      await sessionService.completeSet(set.id, { actualReps: 77, actualWeightKg: 987.5 });
    }
    await sessionService.finishSession(sessionId);

    const json = rawJson((await app.sharing.sharingService.exportProgram(program.id)).code);

    expect(json).toContain(OBS);
    expect(json).not.toMatch(/987|77/);
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    for (const id of [program.id, workout.id, supino.id, sessionId]) expect(json).not.toContain(id);
    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          walk(child);
        }
      }
    };
    walk(JSON.parse(json));
    expect([...keys].sort()).toEqual(['e', 'n', 'p', 'v', 'w']);
  });
});
