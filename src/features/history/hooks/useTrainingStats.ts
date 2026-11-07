import { useCallback, useState } from 'react';

import { historyService } from '@/features/history/services/history.service';
import type { ExerciseHistoryEntry, TrainingStats } from '@/features/history/types/history.types';

export type StatsStatus = 'loading' | 'ready' | 'error';

/** Estatísticas gerais + exercícios já executados. A tela chama `load` ao ganhar foco. */
export function useTrainingStats() {
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [exercises, setExercises] = useState<ExerciseHistoryEntry[]>([]);
  const [status, setStatus] = useState<StatsStatus>('loading');

  const load = useCallback(async () => {
    try {
      const [loadedStats, loadedExercises] = await Promise.all([
        historyService.getTrainingStats(Date.now()),
        historyService.listPerformedExercises(),
      ]);
      setStats(loadedStats);
      setExercises(loadedExercises);
      setStatus('ready');
    } catch {
      setStatus((current) => (current === 'ready' ? current : 'error'));
    }
  }, []);

  const retry = useCallback(async () => {
    setStatus('loading');
    await load();
  }, [load]);

  return { stats, exercises, status, load, retry };
}
