import type { ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearTransition } from 'react-native-reanimated';
import ReorderableList, {
  type ReorderableListReorderEvent,
  type ReorderableListRenderItem,
} from 'react-native-reorderable-list';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WorkoutCard } from '@/features/workouts/components/WorkoutCard';
import type { WorkoutsStatus } from '@/features/workouts/hooks/useWorkouts';
import type { Workout } from '@/features/workouts/types/workout.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface WorkoutListProps {
  workouts: readonly Workout[];
  onWorkoutPress: (workout: Workout) => void;
  onWorkoutOptionsPress: (workout: Workout) => void;
  onCreateWorkoutPress: () => void;
  /** Estado do carregamento. Enquanto não estiver `ready`, a lista exibe loading ou erro. */
  status: WorkoutsStatus;
  onRetryPress: () => void;
  /** Disparado ao soltar um treino em outra posição. */
  onReorder: (from: number, to: number) => void;
  /** IDs dos treinos com sessão em andamento (exibem o indicador "Em andamento"). */
  inProgressWorkoutIds?: ReadonlySet<string>;
  /** Conteúdo exibido acima da lista (rola junto com os itens). */
  header?: ReactElement;
}

function keyExtractor(workout: Workout): string {
  return workout.id;
}

interface EmptyStateProps {
  onCreateWorkoutPress: () => void;
}

function WorkoutListEmptyState({ onCreateWorkoutPress }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyBadge} importantForAccessibility="no-hide-descendants">
        <Text style={styles.emptyBadgeText}>0</Text>
      </View>
      <Text style={styles.emptyTitle} accessibilityRole="header">
        Nenhum treino neste planejamento
      </Text>
      <Text style={styles.emptyDescription}>
        Crie o primeiro treino (ex.: Treino A, Treino B…) para organizar este planejamento.
      </Text>
      <PrimaryButton
        label="Criar primeiro treino"
        leadingSymbol="+"
        onPress={onCreateWorkoutPress}
        accessibilityLabel="Criar primeiro treino"
        style={styles.emptyButton}
      />
    </View>
  );
}

function WorkoutListLoadingState() {
  return (
    <View style={styles.emptyState} accessibilityLabel="Carregando treinos">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.emptyDescription}>Carregando seus treinos…</Text>
    </View>
  );
}

function WorkoutListErrorState({ onRetryPress }: { onRetryPress: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyBadge, styles.errorBadge]} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.emptyBadgeText, styles.errorBadgeText]}>!</Text>
      </View>
      <Text style={styles.emptyTitle} accessibilityRole="header">
        Não foi possível carregar
      </Text>
      <Text style={styles.emptyDescription}>
        Ocorreu um erro ao ler seus treinos salvos. Tente novamente.
      </Text>
      <PrimaryButton label="Tentar novamente" variant="secondary" onPress={onRetryPress} style={styles.emptyButton} />
    </View>
  );
}

export function WorkoutList({
  workouts,
  onWorkoutPress,
  onWorkoutOptionsPress,
  onCreateWorkoutPress,
  status,
  onRetryPress,
  onReorder,
  inProgressWorkoutIds,
  header,
}: WorkoutListProps) {
  const data = status === 'ready' ? [...workouts] : [];
  const draggable = data.length > 1;
  const emptyComponent =
    status === 'loading' ? (
      <WorkoutListLoadingState />
    ) : status === 'error' ? (
      <WorkoutListErrorState onRetryPress={onRetryPress} />
    ) : (
      <WorkoutListEmptyState onCreateWorkoutPress={onCreateWorkoutPress} />
    );

  const renderItem: ReorderableListRenderItem<Workout> = ({ item }) => (
    <WorkoutCard
      workout={item}
      onPress={onWorkoutPress}
      onOptionsPress={onWorkoutOptionsPress}
      draggable={draggable}
      inProgress={inProgressWorkoutIds?.has(item.id) ?? false}
    />
  );

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    if (from !== to) onReorder(from, to);
  };

  return (
    <ReorderableList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onReorder={handleReorder}
      dragEnabled={draggable}
      // Necessário para o destaque visual do card enquanto é arrastado (useIsActive).
      shouldUpdateActiveItem
      // Ao criar, duplicar ou excluir, os demais cards se reacomodam suavemente.
      itemLayoutAnimation={LinearTransition.duration(200)}
      ListHeaderComponent={header}
      ListEmptyComponent={emptyComponent}
      contentContainerStyle={[styles.content, data.length === 0 && styles.contentEmpty]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyBadgeText: {
    ...typography.display,
    color: colors.primary,
  },
  errorBadge: {
    borderColor: colors.error,
  },
  errorBadgeText: {
    color: colors.error,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyButton: {
    marginTop: spacing.md,
  },
});
