import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { parseSetActuals } from '@/features/sessions/services/session.service';
import type { SetActuals, SetLog } from '@/features/sessions/types/session.types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatKg } from '@/utils/number-format';
import { formatNumberForInput } from '@/utils/number-input';

interface SetRowProps {
  set: SetLog;
  /** As funções abaixo não devem rejeitar: o pai trata erros e avisa o usuário. */
  onComplete: (set: SetLog, actuals: SetActuals) => Promise<void>;
  onUncomplete: (set: SetLog) => Promise<void>;
  onSaveActuals: (set: SetLog, actuals: SetActuals) => Promise<void>;
}

function toWeightText(value: number): string {
  return value === 0 ? '' : formatNumberForInput(value);
}

export const SET_ROW_COLUMNS = { weight: 64, reps: 56, check: 40 } as const;

/** Mesma cor do destaque, com alfa 0 (interpolação suave sem "piscar" em cinza). */
const COMPLETED_BG_TRANSPARENT = 'rgba(184, 243, 107, 0)';

function SetRowComponent({ set, onComplete, onUncomplete, onSaveActuals }: SetRowProps) {
  // Campos já vêm preenchidos com o realizado (se houver) ou com o planejado.
  const [repsText, setRepsText] = useState(() => String(set.actualReps ?? set.plannedReps));
  const [weightText, setWeightText] = useState(() => toWeightText(set.actualWeightKg ?? set.plannedWeightKg));
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState(false);

  const isCompleted = set.completedAt !== null;
  const parsed = parseSetActuals(repsText, weightText);

  // Feedback visual de conclusão: o fundo ganha destaque e o ✓ "pula" (só quando muda para concluída).
  const completion = useSharedValue(isCompleted ? 1 : 0);
  const checkScale = useSharedValue(1);
  const wasCompleted = useRef(isCompleted);

  useEffect(() => {
    completion.set(withTiming(isCompleted ? 1 : 0, { duration: 220 }));
    if (isCompleted && !wasCompleted.current) {
      checkScale.set(withSequence(withTiming(1.2, { duration: 110 }), withSpring(1, { damping: 12 })));
    }
    wasCompleted.current = isCompleted;
  }, [isCompleted, completion, checkScale]);

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(completion.get(), [0, 1], [COMPLETED_BG_TRANSPARENT, colors.primarySoft]),
  }));
  const checkAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.get() }] }));
  const errors = showErrors && !parsed.ok ? parsed.errors : {};

  const plannedLabel = `${set.plannedReps} × ${
    set.plannedWeightKg === 0 ? 'sem carga' : formatKg(set.plannedWeightKg)
  }`;

  const handleToggle = async () => {
    if (pending) return;
    if (!isCompleted && !parsed.ok) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    try {
      if (isCompleted) await onUncomplete(set);
      else if (parsed.ok) await onComplete(set, parsed.actuals);
    } finally {
      setPending(false);
    }
  };

  /** Ao terminar de editar, grava os valores (corrige série concluída ou guarda rascunho). */
  const handleEndEditing = () => {
    setShowErrors(true);
    if (!parsed.ok) return;
    const { actualReps, actualWeightKg } = parsed.actuals;
    if (actualReps === set.actualReps && actualWeightKg === set.actualWeightKg) return;
    void onSaveActuals(set, parsed.actuals);
  };

  return (
    <Animated.View style={[styles.row, rowAnimatedStyle]}>
      <View style={styles.info}>
        <Text style={styles.setLabel}>Série {set.setNumber}</Text>
        <Text style={styles.planned} numberOfLines={1}>
          {plannedLabel}
        </Text>
      </View>

      <TextInput
        value={weightText}
        onChangeText={setWeightText}
        onEndEditing={handleEndEditing}
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        keyboardType="decimal-pad"
        maxLength={7}
        selectTextOnFocus
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        accessibilityLabel={`Carga realizada na série ${set.setNumber}, em quilos`}
        style={[styles.input, { width: SET_ROW_COLUMNS.weight }, errors.actualWeightKg && styles.inputError]}
      />
      <TextInput
        value={repsText}
        onChangeText={setRepsText}
        onEndEditing={handleEndEditing}
        placeholder={String(set.plannedReps)}
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        maxLength={3}
        selectTextOnFocus
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        accessibilityLabel={`Repetições realizadas na série ${set.setNumber}`}
        style={[styles.input, { width: SET_ROW_COLUMNS.reps }, errors.actualReps && styles.inputError]}
      />

      <Animated.View style={checkAnimatedStyle}>
      <Pressable
        onPress={handleToggle}
        disabled={pending}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted, busy: pending }}
        accessibilityLabel={`Série ${set.setNumber} concluída`}
        hitSlop={spacing.xs}
        style={({ pressed }) => [
          styles.check,
          isCompleted && styles.checkCompleted,
          pressed && styles.checkPressed,
        ]}
      >
        {pending ? (
          <ActivityIndicator size="small" color={isCompleted ? colors.onPrimary : colors.primary} />
        ) : (
          <Text style={[styles.checkMark, isCompleted && styles.checkMarkCompleted]}>✓</Text>
        )}
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export const SetRow = memo(SetRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  setLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  planned: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  input: {
    ...typography.bodyStrong,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  check: {
    width: SET_ROW_COLUMNS.check,
    height: SET_ROW_COLUMNS.check,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  checkCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkPressed: {
    opacity: 0.8,
  },
  checkMark: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  checkMarkCompleted: {
    color: colors.onPrimary,
  },
});
