import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useToast } from '@/components/ui/Toast';
import { ProgramActionsSheet } from '@/features/programs/components/ProgramActionsSheet';
import { ProgramFormModal } from '@/features/programs/components/ProgramFormModal';
import { ProgramList } from '@/features/programs/components/ProgramList';
import { usePrograms } from '@/features/programs/hooks/usePrograms';
import { ProgramServiceError, type ProgramInput } from '@/features/programs/services/program.service';
import type { ProgramFormMode, TrainingProgram } from '@/features/programs/types/program.types';
import { InProgressSessionBanner } from '@/features/sessions/components/InProgressSessionBanner';
import { useInProgressSessions } from '@/features/sessions/hooks/useInProgressSessions';
import { ImportProgramModal } from '@/features/sharing/components/ImportProgramModal';
import { ShareProgramSheet } from '@/features/sharing/components/ShareProgramSheet';
import { useProgramImport } from '@/features/sharing/hooks/useProgramImport';
import { useProgramSharing } from '@/features/sharing/hooks/useProgramSharing';
import type { ExportedProgram } from '@/features/sharing/types/sharing.types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

/** Apenas um overlay (formulário, menu de opções ou confirmação) fica aberto por vez. */
type OverlayState =
  | { type: 'none' }
  | { type: 'form'; mode: 'create'; key: number }
  | { type: 'form'; mode: 'edit'; key: number; program: TrainingProgram }
  | { type: 'actions'; program: TrainingProgram }
  | { type: 'confirm-delete'; program: TrainingProgram }
  | { type: 'share'; exported: ExportedProgram }
  | { type: 'import'; key: number };

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function describeProgramDeletion(workoutCount: number): string {
  if (workoutCount === 0) return ' será excluído.';
  if (workoutCount === 1) return ' e o seu treino (com os exercícios) serão excluídos.';
  return ` e os seus ${workoutCount} treinos (com os exercícios) serão excluídos.`;
}

