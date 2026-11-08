import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useToast } from '@/components/ui/Toast';
import { ExerciseActionsSheet } from '@/features/exercises/components/ExerciseActionsSheet';
import { ExerciseFormSheet } from '@/features/exercises/components/ExerciseFormSheet';
import { ExerciseList } from '@/features/exercises/components/ExerciseList';
import { useExercises } from '@/features/exercises/hooks/useExercises';
import { exerciseToFormValues } from '@/features/exercises/services/exercise.service';
import { ElapsedClock } from '@/features/sessions/components/ElapsedClock';
import { useInProgressSessions } from '@/features/sessions/hooks/useInProgressSessions';
import type { Exercise, ExerciseInput } from '@/features/exercises/types/exercise.types';
import { formatExerciseCount } from '@/features/workouts/components/WorkoutCard';
import { useWorkout } from '@/features/workouts/hooks/useWorkout';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

/** Apenas um overlay (formulário, menu de opções ou confirmação) fica aberto por vez. */
type OverlayState =
  | { type: 'none' }
  | { type: 'form'; mode: 'create'; key: number }
  | { type: 'form'; mode: 'edit'; key: number; exercise: Exercise }
  | { type: 'actions'; exercise: Exercise }
  | { type: 'confirm-delete'; exercise: Exercise };

