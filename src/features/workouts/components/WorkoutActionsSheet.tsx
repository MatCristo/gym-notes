import { ActionSheet } from '@/components/ui/ActionSheet';
import type { Workout } from '@/features/workouts/types/workout.types';

interface WorkoutActionsSheetProps {
  visible: boolean;
  workout: Workout;
  /** Rótulo da ação de início ("Iniciar treino" ou "Continuar treino"). Omitido = sem a ação. */
  startLabel?: string;
  onStart?: (workout: Workout) => void;
  onEdit: (workout: Workout) => void;
  onDuplicate: (workout: Workout) => void;
  onDelete: (workout: Workout) => void;
  onClose: () => void;
}

/** Menu de opções de um treino. Apenas dispara as ações; quem decide o que fazer é a tela. */
export function WorkoutActionsSheet({
  visible,
  workout,
  startLabel,
  onStart,
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
        ...(startLabel && onStart
          ? [
              {
                key: 'start',
                label: startLabel,
                onPress: () => onStart(workout),
                accessibilityLabel: `${startLabel}: ${workout.name}`,
              },
            ]
          : []),
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
