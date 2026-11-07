import { useCallback, useEffect, useState } from 'react';

import { historyService } from '@/features/history/services/history.service';
import type { ExerciseProgress } from '@/features/history/types/history.types';

export type ProgressStatus = 'loading' | 'ready' | 'error';

/** Evolução de carga de um exercício, a partir de séries concluídas com carga real. */
export function useExerciseProgress(name: string) {
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [status, setStatus] = useState<ProgressStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setProgress(await historyService.getExerciseProgress(name));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [name]);

  useEffect(() => {
    let cancelled = false;
    historyService
      .getExerciseProgress(name)
      .then((loaded) => {
        if (cancelled) return;
        setProgress(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return { progress, status, reload };
}
