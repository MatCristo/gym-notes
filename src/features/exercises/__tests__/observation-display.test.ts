/* eslint-disable @typescript-eslint/no-require-imports -- mocks oficiais de bibliotecas nativas */
import { act, createElement, type ComponentType } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import type { Exercise } from '@/features/exercises/types/exercise.types';
import type { SessionExercise } from '@/features/sessions/types/session.types';

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// O card é renderizado fora da lista reordenável neste teste: só os hooks de arraste são simulados.
jest.mock('react-native-reorderable-list', () => ({
  useReorderableDrag: () => jest.fn(),
  useIsActive: () => false,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OBS = 'Manter a coluna apoiada.';

const exercise = (observation: string | null): Exercise => ({
  id: 'ex-1',
  workoutId: 'w-1',
  name: 'Supino reto',
  sets: 4,
  reps: 12,
  weightKg: 40,
  restSeconds: 90,
  observation,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const sessionExercise = (observationSnapshot: string | null): SessionExercise => ({
  id: 'se-1',
  sessionId: 's-1',
  exerciseId: 'ex-1',
  exerciseNameSnapshot: 'Supino reto',
  observationSnapshot,
  plannedRestSeconds: 90,
  sortOrder: 0,
  sets: [1, 2].map((setNumber) => ({
    id: `set-${setNumber}`,
    sessionExerciseId: 'se-1',
    setNumber,
    plannedReps: 12,
    actualReps: null,
    plannedWeightKg: 40,
    actualWeightKg: null,
    completedAt: null,
  })),
});

function render<P extends object>(component: ComponentType<P>, props: P): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(component, props));
  });
  return renderer;
}

/** Textos na ordem em que aparecem na tela. */
function texts(renderer: ReactTestRenderer): string[] {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else ((value as { children?: unknown[] }).children ?? []).forEach(walk);
  };
  walk(renderer.toJSON());
  return parts;
}

const observationNodes = (renderer: ReactTestRenderer, testID: string) =>
  renderer.root.findAll((node) => node.props.testID === testID && typeof node.props.children === 'string');

describe('observação na lista de exercícios do treino (ExerciseCard)', () => {
  const { ExerciseCard } = require('@/features/exercises/components/ExerciseCard') as typeof import('@/features/exercises/components/ExerciseCard');
  const props = (observation: string | null) => ({
    exercise: exercise(observation),
    position: 1,
    onPress: jest.fn(),
    onOptionsPress: jest.fn(),
    draggable: true,
  });

  it('exibe a observação logo abaixo do nome, em texto secundário limitado a 2 linhas', () => {
    const renderer = render(ExerciseCard, props(OBS));
    const [node] = observationNodes(renderer, 'exercise-observation');
    expect(node!.props.children).toBe(OBS);
    expect(node!.props.numberOfLines).toBe(2);
    const order = texts(renderer);
    expect(order.indexOf(OBS)).toBe(order.indexOf('Supino reto') + 1);
    // Leitores de tela também recebem a observação.
    const card = renderer.root.find((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('1º'));
    expect(card.props.accessibilityLabel).toContain(`observação: ${OBS}`);
  });

  it('não exibe nada quando a observação é nula ou vazia', () => {
    for (const value of [null, '']) {
      const renderer = render(ExerciseCard, props(value));
      expect(observationNodes(renderer, 'exercise-observation')).toHaveLength(0);
      const card = renderer.root.find((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('1º'));
      expect(card.props.accessibilityLabel).not.toContain('observação');
    }
  });
});

describe('observação na execução do treino (SessionExerciseCard)', () => {
  const { SessionExerciseCard } = require('@/features/sessions/components/SessionExerciseCard') as typeof import('@/features/sessions/components/SessionExerciseCard');
  const props = (observationSnapshot: string | null) => ({
    exercise: sessionExercise(observationSnapshot),
    onCompleteSet: jest.fn(async () => undefined),
    onUncompleteSet: jest.fn(async () => undefined),
    onSaveSetActuals: jest.fn(async () => undefined),
  });

  it('exibe a observação do snapshot abaixo do nome, sem limitar linhas, antes do progresso das séries', () => {
    const renderer = render(SessionExerciseCard, props(OBS));
    const [node] = observationNodes(renderer, 'session-exercise-observation');
    expect(node!.props.children).toBe(OBS);
    expect(node!.props.numberOfLines).toBeUndefined();
    const order = texts(renderer);
    const nameIndex = order.indexOf('Supino reto');
    expect(order[nameIndex + 1]).toBe(OBS);
    expect(order.slice(nameIndex + 2).join('')).toMatch(/^0\/2 séries/);
  });

  it('não exibe nada quando o snapshot é nulo (inclusive sessões antigas)', () => {
    const renderer = render(SessionExerciseCard, props(null));
    expect(observationNodes(renderer, 'session-exercise-observation')).toHaveLength(0);
  });

  it('os controles das séries continuam os mesmos, com ou sem observação', () => {
    const controls = (renderer: ReactTestRenderer) =>
      renderer.root
        .findAll((n) => typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function')
        .map((n) => n.props.accessibilityLabel ?? n.props.placeholder ?? '');
    const withObservation = controls(render(SessionExerciseCard, props(OBS)));
    expect(withObservation.length).toBeGreaterThanOrEqual(2); // ao menos um controle por série
    expect(withObservation).toEqual(controls(render(SessionExerciseCard, props(null))));
  });
});
