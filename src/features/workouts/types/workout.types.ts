export interface Workout {
  id: string;
  /** Planejamento ao qual o treino pertence. */
  programId: string;
  name: string;
  exerciseCount: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  /** Posição de exibição na lista (crescente). */
  sortOrder: number;
}

export const WORKOUT_NAME_MAX_LENGTH = 40;

export type WorkoutFormMode = 'create' | 'edit';
