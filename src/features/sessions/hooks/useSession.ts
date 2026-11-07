import { useCallback, useEffect, useState } from 'react';

import { sessionService } from '@/features/sessions/services/session.service';
import type { SessionDetails, SetActuals, SetLog } from '@/features/sessions/types/session.types';

export type SessionLoadStatus = 'loading' | 'ready' | 'not-found' | 'error';

export interface UseSessionResult {
  details: SessionDetails | null;
  status: SessionLoadStatus;
  reload: () => Promise<void>;
  completeSet: (setId: string, actuals: SetActuals) => Promise<SetLog>;
  uncompleteSet: (setId: string) => Promise<SetLog>;
  saveSetActuals: (setId: string, actuals: SetActuals) => Promise<SetLog>;
  finish: () => Promise<SessionDetails>;
}

function replaceSet(details: SessionDetails | null, updated: SetLog): SessionDetails | null {
  if (!details) return details;
  return {
    ...details,
    exercises: details.exercises.map((exercise) =>
      exercise.id !== updated.sessionExerciseId
        ? exercise
        : { ...exercise, sets: exercise.sets.map((set) => (set.id === updated.id ? updated : set)) },
    ),
  };
}

/**
 * Sessão de execução sincronizada com o SQLite.
 * Cada alteração de série é gravada imediatamente; a tela só muda após a confirmação do banco.
 */
export function useSession(sessionId: string): UseSessionResult {
  const [details, setDetails] = useState<SessionDetails | null>(null);
  const [status, setStatus] = useState<SessionLoadStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      const loaded = await sessionService.getSessionDetails(sessionId);
      setDetails(loaded);
      setStatus(loaded ? 'ready' : 'not-found');
    } catch {
      setStatus('error');
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    sessionService
      .getSessionDetails(sessionId)
      .then((loaded) => {
        if (cancelled) return;
        setDetails(loaded);
        setStatus(loaded ? 'ready' : 'not-found');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const completeSet = useCallback(async (setId: string, actuals: SetActuals) => {
    const updated = await sessionService.completeSet(setId, actuals);
    setDetails((current) => replaceSet(current, updated));
    return updated;
  }, []);

  const uncompleteSet = useCallback(async (setId: string) => {
    const updated = await sessionService.uncompleteSet(setId);
    setDetails((current) => replaceSet(current, updated));
    return updated;
  }, []);

  const saveSetActuals = useCallback(async (setId: string, actuals: SetActuals) => {
    const updated = await sessionService.saveSetActuals(setId, actuals);
    setDetails((current) => replaceSet(current, updated));
    return updated;
  }, []);

  const finish = useCallback(async () => {
    const finished = await sessionService.finishSession(sessionId);
    setDetails(finished);
    return finished;
  }, [sessionId]);

  return { details, status, reload, completeSet, uncompleteSet, saveSetActuals, finish };
}
