import { runInTransaction } from '@/database/database';
import { exerciseRepository } from '@/features/exercises/repositories/exercise.repository';
import type { Exercise, ExerciseInput } from '@/features/exercises/types/exercise.types';
import { programRepository } from '@/features/programs/repositories/program.repository';
import { createProgramFromStructure, normalizeProgramName } from '@/features/programs/services/program.service';
import {
  PROGRAM_NAME_MAX_LENGTH,
  type ProgramStructure,
  type TrainingProgram,
  type WorkoutStructure,
} from '@/features/programs/types/program.types';
import {
  IMPORTED_NAME_SUFFIX,
  SHARE_ERROR_MESSAGES,
  SHARE_LIMITS,
  type ExportedProgram,
  type ImportPreview,
  type ShareCodeErrorCode,
  type ShareExportErrorCode,
} from '@/features/sharing/types/sharing.types';
import { decodeShareCode, encodeShareCode } from '@/features/sharing/utils/share-codec';
import { workoutRepository } from '@/features/workouts/repositories/workout.repository';
import type { Workout } from '@/features/workouts/types/workout.types';
import { withNameSuffix } from '@/utils/copy-name';

export type SharingServiceErrorCode = ShareExportErrorCode | ShareCodeErrorCode;

export class SharingServiceError extends Error {
  constructor(
    public readonly code: SharingServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SharingServiceError';
  }
}

/*
 * Mapeamento EXPLÍCITO dos registros do banco para a estrutura compartilhável.
 * Copia campo a campo SOMENTE o que pode ser compartilhado; nunca usa spread de registros.
 * IDs, timestamps, sort_order, contagens e qualquer dado de execução ficam de fora por construção.
 */

function toExerciseStructure(exercise: Exercise): ExerciseInput {
  const structure: ExerciseInput = {
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weightKg: exercise.weightKg,
    restSeconds: exercise.restSeconds,
  };
  // A observação é a única informação textual extra permitida; só entra quando existe.
  if (exercise.observation !== null) structure.observation = exercise.observation;
  return structure;
}

function toWorkoutStructure(workout: Workout, exercises: readonly Exercise[]): WorkoutStructure {
  return { name: workout.name, exercises: exercises.map(toExerciseStructure) };
}

function toProgramStructure(program: TrainingProgram, workouts: WorkoutStructure[]): ProgramStructure {
  return { name: program.name, description: program.description, workouts };
}

/**
 * Lê a estrutura do planejamento: planejamento → treinos (na ordem do usuário) → exercícios (na ordem).
 * Lê apenas as tabelas de PLANEJAMENTO (training_programs, workouts, exercises): as tabelas de
 * execução (sessões, séries, histórico) nunca são consultadas.
 * Roda dentro da fila de transações para obter uma leitura consistente (sem ver uma duplicação,
 * reordenação ou exclusão pela metade).
 */
async function readProgramStructure(programId: string): Promise<ProgramStructure> {
  return runInTransaction(async () => {
    const program = await programRepository.findById(programId);
    if (!program) {
      throw new SharingServiceError('program-not-found', 'Planejamento não encontrado.');
    }
    const workouts = await workoutRepository.findByProgramId(programId);
    const structures: WorkoutStructure[] = [];
    for (const workout of workouts) {
      structures.push(toWorkoutStructure(workout, await exerciseRepository.findByWorkoutId(workout.id)));
    }
    return toProgramStructure(program, structures);
  });
}

/** Decodifica e valida o código colado (Etapa 1). Não acessa o banco. */
function decodeOrThrow(code: string): ProgramStructure {
  const decoded = decodeShareCode(code);
  if (!decoded.ok) throw new SharingServiceError(decoded.error, SHARE_ERROR_MESSAGES[decoded.error]);
  return decoded.value;
}

/**
 * Nome único para o planejamento importado, comparando com a normalização do projeto (trim):
 * "Hipertrofia" → "Hipertrofia (Importado)" → "Hipertrofia (Importado 2)" → ...
 * O original é cortado quando necessário para respeitar o limite de 40 caracteres.
 */
