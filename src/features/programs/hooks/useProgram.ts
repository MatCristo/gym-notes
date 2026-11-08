import { useCallback, useEffect, useState } from 'react';

import { programService } from '@/features/programs/services/program.service';
import type { TrainingProgram } from '@/features/programs/types/program.types';

export type ProgramStatus = 'loading' | 'ready' | 'not-found' | 'error';

export interface UseProgramResult {
  program: TrainingProgram | null;
  status: ProgramStatus;
  reload: () => Promise<void>;
}

/** Carrega um único planejamento do SQLite (tela de detalhes). */
export function useProgram(id: string): UseProgramResult {
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [status, setStatus] = useState<ProgramStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      const loaded = await programService.getProgram(id);
      setProgram(loaded);
      setStatus(loaded ? 'ready' : 'not-found');
    } catch {
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    programService
      .getProgram(id)
      .then((loaded) => {
        if (cancelled) return;
        setProgram(loaded);
        setStatus(loaded ? 'ready' : 'not-found');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { program, status, reload };
}
