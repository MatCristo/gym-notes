import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatRest } from '@/features/exercises/utils/exercise.format';
import { SET_ROW_COLUMNS, SetRow } from '@/features/sessions/components/SetRow';
import type { SessionExercise, SetActuals, SetLog } from '@/features/sessions/types/session.types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface SessionExerciseCardProps {
  exercise: SessionExercise;
  onCompleteSet: (exercise: SessionExercise, set: SetLog, actuals: SetActuals) => Promise<void>;
  onUncompleteSet: (set: SetLog) => Promise<void>;
  onSaveSetActuals: (set: SetLog, actuals: SetActuals) => Promise<void>;
}

function SessionExerciseCardComponent({
  exercise,
  onCompleteSet,
  onUncompleteSet,
  onSaveSetActuals,
}: SessionExerciseCardProps) {
  const completed = exercise.sets.filter((set) => set.completedAt !== null).length;
  const rest = formatRest(exercise.plannedRestSeconds);
  const allDone = completed === exercise.sets.length && exercise.sets.length > 0;

  return (
    <View style={[styles.card, allDone && styles.cardDone]}>
      <View style={styles.header}>
        <Text style={styles.name} accessibilityRole="header">
          {exercise.exerciseNameSnapshot}
        </Text>
        {exercise.observationSnapshot ? (
          <Text style={styles.observation} testID="session-exercise-observation">
            {exercise.observationSnapshot}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {completed}/{exercise.sets.length} séries{rest ? ` · Descanso ${rest}` : ''}
        </Text>
      </View>

      <View style={styles.columns} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.columnLabel, styles.columnFlex]}>Planejado</Text>
        <Text style={[styles.columnLabel, { width: SET_ROW_COLUMNS.weight }]}>kg</Text>
        <Text style={[styles.columnLabel, { width: SET_ROW_COLUMNS.reps }]}>Reps</Text>
        <View style={{ width: SET_ROW_COLUMNS.check }} />
      </View>

      {exercise.sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          onComplete={(target, actuals) => onCompleteSet(exercise, target, actuals)}
          onUncomplete={onUncompleteSet}
          onSaveActuals={onSaveSetActuals}
        />
      ))}
    </View>
  );
}

export const SessionExerciseCard = memo(SessionExerciseCardComponent);

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardDone: {
    borderColor: colors.primary,
  },
  header: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xxs,
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  /** Observação congelada no início da sessão: secundária e discreta, abaixo do nome. */
  observation: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  columnFlex: {
    flex: 1,
    textAlign: 'left',
  },
  columnLabel: {
    ...typography.overline,
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
