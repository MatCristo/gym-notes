import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Workout } from '@/features/workouts/types/workout.types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface WorkoutCardProps {
  workout: Workout;
  onPress: (workout: Workout) => void;
  /** Abre o menu de opções (editar/excluir). O card apenas dispara a ação. */
  onOptionsPress: (workout: Workout) => void;
}

export function formatExerciseCount(count: number): string {
  if (count === 0) return 'Nenhum exercício';
  return count === 1 ? '1 exercício' : `${count} exercícios`;
}

/** Monograma do treino: a última "palavra" de 1 caractere (ex.: "Treino A" → "A") ou a inicial do nome. */
function getWorkoutMonogram(name: string): string {
  const words = name.trim().split(/\s+/);
  const lastWord = words[words.length - 1] ?? '';
  const source = lastWord.length <= 2 ? lastWord : (words[0] ?? '');
  return (source || '?').toUpperCase();
}

function WorkoutCardComponent({ workout, onPress, onOptionsPress }: WorkoutCardProps) {
  const exerciseLabel = formatExerciseCount(workout.exerciseCount);

  return (
    <Pressable
      onPress={() => onPress(workout)}
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${exerciseLabel}`}
      accessibilityHint="Abre os detalhes do treino"
      android_ripple={{ color: colors.pressedOverlay }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.monogram} importantForAccessibility="no-hide-descendants">
        <Text style={styles.monogramText} numberOfLines={1} adjustsFontSizeToFit>
          {getWorkoutMonogram(workout.name)}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {workout.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {exerciseLabel}
        </Text>
      </View>

      <Pressable
        onPress={() => onOptionsPress(workout)}
        accessibilityRole="button"
        accessibilityLabel={`Opções do ${workout.name}`}
        accessibilityHint="Editar ou excluir o treino"
        hitSlop={spacing.sm}
        android_ripple={{ color: colors.pressedOverlay, borderless: false }}
        style={({ pressed }) => [styles.optionsButton, pressed && styles.optionsButtonPressed]}
      >
        <Text style={styles.optionsLabel}>•••</Text>
      </Pressable>
    </Pressable>
  );
}

export const WorkoutCard = memo(WorkoutCardComponent);

const MONOGRAM_SIZE = 48;

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
  monogram: {
    width: MONOGRAM_SIZE,
    height: MONOGRAM_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  monogramText: {
    ...typography.title,
    color: colors.primary,
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
  optionsButton: {
    minHeight: 36,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  optionsButtonPressed: {
    borderColor: colors.primary,
  },
  optionsLabel: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textPrimary,
  },
});
