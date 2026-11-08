import { useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatWorkoutCount } from '@/features/programs/components/ProgramCard';
import type { TrainingProgram } from '@/features/programs/types/program.types';
import type { ImportPreviewResult, PasteResult, ProgramImportResult } from '@/features/sharing/hooks/useProgramImport';
import type { ImportPreview } from '@/features/sharing/types/sharing.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export const IMPORT_INDEPENDENT_NOTICE =
  'A importação cria uma cópia independente. Nenhum planejamento existente será alterado ou substituído.';
export const IMPORT_PRIVACY_NOTICE = 'Somente a estrutura e as prescrições dos treinos são importadas.';

type Busy = 'none' | 'pasting' | 'previewing' | 'importing';

function formatExerciseTotal(count: number): string {
  if (count === 0) return 'nenhum exercício';
  return count === 1 ? '1 exercício' : `${count} exercícios`;
}

export interface ImportProgramContentProps {
  onPaste: () => Promise<PasteResult>;
  onPreview: (code: string) => Promise<ImportPreviewResult>;
  onImport: (code: string) => Promise<ProgramImportResult>;
  /** Chamado após importar com sucesso (a tela fecha a interface e atualiza a lista). */
  onImported: (program: TrainingProgram) => void;
  onClose: () => void;
  /** Avisa quando há uma operação em andamento (para bloquear o fechamento do painel). */
  onBusyChange?: (busy: boolean) => void;
}

function PreviewCard({ preview }: { preview: ImportPreview }) {
  const renamed = preview.finalName !== preview.name;
  return (
    <View style={styles.preview} testID="import-preview">
      <Text style={styles.label}>Prévia</Text>
      <Text style={styles.previewTitle} numberOfLines={2}>
        {preview.name}
      </Text>
      {preview.description ? <Text style={styles.previewDescription}>{preview.description}</Text> : null}
      <Text style={styles.meta}>
        {formatWorkoutCount(preview.workoutCount)} · {formatExerciseTotal(preview.exerciseCount)}
      </Text>

      <View style={styles.workoutList}>
        {preview.workouts.map((workout, index) => (
          // Treinos podem ter nomes repetidos: a posição compõe a chave.
          <View key={`${index}-${workout.name}`} style={styles.workoutRow}>
            <Text style={styles.workoutName} numberOfLines={1}>
              {workout.name}
            </Text>
            <Text style={styles.workoutCount}>{formatExerciseTotal(workout.exerciseCount)}</Text>
          </View>
        ))}
      </View>

      {renamed ? (
        <Text style={styles.renamed}>
          Já existe um planejamento com esse nome. Ele será importado como{' '}
          <Text style={styles.renamedName}>“{preview.finalName}”</Text>.
        </Text>
      ) : null}
      <Text style={styles.notice}>{IMPORT_INDEPENDENT_NOTICE}</Text>
      <Text style={styles.noticeSecondary}>{IMPORT_PRIVACY_NOTICE}</Text>
    </View>
  );
}

/**
 * Fluxo de importação: colar → ver prévia → confirmar. Separado do BottomSheet para ser testável.
 * A prévia vale somente para o texto exato que a gerou: qualquer alteração a invalida.
 */
