import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  /** Aceita texto e elementos <Text> aninhados (ex.: nome em destaque). */
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Usa o estilo de ação destrutiva no botão de confirmação. */
  destructive?: boolean;
  onConfirm: () => void;
  /** Disparado pelo botão cancelar, toque fora do diálogo ou botão voltar do Android. */
  onCancel: () => void;
  /** Enquanto `true`, a confirmação fica bloqueada e exibe `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
}

/**
 * Diálogo de confirmação genérico, alinhado ao tema do app.
 * Qualquer forma de fechar sem tocar em confirmar é tratada como cancelamento.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
  busy = false,
  busyLabel = 'Aguarde…',
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Fechar confirmação"
        />

        <View style={styles.dialog} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <PrimaryButton label={cancelLabel} variant="secondary" onPress={onCancel} style={styles.action} />
            <PrimaryButton
              label={busy ? busyLabel : confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              disabled={busy}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: layout.screenPaddingHorizontal,
    backgroundColor: colors.overlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  action: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