export default function WorkoutDetailsScreen() {
  const { id, name: nameParam } = useLocalSearchParams<'/workout/[id]', { name?: string }>();
  const { workout, status: workoutStatus, reload: reloadWorkout } = useWorkout(id);
  const {
    exercises,
    status,
    reload,
    createExercise,
    updateExercise,
    deleteExercise,
    duplicateExercise,
    reorderExercises,
  } = useExercises(id);
  const toast = useToast();

  const [overlay, setOverlay] = useState<OverlayState>({ type: 'none' });
  const [formOpenCount, setFormOpenCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const { sessions, refresh: refreshSessions, start: startSession } = useInProgressSessions();
  const activeSession = sessions.find((session) => session.workoutId === id) ?? null;

  // Ao voltar da execução (ou abrir a tela), confere se há sessão em andamento deste treino.
  useFocusEffect(
    useCallback(() => {
      void refreshSessions();
    }, [refreshSessions]),
  );

  /** Inicia o treino ou, se já houver sessão em andamento dele, retoma a existente (nunca cria duas). */
  const handleStartOrContinue = async () => {
    if (isStarting) return;
    if (activeSession) {
      router.push({ pathname: '/session/[id]', params: { id: activeSession.id } });
      return;
    }
    setIsStarting(true);
    try {
      const { sessionId } = await startSession(id);
      router.push({ pathname: '/session/[id]', params: { id: sessionId } });
    } catch {
      toast.show('Não foi possível iniciar o treino. Tente novamente.', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const workoutName = workout?.name ?? (typeof nameParam === 'string' && nameParam.length > 0 ? nameParam : 'Treino');

  const closeOverlay = () => {
    if (!isSaving) setOverlay({ type: 'none' });
  };

  const openCreateForm = () => {
    const key = formOpenCount + 1;
    setFormOpenCount(key);
    setOverlay({ type: 'form', mode: 'create', key });
  };

  const openEditForm = (exercise: Exercise) => {
    const key = formOpenCount + 1;
    setFormOpenCount(key);
    setOverlay({ type: 'form', mode: 'edit', key, exercise });
  };

  const handleSubmit = async (input: ExerciseInput) => {
    if (overlay.type !== 'form' || isSaving) return;
    setIsSaving(true);
    try {
      if (overlay.mode === 'edit') {
        await updateExercise(overlay.exercise.id, input);
        toast.show('Exercício atualizado');
      } else {
        await createExercise(input);
        toast.show('Exercício adicionado');
      }
      setOverlay({ type: 'none' });
    } catch {
      // O formulário continua aberto com os dados digitados para o usuário tentar de novo.
      // Alert (e não toast): o Modal fica por cima de toasts no Android.
      Alert.alert('Não foi possível salvar', 'Ocorreu um erro ao salvar o exercício. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (overlay.type !== 'confirm-delete' || isSaving) return;
    setIsSaving(true);
    try {
      await deleteExercise(overlay.exercise.id);
      setOverlay({ type: 'none' });
      toast.show('Exercício excluído');
    } catch {
      setOverlay({ type: 'none' });
      toast.show('Não foi possível excluir o exercício. Tente novamente.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (exercise: Exercise) => {
    if (isSaving) return;
    setOverlay({ type: 'none' });
    setIsSaving(true);
    try {
      await duplicateExercise(exercise.id);
      toast.show('Exercício duplicado');
    } catch {
      toast.show('Não foi possível duplicar o exercício. Nada foi alterado.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /** A lista já mudou na tela (otimista); em caso de falha o hook restaura a ordem salva. */
  const handleReorder = async (from: number, to: number) => {
    try {
      await reorderExercises(from, to);
    } catch {
      toast.show('Não foi possível salvar a nova ordem. A ordem anterior foi restaurada.', 'error');
    }
  };

  const screenOptions = <Stack.Screen options={{ title: workoutName, headerTitle: '' }} />;

  if (workoutStatus === 'loading') {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando treino" />
      </ScreenContainer>
    );
  }

  if (workoutStatus === 'not-found' || workoutStatus === 'error') {
    const notFound = workoutStatus === 'not-found';
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle} accessibilityRole="header">
            {notFound ? 'Treino não encontrado' : 'Não foi possível carregar'}
          </Text>
          <Text style={styles.messageDescription}>
            {notFound
              ? 'Este treino pode ter sido excluído.'
              : 'Ocorreu um erro ao ler este treino. Tente novamente.'}
          </Text>
        </View>
        {notFound ? null : <PrimaryButton label="Tentar novamente" onPress={reloadWorkout} />}
        <PrimaryButton label="Voltar para meus treinos" variant="secondary" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.overline}>Treino</Text>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {workoutName}
      </Text>

      {status === 'ready' ? (
        <View style={styles.startArea}>
          {activeSession ? (
            <View style={styles.activeRow}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Em andamento há </Text>
              <ElapsedClock startedAt={activeSession.startedAt} style={styles.activeClock} />
            </View>
          ) : null}
          <PrimaryButton
            label={activeSession ? 'Continuar treino' : isStarting ? 'Iniciando…' : 'Iniciar treino'}
            onPress={handleStartOrContinue}
            disabled={isStarting || (!activeSession && exercises.length === 0)}
          />
          {!activeSession && exercises.length === 0 ? (
            <Text style={styles.startHint}>Adicione ao menos um exercício para iniciar o treino.</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleGroup}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Exercícios
          </Text>
          {status === 'ready' ? (
            <Text style={styles.sectionCount}>
              {formatExerciseCount(exercises.length)}
              {exercises.length > 1 ? ' · Segure e arraste para reordenar' : ''}
            </Text>
          ) : null}
        </View>
        {status === 'ready' && exercises.length > 0 ? (
          <PrimaryButton
            label="Novo"
            leadingSymbol="+"
            size="compact"
            onPress={openCreateForm}
            accessibilityLabel="Adicionar exercício"
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {screenOptions}

      <ExerciseList
        exercises={exercises}
        status={status}
        header={header}
        onExercisePress={openEditForm}
        onExerciseOptionsPress={(exercise) => setOverlay({ type: 'actions', exercise })}
        onAddExercisePress={openCreateForm}
        onRetryPress={reload}
        onReorder={handleReorder}
      />

      {overlay.type === 'form' ? (
        <ExerciseFormSheet
          key={overlay.key}
          visible
          mode={overlay.mode}
          initialValues={overlay.mode === 'edit' ? exerciseToFormValues(overlay.exercise) : undefined}
          onSubmit={handleSubmit}
          onCancel={closeOverlay}
          submitting={isSaving}
        />
      ) : null}

      {overlay.type === 'actions' ? (
        <ExerciseActionsSheet
          visible
          exercise={overlay.exercise}
          onEdit={openEditForm}
          onDuplicate={handleDuplicate}
          onViewProgress={(exercise) => {
            setOverlay({ type: 'none' });
            router.push({ pathname: '/exercise-progress', params: { name: exercise.name } });
          }}
          onDelete={(exercise) => setOverlay({ type: 'confirm-delete', exercise })}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay.type === 'confirm-delete' ? (
        <ConfirmDialog
          visible
          destructive
          title="Excluir exercício?"
          message={
            <>
              O exercício <Text style={styles.highlight}>{overlay.exercise.name}</Text> será removido deste
              treino. Essa ação não pode ser desfeita.
            </>
          }
          confirmLabel="Excluir"
          busy={isSaving}
          busyLabel="Excluindo…"
          onConfirm={handleConfirmDelete}
          onCancel={closeOverlay}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    gap: spacing.lg,
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
  startArea: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
    backgroundColor: colors.primary,
  },
  activeText: {
    ...typography.caption,
    color: colors.primary,
  },
  activeClock: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  startHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitleGroup: {
    flexShrink: 1,
    gap: spacing.xxs,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.textSecondary,
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
