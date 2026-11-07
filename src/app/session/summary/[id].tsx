import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useSession } from '@/features/sessions/hooks/useSession';
import { computeSessionSummary } from '@/features/sessions/services/session.service';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatDuration } from '@/utils/time-format';

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { details, status, reload } = useSession(id);

  const screenOptions = <Stack.Screen options={{ title: 'Resumo', headerTitle: '' }} />;
  // Volta à raiz da pilha (abas). Não depende dos tipos de rota gerados pelo servidor de desenvolvimento.
  const goHome = () => router.dismissAll();

  if (status === 'loading') {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando resumo" />
      </ScreenContainer>
    );
  }

  if (status !== 'ready' || !details) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {status === 'not-found' ? 'Sessão não encontrada' : 'Não foi possível carregar'}
          </Text>
        </View>
        {status === 'error' ? <PrimaryButton label="Tentar novamente" onPress={reload} /> : null}
        <PrimaryButton label="Voltar ao início" variant="secondary" onPress={goHome} />
      </ScreenContainer>
    );
  }

  // Resumo só existe para sessões finalizadas.
  if (details.session.status !== 'completed' || !details.session.completedAt) {
    return <Redirect href={{ pathname: '/session/[id]', params: { id } }} />;
  }

  const summary = computeSessionSummary(details, Date.parse(details.session.completedAt));

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {screenOptions}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.overline}>Treino concluído</Text>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
            {summary.workoutName}
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <SummaryStat label="Duração" value={formatDuration(summary.durationMs)} />
            <SummaryStat label="Exercícios" value={`${summary.exercisesPerformed}/${summary.totalExercises}`} />
          </View>
          <View style={styles.gridRow}>
            <SummaryStat label="Séries concluídas" value={String(summary.completedSets)} />
            <SummaryStat label="Séries planejadas" value={String(summary.plannedSets)} />
          </View>
        </View>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Exercícios realizados
        </Text>
        <View style={styles.card}>
          {summary.exercises.map((exercise, index) => {
            const done = exercise.completedSets > 0;
            return (
              <View key={`${exercise.name}-${index}`} style={[styles.exerciseRow, index > 0 && styles.exerciseRowDivider]}>
                <View style={[styles.exerciseDot, done && styles.exerciseDotDone]} />
                <Text style={[styles.exerciseName, !done && styles.exerciseNameSkipped]} numberOfLines={2}>
                  {exercise.name}
                </Text>
                <Text style={styles.exerciseSets}>
                  {exercise.completedSets}/{exercise.plannedSets} séries
                </Text>
              </View>
            );
          })}
        </View>

        <PrimaryButton label="Voltar ao início" onPress={goHome} style={styles.homeButton} />
        <PrimaryButton
          label="Ver detalhes das séries"
          variant="secondary"
          onPress={() => router.push({ pathname: '/history/[id]', params: { id } })}
          style={styles.detailsButton}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    gap: spacing.lg,
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  overline: {
    ...typography.overline,
    color: colors.primary,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  grid: {
    gap: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  statLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.title,
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  card: {
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.title,
    color: colors.textPrimary,
    paddingVertical: spacing.xl,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  exerciseRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  exerciseDotDone: {
    backgroundColor: colors.primary,
  },
  exerciseName: {
    ...typography.bodyStrong,
    flex: 1,
    color: colors.textPrimary,
  },
  exerciseNameSkipped: {
    color: colors.textSecondary,
  },
  exerciseSets: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  homeButton: {
    marginTop: spacing.xl,
  },
  detailsButton: {
    marginTop: spacing.md,
  },
});
