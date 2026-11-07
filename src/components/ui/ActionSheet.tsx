import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export interface ActionSheetAction {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
}

interface ActionSheetProps {
  visible: boolean;
  overline: string;
  title: string;
  actions: readonly ActionSheetAction[];
  onClose: () => void;
  cancelLabel?: string;
}

interface ActionItemProps {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
}

function ActionItem({ label, onPress, destructive = false, accessibilityLabel }: ActionItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      android_ripple={{ color: colors.pressedOverlay }}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Text style={[styles.itemLabel, destructive && styles.itemLabelDestructive]}>{label}</Text>
    </Pressable>
  );
}

/** Menu de opções genérico em painel inferior. Apenas dispara as ações recebidas. */
export function ActionSheet({ visible, overline, title, actions, onClose, cancelLabel = 'Cancelar' }: ActionSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} closeAccessibilityLabel="Fechar opções">
      <Text style={styles.overline}>{overline}</Text>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>

      <View style={styles.group}>
        {actions.map((action, index) => (
          <View key={action.key}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <ActionItem
              label={action.label}
              onPress={action.onPress}
              destructive={action.destructive}
              accessibilityLabel={action.accessibilityLabel}
            />
          </View>
        ))}
      </View>

      <ActionItem label={cancelLabel} onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  overline: {
    ...typography.overline,
    color: colors.primary,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  group: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  item: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  itemPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  itemLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  itemLabelDestructive: {
    color: colors.error,
  },
});
