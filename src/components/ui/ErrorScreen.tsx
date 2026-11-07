import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ErrorScreenProps {
  title: string;
  description: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
}

/** Tela cheia de erro no padrão visual do app. Nunca exibe detalhes técnicos ao usuário. */
export function ErrorScreen({ title, description, primaryAction, secondaryAction }: ErrorScreenProps) {
  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.content}>
      <View style={styles.badge} importantForAccessibility="no-hide-descendants">
        <Text style={styles.badgeText}>!</Text>
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.actions}>
        {primaryAction ? <PrimaryButton label={primaryAction.label} onPress={primaryAction.onPress} /> : null}
        {secondaryAction ? (
          <PrimaryButton label={secondaryAction.label} variant="secondary" onPress={secondaryAction.onPress} />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    gap: spacing.md,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.display,
    color: colors.error,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