export function ImportProgramContent({
  onPaste,
  onPreview,
  onImport,
  onImported,
  onClose,
  onBusyChange,
}: ImportProgramContentProps) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<{ code: string; data: ImportPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusyState] = useState<Busy>('none');
  /** Texto atual e operação em andamento, lidos de forma síncrona (evita corridas e toques duplos). */
  const codeRef = useRef('');
  const busyRef = useRef<Busy>('none');
  const scrollRef = useRef<ScrollView>(null);
  /** Após gerar uma prévia, rola até ela assim que for posicionada na tela. */
  const scrollToPreviewRef = useRef(false);

  const setBusy = (next: Busy) => {
    busyRef.current = next;
    setBusyState(next);
    onBusyChange?.(next !== 'none');
  };

  const updateCode = (text: string) => {
    codeRef.current = text;
    setCode(text);
    // Qualquer alteração invalida a prévia anterior: é preciso validar de novo.
    setPreview(null);
    setError(null);
  };

  const handlePaste = async () => {
    if (busyRef.current !== 'none') return;
    setBusy('pasting');
    try {
      const result = await onPaste();
      if (result.ok) updateCode(result.text);
      else setError(result.message);
    } finally {
      setBusy('none');
    }
  };

  const handlePreview = async () => {
    if (busyRef.current !== 'none') return;
    const requested = codeRef.current;
    // Fecha o teclado para liberar espaço para a prévia e para o rodapé de ações.
    Keyboard.dismiss();
    setError(null);
    setBusy('previewing');
    try {
      const result = await onPreview(requested);
      if (codeRef.current !== requested) return; // o texto mudou enquanto a prévia era gerada
      if (result.ok) {
        scrollToPreviewRef.current = true;
        setPreview({ code: requested, data: result.preview });
      } else {
        setError(result.message);
      }
    } finally {
      setBusy('none');
    }
  };

  const handleImport = async () => {
    if (busyRef.current !== 'none' || !preview || preview.code !== codeRef.current) return;
    setError(null);
    setBusy('importing');
    let imported: TrainingProgram | null = null;
    try {
      // O serviço decodifica e valida de novo e recalcula o nome: a prévia não é reaproveitada.
      const result = await onImport(preview.code);
      if (result.ok) imported = result.program;
      else setError(result.message); // a interface continua aberta para corrigir ou tentar de novo
    } finally {
      setBusy('none');
    }
    if (imported) onImported(imported);
  };

  const handlePreviewLayout = (event: LayoutChangeEvent) => {
    if (!scrollToPreviewRef.current) return;
    scrollToPreviewRef.current = false;
    scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - spacing.sm), animated: true });
  };

  const isBusy = busy !== 'none';
  const canPreview = !isBusy && code.trim().length > 0;

  // Layout: área rolável (texto, campo e prévia) + rodapé fixo com as ações, como no ExerciseFormSheet.
  // O ScrollView encolhe para caber no limite de altura do BottomSheet; o rodapé fica sempre visível.
  return (
    <View style={styles.content}>
      <ScrollView
        ref={scrollRef}
        testID="import-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <Text style={styles.overline}>Importar planejamento</Text>
        <Text style={styles.title} accessibilityRole="header">
          Cole o código recebido
        </Text>
        <Text style={styles.description}>
          Pode colar a mensagem inteira do WhatsApp: o Gym Notes encontra o código sozinho.
        </Text>

        <TextInput
          value={code}
          onChangeText={updateCode}
          placeholder="GN1:…"
          placeholderTextColor={colors.textSecondary}
          multiline
          editable={busy !== 'importing'}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          importantForAutofill="no"
          textAlignVertical="top"
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          accessibilityLabel="Código do planejamento"
          style={[styles.input, error !== null && styles.inputError]}
        />

        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error ?? ''}
        </Text>

        {preview ? (
          <View onLayout={handlePreviewLayout}>
            <PreviewCard preview={preview.data} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer} testID="import-footer">
        {preview ? (
          <PrimaryButton
            label={busy === 'importing' ? 'Importando…' : 'Importar planejamento'}
            onPress={handleImport}
            disabled={isBusy}
            accessibilityLabel="Importar planejamento"
          />
        ) : (
          <View style={styles.row}>
            <PrimaryButton
              label={busy === 'pasting' ? 'Colando…' : 'Colar código'}
              variant="secondary"
              onPress={handlePaste}
              disabled={isBusy}
              accessibilityLabel="Colar código"
              style={styles.rowButton}
            />
            <PrimaryButton
              label={busy === 'previewing' ? 'Validando…' : 'Ver prévia'}
              onPress={handlePreview}
              disabled={!canPreview}
              accessibilityLabel="Ver prévia"
              style={styles.rowButton}
            />
          </View>
        )}

        <PrimaryButton
          label="Cancelar"
          variant="secondary"
          onPress={onClose}
          disabled={busy === 'importing'}
          accessibilityLabel="Cancelar importação"
        />
      </View>
    </View>
  );
}

interface ImportProgramModalProps extends Omit<ImportProgramContentProps, 'onBusyChange'> {
  visible: boolean;
}

/** Painel de importação. Fechar descarta o código digitado (nada é salvo). */
export function ImportProgramModal({ visible, onClose, ...contentProps }: ImportProgramModalProps) {
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        if (!busy) onClose();
      }}
      closeAccessibilityLabel="Fechar importação"
    >
      <ImportProgramContent {...contentProps} onClose={onClose} onBusyChange={setBusy} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  /** Encolhe dentro do limite de altura do BottomSheet (92% da tela). */
  content: {
    flexShrink: 1,
    gap: spacing.sm,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  /** Ações sempre visíveis, fora da área rolável. */
  footer: {
    flexShrink: 0,
    gap: spacing.sm,
  },
  overline: {
    ...typography.overline,
    color: colors.primary,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  input: {
    ...typography.caption,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    minHeight: 96,
    maxHeight: 160,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    ...typography.caption,
    minHeight: 18,
    color: colors.error,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowButton: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  preview: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  label: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  previewTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  previewDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  workoutList: {
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: layout.minTouchTarget / 2,
    alignItems: 'center',
  },
  workoutName: {
    ...typography.body,
    flex: 1,
    color: colors.textPrimary,
  },
  workoutCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  renamed: {
    ...typography.caption,
    marginTop: spacing.xs,
    color: colors.textPrimary,
  },
  renamedName: {
    fontWeight: '700',
    color: colors.primary,
  },
  notice: {
    ...typography.caption,
    marginTop: spacing.xs,
    color: colors.textPrimary,
  },
  noticeSecondary: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
