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
  /** Campo de várias linhas (ex.: observações). */
  multiline?: boolean;
  /** Texto curto à direita, abaixo do campo (ex.: contador "12/200"). */
  counter?: string;
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
  multiline = false,
  counter,
  style,
}: TextFieldProps) {
  const hasError = typeof error === 'string' && error.length > 0;

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, multiline && styles.inputWrapperMultiline, hasError && styles.inputWrapperError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : undefined}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          accessibilityLabel={label}
          accessibilityHint={hasError ? error : undefined}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {suffix ? (
          <Text style={styles.suffix} importantForAccessibility="no">
            {suffix}
          </Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Text style={styles.error} accessibilityLiveRegion="polite" numberOfLines={2}>
          {hasError ? error : ''}
        </Text>
        {counter !== undefined ? (
          <Text style={styles.counter} importantForAccessibility="no">
            {counter}
          </Text>
        ) : null}
      </View>
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
  inputWrapperMultiline: {
    alignItems: 'flex-start',
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
  inputMultiline: {
    minHeight: 72,
    maxHeight: 120,
    paddingVertical: spacing.md,
  },
  suffix: {
    ...typography.caption,
    marginLeft: spacing.sm,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  error: {
    ...typography.caption,
    flex: 1,
    minHeight: 18,
    color: colors.error,
  },
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
