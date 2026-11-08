import { useCallback, useEffect, useState } from 'react';

import { programService, type ProgramInput } from '@/features/programs/services/program.service';
import type { TrainingProgram } from '@/features/programs/types/program.types';

export type ProgramsStatus = 'loading' | 'ready' | 'error';

export interface UseProgramsResult {
  programs: TrainingProgram[];
  status: ProgramsStatus;
  reload: () => Promise<void>;
  /** Recarrega em segundo plano, sem exibir loading (ex.: ao voltar para a Home). Falhas mantêm a lista. */
  refresh: () => Promise<void>;
  /** Resolve com o planejamento salvo. Rejeita se os dados forem inválidos ou o banco falhar. */
  createProgram: (input: ProgramInput) => Promise<TrainingProgram>;
  updateProgram: (id: string, input: ProgramInput) => Promise<TrainingProgram>;
  /** Rejeita com `has-session-in-progress` se houver treino em andamento (a lista não muda). */
  deleteProgram: (id: string) => Promise<void>;
  /** Duplica planejamento + treinos + exercícios (transacional). Resolve com a cópia. */
  duplicateProgram: (id: string) => Promise<TrainingProgram>;
}

/**
 * Planejamentos sincronizados com o SQLite.
 * A lista só é alterada depois que o banco confirma a operação.
 */
export function usePrograms(): UseProgramsResult {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [status, setStatus] = useState<ProgramsStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setPrograms(await programService.listPrograms());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setPrograms(await programService.listPrograms());
      setStatus('ready');
    } catch {
      // Mantém os dados já exibidos; o carregamento inicial é quem exibe o estado de erro.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    programService
      .listPrograms()
      .then((loaded) => {
        if (cancelled) return;
        setPrograms(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createProgram = useCallback(async (input: ProgramInput) => {
    const created = await programService.createProgram(input);
    setPrograms((current) => [...current, created]);
    return created;
  }, []);

  const updateProgram = useCallback(async (id: string, input: ProgramInput) => {
    const updated = await programService.updateProgram(id, input);
    setPrograms((current) => current.map((program) => (program.id === id ? updated : program)));
    return updated;
  }, []);

  const deleteProgram = useCallback(async (id: string) => {
    await programService.deleteProgram(id);
    setPrograms((current) => current.filter((program) => program.id !== id));
  }, []);

  const duplicateProgram = useCallback(async (id: string) => {
    const copy = await programService.duplicateProgram(id);
    setPrograms((current) => [...current, copy]);
    return copy;
  }, []);

  return { programs, status, reload, refresh, createProgram, updateProgram, deleteProgram, duplicateProgram };
}