export function resolveImportedProgramName(name: string, existingNames: Iterable<string>): string {
  const taken = new Set([...existingNames].map(normalizeProgramName));
  const base = normalizeProgramName(name);
  if (!taken.has(base)) return base;
  for (let attempt = 1; ; attempt += 1) {
    const suffix = attempt === 1 ? IMPORTED_NAME_SUFFIX : ` (Importado ${attempt})`;
    const candidate = withNameSuffix(base, suffix, PROGRAM_NAME_MAX_LENGTH);
    if (!taken.has(candidate)) return candidate;
  }
}

async function existingProgramNames(): Promise<string[]> {
  return (await programRepository.findAll()).map((program) => program.name);
}

function countExercises(structure: ProgramStructure): number {
  return structure.workouts.reduce((total, workout) => total + workout.exercises.length, 0);
}

/** Compartilhamento de planejamentos por código (sem servidor). */
export const sharingService = {
  /**
   * Gera o código GN1 de um planejamento, com somente estrutura e prescrição.
   * Não grava nada no banco. Erros: `program-not-found`, `no-workouts`, `exceeds-limits`, `too-large`.
   */
  async exportProgram(programId: string): Promise<ExportedProgram> {
    const structure = await readProgramStructure(programId);

    if (structure.workouts.length === 0) {
      throw new SharingServiceError('no-workouts', 'O planejamento não tem treinos para compartilhar.');
    }
    if (
      structure.workouts.length > SHARE_LIMITS.maxWorkouts ||
      structure.workouts.some((workout) => workout.exercises.length > SHARE_LIMITS.maxExercisesPerWorkout)
    ) {
      throw new SharingServiceError('exceeds-limits', 'O planejamento passa do limite para compartilhamento.');
    }

    // O codec revalida com as MESMAS regras da importação: todo código gerado pode ser importado.
    const encoded = encodeShareCode(structure);
    if (!encoded.ok) {
      if (encoded.error === 'too-large') {
        throw new SharingServiceError('too-large', 'O planejamento é grande demais para ser compartilhado.');
      }
      throw new SharingServiceError('exceeds-limits', 'O planejamento contém dados fora dos limites.');
    }

    return {
      code: encoded.value,
      programName: structure.name,
      workoutCount: structure.workouts.length,
      exerciseCount: countExercises(structure),
    };
  },

  /**
   * Decodifica e valida o código e devolve um resumo para a prévia. NÃO grava nada no banco
   * (apenas lê os nomes existentes para mostrar com que nome o planejamento será criado).
   * Erros: os códigos de `ShareCodeErrorCode` (ex.: `corrupted`, `unsupported-version`).
   */
  async previewImport(code: string): Promise<ImportPreview> {
    const structure = decodeOrThrow(code);
    return {
      name: structure.name,
      finalName: resolveImportedProgramName(structure.name, await existingProgramNames()),
      description: structure.description,
      workoutCount: structure.workouts.length,
      exerciseCount: countExercises(structure),
      workouts: structure.workouts.map((workout) => ({ name: workout.name, exerciseCount: workout.exercises.length })),
    };
  },

  /**
   * Importa o código como um planejamento NOVO e independente (nunca substitui nem mescla).
   * O código é decodificado e validado de novo aqui (não confia em uma prévia anterior).
   * Nome único, planejamento, treinos e exercícios são resolvidos e gravados em UMA transação:
   * qualquer falha desfaz tudo. Resolve com o planejamento criado (no fim da lista).
   */
  async importProgram(code: string): Promise<TrainingProgram> {
    const structure = decodeOrThrow(code);
    return runInTransaction(async () => {
      // Dentro da transação: duas importações simultâneas nunca recebem o mesmo nome.
      const name = resolveImportedProgramName(structure.name, await existingProgramNames());
      const programId = await createProgramFromStructure(structure, { name, createdAt: new Date().toISOString() });
      const created = await programRepository.findById(programId);
      if (!created) throw new Error('Planejamento importado não foi encontrado no banco.');
      return created;
    });
  },
};
