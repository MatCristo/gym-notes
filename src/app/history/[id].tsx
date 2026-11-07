import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StatTile } from '@/components/ui/StatTile';
import { useSession } from '@/features/sessions/hooks/useSession';
import { computeSessionSummary } from '@/features/sessions/services/session.service';
import type { SessionExercise, SetLog } from '@/features/sessions/types/session.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatFullDate, formatTime } from '@/utils/date-format';
import { formatKg } from '@/utils/number-format';
import { formatDuration } from '@/utils/time-format';

function formatSetValue(reps: number, weightKg: number): string {
  return weightKg > 0 ? `${reps} × ${formatKg(weightKg)}` : `${reps} reps · sem carga`;
}

const COLUMNS = { set: 28, status: 22 } as const;

function SetHistoryRow({ set }: { set: SetLog }) {
  const done = set.completedAt !== null;
  // Só exibe como "realizado" o que foi concluído; rascunhos de séries não concluídas não contam.
  const actual = done && set.actualReps !== null ? formatSetValue(set.actualReps, set.actualWeightKg ?? 0) : '—';
  const planned = formatSetValue(set.plannedReps, set.plannedWeightKg);
  return (
    <View
      style={[styles.setRow, !done && styles.setRowSkipped]}
      accessible
      accessibilityLabel={`Série ${set.setNumber}: planejado ${planned}; ${done ? `realizado ${actual}` : 'não concluída'}`}
    >
      <Text style={[styles.setNumber, { width: COLUMNS.set }]}>{set.setNumber}</Text>
      <Text style={[styles.setCell, styles.setPlanned]} numberOfLines={1}>
        {planned}
      </Text>
      <Text style={[styles.setCell, done ? styles.setActual : styles.setMissing]} numberOfLines={1}>
        {done ? actual : 'Não concluída'}
      </Text>
      <Text style={[styles.setStatus, { width: COLUMNS.status }, done ? styles.statusDone : styles.statusSkipped]}>
        {done ? '✓' : '–'}
      </Text>
    </View>
  );
}

function ExerciseHistoryCard({ exercise }: { exercise: SessionExercise }) {
  const completed = exercise.sets.filter((set) => set.completedAt !== null).length;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {exercise.exerciseNameSnapshot}
          </Text>
          <Text style={styles.cardMeta}>
            {completed}/{exercise.sets.length} séries concluídas
          </Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/exercise-progress', params: { name: exercise.exerciseNameSnapshot } })
          }
          accessibilityRole="link"
          accessibilityLabel={`Ver evolução de ${exercise.exerciseNameSnapshot}`}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.progressLink, pressed && styles.progressLinkPressed]}
        >
          <Text style={styles.progressLinkText}>Evolução ›</Text>
        </Pressable>
      </View>

      <View style={styles.columns} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.columnLabel, { width: COLUMNS.set }]}>#</Text>
        <Text style={[styles.columnLabel, styles.columnFlex]}>Planejado</Text>
        <Text style={[styles.columnLabel, styles.columnFlex]}>Realizado</Text>
        <View style={{ width: COLUMNS.status }} />
      </View>
      {exercise.sets.map((set) => (
        <SetHistoryRow key={set.id} set={set} />
      ))}
    </View>
  );
}

/** Detalhes de uma execução concluída. Somente leitura: tudo vem dos snapshots da sessão. */
export default function SessionHistoryDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { details, status, reload } = useSession(id);
  const screenOptions = <Stack.Screen options={{ title: 'Histórico', headerTitle: '' }} />;

  if (status === 'loading') {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando treino" />
      </ScreenContainer>
    );
  }

  if (status !== 'ready' || !details) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {status === 'not-found' ? 'Treino não encontrado' : 'Não foi possível carregar'}
          </Text>
        </View>
        {status === 'error' ? <PrimaryButton label="Tentar novamente" onPress={reload} /> : null}
        <PrimaryButton label="Voltar" variant="secondary" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  // Sessão em andamento não é histórico: abre a execução.
  if (details.session.status !== 'completed' || !details.session.completedAt) {
    return <Redirect href={{ pathname: '/session/[id]', params: { id } }} />;
  }

  const { session } = details;
  const summary = computeSessionSummary(details, Date.parse(details.session.completedAt));

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {screenOptions}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.overline}>Treino concluído</Text>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
            {session.workoutNameSnapshot}
          </Text>
          <Text style={styles.subtitle}>
            {formatFullDate(session.startedAt)} · {formatTime(session.startedAt)}–{formatTime(session.completedAt!)}
          </Text>
        </View>

        <View style={styles.tiles}>
          <StatTile label="Duração" value={formatDuration(summary.durationMs)} />
          <StatTile label="Séries" value={`${summary.completedSets}/${summary.plannedSets}`} />
          <StatTile label="Exercícios" value={`${summary.exercisesPerformed}/${summary.totalExercises}`} />
        </View>

        <View style={styles.list}>
          {details.exercises.map((exercise) => (
            <ExerciseHistoryCard key={exercise.id} exercise={exercise} />
          ))}
        </View>

        <Text style={styles.footnote}>
          Registro somente leitura, com os valores do momento da execução. Alterações nos treinos atuais não
          modificam este histórico.
        </Text>
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
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitleGroup: {
    flex: 1,
    gap: spacing.xxs,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  progressLinkPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  progressLinkText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  columnFlex: {
    flex: 1,
  },
  columnLabel: {
    ...typography.overline,
    fontSize: 10,
    color: colors.textSecondary,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  setRowSkipped: {
    opacity: 0.6,
  },
  setNumber: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  setCell: {
    ...typography.caption,
    flex: 1,
  },
  setPlanned: {
    color: colors.textSecondary,
  },
  setActual: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  setMissing: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  setStatus: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  statusDone: {
    color: colors.primary,
  },
  statusSkipped: {
    color: colors.textSecondary,
  },
  footnote: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
