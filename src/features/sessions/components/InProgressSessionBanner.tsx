import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ElapsedClock } from '@/features/sessions/components/ElapsedClock';
import type { WorkoutSession } from '@/features/sessions/types/session.types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface InProgressSessionBannerProps {
  session: WorkoutSession;
  onPress: (session: WorkoutSession) => void;
}

/** Destaque de uma sessão em andamento, para retomar (ex.: após reabrir o app). */
export function InProgressSessionBanner({ session, onPress }: InProgressSessionBannerProps) {
  return (
    <Pressable
      onPress={() => onPress(session)}
      accessibilityRole="button"
      accessibilityLabel={`Treino em andamento: ${session.workoutNameSnapshot}`}
      accessibilityHint="Continua o treino"
      android_ripple={{ color: colors.pressedOverlay }}
      style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
    >
      <View style={styles.dot} />
      <View style={styles.info}>
        <Text style={styles.overline}>Treino em andamento</Text>
        <Text style={styles.name} numberOfLines={1}>
          {session.workoutNameSnapshot}
        </Text>
      </View>
      <View style={styles.side}>
        <ElapsedClock startedAt={session.startedAt} style={styles.clock} />
        <Text style={styles.action}>Continuar ›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  bannerPressed: {
    opacity: 0.85,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  info: {
    flex: 1,
    gap: spacing.xxs,
  },
  overline: {
    ...typography.overline,
    color: colors.primary,
  },
  name: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  side: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  clock: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  action: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
});
