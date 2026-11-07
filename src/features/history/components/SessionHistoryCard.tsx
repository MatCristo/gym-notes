import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SessionHistoryItem } from '@/features/history/types/history.types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatTime, formatWeekdayDate } from '@/utils/date-format';
import { formatDuration } from '@/utils/time-format';

interface SessionHistoryCardProps {
  session: SessionHistoryItem;
  onPress: (session: SessionHistoryItem) => void;
}

function SessionHistoryCardComponent({ session, onPress }: SessionHistoryCardProps) {
  const date = formatWeekdayDate(session.startedAt);
  const time = formatTime(session.startedAt);
  const duration = formatDuration(session.durationMs);
  const exercises = session.exercisesPerformed === 1 ? '1 exercício' : `${session.exercisesPerformed} exercícios`;
  const sets = session.completedSets === 1 ? '1 série' : `${session.completedSets} séries`;

  return (
    <Pressable
      onPress={() => onPress(session)}
      accessibilityRole="button"
      accessibilityLabel={`${session.workoutName}, ${date} às ${time}, ${duration}, ${exercises}, ${sets} concluídas`}
      accessibilityHint="Abre os detalhes do treino"
      android_ripple={{ color: colors.pressedOverlay }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.dateBox} importantForAccessibility="no-hide-descendants">
        <Text style={styles.dateText} numberOfLines={2}>
          {date}
        </Text>
        <Text style={styles.timeText}>{time}</Text>
      </View>

      <View style={styles.info} importantForAccessibility="no-hide-descendants">
        <Text style={styles.name} numberOfLines={1}>
          {session.workoutName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {duration} · {exercises}
        </Text>
        <Text style={styles.sets} numberOfLines={1}>
          {sets} concluídas
          {session.completedSets < session.plannedSets ? (
            <Text style={styles.planned}> de {session.plannedSets}</Text>
          ) : null}
        </Text>
      </View>

      <Text style={styles.chevron} importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

export const SessionHistoryCard = memo(SessionHistoryCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  dateBox: {
    width: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  dateText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.primary,
  },
  timeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sets: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  planned: {
    fontWeight: '400',
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
});
