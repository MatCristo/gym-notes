import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useToast } from '@/components/ui/Toast';
import { ElapsedClock } from '@/features/sessions/components/ElapsedClock';
import { RestTimerPanel } from '@/features/sessions/components/RestTimerPanel';
import { SessionExerciseCard } from '@/features/sessions/components/SessionExerciseCard';
import { useRestTimer } from '@/features/sessions/hooks/useRestTimer';
import { useSession } from '@/features/sessions/hooks/useSession';
import type { SessionExercise, SetActuals, SetLog } from '@/features/sessions/types/session.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const REST_PANEL_SPACE = 260;

export default function SessionExecutionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { details, status, reload, completeSet, uncompleteSet, saveSetActuals, finish } = useSession(id);
  const timer = useRestTimer();
  const toast = useToast();
  const [confirmFinishVisible, setConfirmFinishVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const screenOptions = <Stack.Screen options={{ title: 'Treino em andamento', headerTitle: '' }} />;

  // Callbacks das séries: nunca rejeitam (o erro é tratado aqui e o usuário é avisado).
  const handleCompleteSet = async (exercise: SessionExercise, set: SetLog, actuals: SetActuals) => {
    try {
      await completeSet(set.id, actuals);
      timer.offer(exercise.plannedRestSeconds, exercise.exerciseNameSnapshot);
    } catch {
      toast.show('A série não foi salva. Tente novamente.', 'error');
    }
  };

  const handleUncompleteSet = async (set: SetLog) => {
    try {
      await uncompleteSet(set.id);
    } catch {
      toast.show('Não foi possível alterar a série. Tente novamente.', 'error');
    }
  };

  const handleSaveSetActuals = async (set: SetLog, actuals: SetActuals) => {
    try {
      await saveSetActuals(set.id, actuals);
    } catch {
      toast.show('Os valores da série não foram salvos. Tente novamente.', 'error');
    }
  };

  const handleConfirmFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await finish();
      setConfirmFinishVisible(false);
      timer.dismiss();
      router.replace({ pathname: '/session/summary/[id]', params: { id } });
    } catch {
      // Alert (e não toast): o diálogo de confirmação continua aberto por cima.
      Alert.alert('Não foi possível finalizar', 'Ocorreu um erro ao finalizar o treino. Tente novamente.');
    } finally {
      setIsFinishing(false);
    }
  };

  if (status === 'loading') {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando treino" />
      </ScreenContainer>
    );
  }

  if (status !== 'ready' || !details) {
    const notFound = status === 'not-found';
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle} accessibilityRole="header">
            {notFound ? 'Sessão não encontrada' : 'Não foi possível carregar'}
          </Text>
          <Text style={styles.messageDescription}>
            {notFound ? 'Esta sessão de treino não existe mais.' : 'Ocorreu um erro ao ler a sessão. Tente novamente.'}
          </Text>
        </View>
        {notFound ? null : <PrimaryButton label="Tentar novamente" onPress={reload} />}
        <PrimaryButton label="Voltar" variant="secondary" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  // Sessão já finalizada não é editável: mostra o resumo.
  if (details.session.status === 'completed') {
    return <Redirect href={{ pathname: '/session/summary/[id]', params: { id } }} />;
  }

  const allSets = details.exercises.flatMap((exercise) => exercise.sets);
  const completedSets = allSets.filter((set) => set.completedAt !== null).length;
  const pendingSets = allSets.length - completedSets;

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {screenOptions}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, timer.state.status !== 'idle' && { paddingBottom: REST_PANEL_SPACE }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.statusRow}>
              <View style={styles.liveDot} />
              <Text style={styles.overline}>Em andamento</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
              {details.session.workoutNameSnapshot}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Tempo</Text>
                <ElapsedClock startedAt={details.session.startedAt} style={styles.statValue} />
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Séries</Text>
                <Text style={styles.statValue}>
                  {completedSets}/{allSets.length}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.list}>
            {details.exercises.map((exercise) => (
              <SessionExerciseCard
                key={exercise.id}
                exercise={exercise}
                onCompleteSet={handleCompleteSet}
                onUncompleteSet={handleUncompleteSet}
                onSaveSetActuals={handleSaveSetActuals}
              />
            ))}
          </View>

          <PrimaryButton
            label="Finalizar treino"
            onPress={() => setConfirmFinishVisible(true)}
            style={styles.finishButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <RestTimerPanel
        state={timer.state}
        onStart={timer.start}
        onPause={timer.pause}
        onResume={timer.resume}
        onAdjust={timer.adjust}
        onDismiss={timer.dismiss}
      />

      {confirmFinishVisible ? (
        <ConfirmDialog
          visible
          title="Finalizar treino?"
          message={
            pendingSets > 0 ? (
              <>
                Você concluiu <Text style={styles.highlight}>{completedSets}</Text> de {allSets.length} séries. As séries
                não concluídas ficarão registradas como não realizadas.
              </>
            ) : (
              'Todas as séries foram concluídas. Bom treino!'
            )
          }
          confirmLabel="Finalizar"
          busy={isFinishing}
          busyLabel="Finalizando…"
          onConfirm={handleConfirmFinish}
          onCancel={() => {
            if (!isFinishing) setConfirmFinishVisible(false);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  overline: {
    ...typography.overline,
    color: colors.primary,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  stat: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xxs,
  },
  statLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.title,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  list: {
    gap: spacing.md,
  },
  finishButton: {
    marginTop: spacing.xl,
  },
  highlight: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  messageCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  messageTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  messageDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
