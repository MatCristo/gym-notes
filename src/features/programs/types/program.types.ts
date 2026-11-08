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
