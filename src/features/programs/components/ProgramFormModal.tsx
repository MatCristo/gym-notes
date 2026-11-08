import { useRef, useState } from 'react';
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
  validateProgramDescription,
  validateProgramName,
  type ProgramInput,
  type ProgramNameValidationError,
} from '@/features/programs/services/program.service';
import {
  PROGRAM_DESCRIPTION_MAX_LENGTH,
  PROGRAM_NAME_MAX_LENGTH,
  type ProgramFormMode,
} from '@/features/programs/types/program.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ProgramFormModalProps {
  visible: boolean;
  mode: ProgramFormMode;
  initialName?: string;
  initialDescription?: string;
  /** Recebe os valores já validados (o service normaliza com trim). */
  onSubmit: (input: ProgramInput) => void;
  onCancel: () => void;
  /** Enquanto `true`, o envio fica bloqueado (evita gravar duas vezes). */
  submitting?: boolean;
}

const COPY: Record<ProgramFormMode, { title: string; description: string; submit: string }> = {
  create: {
    title: 'Novo planejamento',
    description: 'Agrupe seus treinos (A, B, C…) em um planejamento, como “Hipertrofia” ou “Treino em casa”.',
    submit: 'Criar',
  },
  edit: {
    title: 'Editar planejamento',
    description: 'Altere o nome ou a descrição do planejamento.',
    submit: 'Salvar',
  },
};

const NAME_ERROR_MESSAGES: Record<ProgramNameValidationError, string> = {
  empty: 'Informe um nome para o planejamento.',
  'too-long': `O nome deve ter no máximo ${PROGRAM_NAME_MAX_LENGTH} caracteres.`,
};

const DESCRIPTION_ERROR_MESSAGE = `A descrição deve ter no máximo ${PROGRAM_DESCRIPTION_MAX_LENGTH} caracteres.`;

/**
 * Formulário único para criação e edição de planejamentos (nome obrigatório e descrição opcional).
 * O componente pai deve fornecer uma `key` diferente a cada abertura para reiniciar o formulário.
 */
export function ProgramFormModal({
  visible,
  mode,
  initialName = '',
  initialDescription = '',
  onSubmit,
  onCancel,
  submitting = false,
}: ProgramFormModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const descriptionInputRef = useRef<TextInput>(null);

  const nameError = validateProgramName(name);
  const descriptionError = validateProgramDescription(description);
  const visibleNameError = hasAttemptedSubmit ? nameError : null;
  const visibleDescriptionError = hasAttemptedSubmit ? descriptionError : null;
  const copy = COPY[mode];

  const handleSubmit = () => {
    if (submitting) return;
    setHasAttemptedSubmit(true);
    if (nameError !== null || descriptionError !== null) return;
    onSubmit({ name, description });
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
              <Text style={styles.label} nativeID="program-name-label">
                Nome do planejamento
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex.: Hipertrofia"
                placeholderTextColor={colors.textSecondary}
                maxLength={PROGRAM_NAME_MAX_LENGTH}
                autoFocus
                autoCapitalize="sentences"
                returnKeyType="next"
                // "Próximo" leva o foco para a descrição sem fechar o teclado.
                submitBehavior="submit"
                onSubmitEditing={() => descriptionInputRef.current?.focus()}
                selectionColor={colors.primary}
                cursorColor={colors.primary}
                accessibilityLabel="Nome do planejamento"
                accessibilityLabelledBy="program-name-label"
                style={[styles.input, visibleNameError !== null && styles.inputError]}
              />
              <View style={styles.fieldFooter}>
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {visibleNameError !== null ? NAME_ERROR_MESSAGES[visibleNameError] : ''}
                </Text>
                <Text style={styles.counter}>
                  {name.length}/{PROGRAM_NAME_MAX_LENGTH}
                </Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label} nativeID="program-description-label">
                Descrição (opcional)
              </Text>
              <TextInput
                ref={descriptionInputRef}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex.: 4x por semana, foco em força"
                placeholderTextColor={colors.textSecondary}
                maxLength={PROGRAM_DESCRIPTION_MAX_LENGTH}
                multiline
                autoCapitalize="sentences"
                selectionColor={colors.primary}
                cursorColor={colors.primary}
                accessibilityLabel="Descrição do planejamento"
                accessibilityLabelledBy="program-description-label"
                style={[styles.input, styles.inputMultiline, visibleDescriptionError !== null && styles.inputError]}
              />
              <View style={styles.fieldFooter}>
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {visibleDescriptionError !== null ? DESCRIPTION_ERROR_MESSAGE : ''}
                </Text>
                <Text style={styles.counter}>
                  {description.length}/{PROGRAM_DESCRIPTION_MAX_LENGTH}
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
  inputMultiline: {
    minHeight: 72,
    maxHeight: 120,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
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
