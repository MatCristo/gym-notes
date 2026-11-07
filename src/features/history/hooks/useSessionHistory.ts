import { useCallback, useState } from 'react';

import { historyService } from '@/features/history/services/history.service';
import type { SessionHistoryItem } from '@/features/history/types/history.types';

export type HistoryStatus = 'loading' | 'ready' | 'error';

/**
 * Sessões concluídas (somente leitura). Não carrega sozinho: a tela chama `load`
 * ao ganhar foco, para refletir treinos recém-finalizados sem piscar a lista.
 */
export function useSessionHistory() {
  const [items, setItems] = useState<SessionHistoryItem[]>([]);
  const [status, setStatus] = useState<HistoryStatus>('loading');

  /** Carrega mantendo os dados atuais na tela (sem loading após o primeiro carregamento). */
  const load = useCallback(async () => {
    try {
      setItems(await historyService.listCompletedSessions());
      setStatus('ready');
    } catch {
      setStatus((current) => (current === 'ready' ? current : 'error'));
    }
  }, []);

  const retry = useCallback(async () => {
    setStatus('loading');
    await load();
  }, [load]);

  return { items, status, load, retry };
}
