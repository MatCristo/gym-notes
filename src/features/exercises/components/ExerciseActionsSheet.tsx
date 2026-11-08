import { ActionSheet } from '@/components/ui/ActionSheet';
import type { Exercise } from '@/features/exercises/types/exercise.types';

interface ExerciseActionsSheetProps {
  visible: boolean;
  exercise: Exercise;
  onEdit: (exercise: Exercise) => void;
  onDuplicate: (exercise: Exercise) => void;
  onViewProgress: (exercise: Exercise) => void;
  onDelete: (exercise: Exercise) => void;
  onClose: () => void;
}

/** Menu de opções de um exercício. Apenas dispara as ações; quem decide o que fazer é a tela. */
export function ExerciseActionsSheet({
  visible,
  exercise,
  onEdit,
  onDuplicate,
  onViewProgress,
  onDelete,
  onClose,
}: ExerciseActionsSheetProps) {
  return (
    <ActionSheet
      visible={visible}
      overline="Opções do exercício"
      title={exercise.name}
      onClose={onClose}
      actions={[
        {
          key: 'edit',
          label: 'Editar exercício',
          onPress: () => onEdit(exercise),
          accessibilityLabel: `Editar ${exercise.name}`,
        },
        {
          key: 'duplicate',
          label: 'Duplicar exercício',
          onPress: () => onDuplicate(exercise),
          accessibilityLabel: `Duplicar ${exercise.name} logo abaixo do original`,
        },
        {
          key: 'progress',
          label: 'Ver evolução',
          onPress: () => onViewProgress(exercise),
          accessibilityLabel: `Ver evolução de carga de ${exercise.name}`,
        },
        {
          key: 'delete',
          label: 'Excluir exercício',
          destructive: true,
          onPress: () => onDelete(exercise),
          accessibilityLabel: `Excluir ${exercise.name}`,
        },
      ]}
    />
  );
}
