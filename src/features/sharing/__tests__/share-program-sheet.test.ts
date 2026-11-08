import { act, createElement } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import {
  SHARE_NOT_ENCRYPTED_NOTICE,
  SHARE_PRIVACY_NOTICE,
  ShareProgramContent,
  type ShareProgramContentProps,
} from '@/features/sharing/components/ShareProgramSheet';
import type { ExportedProgram } from '@/features/sharing/types/sharing.types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Código realista e longo (o painel não pode truncá-lo). */
const exported: ExportedProgram = {
  code: `GN1:${'eyJ2IjoxLCJwIjp7Im4iOiJIaXBlcnRyb2ZpYSJ9fQ'.repeat(40)}.1a2b3c4d`,
  programName: 'Hipertrofia',
  workoutCount: 4,
  exerciseCount: 28,
};

function render(overrides: Partial<ShareProgramContentProps> = {}) {
  const props: ShareProgramContentProps = {
    exported,
    onCopy: jest.fn(async () => true),
    onShare: jest.fn(async () => true),
    onClose: jest.fn(),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(ShareProgramContent, props));
  });
  return { renderer, props };
}

/** Todo o texto visível, concatenado. */
function allText(renderer: ReactTestRenderer): string {
  const parts: string[] = [];
  const walk = (node: ReturnType<ReactTestRenderer['toJSON']>) => {
    if (node === null) return;
    if (typeof node === 'string') parts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else (node.children ?? []).forEach((child) => walk(child as never));
  };
  walk(renderer.toJSON());
  return parts.join(' ');
}

function button(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  return renderer.root.find(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
  );
}

async function press(renderer: ReactTestRenderer, label: string) {
  await act(async () => {
    await button(renderer, label).props.onPress();
  });
}

describe('ShareProgramContent (painel de compartilhamento)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('mostra nome, resumo, avisos de privacidade e o código completo e selecionável', () => {
    const { renderer } = render();
    const codeText = renderer.root.find((node) => node.props.testID === 'share-code' && node.props.selectable === true);

    expect(codeText.props.children).toBe(exported.code);
    expect(codeText.props.numberOfLines).toBeUndefined(); // sem truncamento
    const text = allText(renderer);
    expect(text).toContain('Hipertrofia');
    expect(text).toContain('4 treinos');
    expect(text).toContain('28 exercícios');
    expect(text).toContain(SHARE_PRIVACY_NOTICE);
    expect(text).toContain(SHARE_NOT_ENCRYPTED_NOTICE);
  });

  it('copiar envia exatamente o código e mostra a confirmação, que some depois', async () => {
    const { renderer, props } = render();

    await press(renderer, 'Copiar código');

    expect(props.onCopy).toHaveBeenCalledTimes(1);
    expect(props.onCopy).toHaveBeenCalledWith(exported.code);
    expect(allText(renderer)).toContain('Código copiado. Agora é só colar na conversa.');
    expect(allText(renderer)).toContain('Código copiado ✓');

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(allText(renderer)).not.toContain('Código copiado');
  });

  it('se a cópia falhar, orienta a copiar manualmente', async () => {
    const { renderer } = render({ onCopy: jest.fn(async () => false) });
    await press(renderer, 'Copiar código');
    expect(allText(renderer)).toContain('Selecione o código e copie manualmente');
  });

  it('compartilhar repassa o resultado exportado completo ao compartilhamento nativo', async () => {
    const { renderer, props } = render();
    await press(renderer, 'Compartilhar');
    expect(props.onShare).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledWith(exported);
  });

  it('se o compartilhamento não abrir, sugere copiar o código', async () => {
    const { renderer } = render({ onShare: jest.fn(async () => false) });
    await press(renderer, 'Compartilhar');
    expect(allText(renderer)).toContain('Não foi possível abrir o compartilhamento');
  });

  it('fechar apenas fecha: não copia, não compartilha e não chama mais nada', async () => {
    const { renderer, props } = render();
    await press(renderer, 'Fechar');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onCopy).not.toHaveBeenCalled();
    expect(props.onShare).not.toHaveBeenCalled();
  });

  it('não exibe nenhuma informação de sessões ou desempenho', () => {
    const text = allText(render().renderer).replace(exported.code, '');
    expect(text).not.toMatch(/sess(ão|ões)|realizad|recorde|kg|\d{4}-\d{2}-\d{2}/i);
    // As palavras abaixo só aparecem no aviso que diz que esses dados NÃO são compartilhados.
    expect(text.replace(SHARE_PRIVACY_NOTICE, '')).not.toMatch(/histórico|evolução|desempenho/i);
  });
});

describe('ShareProgramContent: layout (área rolável + rodapé fixo)', () => {
  const scroll = (renderer: ReactTestRenderer) =>
    renderer.root.find((node) => node.props.testID === 'share-scroll' && typeof node.instance?.scrollTo === 'function');
  const footer = (renderer: ReactTestRenderer) =>
    renderer.root.find((node) => node.props.testID === 'share-footer' && node.type === View);
  const within = (container: ReactTestInstance, label: string) =>
    container.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function');
  const flat = (style: unknown) => StyleSheet.flatten(style as StyleProp<ViewStyle>);

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resumo, avisos e o código ficam na área rolável', () => {
    const { renderer } = render();
    const scrollArea = scroll(renderer);
    const texts = scrollArea.findAll((node) => typeof node.props.children === 'string').map((node) => node.props.children);
    expect(texts).toEqual(expect.arrayContaining(['Compartilhar planejamento', 'Hipertrofia', SHARE_PRIVACY_NOTICE]));
    expect(texts).toContain(SHARE_NOT_ENCRYPTED_NOTICE);
    // O código integral e selecionável está dentro da área rolável.
    const code = scrollArea.find((node) => node.props.testID === 'share-code' && node.props.selectable === true);
    expect(code.props.children).toBe(exported.code);
  });

  it('Compartilhar, Copiar código e Fechar ficam no rodapé, fora da área rolável', () => {
    const { renderer } = render();
    for (const label of ['Compartilhar', 'Copiar código', 'Fechar']) {
      expect(within(footer(renderer), label).length).toBeGreaterThan(0);
      expect(within(scroll(renderer), label)).toHaveLength(0);
    }
  });

  it('a área rolável encolhe para caber no painel e o rodapé nunca encolhe', () => {
    const { renderer } = render();
    const content = renderer.root.findAll((node) => node.type === View)[0]!;
    expect(flat(content.props.style)).toMatchObject({ flexShrink: 1 });
    expect(flat(scroll(renderer).props.style)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
    expect(flat(footer(renderer).props.style)).toMatchObject({ flexShrink: 0 });
  });

  it('a confirmação da cópia aparece no rodapé, junto dos botões', async () => {
    const { renderer, props } = render();
    await act(async () => {
      scroll(renderer).props.onScroll?.({ nativeEvent: { contentOffset: { x: 0, y: 400 } } });
    });
    await press(renderer, 'Copiar código');
    expect(props.onCopy).toHaveBeenCalledWith(exported.code);
    const footerTexts = footer(renderer)
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children);
    expect(footerTexts).toContain('Código copiado. Agora é só colar na conversa.');
  });

  it('compartilhar e fechar continuam funcionando a partir do rodapé', async () => {
    const { renderer, props } = render();
    await press(renderer, 'Compartilhar');
    expect(props.onShare).toHaveBeenCalledWith(exported);
    await press(renderer, 'Fechar');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
