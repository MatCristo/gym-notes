import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TrainingProgram } from '@/features/programs/types/program.types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ProgramCardProps {
  program: TrainingProgram;
  onPress: (program: TrainingProgram) => void;
  /** Abre o menu de opções. O card apenas dispara a ação. */
  onOptionsPress: (program: TrainingProgram) => void;
}

export function formatWorkoutCount(count: number): string {
  if (count === 0) return 'Nenhum treino';
  return count === 1 ? '1 treino' : `${count} treinos`;
}

/** Monograma do planejamento: a inicial do nome (ex.: "Hipertrofia" → "H"). */
function getProgramMonogram(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function ProgramCardComponent({ program, onPress, onOptionsPress }: ProgramCardProps) {
  const workoutLabel = formatWorkoutCount(program.workoutCount);

  return (
    <Pressable
      onPress={() => onPress(program)}
      accessibilityRole="button"
      accessibilityLabel={`${program.name}, ${workoutLabel}`}
      accessibilityHint="Abre os treinos do planejamento"
      android_ripple={{ color: colors.pressedOverlay }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.monogram} importantForAccessibility="no-hide-descendants">
        <Text style={styles.monogramText} numberOfLines={1}>
          {getProgramMonogram(program.name)}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {program.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {workoutLabel}
          {program.description ? ` · ${program.description}` : ''}
        </Text>
      </View>

      <Pressable
        onPress={() => onOptionsPress(program)}
        accessibilityRole="button"
        accessibilityLabel={`Opções de ${program.name}`}
        accessibilityHint="Editar, duplicar ou excluir o planejamento"
        hitSlop={spacing.sm}
        android_ripple={{ color: colors.pressedOverlay, borderless: false }}
        style={({ pressed }) => [styles.optionsButton, pressed && styles.optionsButtonPressed]}
      >
        <Text style={styles.optionsLabel}>•••</Text>
      </Pressable>
    </Pressable>
  );
}

export const ProgramCard = memo(ProgramCardComponent);

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
