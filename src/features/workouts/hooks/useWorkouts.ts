import { useCallback, useEffect, useState } from 'react';

import { workoutService } from '@/features/workouts/services/workout.service';
import type { Workout } from '@/features/workouts/types/workout.types';

export type WorkoutsStatus = 'loading' | 'ready' | 'error';

export interface UseWorkoutsResult {
  workouts: Workout[];
  status: WorkoutsStatus;
  reload: () => Promise<void>;
  /**
   * Recarrega em segundo plano, sem exibir loading (ex.: ao voltar para a Home,
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
}

/**
 * Estado dos treinos sincronizado com o SQLite.
 * A lista só é alterada depois que o banco confirma a operação,
 * evitando divergência entre interface e dados persistidos.
 */
export function useWorkouts(): UseWorkoutsResult {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [status, setStatus] = useState<WorkoutsStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setWorkouts(await workoutService.listWorkouts());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const loaded = await workoutService.listWorkouts();
      setWorkouts(loaded);
      setStatus('ready');
    } catch {
      // Mantém os dados já exibidos; o carregamento inicial é quem exibe o estado de erro.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    workoutService
      .listWorkouts()
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
  }, []);

  const createWorkout = useCallback(async (rawName: string) => {
    const created = await workoutService.createWorkout(rawName);
    setWorkouts((current) => [...current, created]);
    return created;
  }, []);

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

  return {
    workouts,
    status,
    reload,
    refresh,
    createWorkout,
    renameWorkout,
    deleteWorkout,
    duplicateWorkout,
  };
}
