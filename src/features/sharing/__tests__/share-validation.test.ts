import { validateSharedPayload } from '@/features/sharing/utils/share-validation';

type Json = Record<string, unknown>;

const exercise = (overrides: Partial<Record<0 | 1 | 2 | 3 | 4, unknown>> = {}): unknown[] => {
  const tuple: unknown[] = ['Supino reto', 4, 12, 40, 90];
  for (const [index, value] of Object.entries(overrides)) tuple[Number(index)] = value;
  return tuple;
};

const payload = (program: Json = {}, root: Json = {}): Json => ({
  v: 1,
  p: { n: 'Hipertrofia', d: '4x por semana', w: [{ n: 'Treino A', e: [exercise()] }], ...program },
  ...root,
});

const withWorkout = (workout: Json) => payload({ w: [{ n: 'Treino A', e: [exercise()], ...workout }] });
const withExercise = (tuple: unknown) => payload({ w: [{ n: 'Treino A', e: [tuple] }] });
const errorOf = (data: unknown) => {
  const result = validateSharedPayload(data);
  return result.ok ? 'ok' : result.error;
};

describe('validateSharedPayload', () => {
  it('converte um payload válido em estrutura normalizada (trim; descrição vazia vira null)', () => {
    const result = validateSharedPayload(
      payload({
        n: '  Hipertrofia  ',
        d: '   ',
        w: [
          { n: ' Treino A ', e: [[' Supino reto ', 4, 12, 22.5, 90], ['Flexão', 3, 15, 0, 0]] },
          { n: 'Treino B', e: [] },
        ],
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Hipertrofia',
        description: null,
        workouts: [
          {
            name: 'Treino A',
            exercises: [
              { name: 'Supino reto', sets: 4, reps: 12, weightKg: 22.5, restSeconds: 90 },
              { name: 'Flexão', sets: 3, reps: 15, weightKg: 0, restSeconds: 0 },
            ],
          },
          { name: 'Treino B', exercises: [] },
        ],
      },
    });
  });

  it('aceita descrição ausente ou null', () => {
    const { d: _omit, ...withoutDescription } = payload().p as Json;
    expect(validateSharedPayload({ v: 1, p: withoutDescription })).toMatchObject({ ok: true, value: { description: null } });
    expect(validateSharedPayload(payload({ d: null }))).toMatchObject({ ok: true, value: { description: null } });
  });

  it('ignora campos extras em todos os níveis (nunca chegam à estrutura)', () => {
    const result = validateSharedPayload({
      v: 1,
      id: 'uuid-raiz',
      history: [{ weight: 987.5 }],
      p: {
        n: 'Hipertrofia',
        id: 'uuid-plano',
        createdAt: '2026-01-01T00:00:00.000Z',
        w: [{ n: 'Treino A', id: 'uuid-treino', sessions: [1, 2], e: [exercise()] }],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value).sort()).toEqual(['description', 'name', 'workouts']);
    expect(Object.keys(result.value.workouts[0]!).sort()).toEqual(['exercises', 'name']);
    expect(Object.keys(result.value.workouts[0]!.exercises[0]!).sort()).toEqual([
      'name',
      'reps',
      'restSeconds',
      'sets',
      'weightKg',
    ]);
    expect(JSON.stringify(result.value)).not.toMatch(/uuid|987|2026|sessions|history/);
  });

  it('trata nomes com aspas e SQL como texto comum', () => {
    const tricky = "Robert'); DROP TABLE workouts;--";
    const result = validateSharedPayload(payload({ n: tricky.slice(0, 40) }));
    expect(result).toMatchObject({ ok: true, value: { name: tricky.slice(0, 40) } });
  });

  describe('versão', () => {
    it('versão futura → unsupported-version; ausente, inválida ou zero → malformed', () => {
      expect(errorOf(payload({}, { v: 3 }))).toBe('unsupported-version');
      expect(errorOf(payload({}, { v: 99 }))).toBe('unsupported-version');
      expect(errorOf(payload({}, { v: undefined }))).toBe('malformed');
      expect(errorOf(payload({}, { v: '1' }))).toBe('malformed');
      expect(errorOf(payload({}, { v: 1.5 }))).toBe('malformed');
      expect(errorOf(payload({}, { v: 0 }))).toBe('malformed');
    });
  });

  describe('estrutura e tipos → malformed', () => {
    it.each<[string, unknown]>([
      ['raiz não é objeto', [1, 2]],
      ['raiz nula', null],
      ['raiz texto', 'GN1'],
      ['p ausente', { v: 1 }],
      ['p é array', { v: 1, p: [] }],
      ['nome do plano não é texto', payload({ n: 123 })],
      ['descrição não é texto', payload({ d: 5 })],
      ['w não é array', payload({ w: { n: 'Treino A' } })],
      ['treino não é objeto', payload({ w: ['Treino A'] })],
      ['nome do treino ausente', withWorkout({ n: undefined })],
      ['e não é array', withWorkout({ e: 'Supino' })],
      ['exercício não é tupla', withExercise({ n: 'Supino' })],
      ['tupla com 4 posições', withExercise(['Supino', 4, 12, 40])],
      ['tupla com 6 posições', withExercise(['Supino', 4, 12, 40, 90, 'extra'])],
      ['nome do exercício não é texto', withExercise(exercise({ 0: 7 }))],
      ['séries como texto', withExercise(exercise({ 1: '4' }))],
      ['repetições nulas', withExercise(exercise({ 2: null }))],
      ['carga booleana', withExercise(exercise({ 3: true }))],
      ['descanso como objeto', withExercise(exercise({ 4: {} }))],
      ['carga NaN', withExercise(exercise({ 3: Number.NaN }))],
      ['carga infinita', withExercise(exercise({ 3: Number.POSITIVE_INFINITY }))],
    ])('%s', (_label, data) => {
      expect(errorOf(data)).toBe('malformed');
    });
  });

  describe('limites (mesmas regras do app) → invalid-content', () => {
    const exercises = (count: number) => Array.from({ length: count }, () => exercise());
    const workouts = (count: number) => Array.from({ length: count }, (_, i) => ({ n: `Treino ${i + 1}`, e: [] }));

    it.each<[string, unknown]>([
      ['nome do plano vazio', payload({ n: '' })],
      ['nome do plano só com espaços', payload({ n: '    ' })],
      ['nome do plano com 41 caracteres', payload({ n: 'x'.repeat(41) })],
      ['descrição com 201 caracteres', payload({ d: 'x'.repeat(201) })],
      ['nenhum treino', payload({ w: [] })],
      ['51 treinos', payload({ w: workouts(51) })],
      ['nome do treino vazio', withWorkout({ n: '  ' })],
      ['nome do treino com 41 caracteres', withWorkout({ n: 'x'.repeat(41) })],
      ['101 exercícios em um treino', withWorkout({ e: exercises(101) })],
      ['nome do exercício vazio', withExercise(exercise({ 0: '   ' }))],
      ['nome do exercício com 61 caracteres', withExercise(exercise({ 0: 'x'.repeat(61) }))],
      ['0 séries', withExercise(exercise({ 1: 0 }))],
      ['100 séries', withExercise(exercise({ 1: 100 }))],
      ['séries fracionadas', withExercise(exercise({ 1: 2.5 }))],
      ['0 repetições', withExercise(exercise({ 2: 0 }))],
      ['1000 repetições', withExercise(exercise({ 2: 1000 }))],
      ['repetições fracionadas', withExercise(exercise({ 2: 10.5 }))],
      ['carga negativa', withExercise(exercise({ 3: -1 }))],
      ['carga acima de 9999 kg', withExercise(exercise({ 3: 10000 }))],
      ['descanso negativo', withExercise(exercise({ 4: -1 }))],
      ['descanso acima de 3600 s', withExercise(exercise({ 4: 3601 }))],
      ['descanso fracionado', withExercise(exercise({ 4: 30.5 }))],
    ])('%s', (_label, data) => {
      expect(errorOf(data)).toBe('invalid-content');
    });

    it('aceita exatamente os valores-limite', () => {
      expect(errorOf(payload({ n: 'x'.repeat(40), d: 'x'.repeat(200), w: workouts(50) }))).toBe('ok');
      expect(errorOf(withWorkout({ n: 'x'.repeat(40), e: exercises(100) }))).toBe('ok');
      expect(errorOf(withWorkout({ e: [] }))).toBe('ok');
      expect(errorOf(withExercise(['x'.repeat(60), 1, 1, 0, 0]))).toBe('ok');
      expect(errorOf(withExercise(['Supino', 99, 999, 9999, 3600]))).toBe('ok');
      expect(errorOf(withExercise(['Supino', 3, 10, 22.5, 60]))).toBe('ok');
    });
  });
});
