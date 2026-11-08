import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';

import { GripDots } from '@/components/ui/GripDots';
import type { Exercise } from '@/features/exercises/types/exercise.types';
import { formatExercisePlan, formatRest } from '@/features/exercises/utils/exercise.format';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ExerciseCardProps {
  exercise: Exercise;
  /** Posição exibida (1, 2, 3...). */
  position: number;
  onPress: (exercise: Exercise) => void;
  onOptionsPress: (exercise: Exercise) => void;
  /** Quando `false`, o card não pode ser arrastado (ex.: lista com 1 item). */
  draggable: boolean;
}

/** Tempo segurando a alça para começar a arrastar (curto, mas evita arrastar ao rolar a lista). */
const HANDLE_DRAG_DELAY_MS = 150;

/** Card de exercício para a lista reordenável. Deve ser renderizado dentro de `ReorderableList`. */
function ExerciseCardComponent({ exercise, position, onPress, onOptionsPress, draggable }: ExerciseCardProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const plan = formatExercisePlan(exercise);
  const rest = formatRest(exercise.restSeconds);

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.cell}>
      <Pressable
        onPress={() => onPress(exercise)}
        onLongPress={draggable ? drag : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${position}º, ${exercise.name}, ${plan}${rest ? `, descanso de ${rest}` : ''}`}
        accessibilityHint={draggable ? 'Toque para editar. Segure para reordenar.' : 'Edita o exercício'}
        android_ripple={{ color: colors.pressedOverlay }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, isActive && styles.cardActive]}
      >
        <Pressable
          onLongPress={draggable ? drag : undefined}
          delayLongPress={HANDLE_DRAG_DELAY_MS}
          disabled={!draggable}
          accessibilityLabel={`Arrastar ${exercise.name}`}
          hitSlop={spacing.sm}
          style={[styles.handle, isActive && styles.handleActive]}
        >
          <Text style={[styles.positionText, isActive && styles.positionTextActive]}>{position}</Text>
          {draggable ? <GripDots /> : null}
        </Pressable>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {exercise.name}
          </Text>
          <Text style={styles.plan}>{plan}</Text>
          {rest ? <Text style={styles.rest}>Descanso {rest}</Text> : null}
        </View>

        <Pressable
          onPress={() => onOptionsPress(exercise)}
          accessibilityRole="button"
          accessibilityLabel={`Opções de ${exercise.name}`}
          accessibilityHint="Editar ou excluir o exercício"
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

export const ExerciseCard = memo(ExerciseCardComponent);

const HANDLE_WIDTH = 32;

const styles = StyleSheet.create({
  /** Espaço entre itens dentro da própria célula (separadores interferem no cálculo do arrasto). */
  cell: {
    paddingBottom: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
    gap: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: spacing.sm,
  },
  handleActive: {
    backgroundColor: colors.primary,
  },
  positionText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  positionTextActive: {
    color: colors.onPrimary,
  },
  info: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  plan: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rest: {
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
