import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  validateWorkoutName,
  type WorkoutNameValidationError,
} from '@/features/workouts/services/workout.service';
import { WORKOUT_NAME_MAX_LENGTH, type WorkoutFormMode } from '@/features/workouts/types/workout.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface WorkoutFormModalProps {
  visible: boolean;
  mode: WorkoutFormMode;
  /** Nome inicial do campo. No modo edição, o nome atual do treino. */
  initialName?: string;
  /** Recebe o nome já validado (o hook normaliza com trim). */
  onSubmit: (name: string) => void;
  onCancel: () => void;
  /** Enquanto `true`, o envio fica bloqueado (evita gravar duas vezes). */
  submitting?: boolean;
}

const COPY: Record<WorkoutFormMode, { title: string; description: string; submit: string }> = {
  create: {
    title: 'Novo treino',
    description: 'Dê um nome para identificar este treino.',
    submit: 'Criar treino',
  },
  edit: {
    title: 'Editar treino',
    description: 'Altere o nome do treino.',
    submit: 'Salvar',
  },
};

const ERROR_MESSAGES: Record<WorkoutNameValidationError, string> = {
  empty: 'Informe um nome para o treino.',
  'too-long': `O nome deve ter no máximo ${WORKOUT_NAME_MAX_LENGTH} caracteres.`,
};

/**
 * Formulário único para criação e edição de treinos.
 * O estado interno é inicializado a partir de `initialName`; o componente pai deve
 * fornecer uma `key` diferente a cada abertura para reiniciar o formulário.
 */
export function WorkoutFormModal({
  visible,
  mode,
  initialName = '',
  onSubmit,
  onCancel,
  submitting = false,
}: WorkoutFormModalProps) {
  const [name, setName] = useState(initialName);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const validationError = validateWorkoutName(name);
  const visibleError = hasAttemptedSubmit ? validationError : null;
  const copy = COPY[mode];

  const handleSubmit = () => {
    if (submitting) return;
    setHasAttemptedSubmit(true);
    if (validationError !== null) return;
    onSubmit(name);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Fechar formulário"
          />

          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.title} accessibilityRole="header">
              {copy.title}
            </Text>
            <Text style={styles.description}>{copy.description}</Text>

            <View style={styles.field}>
              <Text style={styles.label} nativeID="workout-name-label">
                Nome do treino
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex.: Treino A - Peito e tríceps"
                placeholderTextColor={colors.textSecondary}
                maxLength={WORKOUT_NAME_MAX_LENGTH}
                autoFocus
                autoCapitalize="sentences"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                selectionColor={colors.primary}
                cursorColor={colors.primary}
                accessibilityLabel="Nome do treino"
                accessibilityLabelledBy="workout-name-label"
                style={[styles.input, visibleError !== null && styles.inputError]}
              />
              <View style={styles.fieldFooter}>
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {visibleError !== null ? ERROR_MESSAGES[visibleError] : ''}
                </Text>
                <Text style={styles.counter}>
                  {name.length}/{WORKOUT_NAME_MAX_LENGTH}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <PrimaryButton label="Cancelar" variant="secondary" onPress={onCancel} style={styles.action} />
              <PrimaryButton
                label={submitting ? 'Salvando…' : copy.submit}
                onPress={handleSubmit}
                disabled={submitting}
                style={styles.action}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: layout.screenPaddingHorizontal,
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  field: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  fieldFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 18,
  },
  errorText: {
    ...typography.caption,
    flex: 1,
    color: colors.error,
  },
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
