import type { ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearTransition } from 'react-native-reanimated';
import ReorderableList, {
  type ReorderableListReorderEvent,
  type ReorderableListRenderItem,
} from 'react-native-reorderable-list';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ExerciseCard } from '@/features/exercises/components/ExerciseCard';
import type { ExercisesStatus } from '@/features/exercises/hooks/useExercises';
import type { Exercise } from '@/features/exercises/types/exercise.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ExerciseListProps {
  exercises: readonly Exercise[];
  status: ExercisesStatus;
  onExercisePress: (exercise: Exercise) => void;
  onExerciseOptionsPress: (exercise: Exercise) => void;
  onAddExercisePress: () => void;
  onRetryPress: () => void;
  /** Disparado ao soltar um exercício em outra posição. */
  onReorder: (from: number, to: number) => void;
  header?: ReactElement;
}

function keyExtractor(exercise: Exercise): string {
  return exercise.id;
}

function EmptyState({ onAddExercisePress }: { onAddExercisePress: () => void }) {
  return (
    <View style={styles.state}>
      <View style={styles.badge} importantForAccessibility="no-hide-descendants">
        <Text style={styles.badgeText}>0</Text>
      </View>
      <Text style={styles.stateTitle} accessibilityRole="header">
        Nenhum exercício ainda
      </Text>
      <Text style={styles.stateDescription}>
        Adicione os exercícios deste treino com séries, repetições e carga planejadas.
      </Text>
      <PrimaryButton
        label="Adicionar exercício"
        leadingSymbol="+"
        onPress={onAddExercisePress}
        style={styles.stateButton}
      />
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.state} accessibilityLabel="Carregando exercícios">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.stateDescription}>Carregando exercícios…</Text>
    </View>
  );
}

function ErrorState({ onRetryPress }: { onRetryPress: () => void }) {
  return (
    <View style={styles.state}>
      <View style={[styles.badge, styles.badgeError]} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.badgeText, styles.badgeTextError]}>!</Text>
      </View>
      <Text style={styles.stateTitle} accessibilityRole="header">
        Não foi possível carregar
      </Text>
      <Text style={styles.stateDescription}>Ocorreu um erro ao ler os exercícios. Tente novamente.</Text>
      <PrimaryButton label="Tentar novamente" variant="secondary" onPress={onRetryPress} style={styles.stateButton} />
    </View>
  );
}

export function ExerciseList({
  exercises,
  status,
  onExercisePress,
  onExerciseOptionsPress,
  onAddExercisePress,
  onRetryPress,
  onReorder,
  header,
}: ExerciseListProps) {
  const data = status === 'ready' ? [...exercises] : [];
  const draggable = data.length > 1;

  const renderItem: ReorderableListRenderItem<Exercise> = ({ item, index }) => (
    <ExerciseCard
      exercise={item}
      position={index + 1}
      onPress={onExercisePress}
      onOptionsPress={onExerciseOptionsPress}
      draggable={draggable}
    />
  );

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    if (from !== to) onReorder(from, to);
  };

  const emptyComponent =
    status === 'loading' ? (
      <LoadingState />
    ) : status === 'error' ? (
      <ErrorState onRetryPress={onRetryPress} />
    ) : (
      <EmptyState onAddExercisePress={onAddExercisePress} />
    );

  return (
    <ReorderableList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onReorder={handleReorder}
      dragEnabled={draggable}
      // Necessário para o destaque visual do card enquanto é arrastado (useIsActive).
      shouldUpdateActiveItem
      itemLayoutAnimation={LinearTransition.duration(200)}
      ListHeaderComponent={header}
      ListEmptyComponent={emptyComponent}
      contentContainerStyle={[styles.content, data.length === 0 && styles.contentEmpty]}
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
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  badge: {
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
  badgeError: {
    borderColor: colors.error,
  },
  badgeText: {
    ...typography.display,
    color: colors.primary,
  },
  badgeTextError: {
    color: colors.error,
  },
  stateTitle: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  stateDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  stateButton: {
    marginTop: spacing.md,
  },
});
