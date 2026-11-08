import { ActionSheet } from '@/components/ui/ActionSheet';
import type { TrainingProgram } from '@/features/programs/types/program.types';

interface ProgramActionsSheetProps {
  visible: boolean;
  program: TrainingProgram;
  onEdit: (program: TrainingProgram) => void;
  onDuplicate: (program: TrainingProgram) => void;
  onShare: (program: TrainingProgram) => void;
  onDelete: (program: TrainingProgram) => void;
  onClose: () => void;
}

/** Menu de opções de um planejamento. Apenas dispara as ações; quem decide o que fazer é a tela. */
export function ProgramActionsSheet({
  visible,
  program,
  onEdit,
  onDuplicate,
  onShare,
  onDelete,
  onClose,
}: ProgramActionsSheetProps) {
  const canShare = program.workoutCount > 0;
  return (
    <ActionSheet
      visible={visible}
      overline="Opções do planejamento"
      title={program.name}
      onClose={onClose}
      actions={[
        {
          key: 'edit',
          label: 'Editar planejamento',
          onPress: () => onEdit(program),
          accessibilityLabel: `Editar nome e descrição de ${program.name}`,
        },
        {
          key: 'duplicate',
          label: 'Duplicar planejamento',
          onPress: () => onDuplicate(program),
          accessibilityLabel: `Duplicar ${program.name} com todos os treinos e exercícios`,
        },
        {
          key: 'share',
          label: 'Compartilhar planejamento',
          onPress: () => onShare(program),
          disabled: !canShare,
          hint: canShare ? undefined : 'Adicione ao menos um treino para compartilhar.',
          accessibilityLabel: `Compartilhar ${program.name} por código`,
        },
        {
          key: 'delete',
          label: 'Excluir planejamento',
          destructive: true,
          onPress: () => onDelete(program),
          accessibilityLabel: `Excluir ${program.name}`,
        },
      ]}
    />
  );
}
