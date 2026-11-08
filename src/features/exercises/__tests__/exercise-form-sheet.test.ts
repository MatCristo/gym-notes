/* eslint-disable @typescript-eslint/no-require-imports -- mock oficial da safe area */
import { act, createElement } from 'react';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ExerciseFormSheet } from '@/features/exercises/components/ExerciseFormSheet';
import type { ExerciseFormValues } from '@/features/exercises/types/exercise.types';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(initialValues?: ExerciseFormValues) {
  const onSubmit = jest.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(ExerciseFormSheet, { visible: true, mode: initialValues ? 'edit' : 'create', initialValues, onSubmit, onCancel: jest.fn() }),
    );
  });
  return { renderer, onSubmit };
}

const field = (renderer: ReactTestRenderer, label: string): ReactTestInstance =>
  renderer.root.find((node) => node.props.accessibilityLabel === label && typeof node.props.onChangeText === 'function');

async function type(renderer: ReactTestRenderer, label: string, text: string) {
  await act(async () => {
    field(renderer, label).props.onChangeText(text);
  });
}

async function submit(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
  )[0]!;
  await act(async () => {
    button.props.onPress();
  });
}

function allText(renderer: ReactTestRenderer): string {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else ((value as { children?: unknown[] }).children ?? []).forEach(walk);
  };
  walk(renderer.toJSON());
  return parts.join(' ');
}

const OBSERVATION_LABEL = 'Observação (opcional)';

describe('ExerciseFormSheet: campo Observação', () => {
  it('exibe o campo multilinha, opcional, com limite de 200 e contador', () => {
    const { renderer } = render();
    const input = field(renderer, OBSERVATION_LABEL);
    expect(input.props.multiline).toBe(true);
    expect(input.props.maxLength).toBe(200);
    expect(input.props.value).toBe('');
    expect(allText(renderer)).toContain('0/200');
  });

  it('pode ficar vazio: o exercício é salvo com observação nula', async () => {
    const { renderer, onSubmit } = render();
    await type(renderer, 'Nome do exercício', 'Supino');
    await type(renderer, 'Séries', '4');
    await type(renderer, 'Repetições', '12');
    await submit(renderer, 'Adicionar');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Supino', observation: null }));
  });

  it('salva a observação digitada (sem espaços nas pontas) e atualiza o contador', async () => {
    const { renderer, onSubmit } = render();
    await type(renderer, 'Nome do exercício', 'Supino');
    await type(renderer, 'Séries', '4');
    await type(renderer, 'Repetições', '12');
    await type(renderer, OBSERVATION_LABEL, '  Manter a coluna apoiada.\n');
    expect(allText(renderer)).toContain('27/200'); // 2 espaços + 24 caracteres + quebra de linha
    await submit(renderer, 'Adicionar');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ observation: 'Manter a coluna apoiada.' }));
  });

  it('na edição carrega a observação salva e permite removê-la', async () => {
    const { renderer, onSubmit } = render({
      name: 'Supino',
      sets: '4',
      reps: '12',
      weightKg: '40',
      restSeconds: '90',
      observation: 'Executar o movimento lentamente.',
    });
    expect(field(renderer, OBSERVATION_LABEL).props.value).toBe('Executar o movimento lentamente.');

    await type(renderer, OBSERVATION_LABEL, '');
    await submit(renderer, 'Salvar');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Supino', observation: null }));
  });

  it('os demais campos continuam iguais (nome, séries, repetições, carga e descanso)', () => {
    const { renderer } = render();
    for (const label of ['Nome do exercício', 'Séries', 'Repetições', 'Carga', 'Descanso']) {
      expect(field(renderer, label).props.multiline).toBe(false);
    }
  });
});
