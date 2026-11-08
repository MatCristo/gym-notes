import { useCallback, useEffect, useState } from 'react';

import { workoutService } from '@/features/workouts/services/workout.service';
import type { Workout } from '@/features/workouts/types/workout.types';
import { moveItem } from '@/utils/move-item';

export type WorkoutsStatus = 'loading' | 'ready' | 'error';

export interface UseWorkoutsResult {
  workouts: Workout[];
  status: WorkoutsStatus;
  reload: () => Promise<void>;
  /**
   * Recarrega em segundo plano, sem exibir loading (ex.: ao voltar para o planejamento,
   * para refletir exercícios adicionados/excluídos). Falhas mantêm a lista atual.
   */
  refresh: () => Promise<void>;
  /** Resolve com o treino salvo. Rejeita se o nome for inválido ou o banco falhar. */
  createWorkout: (rawName: string) => Promise<Workout>;
  /** Resolve com o treino atualizado. Rejeita se não existir, nome inválido ou falha no banco. */
  renameWorkout: (id: string, rawName: string) => Promise<Workout>;
  /** Exclui pelo ID. Rejeita se o banco falhar (a lista não é alterada nesse caso). */
  deleteWorkout: (id: string) => Promise<void>;
  /** Duplica treino + exercícios (transacional). Resolve com a cópia, já adicionada à lista. */
  duplicateWorkout: (id: string) => Promise<Workout>;
  /**
   * Move o treino de `from` para `to`. A lista muda na hora (otimista) e a ordem é gravada
   * no SQLite; se a gravação falhar, a lista é recarregada do banco e o erro é repassado.
   */
  reorderWorkouts: (from: number, to: number) => Promise<void>;
}

/**
 * Treinos de um planejamento, sincronizados com o SQLite.
 * A lista só é alterada depois que o banco confirma a operação (exceto a reordenação,
 * que é otimista e desfeita em caso de falha).
 */
export function useWorkouts(programId: string): UseWorkoutsResult {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [status, setStatus] = useState<WorkoutsStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setWorkouts(await workoutService.listWorkouts(programId));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [programId]);

  const refresh = useCallback(async () => {
    try {
      const loaded = await workoutService.listWorkouts(programId);
      setWorkouts(loaded);
      setStatus('ready');
    } catch {
      // Mantém os dados já exibidos; o carregamento inicial é quem exibe o estado de erro.
    }
  }, [programId]);

  useEffect(() => {
    let cancelled = false;
    workoutService
      .listWorkouts(programId)
      .then((loaded) => {
        if (cancelled) return;
        setWorkouts(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const createWorkout = useCallback(
    async (rawName: string) => {
      const created = await workoutService.createWorkout(programId, rawName);
      setWorkouts((current) => [...current, created]);
      return created;
    },
    [programId],
  );

  const renameWorkout = useCallback(async (id: string, rawName: string) => {
    const updated = await workoutService.renameWorkout(id, rawName);
    setWorkouts((current) => current.map((workout) => (workout.id === id ? updated : workout)));
    return updated;
  }, []);

  const deleteWorkout = useCallback(async (id: string) => {
    await workoutService.deleteWorkout(id);
    setWorkouts((current) => current.filter((workout) => workout.id !== id));
  }, []);

  const duplicateWorkout = useCallback(async (id: string) => {
    const copy = await workoutService.duplicateWorkout(id);
    setWorkouts((current) => [...current, copy]);
    return copy;
  }, []);

  const reorderWorkouts = useCallback(
    async (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= workouts.length || to >= workouts.length) return;
      const next = moveItem(workouts, from, to).map((workout, index) => ({ ...workout, sortOrder: index }));
      setWorkouts(next);
      try {
        await workoutService.reorderWorkouts(
          programId,
          next.map((workout) => workout.id),
        );
      } catch (error) {
        // Volta ao estado real do banco para nunca exibir uma ordem que não foi salva.
        try {
          setWorkouts(await workoutService.listWorkouts(programId));
        } catch {
          // Se nem a leitura funcionar, mantém a lista atual; o erro original é repassado.
        }
        throw error;
      }
    },
    [workouts, programId],
  );

  return {
    workouts,
    status,
    reload,
    refresh,
    createWorkout,
    renameWorkout,
    deleteWorkout,
    duplicateWorkout,
    reorderWorkouts,
  };
}
