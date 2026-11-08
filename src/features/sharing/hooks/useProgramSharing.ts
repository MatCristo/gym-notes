import * as Clipboard from 'expo-clipboard';
import { useCallback, useRef, useState } from 'react';
import { Share } from 'react-native';

import { SharingServiceError, sharingService } from '@/features/sharing/services/sharing.service';
import {
  SHARE_EXPORT_ERROR_MESSAGES,
  type ExportedProgram,
  type ShareExportErrorCode,
} from '@/features/sharing/types/sharing.types';

/*
 * Integração da exportação com a interface: chamada ao serviço, área de transferência
 * (expo-clipboard) e compartilhamento nativo (Share do React Native).
 * Nada aqui grava no banco: exportar, copiar, compartilhar e fechar são somente leitura.
 */

const UNEXPECTED_EXPORT_ERROR = 'Não foi possível gerar o código agora. Tente novamente.';

export type ProgramExportResult = { ok: true; exported: ExportedProgram } | { ok: false; message: string };

function isExportErrorCode(code: string): code is ShareExportErrorCode {
  return Object.prototype.hasOwnProperty.call(SHARE_EXPORT_ERROR_MESSAGES, code);
}

/** Mensagem amigável para uma falha na geração do código (sem detalhes técnicos). */
export function getExportErrorMessage(error: unknown): string {
  if (error instanceof SharingServiceError && isExportErrorCode(error.code)) {
    return SHARE_EXPORT_ERROR_MESSAGES[error.code];
  }
  return UNEXPECTED_EXPORT_ERROR;
}

/** Gera o código do planejamento. Nunca lança: devolve o resultado ou a mensagem de erro. */
export async function requestProgramExport(programId: string): Promise<ProgramExportResult> {
  try {
    return { ok: true, exported: await sharingService.exportProgram(programId) };
  } catch (error) {
    return { ok: false, message: getExportErrorMessage(error) };
  }
}

/**
 * Texto enviado pelo compartilhamento nativo: uma explicação curta + o código COMPLETO,
 * em uma linha própria (sem truncar nem alterar). Contém só o nome do planejamento e o código.
 */
export function buildShareMessage(exported: Pick<ExportedProgram, 'programName' | 'code'>): string {
  return [
    `Planejamento de treino “${exported.programName}” do Gym Notes 💪`,
    'Para importar, abra o Gym Notes, toque em “Importar” e cole este código:',
    '',
    exported.code,
  ].join('\n');
}

/** Copia exatamente o código para a área de transferência. Resolve `true` se copiou. */
export async function copyShareCode(code: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(code);
  } catch {
    return false;
  }
}

/** Abre o compartilhamento nativo do sistema. Resolve `false` se não foi possível abrir. */
export async function shareProgramCode(exported: Pick<ExportedProgram, 'programName' | 'code'>): Promise<boolean> {
  try {
    await Share.share({ message: buildShareMessage(exported) }, { dialogTitle: 'Compartilhar planejamento' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Estado da exportação na tela: gera o código (impedindo toques duplos) e expõe copiar/compartilhar.
 * A interface de compartilhamento só deve ser aberta quando `exportProgram` resolver com `ok: true`.
 */
export function useProgramSharing() {
  const [isExporting, setIsExporting] = useState(false);
  const busy = useRef(false);

  const exportProgram = useCallback(async (programId: string): Promise<ProgramExportResult | null> => {
    if (busy.current) return null;
    busy.current = true;
    setIsExporting(true);
    try {
      return await requestProgramExport(programId);
    } finally {
      busy.current = false;
      setIsExporting(false);
    }
  }, []);

  return { isExporting, exportProgram, copyCode: copyShareCode, shareCode: shareProgramCode };
}
