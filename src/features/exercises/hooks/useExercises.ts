import { useCallback, useEffect, useState } from 'react';

import { exerciseService } from '@/features/exercises/services/exercise.service';
import type { Exercise, ExerciseInput } from '@/features/exercises/types/exercise.types';
import { moveItem } from '@/utils/move-item';

export type ExercisesStatus = 'loading' | 'ready' | 'error';

export interface UseExercisesResult {
  exercises: Exercise[];
  status: ExercisesStatus;
  reload: () => Promise<void>;
  /** Resolve com o exercício salvo. Rejeita em caso de dados inválidos ou falha no banco. */
  createExercise: (input: ExerciseInput) => Promise<Exercise>;
  updateExercise: (id: string, input: ExerciseInput) => Promise<Exercise>;
  /** Rejeita se o banco falhar (a lista não é alterada nesse caso). */
  deleteExercise: (id: string) => Promise<void>;
  /** Duplica logo abaixo do original. Resolve com a cópia; a lista é relida do banco (nova ordem). */
  duplicateExercise: (id: string) => Promise<Exercise>;
  /**
   * Move o exercício de `from` para `to`. A lista muda na hora (otimista) e a ordem é
   * gravada no SQLite; se a gravação falhar, a lista é recarregada do banco e o erro é repassado.
   */
  reorderExercises: (from: number, to: number) => Promise<void>;
}

/**
 * Exercícios planejados de um treino, sincronizados com o SQLite.
 * A lista só muda depois que o banco confirma a operação.
 */
export function useExercises(workoutId: string): UseExercisesResult {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [status, setStatus] = useState<ExercisesStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setExercises(await exerciseService.listByWorkout(workoutId));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [workoutId]);

  useEffect(() => {
    let cancelled = false;
    exerciseService
      .listByWorkout(workoutId)
      .then((loaded) => {
        if (cancelled) return;
        setExercises(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  const createExercise = useCallback(
    async (input: ExerciseInput) => {
      const created = await exerciseService.createExercise(workoutId, input);
      setExercises((current) => [...current, created]);
      return created;
    },
    [workoutId],
  );

  const updateExercise = useCallback(async (id: string, input: ExerciseInput) => {
    const updated = await exerciseService.updateExercise(id, input);
    setExercises((current) => current.map((exercise) => (exercise.id === id ? updated : exercise)));
    return updated;
  }, []);

  const deleteExercise = useCallback(async (id: string) => {
    await exerciseService.deleteExercise(id);
    setExercises((current) => current.filter((exercise) => exercise.id !== id));
  }, []);

  const duplicateExercise = useCallback(
    async (id: string) => {
      const copy = await exerciseService.duplicateExercise(id);
      try {
        setExercises(await exerciseService.listByWorkout(workoutId));
      } catch {
        // A cópia já foi salva; se a releitura falhar, insere localmente logo após o original.
        setExercises((current) => {
          const index = current.findIndex((exercise) => exercise.id === id);
          const next = [...current];
          next.splice(index + 1, 0, copy);
          return next;
        });
      }
      return copy;
    },
    [workoutId],
  );

  const reorderExercises = useCallback(
    async (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= exercises.length || to >= exercises.length) return;
      const next = moveItem(exercises, from, to).map((exercise, index) => ({ ...exercise, sortOrder: index }));
      setExercises(next);
      try {
        await exerciseService.reorderExercises(
          workoutId,
          next.map((exercise) => exercise.id),
        );
      } catch (error) {
        // Volta ao estado real do banco para nunca exibir uma ordem que não foi salva.
        try {
          setExercises(await exerciseService.listByWorkout(workoutId));
        } catch {
          // Se nem a leitura funcionar, mantém a lista atual; o erro original é repassado.
        }
        throw error;
      }
    },
    [exercises, workoutId],
  );

  return {
    exercises,
    status,
    reload,
    createExercise,
    updateExercise,
    deleteExercise,
    duplicateExercise,
    reorderExercises,
  };
}
