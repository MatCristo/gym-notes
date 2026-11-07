import { useCallback, useState } from 'react';

import { sessionService, type StartSessionResult } from '@/features/sessions/services/session.service';
import type { WorkoutSession } from '@/features/sessions/types/session.types';

/**
 * Sessões em andamento (para retomar após fechar o app).
 * Não carrega sozinho: a tela chama `refresh` ao ganhar foco, para refletir o estado atual do banco.
 */
export function useInProgressSessions() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  const refresh = useCallback(async () => {
    try {
      setSessions(await sessionService.listInProgressSessions());
    } catch {
      // Falha ao listar não deve quebrar a Home; mantém o último estado conhecido.
    }
  }, []);

  /** Inicia (ou retoma, se já houver) a sessão do treino e atualiza a lista. */
  const start = useCallback(
    async (workoutId: string): Promise<StartSessionResult> => {
      const result = await sessionService.startSession(workoutId);
      await refresh();
      return result;
    },
    [refresh],
  );

  return { sessions, refresh, start };
}
