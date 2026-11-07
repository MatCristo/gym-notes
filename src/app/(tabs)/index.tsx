import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useToast } from '@/components/ui/Toast';
import { InProgressSessionBanner } from '@/features/sessions/components/InProgressSessionBanner';
import { useInProgressSessions } from '@/features/sessions/hooks/useInProgressSessions';
import { WorkoutActionsSheet } from '@/features/workouts/components/WorkoutActionsSheet';
import { WorkoutFormModal } from '@/features/workouts/components/WorkoutFormModal';
import { WorkoutList } from '@/features/workouts/components/WorkoutList';
import { useWorkouts } from '@/features/workouts/hooks/useWorkouts';
import type { Workout, WorkoutFormMode } from '@/features/workouts/types/workout.types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

/** Apenas um overlay (formulário, menu de opções ou confirmação) fica aberto por vez. */
type OverlayState =
  | { type: 'none' }
  | { type: 'form'; mode: 'create'; key: number }
  | { type: 'form'; mode: 'edit'; key: number; workout: Workout }
  | { type: 'actions'; workout: Workout }
  | { type: 'confirm-delete'; workout: Workout };

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomeScreen() {
  const { workouts, status, reload, refresh, createWorkout, renameWorkout, deleteWorkout, duplicateWorkout } =
    useWorkouts();
  const toast = useToast();

  const { sessions: inProgressSessions, refresh: refreshSessions } = useInProgressSessions();

  // Ao abrir/voltar para a Home: atualiza a contagem de exercícios e detecta sessões em andamento
  // (inclusive após o app ter sido fechado no meio de um treino).
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
    } catch {
      setOverlay({ type: 'none' });
      toast.show('Não foi possível excluir o treino. Tente novamente.', 'error');
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

  const handleWorkoutPress = (workout: Workout) => {
    router.push({ pathname: '/workout/[id]', params: { id: workout.id, name: workout.name } });
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandDot} />
        <Text style={styles.brand} accessibilityRole="header">
          Gym Notes
        </Text>
      </View>
      <Text style={styles.greeting}>{getGreeting(new Date())}! Pronto para treinar?</Text>

      {inProgressSessions.length > 0 ? (
        <View style={styles.sessions}>
          {inProgressSessions.map((session) => (
            <InProgressSessionBanner
              key={session.id}
              session={session}
              onPress={(target) => router.push({ pathname: '/session/[id]', params: { id: target.id } })}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleGroup}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Meus treinos
          </Text>
          {status === 'ready' ? (
            <Text style={styles.sectionCount}>
              {workouts.length === 1 ? '1 treino' : `${workouts.length} treinos`}
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
    <ScreenContainer>
      <WorkoutList
        workouts={workouts}
        header={header}
        onWorkoutPress={handleWorkoutPress}
        onWorkoutOptionsPress={(workout) => setOverlay({ type: 'actions', workout })}
        onCreateWorkoutPress={() => openForm('create')}
        status={status}
        onRetryPress={reload}
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
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  brand: {
    ...typography.overline,
    color: colors.primary,
  },
  greeting: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sessions: {
    gap: spacing.md,
    marginTop: spacing.lg,
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
    ...typography.display,
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
});
