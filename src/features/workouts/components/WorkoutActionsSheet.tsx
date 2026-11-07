import { ActionSheet } from '@/components/ui/ActionSheet';
import type { Workout } from '@/features/workouts/types/workout.types';

interface WorkoutActionsSheetProps {
  visible: boolean;
  workout: Workout;
  onEdit: (workout: Workout) => void;
  onDuplicate: (workout: Workout) => void;
  onDelete: (workout: Workout) => void;
  onClose: () => void;
}

/** Menu de opções de um treino. Apenas dispara as ações; quem decide o que fazer é a tela. */
export function WorkoutActionsSheet({
  visible,
  workout,
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
}: WorkoutActionsSheetProps) {
  return (
    <ActionSheet
      visible={visible}
      overline="Opções do treino"
      title={workout.name}
      onClose={onClose}
      actions={[
        {
          key: 'edit',
          label: 'Editar nome',
          onPress: () => onEdit(workout),
          accessibilityLabel: `Editar nome do ${workout.name}`,
        },
        {
          key: 'duplicate',
          label: 'Duplicar treino',
          onPress: () => onDuplicate(workout),
          accessibilityLabel: `Duplicar ${workout.name} com todos os exercícios`,
        },
        {
          key: 'delete',
          label: 'Excluir treino',
          destructive: true,
          onPress: () => onDelete(workout),
          accessibilityLabel: `Excluir ${workout.name}`,
        },
      ]}
    />
  );
}
