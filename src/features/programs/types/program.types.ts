import type { ExerciseInput } from '@/features/exercises/types/exercise.types';

/**
 * Planejamento de treinos (ex.: "Hipertrofia", "Treino em casa").
 * Agrupa treinos (A, B, C...) — é apenas ESTRUTURA/PRESCRIÇÃO, nunca dados de execução.
 */
export interface TrainingProgram {
  id: string;
  name: string;
  /** Descrição opcional (null quando não informada). */
  description: string | null;
  workoutCount: number;
  /** Posição de exibição na lista (crescente). */
  sortOrder: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

export const PROGRAM_NAME_MAX_LENGTH = 40;
export const PROGRAM_DESCRIPTION_MAX_LENGTH = 200;

export type ProgramFormMode = 'create' | 'edit';

/**
 * ESTRUTURA de um planejamento (somente prescrição, sem IDs, datas ou dados de execução),
 * já validada e normalizada. Usada para criar planejamentos a partir de um código compartilhado
 * (e, futuramente, pela duplicação). A ordem dos arrays é a ordem dos itens.
 */
export interface ProgramStructure {
  name: string;
  description: string | null;
  workouts: WorkoutStructure[];
}

export interface WorkoutStructure {
  name: string;
  exercises: ExerciseInput[];
}
