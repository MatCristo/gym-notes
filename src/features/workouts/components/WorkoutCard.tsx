import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';

import { GripDots } from '@/components/ui/GripDots';
import type { Workout } from '@/features/workouts/types/workout.types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface WorkoutCardProps {
  workout: Workout;
  onPress: (workout: Workout) => void;
  /** Abre o menu de opções (editar/excluir). O card apenas dispara a ação. */
  onOptionsPress: (workout: Workout) => void;
  /** Quando `false`, o card não pode ser arrastado (ex.: lista com 1 item). */
  draggable: boolean;
  /** Há uma sessão deste treino em andamento. */
  inProgress?: boolean;
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

/** Tempo segurando a alça para começar a arrastar (mesmo valor dos exercícios). */
const HANDLE_DRAG_DELAY_MS = 150;

/** Card de treino para a lista reordenável. Deve ser renderizado dentro de `ReorderableList`. */
function WorkoutCardComponent({ workout, onPress, onOptionsPress, draggable, inProgress = false }: WorkoutCardProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const exerciseLabel = formatExerciseCount(workout.exerciseCount);

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={styles.cell}>
      <Pressable
        onPress={() => onPress(workout)}
        onLongPress={draggable ? drag : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${workout.name}, ${exerciseLabel}${inProgress ? ', em andamento' : ''}`}
        accessibilityHint={draggable ? 'Toque para abrir. Segure para reordenar.' : 'Abre os detalhes do treino'}
        android_ripple={{ color: colors.pressedOverlay }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, isActive && styles.cardActive]}
      >
        {draggable ? (
          <Pressable
            onLongPress={drag}
            delayLongPress={HANDLE_DRAG_DELAY_MS}
            accessibilityLabel={`Arrastar ${workout.name}`}
            hitSlop={spacing.sm}
            style={[styles.handle, isActive && styles.handleActive]}
          >
            <GripDots />
          </Pressable>
        ) : null}

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
            {inProgress ? <Text style={styles.metaActive}> · Em andamento</Text> : null}
          </Text>
        </View>

        <Pressable
          onPress={() => onOptionsPress(workout)}
          accessibilityRole="button"
          accessibilityLabel={`Opções do ${workout.name}`}
          accessibilityHint="Iniciar, editar, duplicar ou excluir o treino"
          hitSlop={spacing.sm}
          android_ripple={{ color: colors.pressedOverlay, borderless: false }}
          style={({ pressed }) => [styles.optionsButton, pressed && styles.optionsButtonPressed]}
        >
          <Text style={styles.optionsLabel}>•••</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export const WorkoutCard = memo(WorkoutCardComponent);

const MONOGRAM_SIZE = 48;
const HANDLE_WIDTH = 20;

const styles = StyleSheet.create({
  /** Espaço entre itens dentro da própria célula (separadores interferem no cálculo do arrasto). */
  cell: {
    paddingBottom: spacing.md,
  },
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
  cardActive: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  handle: {
    width: HANDLE_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  handleActive: {
    backgroundColor: colors.primary,
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
  metaActive: {
    color: colors.primary,
    fontWeight: '700',
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
