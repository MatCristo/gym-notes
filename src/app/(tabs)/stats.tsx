import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StatTile } from '@/components/ui/StatTile';
import { formatWeight } from '@/features/exercises/utils/exercise.format';
import { useTrainingStats } from '@/features/history/hooks/useTrainingStats';
import type { ExerciseHistoryEntry, TrainingStats } from '@/features/history/types/history.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatMonthShort, formatMonthYear, formatShortDate, formatShortDateWithYear } from '@/utils/date-format';
import { formatDecimal } from '@/utils/number-format';
import { formatDuration } from '@/utils/time-format';

const formatTrainings = (value: number) => (value === 1 ? '1 treino' : `${value} treinos`);

function weeklyData(stats: TrainingStats): BarDatum[] {
  return stats.weekly.map((bucket, index) => ({
    key: bucket.start,
    label: formatShortDate(bucket.start),
    description: index === stats.weekly.length - 1 ? 'Esta semana' : `Semana de ${formatShortDate(bucket.start)}`,
    value: bucket.count,
  }));
}

function monthlyData(stats: TrainingStats): BarDatum[] {
  return stats.monthly.map((bucket) => ({
    key: bucket.start,
    label: formatMonthShort(bucket.start),
    description: formatMonthYear(bucket.start),
    value: bucket.count,
  }));
}

function ExerciseRow({ entry, onPress }: { entry: ExerciseHistoryEntry; onPress: (entry: ExerciseHistoryEntry) => void }) {
  const sessions = entry.sessionsCount === 1 ? '1 sessão' : `${entry.sessionsCount} sessões`;
  const last = entry.lastTopWeightKg === null ? 'sem carga registrada' : `última: ${formatWeight(entry.lastTopWeightKg)}`;
  return (
    <Pressable
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}, ${last}, ${sessions}`}
      accessibilityHint="Abre a evolução do exercício"
      android_ripple={{ color: colors.pressedOverlay }}
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.exerciseRowPressed]}
    >
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={styles.exerciseMeta} numberOfLines={1}>
          {last} · {sessions} · {formatShortDateWithYear(entry.lastPerformedAt)}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function StatsScreen() {
  const { stats, exercises, status, load, retry } = useTrainingStats();

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openProgress = (entry: ExerciseHistoryEntry) =>
    router.push({ pathname: '/exercise-progress', params: { name: entry.name } });

  const header = (
    <View style={styles.header}>
      <Text style={styles.overline}>Gym Notes</Text>
      <Text style={styles.title} accessibilityRole="header">
        Estatísticas
      </Text>
      <Text style={styles.subtitle}>Calculadas a partir dos treinos concluídos.</Text>
    </View>
  );

  if (status !== 'ready' || !stats) {
    return (
      <ScreenContainer contentStyle={styles.padded}>
        {header}
        <View style={styles.state}>
          {status === 'loading' ? (
            <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando estatísticas" />
          ) : (
            <>
              <Text style={styles.stateTitle}>Não foi possível carregar</Text>
              <Text style={styles.stateDescription}>Ocorreu um erro ao calcular as estatísticas. Tente novamente.</Text>
              <PrimaryButton label="Tentar novamente" variant="secondary" onPress={retry} />
            </>
          )}
        </View>
      </ScreenContainer>
    );
  }

  if (stats.totalSessions === 0) {
    return (
      <ScreenContainer contentStyle={styles.padded}>
        {header}
        <View style={styles.state}>
          <View style={styles.badge} importantForAccessibility="no-hide-descendants">
            <Text style={styles.badgeText}>0</Text>
          </View>
          <Text style={styles.stateTitle} accessibilityRole="header">
            Sem dados ainda
          </Text>
          <Text style={styles.stateDescription}>
            As estatísticas aparecem depois que você finalizar o primeiro treino.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {header}

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatTile label="Treinos" value={String(stats.totalSessions)} caption="sessões concluídas" />
            <StatTile label="Séries" value={String(stats.totalCompletedSets)} caption="séries concluídas" />
          </View>
          <View style={styles.gridRow}>
            <StatTile label="Tempo total" value={formatDuration(stats.totalDurationMs)} caption="de treino registrado" />
            <StatTile
              label="Por semana"
              value={formatDecimal(stats.weeklyAverage, 1)}
              caption="média das últimas 4 semanas"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Treinos por semana
          </Text>
          <BarChart data={weeklyData(stats)} formatValue={formatTrainings} labelEvery={2} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Treinos por mês
          </Text>
          <BarChart data={monthlyData(stats)} formatValue={formatTrainings} />
        </View>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Evolução por exercício
        </Text>
        {exercises.length === 0 ? (
          <Text style={styles.stateDescription}>Nenhum exercício com séries concluídas ainda.</Text>
        ) : (
          <View style={styles.exerciseList}>
            {exercises.map((entry, index) => (
              <View key={entry.key} style={index > 0 ? styles.exerciseDivider : undefined}>
                <ExerciseRow entry={entry} onPress={openProgress} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  padded: {
    paddingHorizontal: layout.screenPaddingHorizontal,
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: {
    paddingTop: spacing.xl,
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
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  grid: {
    gap: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  exerciseList: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  exerciseDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: layout.minTouchTarget,
  },
  exerciseRowPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  exerciseInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  exerciseName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  exerciseMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
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
  badgeText: {
    ...typography.display,
    color: colors.primary,
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
    alignSelf: 'center',
  },
});
