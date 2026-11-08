import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import {
  parseExerciseForm,
  type ExerciseFieldError,
} from '@/features/exercises/services/exercise.service';
import {
  EXERCISE_LIMITS,
  type ExerciseField,
  type ExerciseFormValues,
  type ExerciseInput,
} from '@/features/exercises/types/exercise.types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type ExerciseFormMode = 'create' | 'edit';

interface ExerciseFormSheetProps {
  visible: boolean;
  mode: ExerciseFormMode;
  /** Valores iniciais. Em edição, os dados atuais do exercício. */
  initialValues?: ExerciseFormValues;
  /** Recebe os dados já validados e convertidos. */
  onSubmit: (input: ExerciseInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export const EMPTY_EXERCISE_FORM: ExerciseFormValues = {
  name: '',
  sets: '',
  reps: '',
  weightKg: '',
  restSeconds: '60',
  observation: '',
};

const COPY: Record<ExerciseFormMode, { title: string; submit: string }> = {
  create: { title: 'Novo exercício', submit: 'Adicionar' },
  edit: { title: 'Editar exercício', submit: 'Salvar' },
};

const FIELD_LABELS: Record<ExerciseField, string> = {
  name: 'nome',
  sets: 'séries',
  reps: 'repetições',
  weightKg: 'carga',
  restSeconds: 'descanso',
  observation: 'observação',
};

const FIELD_MAX: Partial<Record<ExerciseField, string>> = {
  name: `${EXERCISE_LIMITS.nameMaxLength} caracteres`,
  sets: String(EXERCISE_LIMITS.setsMax),
  reps: String(EXERCISE_LIMITS.repsMax),
  weightKg: `${EXERCISE_LIMITS.weightMaxKg} kg`,
  restSeconds: `${EXERCISE_LIMITS.restMaxSeconds} s`,
  observation: `${EXERCISE_LIMITS.observationMaxLength} caracteres`,
};

function getErrorMessage(field: ExerciseField, error: ExerciseFieldError | undefined): string | null {
  if (!error) return null;
  switch (error) {
    case 'required':
      return field === 'name' ? 'Informe o nome do exercício.' : `Informe as ${FIELD_LABELS[field]}.`;
    case 'too-long':
    case 'too-large':
      return `Máximo de ${FIELD_MAX[field] ?? ''}.`;
    case 'invalid-number':
      return 'Digite apenas números.';
    case 'not-integer':
      return 'Use um número inteiro.';
    case 'not-positive':
      return 'Deve ser maior que zero.';
    case 'negative':
      return 'Não pode ser negativo.';
  }
}

/**
 * Formulário de cadastro/edição de exercício em painel inferior.
 * O pai deve fornecer uma `key` diferente a cada abertura para reiniciar o estado.
 */
export function ExerciseFormSheet({
  visible,
  mode,
  initialValues = EMPTY_EXERCISE_FORM,
  onSubmit,
  onCancel,
  submitting = false,
}: ExerciseFormSheetProps) {
  const [values, setValues] = useState<ExerciseFormValues>(initialValues);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const result = parseExerciseForm(values);
  const errors = hasAttemptedSubmit && !result.ok ? result.errors : {};
  const copy = COPY[mode];

  const setField = (field: ExerciseField) => (text: string) =>
    setValues((current) => ({ ...current, [field]: text }));

  const handleSubmit = () => {
    if (submitting) return;
    setHasAttemptedSubmit(true);
    if (result.ok) onSubmit(result.input);
  };

  return (
    <BottomSheet visible={visible} onClose={onCancel} closeAccessibilityLabel="Fechar formulário">
      <Text style={styles.title} accessibilityRole="header">
        {copy.title}
      </Text>
      <Text style={styles.description}>Valores planejados para este exercício.</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextField
          label="Nome do exercício"
          value={values.name}
          onChangeText={setField('name')}
          placeholder="Ex.: Supino reto"
          maxLength={EXERCISE_LIMITS.nameMaxLength}
          autoCapitalize="sentences"
          autoFocus={mode === 'create'}
          error={getErrorMessage('name', errors.name)}
        />

        <View style={styles.row}>
          <TextField
            label="Séries"
            value={values.sets}
            onChangeText={setField('sets')}
            placeholder="Ex.: 4"
            keyboardType="number-pad"
            maxLength={2}
            error={getErrorMessage('sets', errors.sets)}
            style={styles.rowItem}
          />
          <TextField
            label="Repetições"
            value={values.reps}
            onChangeText={setField('reps')}
            placeholder="Ex.: 12"
            keyboardType="number-pad"
            maxLength={3}
            error={getErrorMessage('reps', errors.reps)}
            style={styles.rowItem}
          />
        </View>

        <View style={styles.row}>
          <TextField
            label="Carga"
            value={values.weightKg}
            onChangeText={setField('weightKg')}
            placeholder="0"
            suffix="kg"
            keyboardType="decimal-pad"
            maxLength={7}
            error={getErrorMessage('weightKg', errors.weightKg)}
            style={styles.rowItem}
          />
          <TextField
            label="Descanso"
            value={values.restSeconds}
            onChangeText={setField('restSeconds')}
            placeholder="0"
            suffix="seg"
            keyboardType="number-pad"
            maxLength={4}
            error={getErrorMessage('restSeconds', errors.restSeconds)}
            style={styles.rowItem}
          />
        </View>

        <TextField
          label="Observação (opcional)"
          value={values.observation}
          onChangeText={setField('observation')}
          placeholder="Ex.: Manter a coluna apoiada."
          multiline
          maxLength={EXERCISE_LIMITS.observationMaxLength}
          autoCapitalize="sentences"
          counter={`${values.observation.length}/${EXERCISE_LIMITS.observationMaxLength}`}
          error={getErrorMessage('observation', errors.observation)}
        />
      </ScrollView>

      <View style={styles.actions}>
        <PrimaryButton label="Cancelar" variant="secondary" onPress={onCancel} style={styles.action} />
        <PrimaryButton
          label={submitting ? 'Salvando…' : copy.submit}
          onPress={handleSubmit}
          disabled={submitting}
          style={styles.action}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  scroll: {
    flexGrow: 0,
  },
  form: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  action: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
