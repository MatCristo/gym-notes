import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatWorkoutCount } from '@/features/programs/components/ProgramCard';
import type { ExportedProgram } from '@/features/sharing/types/sharing.types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export const SHARE_PRIVACY_NOTICE =
  'Este compartilhamento inclui somente a estrutura e as prescrições dos treinos. Histórico, evolução e desempenho pessoal não são compartilhados.';
export const SHARE_NOT_ENCRYPTED_NOTICE = 'O código não é criptografado: quem recebê-lo poderá ver este planejamento.';

const FEEDBACK_DURATION_MS = 2500;

type Feedback = { type: 'success' | 'error'; message: string } | null;

function formatExerciseTotal(count: number): string {
  if (count === 0) return 'nenhum exercício';
  return count === 1 ? '1 exercício' : `${count} exercícios`;
}

export interface ShareProgramContentProps {
  exported: ExportedProgram;
  /** Copia o código. Resolve `true` se copiou. */
  onCopy: (code: string) => Promise<boolean>;
  /** Abre o compartilhamento nativo. Resolve `false` se não foi possível abrir. */
  onShare: (exported: ExportedProgram) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Conteúdo do painel: resumo, aviso de privacidade, código completo (selecionável) e ações.
 * Separado do BottomSheet para poder ser testado isoladamente.
 */
export function ShareProgramContent({ exported, onCopy, onShare, onClose }: ShareProgramContentProps) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const handleCopy = async () => {
    const copied = await onCopy(exported.code);
    // Toasts ficam atrás do Modal no Android: a confirmação aparece dentro do próprio painel.
    setFeedback(
      copied
        ? { type: 'success', message: 'Código copiado. Agora é só colar na conversa.' }
        : { type: 'error', message: 'Não foi possível copiar. Selecione o código e copie manualmente.' },
    );
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const opened = await onShare(exported);
      if (!opened) setFeedback({ type: 'error', message: 'Não foi possível abrir o compartilhamento. Use “Copiar código”.' });
    } finally {
      setIsSharing(false);
    }
  };

  const copied = feedback?.type === 'success';

  // Layout: área rolável (resumo, avisos e código) + rodapé fixo com as ações, como no ImportProgramModal.
  // A área rolável encolhe para caber no limite de altura do BottomSheet; o rodapé fica sempre visível.
  return (
    <View style={styles.content}>
      <ScrollView testID="share-scroll" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.overline}>Compartilhar planejamento</Text>
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
          {exported.programName}
        </Text>
        <Text style={styles.meta}>
          {formatWorkoutCount(exported.workoutCount)} · {formatExerciseTotal(exported.exerciseCount)}
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>{SHARE_PRIVACY_NOTICE}</Text>
          <Text style={styles.noticeSecondary}>{SHARE_NOT_ENCRYPTED_NOTICE}</Text>
        </View>

        <Text style={styles.label} nativeID="share-code-label">
          Código
        </Text>
        <ScrollView style={styles.codeBox} contentContainerStyle={styles.codeContent} nestedScrollEnabled>
          <Text
            selectable
            style={styles.code}
            accessibilityLabelledBy="share-code-label"
            accessibilityHint="Toque e segure para selecionar e copiar manualmente"
            testID="share-code"
          >
            {exported.code}
          </Text>
        </ScrollView>
      </ScrollView>

      <View style={styles.footer} testID="share-footer">
        <Text
          style={[styles.feedback, feedback?.type === 'error' && styles.feedbackError]}
          accessibilityLiveRegion="polite"
        >
          {feedback?.message ?? ''}
        </Text>

        <PrimaryButton label={isSharing ? 'Abrindo…' : 'Compartilhar'} onPress={handleShare} disabled={isSharing} />
        <PrimaryButton
          label={copied ? 'Código copiado ✓' : 'Copiar código'}
          variant="secondary"
          onPress={handleCopy}
          accessibilityLabel="Copiar código"
        />
        <PrimaryButton label="Fechar" variant="secondary" onPress={onClose} />
      </View>
    </View>
  );
}

interface ShareProgramSheetProps extends ShareProgramContentProps {
  visible: boolean;
}

/** Painel de compartilhamento de um planejamento já exportado. Fechar não altera nenhum dado. */
export function ShareProgramSheet({ visible, onClose, ...contentProps }: ShareProgramSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} closeAccessibilityLabel="Fechar compartilhamento">
      <ShareProgramContent {...contentProps} onClose={onClose} />
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
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  notice: {
    marginTop: spacing.sm,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  noticeText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  noticeSecondary: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  label: {
    ...typography.overline,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  codeBox: {
    maxHeight: 132,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeContent: {
    padding: spacing.md,
  },
  code: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  feedback: {
    ...typography.caption,
    minHeight: 18,
    color: colors.primary,
  },
  feedbackError: {
    color: colors.error,
  },
});
