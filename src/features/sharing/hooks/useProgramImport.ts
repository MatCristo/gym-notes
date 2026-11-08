import * as Clipboard from 'expo-clipboard';

import type { TrainingProgram } from '@/features/programs/types/program.types';
import { SharingServiceError, sharingService } from '@/features/sharing/services/sharing.service';
import {
  SHARE_ERROR_MESSAGES,
  type ImportPreview,
  type ShareCodeErrorCode,
} from '@/features/sharing/types/sharing.types';

/*
 * Integração da importação com a interface: área de transferência (expo-clipboard), prévia e
 * confirmação. Toda a decodificação/validação/gravação é do sharingService (Etapas 1–3).
 * O código colado só existe em memória enquanto a interface está aberta: nunca é persistido.
 */

export const IMPORT_MESSAGES = {
  clipboardEmpty: 'A área de transferência está vazia. Copie o código recebido e tente de novo.',
  clipboardFailed: 'Não foi possível acessar a área de transferência. Cole o código manualmente no campo.',
  previewFailed: 'Não foi possível ler o código agora. Tente novamente.',
  importFailed: 'Não foi possível importar o planejamento. Nada foi alterado. Tente novamente.',
} as const;

export type PasteResult = { ok: true; text: string } | { ok: false; message: string };
export type ImportPreviewResult = { ok: true; preview: ImportPreview } | { ok: false; message: string };
export type ProgramImportResult = { ok: true; program: TrainingProgram } | { ok: false; message: string };

function isCodeErrorCode(code: string): code is ShareCodeErrorCode {
  return Object.prototype.hasOwnProperty.call(SHARE_ERROR_MESSAGES, code);
}

/** Mensagem amigável (sem detalhes técnicos) para uma falha de prévia ou importação. */
export function getImportErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof SharingServiceError && isCodeErrorCode(error.code)) return SHARE_ERROR_MESSAGES[error.code];
  return fallback;
}

/** Lê o texto da área de transferência. Nunca lança. */
export async function pasteShareCodeFromClipboard(): Promise<PasteResult> {
  try {
    const text = await Clipboard.getStringAsync();
    if (text.trim().length === 0) return { ok: false, message: IMPORT_MESSAGES.clipboardEmpty };
    return { ok: true, text };
  } catch {
    return { ok: false, message: IMPORT_MESSAGES.clipboardFailed };
  }
}

/** Prévia do código (somente leitura: não grava nada). Nunca lança. */
export async function requestImportPreview(code: string): Promise<ImportPreviewResult> {
  try {
    return { ok: true, preview: await sharingService.previewImport(code) };
  } catch (error) {
    return { ok: false, message: getImportErrorMessage(error, IMPORT_MESSAGES.previewFailed) };
  }
}

/** Importa o código (o serviço valida tudo de novo e grava em uma transação). Nunca lança. */
export async function requestProgramImport(code: string): Promise<ProgramImportResult> {
  try {
    return { ok: true, program: await sharingService.importProgram(code) };
  } catch (error) {
    return { ok: false, message: getImportErrorMessage(error, IMPORT_MESSAGES.importFailed) };
  }
}

/** Ações de importação para a tela (sem estado próprio: o estado do fluxo fica na interface). */
export function useProgramImport() {
  return {
    paste: pasteShareCodeFromClipboard,
    preview: requestImportPreview,
    importCode: requestProgramImport,
  };
}
