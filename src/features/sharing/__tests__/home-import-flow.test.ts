/* eslint-disable @typescript-eslint/no-require-imports -- os módulos são recarregados junto com o app de teste */
import type { ComponentType, ReactNode } from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import type { ProgramStructure } from '@/features/programs/types/program.types';

import { cleanupDatabases, closeApp, startApp, type TestApp } from '../../../../test/helpers/app';

/*
 * Fluxo completo na Home real (banco SQLite real dos testes): abrir "Importar", colar, ver prévia,
 * confirmar, e conferir a lista atualizada. Só o que é nativo/de navegação é simulado.
 */
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => '') }));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (callback: () => void) => useEffect(() => callback(), [callback]),
  };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// A primeira renderização da Home carrega muitos módulos (lenta com o cache do Jest frio).
jest.setTimeout(30_000);

const shared: ProgramStructure = {
  name: 'Meu planejamento',
  description: 'Recebido de um amigo',
  workouts: [
    { name: 'Treino A', exercises: [{ name: 'Supino reto', sets: 4, reps: 12, weightKg: 40, restSeconds: 90 }] },
    { name: 'Treino B', exercises: [] },
  ],
};

describe('Home: importação de planejamento (fluxo completo)', () => {
  let app: TestApp;
  let renderer: ReactTestRenderer;
  let act: typeof import('react').act;
  let clipboard: { getStringAsync: jest.Mock<Promise<string>, []> };
  let code: string;

  beforeEach(async () => {
    app = startApp();
    const React = require('react') as typeof import('react');
    act = React.act;
    const { create } = require('react-test-renderer') as typeof import('react-test-renderer');
    const HomeScreen = require('@/app/(tabs)/index').default as ComponentType;
    const { ToastProvider } = require('@/components/ui/Toast') as {
      ToastProvider: ComponentType<{ children: ReactNode }>;
    };
    const { SafeAreaProvider } = require('react-native-safe-area-context') as {
      SafeAreaProvider: ComponentType<{ children: ReactNode }>;
    };
    clipboard = require('expo-clipboard');
    const { encodeShareCode } = require('@/features/sharing/utils/share-codec') as typeof import('@/features/sharing/utils/share-codec');
    const encoded = encodeShareCode(shared);
    if (!encoded.ok) throw new Error(encoded.error);
    code = encoded.value;
    clipboard.getStringAsync.mockResolvedValue(`Importe no Gym Notes:\n${code}\nAbraço!`);

    await act(async () => {
      renderer = create(
        React.createElement(SafeAreaProvider, null, React.createElement(ToastProvider, null, React.createElement(HomeScreen))),
      );
    });
    await settle();
  });
  afterEach(async () => {
    await act(async () => renderer.unmount());
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  /** Deixa as operações assíncronas (SQLite) terminarem. */
  async function settle() {
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  function allText(node: ReactTestInstance | ReactTestRenderer = renderer): string {
    const json = 'toJSON' in node ? node.toJSON() : null;
    const parts: string[] = [];
    const walk = (value: unknown) => {
      if (value === null || value === undefined) return;
      if (typeof value === 'string') parts.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else ((value as { children?: unknown[] }).children ?? []).forEach(walk);
    };
    walk(json);
    return parts.join(' ');
  }

  const importPanel = () => renderer.root.findAll((node) => node.props.accessibilityLabel === 'Código do planejamento');
  const pressables = (label: string) =>
    renderer.root.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function');

  async function press(label: string, index = 0) {
    const target = pressables(label)[index];
    if (!target) throw new Error(`botão "${label}" não encontrado`);
    await act(async () => {
      await target.props.onPress();
    });
    await settle();
  }

  async function dumpAll() {
    const db = await app.database.getDatabase();
    const all = (table: string) => db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
    return Promise.all(
      ['training_programs', 'workouts', 'exercises', 'workout_sessions', 'session_exercises', 'set_logs'].map(all),
    );
  }

  it('o botão "Importar" abre a interface de importação', async () => {
    expect(allText()).toContain('Meus planejamentos');
    expect(importPanel()).toHaveLength(0);

    await press('Importar planejamento');

    expect(importPanel().length).toBeGreaterThan(0);
    expect(allText()).toContain('Cole o código recebido');
  });

  it('colar → prévia → confirmar: cria cópia independente, atualiza a lista e informa o nome', async () => {
    const before = await dumpAll();
    await press('Importar planejamento');
    await press('Colar código');
    expect(clipboard.getStringAsync).toHaveBeenCalledTimes(1);

    await press('Ver prévia');
    // A prévia não grava nada e já mostra o nome alternativo (o nome padrão já existe).
    expect(await dumpAll()).toEqual(before);
    expect(allText()).toContain('Meu planejamento (Importado)');
    expect(allText()).toContain('2 treinos');

    // O botão de confirmação é o último com esse rótulo (o primeiro é o "Importar" do cabeçalho).
    const confirmIndex = pressables('Importar planejamento').length - 1;
    await press('Importar planejamento', confirmIndex);

    // Interface fechada, lista atualizada a partir do banco e confirmação com o nome.
    expect(importPanel()).toHaveLength(0);
    const text = allText();
    expect(text).toContain('Meu planejamento (Importado)');
    expect(text).toContain('Planejamento importado com sucesso: “Meu planejamento (Importado)”');
    expect(text).toContain('2 planejamentos');

    const programs = await app.programs.programService.listPrograms();
    expect(programs.map((p) => p.name)).toEqual(['Meu planejamento', 'Meu planejamento (Importado)']);
    // Nenhum registro preexistente foi alterado ou removido: só foram acrescentados registros novos.
    const after = await dumpAll();
    for (const [table, rows] of before.entries()) expect(after[table]).toEqual(expect.arrayContaining(rows));
    expect(after[3]).toEqual(before[3]); // sessões
    expect(after[5]).toEqual(before[5]); // séries registradas
    expect(await app.workouts.workoutService.listWorkouts(programs[0]!.id)).toHaveLength(3);
  });

  it('código inválido: mostra o erro, mantém a interface aberta e não altera dados', async () => {
    clipboard.getStringAsync.mockResolvedValue(code.slice(0, -10));
    const before = await dumpAll();
    await press('Importar planejamento');
    await press('Colar código');
    await press('Ver prévia');

    expect(importPanel().length).toBeGreaterThan(0);
    expect(allText()).toContain('O código está incompleto ou foi alterado');
    expect(await dumpAll()).toEqual(before);
  });

  it('falha ao ler a área de transferência mostra mensagem amigável', async () => {
    clipboard.getStringAsync.mockRejectedValue(new Error('permission denied: clipboard'));
    await press('Importar planejamento');
    await press('Colar código');
    expect(allText()).toContain('Não foi possível acessar a área de transferência');
    expect(allText()).not.toContain('permission denied');
  });
});
