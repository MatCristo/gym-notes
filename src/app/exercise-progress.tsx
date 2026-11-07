import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LineChart, type LineChartPoint } from '@/components/charts/LineChart';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SegmentedControl, type SegmentOption } from '@/components/ui/SegmentedControl';
import { StatTile } from '@/components/ui/StatTile';
import { useExerciseProgress } from '@/features/history/hooks/useExerciseProgress';
import { filterPointsByPeriod, getLastWeight, getMaxWeight } from '@/features/history/services/history.service';
import type { ExerciseProgressPoint, ProgressPeriod } from '@/features/history/types/history.types';
import { useNow } from '@/hooks/useNow';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatShortDate, formatShortDateWithYear, formatWeekdayDate } from '@/utils/date-format';
import { formatDecimal, formatKg } from '@/utils/number-format';

/** Linhas exibidas inicialmente na lista (evita renderizar centenas de sessões de uma vez). */
const INITIAL_ROWS = 30;

const PERIODS: readonly SegmentOption<ProgressPeriod>[] = [
  { value: '30d', label: '30 dias', accessibilityLabel: 'Últimos 30 dias' },
  { value: '90d', label: '90 dias', accessibilityLabel: 'Últimos 90 dias' },
  { value: '6m', label: '6 meses', accessibilityLabel: 'Últimos 6 meses' },
  { value: 'all', label: 'Tudo', accessibilityLabel: 'Todo o período' },
];


function SessionLoadRow({ point, isRecord }: { point: ExerciseProgressPoint; isRecord: boolean }) {
  const sets = point.sets.map((set) => `${formatDecimal(set.weightKg)}×${set.reps}`).join(' · ');
  return (
    <View
      style={styles.loadRow}
      accessible
      accessibilityLabel={`${formatWeekdayDate(point.date)}: maior carga ${formatKg(point.topWeightKg)} com ${point.topWeightReps} repetições${isRecord ? ', maior carga registrada' : ''}. Séries: ${sets}`}
    >
      <View style={styles.loadInfo}>
        <Text style={styles.loadDate}>{formatWeekdayDate(point.date)}</Text>
        <Text style={styles.loadSets} numberOfLines={2}>
          {sets}
        </Text>
      </View>
      <View style={styles.loadTop}>
        <Text style={styles.loadTopValue}>{formatKg(point.topWeightKg)}</Text>
        {isRecord ? <Text style={styles.recordBadge}>Recorde</Text> : <Text style={styles.loadTopReps}>× {point.topWeightReps}</Text>}
      </View>
    </View>
  );
}

/** Evolução de carga de um exercício. Só considera séries concluídas com carga real > 0. */
export default function ExerciseProgressScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { progress, status, reload } = useExerciseProgress(name ?? '');
  const [period, setPeriod] = useState<ProgressPeriod>('90d');
  const [showAllRows, setShowAllRows] = useState(false);
  const now = useNow(60_000);

  const screenOptions = <Stack.Screen options={{ title: 'Evolução', headerTitle: '' }} />;

  if (status === 'loading') {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando evolução" />
      </ScreenContainer>
    );
  }

  if (status === 'error' || !progress) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Não foi possível carregar</Text>
          <Text style={styles.muted}>Ocorreu um erro ao ler o histórico deste exercício.</Text>
        </View>
        <PrimaryButton label="Tentar novamente" onPress={reload} />
        <PrimaryButton label="Voltar" variant="secondary" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  const last = getLastWeight(progress.points);
  const max = getMaxWeight(progress.points);
  const recordSessionId = max ? progress.points.find((point) => point.topWeightKg === max.weightKg)?.sessionId : undefined;
  const filtered = filterPointsByPeriod(progress.points, period, now);
  const chartPoints: LineChartPoint[] = filtered.map((point) => ({
    id: point.sessionId,
    x: Date.parse(point.date),
    y: point.topWeightKg,
  }));
  const byId = new Map(filtered.map((point) => [point.sessionId, point]));
  const newestFirst = [...filtered].reverse();
  const visibleRows = showAllRows ? newestFirst : newestFirst.slice(0, INITIAL_ROWS);

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {screenOptions}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.overline}>Evolução</Text>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
            {progress.name}
          </Text>
        </View>

        {!last || !max ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sem registros de carga ainda</Text>
            <Text style={styles.muted}>
              A evolução considera apenas séries concluídas com carga real maior que zero em treinos finalizados.
              Valores planejados não entram no cálculo.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile
                label="Última carga"
                value={formatKg(last.weightKg)}
                caption={`${last.reps} reps · ${formatShortDateWithYear(last.date)}`}
              />
              <StatTile
                label="Maior carga"
                value={formatKg(max.weightKg)}
                caption={`${max.reps} reps · ${formatShortDateWithYear(max.date)}`}
              />
            </View>

            {/* Filtro acima de tudo o que ele afeta (gráfico e lista). */}
            <SegmentedControl
              options={PERIODS}
              value={period}
              onChange={(next) => {
                setPeriod(next);
                setShowAllRows(false);
              }}
            />

            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Maior carga por sessão
              </Text>
              <Text style={styles.muted}>Carga (kg) da série mais pesada concluída em cada treino.</Text>
              {filtered.length === 0 ? (
                <Text style={styles.chartMessage}>Nenhum registro neste período.</Text>
              ) : filtered.length === 1 ? (
                <Text style={styles.chartMessage}>
                  Apenas 1 sessão neste período. Registre ao menos 2 para ver a linha de evolução.
                </Text>
              ) : (
                <LineChart
                  points={chartPoints}
                  formatYTick={(value) => formatDecimal(value)}
                  formatXLabel={(x) => formatShortDate(new Date(x).toISOString())}
                  formatEndLabel={(point) => formatKg(point.y)}
                  formatTooltip={(point) => {
                    const source = byId.get(point.id);
                    return `${formatShortDate(new Date(point.x).toISOString())} · ${formatKg(point.y)}${source ? ` × ${source.topWeightReps}` : ''}`;
                  }}
                  accessibilityLabel={`Gráfico de linha com ${filtered.length} sessões. De ${formatKg(filtered[0]!.topWeightKg)} em ${formatShortDate(filtered[0]!.date)} a ${formatKg(filtered[filtered.length - 1]!.topWeightKg)} em ${formatShortDate(filtered[filtered.length - 1]!.date)}. Os valores estão na lista abaixo.`}
                />
              )}
            </View>

            <Text style={styles.sectionTitle} accessibilityRole="header">
              Histórico de cargas
            </Text>
            {filtered.length === 0 ? (
              <Text style={styles.muted}>Nenhuma sessão neste período.</Text>
            ) : (
              <>
                <View style={styles.loadList}>
                  {visibleRows.map((point, index) => (
                    <View key={point.sessionId} style={index > 0 ? styles.loadDivider : undefined}>
                      <SessionLoadRow point={point} isRecord={point.sessionId === recordSessionId} />
                    </View>
                  ))}
                </View>
                {!showAllRows && newestFirst.length > INITIAL_ROWS ? (
                  <PrimaryButton
                    label={`Mostrar todas (${newestFirst.length})`}
                    variant="secondary"
                    onPress={() => setShowAllRows(true)}
                  />
                ) : null}
              </>
            )}
          </>
        )}
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
    gap: spacing.lg,
  },
  header: {
    paddingTop: spacing.sm,
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
  tiles: {
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
  muted: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chartMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  loadList: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  loadDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  loadInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  loadDate: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  loadSets: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  loadTop: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  loadTopValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  loadTopReps: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  recordBadge: {
    ...typography.overline,
    fontSize: 10,
    color: colors.primary,
  },
});
