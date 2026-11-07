import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Mensagem de erro; quando presente, destaca o campo. */
  error?: string | null;
  /** Unidade exibida dentro do campo, à direita (ex.: "kg"). */
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<ViewStyle>;
}

/** Campo de texto com rótulo, unidade opcional e mensagem de erro, no padrão visual do app. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  suffix,
  keyboardType,
  maxLength,
  autoFocus,
  autoCapitalize = 'none',
  style,
}: TextFieldProps) {
  const hasError = typeof error === 'string' && error.length > 0;

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, hasError && styles.inputWrapperError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          accessibilityLabel={label}
          accessibilityHint={hasError ? error : undefined}
          style={styles.input}
        />
        {suffix ? (
          <Text style={styles.suffix} importantForAccessibility="no">
            {suffix}
          </Text>
        ) : null}
      </View>
      <Text style={styles.error} accessibilityLiveRegion="polite" numberOfLines={2}>
        {hasError ? error : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: layout.minTouchTarget,
    paddingVertical: 0,
    color: colors.textPrimary,
  },
  suffix: {
    ...typography.caption,
    marginLeft: spacing.sm,
    color: colors.textSecondary,
  },
  error: {
    ...typography.caption,
    minHeight: 18,
    color: colors.error,
  },
});