export default function HomeScreen() {
  const { programs, status, reload, refresh, createProgram, updateProgram, deleteProgram, duplicateProgram } =
    usePrograms();
  const toast = useToast();

  const { sessions: inProgressSessions, refresh: refreshSessions } = useInProgressSessions();
  const { isExporting, exportProgram, copyCode, shareCode } = useProgramSharing();
  const { paste, preview, importCode } = useProgramImport();

  // Ao abrir/voltar para a Home: atualiza a contagem de treinos e detecta sessões em andamento
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

  const openForm = (mode: ProgramFormMode, program?: TrainingProgram) => {
    const key = formOpenCount + 1;
    setFormOpenCount(key);
    setOverlay(
      mode === 'edit' && program
        ? { type: 'form', mode, key, program }
        : { type: 'form', mode: 'create', key },
    );
  };

  const handleSubmit = async (input: ProgramInput) => {
    if (overlay.type !== 'form' || isSaving) return;
    setIsSaving(true);
    try {
      if (overlay.mode === 'edit') {
        await updateProgram(overlay.program.id, input);
        toast.show('Planejamento atualizado');
      } else {
        await createProgram(input);
        toast.show('Planejamento criado');
      }
      setOverlay({ type: 'none' });
    } catch {
      // O formulário continua aberto com o texto digitado para o usuário tentar de novo.
      // Alert (e não toast): o Modal fica por cima de toasts no Android.
      Alert.alert('Não foi possível salvar', 'Ocorreu um erro ao salvar o planejamento. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (overlay.type !== 'confirm-delete' || isSaving) return;
    setIsSaving(true);
    try {
      await deleteProgram(overlay.program.id);
      setOverlay({ type: 'none' });
      toast.show('Planejamento excluído');
    } catch (error) {
      setOverlay({ type: 'none' });
      if (error instanceof ProgramServiceError && error.code === 'has-session-in-progress') {
        Alert.alert(
          'Treino em andamento',
          'Um treino deste planejamento está em andamento. Finalize esse treino antes de excluir o planejamento. Nada foi excluído.',
        );
      } else {
        toast.show('Não foi possível excluir o planejamento. Nada foi alterado.', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (program: TrainingProgram) => {
    if (isSaving) return;
    setOverlay({ type: 'none' });
    setIsSaving(true);
    try {
      const copy = await duplicateProgram(program.id);
      toast.show(`“${copy.name}” criado`);
    } catch {
      toast.show('Não foi possível duplicar o planejamento. Nada foi alterado.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /** Gera o código e só então abre o painel; em caso de falha, mostra o motivo e não abre nada. */
  const handleShare = async (program: TrainingProgram) => {
    if (isExporting) return;
    setOverlay({ type: 'none' });
    const result = await exportProgram(program.id);
    if (!result) return;
    if (result.ok) setOverlay({ type: 'share', exported: result.exported });
    else toast.show(result.message, 'error');
  };

  const openImport = () => {
    // Nova `key` a cada abertura: o código digitado antes nunca é reaproveitado.
    const key = formOpenCount + 1;
    setFormOpenCount(key);
    setOverlay({ type: 'import', key });
  };

  /** Após importar: fecha a interface, atualiza a lista a partir do banco e confirma com o nome. */
  const handleImported = (program: TrainingProgram) => {
    setOverlay({ type: 'none' });
    void refresh();
    toast.show(`Planejamento importado com sucesso: “${program.name}”`);
  };

  const handleProgramPress = (program: TrainingProgram) => {
    router.push({ pathname: '/program/[id]', params: { id: program.id, name: program.name } });
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
            Meus planejamentos
          </Text>
          {status === 'ready' ? (
            <Text style={styles.sectionCount}>
              {programs.length === 1 ? '1 planejamento' : `${programs.length} planejamentos`}
            </Text>
          ) : null}
        </View>
        {status === 'ready' && programs.length > 0 ? (
          <View style={styles.sectionActions}>
            <PrimaryButton
              label="Importar"
              variant="secondary"
              size="compact"
              onPress={openImport}
              accessibilityLabel="Importar planejamento"
              accessibilityHint="Cria um planejamento a partir de um código recebido"
            />
            <PrimaryButton
              label="Novo"
              leadingSymbol="+"
              size="compact"
              onPress={() => openForm('create')}
              accessibilityLabel="Adicionar planejamento"
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <ProgramList
        programs={programs}
        header={header}
        onProgramPress={handleProgramPress}
        onProgramOptionsPress={(program) => setOverlay({ type: 'actions', program })}
        onCreateProgramPress={() => openForm('create')}
        onImportProgramPress={openImport}
        status={status}
        onRetryPress={reload}
      />

      {overlay.type === 'form' ? (
        <ProgramFormModal
          key={overlay.key}
          visible
          mode={overlay.mode}
          initialName={overlay.mode === 'edit' ? overlay.program.name : ''}
          initialDescription={overlay.mode === 'edit' ? (overlay.program.description ?? '') : ''}
          onSubmit={handleSubmit}
          onCancel={closeOverlay}
          submitting={isSaving}
        />
      ) : null}

      {overlay.type === 'actions' ? (
        <ProgramActionsSheet
          visible
          program={overlay.program}
          onEdit={(program) => openForm('edit', program)}
          onDuplicate={handleDuplicate}
          onShare={handleShare}
          onDelete={(program) => setOverlay({ type: 'confirm-delete', program })}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay.type === 'import' ? (
        <ImportProgramModal
          key={overlay.key}
          visible
          onPaste={paste}
          onPreview={preview}
          onImport={importCode}
          onImported={handleImported}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay.type === 'share' ? (
        <ShareProgramSheet
          visible
          exported={overlay.exported}
          onCopy={copyCode}
          onShare={shareCode}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay.type === 'confirm-delete' ? (
        <ConfirmDialog
          visible
          destructive
          title="Excluir planejamento?"
          message={
            <>
              O planejamento <Text style={styles.highlight}>{overlay.program.name}</Text>
              {describeProgramDeletion(overlay.program.workoutCount)} O histórico dos treinos já realizados é
              mantido. Essa ação não pode ser desfeita.
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
  sectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
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
