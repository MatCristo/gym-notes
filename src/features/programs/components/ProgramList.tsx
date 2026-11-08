import type { ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ProgramCard } from '@/features/programs/components/ProgramCard';
import type { ProgramsStatus } from '@/features/programs/hooks/usePrograms';
import type { TrainingProgram } from '@/features/programs/types/program.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ProgramListProps {
  programs: readonly TrainingProgram[];
  onProgramPress: (program: TrainingProgram) => void;
  onProgramOptionsPress: (program: TrainingProgram) => void;
  onCreateProgramPress: () => void;
  /** Estado do carregamento. Enquanto não estiver `ready`, a lista exibe loading ou erro. */
  status: ProgramsStatus;
  onRetryPress: () => void;
  /** Conteúdo exibido acima da lista (rola junto com os itens). */
  header?: ReactElement;
}

function keyExtractor(program: TrainingProgram): string {
  return program.id;
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

interface EmptyStateProps {
  onCreateProgramPress: () => void;
}

function ProgramListEmptyState({ onCreateProgramPress }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyBadge} importantForAccessibility="no-hide-descendants">
        <Text style={styles.emptyBadgeText}>0</Text>
      </View>
      <Text style={styles.emptyTitle} accessibilityRole="header">
        Nenhum planejamento por aqui
      </Text>
      <Text style={styles.emptyDescription}>
        Crie seu primeiro planejamento e organize nele os seus treinos (A, B, C…).
      </Text>
      <PrimaryButton
        label="Criar primeiro planejamento"
        leadingSymbol="+"
        onPress={onCreateProgramPress}
        accessibilityLabel="Criar primeiro planejamento"
        style={styles.emptyButton}
      />
    </View>
  );
}

function ProgramListLoadingState() {
  return (
    <View style={styles.emptyState} accessibilityLabel="Carregando planejamentos">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.emptyDescription}>Carregando seus planejamentos…</Text>
    </View>
  );
}

function ProgramListErrorState({ onRetryPress }: { onRetryPress: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyBadge, styles.errorBadge]} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.emptyBadgeText, styles.errorBadgeText]}>!</Text>
      </View>
      <Text style={styles.emptyTitle} accessibilityRole="header">
        Não foi possível carregar
      </Text>
      <Text style={styles.emptyDescription}>
        Ocorreu um erro ao ler seus planejamentos salvos. Tente novamente.
      </Text>
      <PrimaryButton label="Tentar novamente" variant="secondary" onPress={onRetryPress} style={styles.emptyButton} />
    </View>
  );
}

export function ProgramList({
  programs,
  onProgramPress,
  onProgramOptionsPress,
  onCreateProgramPress,
  status,
  onRetryPress,
  header,
}: ProgramListProps) {
  const data = status === 'ready' ? programs : [];
  const emptyComponent =
    status === 'loading' ? (
      <ProgramListLoadingState />
    ) : status === 'error' ? (
      <ProgramListErrorState onRetryPress={onRetryPress} />
    ) : (
      <ProgramListEmptyState onCreateProgramPress={onCreateProgramPress} />
    );

  const renderItem: ListRenderItem<TrainingProgram> = ({ item }) => (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
      <ProgramCard program={item} onPress={onProgramPress} onOptionsPress={onProgramOptionsPress} />
    </Animated.View>
  );

  return (
    <Animated.FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparator}
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
  separator: {
    height: spacing.md,
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
