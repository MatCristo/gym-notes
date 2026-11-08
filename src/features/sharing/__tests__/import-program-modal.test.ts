import { act, createElement } from 'react';
import { Keyboard, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import type { TrainingProgram } from '@/features/programs/types/program.types';
import {
  IMPORT_INDEPENDENT_NOTICE,
  IMPORT_PRIVACY_NOTICE,
  ImportProgramContent,
  type ImportProgramContentProps,
} from '@/features/sharing/components/ImportProgramModal';
import type { ImportPreview } from '@/features/sharing/types/sharing.types';
import { spacing } from '@/theme/spacing';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CODE = 'Olha esse treino:\nGN1:eyJ2IjoxfQ.1a2b3c4d\nAbraço!';

const preview: ImportPreview = {
  name: 'Hipertrofia',
  finalName: 'Hipertrofia (Importado)',
  description: '4x por semana',
  workoutCount: 3,
  exerciseCount: 5,
  workouts: [
    { name: 'Treino A - Peito', exerciseCount: 2 },
    { name: 'Treino B - Mobilidade', exerciseCount: 0 },
    { name: 'Treino C - Pernas', exerciseCount: 3 },
  ],
};

const program = { id: 'novo', name: 'Hipertrofia (Importado)' } as TrainingProgram;

/** Promessa controlada manualmente (para simular operações em andamento). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function render(overrides: Partial<ImportProgramContentProps> = {}) {
  const props = {
    onPaste: jest.fn(async () => ({ ok: true as const, text: CODE })),
    onPreview: jest.fn(async () => ({ ok: true as const, preview })),
    onImport: jest.fn(async () => ({ ok: true as const, program })),
    onImported: jest.fn(),
    onClose: jest.fn(),
    onBusyChange: jest.fn(),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(ImportProgramContent, props));
  });
  return { renderer, props };
}

function allText(renderer: ReactTestRenderer): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') parts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else ((node as { children?: unknown[] }).children ?? []).forEach(walk);
  };
  walk(renderer.toJSON());
  return parts.join(' ');
}

const input = (renderer: ReactTestRenderer) =>
  renderer.root.find((node) => node.props.accessibilityLabel === 'Código do planejamento' && 'onChangeText' in node.props);

function button(renderer: ReactTestRenderer, label: string): ReactTestInstance | undefined {
  return renderer.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
  )[0];
}

async function press(renderer: ReactTestRenderer, label: string) {
  const target = button(renderer, label);
  if (!target) throw new Error(`botão "${label}" não encontrado`);
  await act(async () => {
    await target.props.onPress();
  });
}

async function type(renderer: ReactTestRenderer, text: string) {
  await act(async () => {
    input(renderer).props.onChangeText(text);
  });
}

describe('ImportProgramContent (interface de importação)', () => {
  it('começa vazio, com colar, ver prévia (desabilitado) e cancelar; o campo é multilinha e sem limite', () => {
    const { renderer } = render();
    const field = input(renderer);
    expect(field.props.value).toBe('');
    expect(field.props.multiline).toBe(true);
    expect(field.props.maxLength).toBeUndefined();
    expect(button(renderer, 'Colar código')).toBeDefined();
    expect(button(renderer, 'Ver prévia')!.props.disabled).toBe(true);
    expect(button(renderer, 'Cancelar importação')).toBeDefined();
    expect(button(renderer, 'Importar planejamento')).toBeUndefined();
  });

  it('"Colar código" usa a área de transferência e preenche o campo com o texto completo', async () => {
    const { renderer, props } = render();
    await press(renderer, 'Colar código');
    expect(props.onPaste).toHaveBeenCalledTimes(1);
    expect(input(renderer).props.value).toBe(CODE);
  });

  it('falha ou área de transferência vazia mostram a mensagem e mantêm o campo', async () => {
    const { renderer } = render({ onPaste: jest.fn(async () => ({ ok: false as const, message: 'Área vazia.' })) });
    await type(renderer, 'meu texto');
    await press(renderer, 'Colar código');
    expect(allText(renderer)).toContain('Área vazia.');
    expect(input(renderer).props.value).toBe('meu texto');
  });

  it('a prévia mostra nome original, nome final, descrição, totais, treinos e os avisos', async () => {
    const { renderer, props } = render();
    await type(renderer, CODE);
    await press(renderer, 'Ver prévia');

    expect(props.onPreview).toHaveBeenCalledWith(CODE);
    const text = allText(renderer);
    for (const expected of [
      'Hipertrofia',
      'Hipertrofia (Importado)',
      'Já existe um planejamento com esse nome',
      '4x por semana',
      '3 treinos',
      '5 exercícios',
      'Treino A - Peito',
      '2 exercícios',
      'Treino B - Mobilidade',
      'nenhum exercício',
      'Treino C - Pernas',
      IMPORT_INDEPENDENT_NOTICE,
      IMPORT_PRIVACY_NOTICE,
    ]) {
      expect(text).toContain(expected);
    }
    expect(button(renderer, 'Importar planejamento')).toBeDefined();
  });

  it('sem conflito de nome, não mostra aviso de renomeação', async () => {
    const { renderer } = render({
      onPreview: jest.fn(async () => ({ ok: true as const, preview: { ...preview, finalName: 'Hipertrofia' } })),
    });
    await type(renderer, CODE);
    await press(renderer, 'Ver prévia');
    expect(allText(renderer)).not.toContain('Já existe um planejamento');
  });

  it('alterar o código invalida a prévia e exige nova validação', async () => {
    const { renderer, props } = render();
    await type(renderer, CODE);
    await press(renderer, 'Ver prévia');
    expect(button(renderer, 'Importar planejamento')).toBeDefined();

    await type(renderer, `${CODE} `);

    expect(button(renderer, 'Importar planejamento')).toBeUndefined();
    expect(renderer.root.findAll((node) => node.props.testID === 'import-preview')).toHaveLength(0);
    expect(button(renderer, 'Ver prévia')!.props.disabled).toBe(false);
    expect(props.onImport).not.toHaveBeenCalled();
  });

  it('se o código mudar enquanto a prévia é gerada, o resultado antigo é descartado', async () => {
    const pending = deferred<{ ok: true; preview: ImportPreview }>();
    const { renderer } = render({ onPreview: jest.fn(() => pending.promise) });
    await type(renderer, CODE);
    await act(async () => {
      void button(renderer, 'Ver prévia')!.props.onPress();
    });
    await type(renderer, 'outro texto');
    await act(async () => {
      pending.resolve({ ok: true, preview });
    });
    expect(renderer.root.findAll((node) => node.props.testID === 'import-preview')).toHaveLength(0);
  });

  it('a confirmação chama importProgram com o código atual e informa o planejamento criado', async () => {
    const { renderer, props } = render();
    await type(renderer, CODE);
    await press(renderer, 'Ver prévia');
    await press(renderer, 'Importar planejamento');

    expect(props.onImport).toHaveBeenCalledTimes(1);
    expect(props.onImport).toHaveBeenCalledWith(CODE);
    expect(props.onImported).toHaveBeenCalledWith(program);
  });

  it('toques repetidos durante a importação não geram importações duplicadas; mostra carregamento', async () => {
    const pending = deferred<{ ok: true; program: TrainingProgram }>();
    const { renderer, props } = render({ onImport: jest.fn(() => pending.promise) });
    await type(renderer, CODE);
    await press(renderer, 'Ver prévia');

    const confirm = button(renderer, 'Importar planejamento')!;
    await act(async () => {
      void confirm.props.onPress();
      void confirm.props.onPress();
      void confirm.props.onPress();
    });
    expect(allText(renderer)).toContain('Importando…');
    expect(button(renderer, 'Importar planejamento')!.props.disabled).toBe(true);
    expect(button(renderer, 'Cancelar importação')!.props.disabled).toBe(true);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      pending.resolve({ ok: true, program });
    });
    expect(props.onImport).toHaveBeenCalledTimes(1);
    expect(props.onImported).toHaveBeenCalledTimes(1);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('erro de validação na prévia é exibido e a interface continua aberta', async () => {
    const { renderer, props } = render({
      onPreview: jest.fn(async () => ({ ok: false as const, message: 'O código está incompleto ou foi alterado.' })),
    });
    await type(renderer, 'GN1:quebrado');
    await press(renderer, 'Ver prévia');
    expect(allText(renderer)).toContain('O código está incompleto ou foi alterado.');
    expect(button(renderer, 'Importar planejamento')).toBeUndefined();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(input(renderer).props.value).toBe('GN1:quebrado');
  });

  it('falha na importação não fecha a interface e permite tentar de novo', async () => {
    const onImport = jest
      .fn<Promise<{ ok: false; message: string } | { ok: true; program: TrainingProgram }>, [string]>()
      .mockResolvedValueOnce({ ok: false, message: 'Não foi possível importar o planejamento. Nada foi alterado.' })
      .mockResolvedValueOnce({ ok: true, program });
    const { renderer, props } = render({ onImport });
    await type(renderer, CODE);
    await press(renderer, 'Ver prévia');

    await press(renderer, 'Importar planejamento');
    expect(allText(renderer)).toContain('Não foi possível importar o planejamento. Nada foi alterado.');
    expect(props.onImported).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();

    await press(renderer, 'Importar planejamento');
    expect(onImport).toHaveBeenCalledTimes(2);
    expect(props.onImported).toHaveBeenCalledWith(program);
  });

  it('cancelar apenas fecha, sem prévia nem importação', async () => {
    const { renderer, props } = render();
    await type(renderer, CODE);
    await press(renderer, 'Cancelar importação');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onPreview).not.toHaveBeenCalled();
    expect(props.onImport).not.toHaveBeenCalled();
  });

  it('não exibe nenhuma informação de histórico, sessões ou desempenho', async () => {
    const { renderer } = render();
    await type(renderer, CODE);
    await press(renderer, 'Ver prévia');
    const text = allText(renderer).replace(IMPORT_PRIVACY_NOTICE, '');
    expect(text).not.toMatch(/histórico|sess(ão|ões)|evolução|desempenho|recorde|realizad|\bkg\b/i);
  });
});

describe('ImportProgramContent: layout (área rolável + rodapé fixo)', () => {
  const longPreview: ImportPreview = {
    ...preview,
    workoutCount: 50,
    exerciseCount: 500,
    workouts: Array.from({ length: 50 }, (_, i) => ({ name: `Treino número ${i + 1}`, exerciseCount: 10 })),
  };

  const scroll = (renderer: ReactTestRenderer) =>
    renderer.root.find((node) => node.props.testID === 'import-scroll' && typeof node.instance?.scrollTo === 'function');
  const footer = (renderer: ReactTestRenderer) =>
    renderer.root.find((node) => node.props.testID === 'import-footer' && node.type === View);
  const within = (container: ReactTestInstance, label: string) =>
    container.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function');

  async function renderWithPreview(data: ImportPreview = preview) {
    const result = render({ onPreview: jest.fn(async () => ({ ok: true as const, preview: data })) });
    await type(result.renderer, CODE);
    await press(result.renderer, 'Ver prévia');
    return result;
  }

  it('a prévia fica dentro da área rolável; as ações ficam no rodapé, fora dela', async () => {
    const { renderer } = await renderWithPreview();
    const scrollArea = scroll(renderer);
    const footerArea = footer(renderer);

    expect(scrollArea.findAll((node) => node.props.testID === 'import-preview').length).toBeGreaterThan(0);
    expect(scrollArea.findAll((node) => node.props.accessibilityLabel === 'Código do planejamento').length).toBeGreaterThan(0);
    expect(within(footerArea, 'Importar planejamento').length).toBeGreaterThan(0);
    expect(within(footerArea, 'Cancelar importação').length).toBeGreaterThan(0);
    expect(within(scrollArea, 'Importar planejamento')).toHaveLength(0);
    expect(within(scrollArea, 'Cancelar importação')).toHaveLength(0);
  });

  it('antes da prévia, colar/ver prévia/cancelar também ficam no rodapé', () => {
    const { renderer } = render();
    const footerArea = footer(renderer);
    for (const label of ['Colar código', 'Ver prévia', 'Cancelar importação']) {
      expect(within(footerArea, label).length).toBeGreaterThan(0);
    }
  });

  it('a área rolável encolhe para caber no painel e o rodapé nunca encolhe', () => {
    const { renderer } = render();
    const flat = (style: unknown) => StyleSheet.flatten(style as StyleProp<ViewStyle>);
    const content = renderer.root.findAll((node) => node.type === View)[0]!;
    expect(flat(content.props.style)).toMatchObject({ flexShrink: 1 });
    expect(flat(scroll(renderer).props.style)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
    expect(flat(footer(renderer).props.style)).toMatchObject({ flexShrink: 0 });
  });

  it('prévia longa: todo o conteúdo fica na área rolável (sem virtualização) e a importação continua funcionando', async () => {
    const { renderer, props } = await renderWithPreview(longPreview);
    const scrollText = scroll(renderer)
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
    for (let i = 1; i <= 50; i += 1) expect(scrollText).toContain(`Treino número ${i}`);
    expect(scrollText).toContain(IMPORT_INDEPENDENT_NOTICE);

    // Após rolar (simulado), o botão do rodapé continua lá e importa normalmente.
    await act(async () => {
      scroll(renderer).props.onScroll?.({ nativeEvent: { contentOffset: { x: 0, y: 5000 } } });
    });
    await press(renderer, 'Importar planejamento');
    expect(props.onImport).toHaveBeenCalledWith(CODE);
    expect(props.onImported).toHaveBeenCalledWith(program);
  });

  it('ao gerar a prévia, fecha o teclado e rola até ela (uma única vez)', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const { renderer } = await renderWithPreview();
    expect(dismiss).toHaveBeenCalled();

    const scrollArea = scroll(renderer);
    const scrollTo = scrollArea.instance.scrollTo as jest.Mock;
    scrollTo.mockClear();
    const previewWrapper = scrollArea.find((node) => typeof node.props.onLayout === 'function' && node.type === View);
    act(() => {
      previewWrapper.props.onLayout({ nativeEvent: { layout: { x: 0, y: 320, width: 300, height: 900 } } });
    });
    expect(scrollTo).toHaveBeenCalledWith({ y: 320 - spacing.sm, animated: true });

    // Novos layouts (ex.: teclado abrindo) não forçam outra rolagem.
    act(() => {
      previewWrapper.props.onLayout({ nativeEvent: { layout: { x: 0, y: 200, width: 300, height: 900 } } });
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    dismiss.mockRestore();
  });

  it('com o teclado aberto, toques nas ações não são perdidos e o campo continua alcançável pela rolagem', () => {
    const { renderer } = render();
    expect(scroll(renderer).props.keyboardShouldPersistTaps).toBe('handled');
    // O campo está na área rolável (o painel encolhe com o teclado e o conteúdo rola);
    // as ações estão no rodapé fixo, logo acima do teclado.
    expect(scroll(renderer).findAll((node) => node.props.accessibilityLabel === 'Código do planejamento').length).toBeGreaterThan(0);
  });

  it('cancelar continua funcionando com a prévia aberta', async () => {
    const { renderer, props } = await renderWithPreview(longPreview);
    await press(renderer, 'Cancelar importação');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onImport).not.toHaveBeenCalled();
  });
});
