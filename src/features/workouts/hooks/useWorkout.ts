import { useCallback, useEffect, useState } from 'react';

import { workoutService } from '@/features/workouts/services/workout.service';
import type { Workout } from '@/features/workouts/types/workout.types';

export type WorkoutStatus = 'loading' | 'ready' | 'not-found' | 'error';

export interface UseWorkoutResult {
  workout: Workout | null;
  status: WorkoutStatus;
  reload: () => Promise<void>;
}

/** Carrega um único treino do SQLite (ex.: tela de detalhes). */
export function useWorkout(id: string): UseWorkoutResult {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [status, setStatus] = useState<WorkoutStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      const loaded = await workoutService.getWorkout(id);
      setWorkout(loaded);
      setStatus(loaded ? 'ready' : 'not-found');
    } catch {
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    workoutService
      .getWorkout(id)
      .then((loaded) => {
        if (cancelled) return;
        setWorkout(loaded);
        setStatus(loaded ? 'ready' : 'not-found');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { workout, status, reload };
}
