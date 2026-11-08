import { randomUUID } from 'expo-crypto';

import { runInTransaction } from '@/database/database';
import { programRepository } from '@/features/programs/repositories/program.repository';
import {
  PROGRAM_DESCRIPTION_MAX_LENGTH,
  PROGRAM_NAME_MAX_LENGTH,
  type TrainingProgram,
} from '@/features/programs/types/program.types';
import { sessionRepository } from '@/features/sessions/repositories/session.repository';
import { workoutRepository } from '@/features/workouts/repositories/workout.repository';
import { copyWorkoutStructure } from '@/features/workouts/services/workout.service';
import { buildCopyName } from '@/utils/copy-name';

export type ProgramNameValidationError = 'empty' | 'too-long';
export type ProgramDescriptionValidationError = 'too-long';

export function normalizeProgramName(rawName: string): string {
  return rawName.trim();
}

/** Descrição opcional: espaços nas pontas são removidos e texto vazio vira `null`. */
export function normalizeProgramDescription(rawDescription: string | null | undefined): string | null {
  const description = (rawDescription ?? '').trim();
  return description.length === 0 ? null : description;
}

export function validateProgramName(rawName: string): ProgramNameValidationError | null {
  const name = normalizeProgramName(rawName);
  if (name.length === 0) return 'empty';
  if (name.length > PROGRAM_NAME_MAX_LENGTH) return 'too-long';
  return null;
}

export function validateProgramDescription(
  rawDescription: string | null | undefined,
): ProgramDescriptionValidationError | null {
  const description = normalizeProgramDescription(rawDescription);
  if (description !== null && description.length > PROGRAM_DESCRIPTION_MAX_LENGTH) return 'too-long';
  return null;
}

export type ProgramServiceErrorCode = 'invalid-name' | 'invalid-description' | 'not-found' | 'has-session-in-progress';

export class ProgramServiceError extends Error {
  constructor(
    public readonly code: ProgramServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProgramServiceError';
  }
}

export interface ProgramInput {
  name: string;
  description?: string | null;
}

function assertValidInput({ name, description }: ProgramInput): { name: string; description: string | null } {
  const nameError = validateProgramName(name);
  if (nameError !== null) {
    throw new ProgramServiceError('invalid-name', `Nome de planejamento inválido (${nameError}).`);
  }
  if (validateProgramDescription(description) !== null) {
    throw new ProgramServiceError('invalid-description', 'Descrição do planejamento inválida.');
  }
  return { name: normalizeProgramName(name), description: normalizeProgramDescription(description) };
}

async function requireProgram(id: string): Promise<TrainingProgram> {
  const program = await programRepository.findById(id);
  if (!program) throw new ProgramServiceError('not-found', 'Planejamento não encontrado.');
  return program;
}

/** Regras de negócio dos planejamentos. Toda leitura/escrita passa pelos repositories. */
export const programService = {
  listPrograms(): Promise<TrainingProgram[]> {
    return programRepository.findAll();
  },

  getProgram(id: string): Promise<TrainingProgram | null> {
    return programRepository.findById(id);
  },

  /** Cria o planejamento no fim da lista e retorna o registro como ficou salvo no banco. */
  async createProgram(rawInput: ProgramInput): Promise<TrainingProgram> {
    const { name, description } = assertValidInput(rawInput);
    const id = randomUUID();
    await programRepository.insert({ id, name, description, createdAt: new Date().toISOString() });
    const created = await programRepository.findById(id);
    if (!created) throw new Error('Planejamento criado não foi encontrado no banco.');
    return created;
  },

  /** Altera nome e descrição. Sem mudanças reais, o banco não é alterado. */
  async updateProgram(id: string, rawInput: ProgramInput): Promise<TrainingProgram> {
    const { name, description } = assertValidInput(rawInput);
    const current = await requireProgram(id);
    if (current.name === name && current.description === description) return current;

    await programRepository.update(id, { name, description, updatedAt: new Date().toISOString() });
    return requireProgram(id);
  },

  /**
   * Duplica o planejamento com todos os treinos e exercícios em UMA transação (tudo ou nada).
   * Novos UUIDs para planejamento, treinos e exercícios; mesma prescrição e mesma ordem.
   * Sessões, séries registradas, histórico, estatísticas e evolução NUNCA são copiados.
   */
  async duplicateProgram(id: string): Promise<TrainingProgram> {
    return runInTransaction(async () => {
      const original = await requireProgram(id);
      const copyId = randomUUID();
      const now = new Date().toISOString();
      await programRepository.insert({
        id: copyId,
        name: buildCopyName(original.name, PROGRAM_NAME_MAX_LENGTH),
        description: original.description,
        createdAt: now,
      });

      const workouts = await workoutRepository.findByProgramId(id);
      for (const workout of workouts) {
        await copyWorkoutStructure(workout, {
          programId: copyId,
          name: workout.name,
          createdAt: now,
          sortOrder: workout.sortOrder,
        });
      }

      const copy = await programRepository.findById(copyId);
      if (!copy) throw new Error('Cópia do planejamento não foi encontrada no banco.');
      return copy;
    });
  },

  /**
   * Exclui o planejamento e seus treinos (com os exercícios planejados) em uma transação.
   * Bloqueia com `has-session-in-progress` se algum treino dele tiver sessão em andamento.
   * Sessões concluídas, séries e histórico são preservados (FKs com ON DELETE SET NULL).
   * Excluir um planejamento que já não existe não é tratado como erro.
   */
  async deleteProgram(id: string): Promise<void> {
    await runInTransaction(async () => {
      // Dentro da mesma fila de transações de `startSession`: não há corrida entre a checagem e a exclusão.
      if ((await sessionRepository.countInProgressByProgramId(id)) > 0) {
        throw new ProgramServiceError(
          'has-session-in-progress',
          'Há um treino em andamento neste planejamento. Finalize-o antes de excluir.',
        );
      }
      await workoutRepository.deleteByProgramId(id);
      await programRepository.delete(id);
    });
  },
};
