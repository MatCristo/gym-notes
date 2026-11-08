import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useToast } from '@/components/ui/Toast';
import { formatWorkoutCount } from '@/features/programs/components/ProgramCard';
import { useProgram } from '@/features/programs/hooks/useProgram';
import { useInProgressSessions } from '@/features/sessions/hooks/useInProgressSessions';
import { WorkoutActionsSheet } from '@/features/workouts/components/WorkoutActionsSheet';
import { WorkoutFormModal } from '@/features/workouts/components/WorkoutFormModal';
import { WorkoutList } from '@/features/workouts/components/WorkoutList';
import { useWorkouts } from '@/features/workouts/hooks/useWorkouts';
import { WorkoutServiceError } from '@/features/workouts/services/workout.service';
import type { Workout, WorkoutFormMode } from '@/features/workouts/types/workout.types';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

/** Apenas um overlay (formulário, menu de opções ou confirmação) fica aberto por vez. */
type OverlayState =
  | { type: 'none' }
  | { type: 'form'; mode: 'create'; key: number }
  | { type: 'form'; mode: 'edit'; key: number; workout: Workout }
  | { type: 'actions'; workout: Workout }
  | { type: 'confirm-delete'; workout: Workout };

export default function ProgramDetailsScreen() {
  const { id, name: nameParam } = useLocalSearchParams<'/program/[id]', { name?: string }>();
  const { program, status: programStatus, reload: reloadProgram } = useProgram(id);
  const {
    workouts,
    status,
    reload,
    refresh,
    createWorkout,
    renameWorkout,
    deleteWorkout,
    duplicateWorkout,
    reorderWorkouts,
  } = useWorkouts(id);
  const toast = useToast();

  const { sessions, refresh: refreshSessions, start: startSession } = useInProgressSessions();
  const inProgressWorkoutIds = useMemo(
    () => new Set(sessions.flatMap((session) => (session.workoutId ? [session.workoutId] : []))),
    [sessions],
  );

  // Ao voltar de um treino: atualiza a contagem de exercícios e as sessões em andamento.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshSessions();
    }, [refresh, refreshSessions]),
  );

  const [overlay, setOverlay] = useState<OverlayState>({ type: 'none' });
  const [formOpenCount, setFormOpenCount] = useState(0);
  /** Operação em andamento no banco: bloqueia envios duplicados e o fechamento dos diálogos. */
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const programName =
    program?.name ?? (typeof nameParam === 'string' && nameParam.length > 0 ? nameParam : 'Planejamento');

  const closeOverlay = () => {
    if (!isSaving) setOverlay({ type: 'none' });
  };

  const openForm = (mode: WorkoutFormMode, workout?: Workout) => {
    const key = formOpenCount + 1;
    setFormOpenCount(key);
    setOverlay(
      mode === 'edit' && workout
        ? { type: 'form', mode, key, workout }
        : { type: 'form', mode: 'create', key },
    );
  };

  const handleSubmit = async (name: string) => {
    if (overlay.type !== 'form' || isSaving) return;
    setIsSaving(true);
    try {
      if (overlay.mode === 'edit') {
        await renameWorkout(overlay.workout.id, name);
        toast.show('Nome do treino atualizado');
      } else {
        await createWorkout(name);
        toast.show('Treino criado');
      }
      setOverlay({ type: 'none' });
    } catch {
      // O formulário continua aberto com o texto digitado para o usuário tentar de novo.
      // Alert (e não toast): o Modal fica por cima de toasts no Android.
      Alert.alert('Não foi possível salvar', 'Ocorreu um erro ao salvar o treino. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (overlay.type !== 'confirm-delete' || isSaving) return;
    setIsSaving(true);
    try {
      await deleteWorkout(overlay.workout.id);
      setOverlay({ type: 'none' });
      toast.show('Treino excluído');
    } catch (error) {
      setOverlay({ type: 'none' });
      if (error instanceof WorkoutServiceError && error.code === 'has-session-in-progress') {
        // A lista pode estar desatualizada (sessão iniciada em outra tela): atualiza o indicador.
        void refreshSessions();
        Alert.alert(
          'Treino em andamento',
          'Este treino está em andamento. Finalize-o antes de excluir. Nada foi excluído.',
        );
      } else {
        toast.show('Não foi possível excluir o treino. Tente novamente.', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (workout: Workout) => {
    if (isSaving) return;
    setOverlay({ type: 'none' });
    setIsSaving(true);
    try {
      const copy = await duplicateWorkout(workout.id);
      toast.show(`“${copy.name}” criado`);
    } catch {
      toast.show('Não foi possível duplicar o treino. Nada foi alterado.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /** Inicia o treino ou, se já houver sessão em andamento dele, retoma a existente (nunca cria duas). */
  const handleStart = async (workout: Workout) => {
    if (isStarting) return;
    setOverlay({ type: 'none' });
    const active = sessions.find((session) => session.workoutId === workout.id);
    if (active) {
      router.push({ pathname: '/session/[id]', params: { id: active.id } });
      return;
    }
    if (workout.exerciseCount === 0) {
      toast.show('Adicione ao menos um exercício para iniciar o treino.', 'error');
      return;
    }
    setIsStarting(true);
    try {
      const { sessionId } = await startSession(workout.id);
      router.push({ pathname: '/session/[id]', params: { id: sessionId } });
    } catch {
      toast.show('Não foi possível iniciar o treino. Tente novamente.', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  /** A lista já mudou na tela (otimista); em caso de falha o hook restaura a ordem salva. */
  const handleReorder = async (from: number, to: number) => {
    try {
      await reorderWorkouts(from, to);
    } catch {
      toast.show('Não foi possível salvar a nova ordem. A ordem anterior foi restaurada.', 'error');
    }
  };

  const handleWorkoutPress = (workout: Workout) => {
    router.push({ pathname: '/workout/[id]', params: { id: workout.id, name: workout.name } });
  };

  const screenOptions = <Stack.Screen options={{ title: programName, headerTitle: '' }} />;

  if (programStatus === 'loading') {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando planejamento" />
      </ScreenContainer>
    );
  }

  if (programStatus === 'not-found' || programStatus === 'error') {
    const notFound = programStatus === 'not-found';
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {screenOptions}
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle} accessibilityRole="header">
            {notFound ? 'Planejamento não encontrado' : 'Não foi possível carregar'}
          </Text>
          <Text style={styles.messageDescription}>
            {notFound
              ? 'Este planejamento pode ter sido excluído.'
              : 'Ocorreu um erro ao ler este planejamento. Tente novamente.'}
          </Text>
        </View>
        {notFound ? null : <PrimaryButton label="Tentar novamente" onPress={reloadProgram} />}
        <PrimaryButton label="Voltar para meus planejamentos" variant="secondary" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  const activeForOverlay =
    overlay.type === 'actions' ? inProgressWorkoutIds.has(overlay.workout.id) : false;

  const header = (
    <View style={styles.header}>
      <Text style={styles.overline}>Planejamento</Text>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {programName}
      </Text>
      {program?.description ? <Text style={styles.description}>{program.description}</Text> : null}

      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleGroup}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Treinos
          </Text>
          {status === 'ready' ? (
            <Text style={styles.sectionCount}>
              {formatWorkoutCount(workouts.length)}
              {workouts.length > 1 ? ' · Segure e arraste para reordenar' : ''}
            </Text>
          ) : null}
        </View>
        {status === 'ready' && workouts.length > 0 ? (
          <PrimaryButton
            label="Novo"
            leadingSymbol="+"
            size="compact"
            onPress={() => openForm('create')}
            accessibilityLabel="Adicionar treino"
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {screenOptions}

      <WorkoutList
        workouts={workouts}
        header={header}
        onWorkoutPress={handleWorkoutPress}
        onWorkoutOptionsPress={(workout) => setOverlay({ type: 'actions', workout })}
        onCreateWorkoutPress={() => openForm('create')}
        status={status}
        onRetryPress={reload}
        onReorder={handleReorder}
        inProgressWorkoutIds={inProgressWorkoutIds}
      />

      {overlay.type === 'form' ? (
        <WorkoutFormModal
          key={overlay.key}
          visible
          mode={overlay.mode}
          initialName={overlay.mode === 'edit' ? overlay.workout.name : ''}
          onSubmit={handleSubmit}
          onCancel={closeOverlay}
          submitting={isSaving}
        />
      ) : null}

      {overlay.type === 'actions' ? (
        <WorkoutActionsSheet
          visible
          workout={overlay.workout}
          startLabel={activeForOverlay ? 'Continuar treino' : 'Iniciar treino'}
          onStart={handleStart}
          onEdit={(workout) => openForm('edit', workout)}
          onDuplicate={handleDuplicate}
          onDelete={(workout) => setOverlay({ type: 'confirm-delete', workout })}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay.type === 'confirm-delete' ? (
        <ConfirmDialog
          visible
          destructive
          title="Excluir treino?"
          message={
            <>
              O treino <Text style={styles.highlight}>{overlay.workout.name}</Text>
              {overlay.workout.exerciseCount > 0
                ? ` e ${overlay.workout.exerciseCount === 1 ? 'seu exercício serão excluídos' : `seus ${overlay.workout.exerciseCount} exercícios serão excluídos`}.`
                : ' será excluído.'}{' '}
              Essa ação não pode ser desfeita.
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
  description: {
    ...typography.body,
    color: colors.textSecondary,
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
