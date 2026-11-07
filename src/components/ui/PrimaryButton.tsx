import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type PrimaryButtonVariant = 'primary' | 'secondary' | 'danger';
type PrimaryButtonSize = 'regular' | 'compact';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: PrimaryButtonVariant;
  size?: PrimaryButtonSize;
  disabled?: boolean;
  /** Texto curto exibido antes do rótulo, ex.: "+". Ignorado por leitores de tela. */
  leadingSymbol?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  size = 'regular',
  disabled = false,
  leadingSymbol,
  accessibilityLabel,
  accessibilityHint,
  style,
}: PrimaryButtonProps) {
  const isFilled = variant !== 'secondary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      android_ripple={{ color: isFilled ? 'rgba(0, 0, 0, 0.12)' : colors.pressedOverlay }}
      hitSlop={size === 'compact' ? spacing.xs : undefined}
      style={({ pressed }) => [
        styles.base,
        size === 'compact' ? styles.compact : styles.regular,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[styles.label, isFilled ? styles.filledLabel : styles.secondaryLabel]}
        numberOfLines={1}
      >
        {leadingSymbol ? <Text style={styles.leadingSymbol}>{`${leadingSymbol} `}</Text> : null}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  regular: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.xl,
  },
  compact: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.error,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...typography.button,
  },
  filledLabel: {
    color: colors.onPrimary,
  },
  secondaryLabel: {
    color: colors.textPrimary,
  },
  leadingSymbol: {
    fontSize: 18,
    fontWeight: '800',
  },
});
