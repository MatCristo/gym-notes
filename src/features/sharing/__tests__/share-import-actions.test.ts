/* eslint-disable @typescript-eslint/no-require-imports -- os módulos são recarregados junto com o app de teste */
import type { ProgramStructure } from '@/features/programs/types/program.types';
import { SHARE_ERROR_MESSAGES } from '@/features/sharing/types/sharing.types';
import { encodeShareCode } from '@/features/sharing/utils/share-codec';

import { cleanupDatabases, closeApp, startApp, type TestApp } from '../../../../test/helpers/app';

jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => '') }));

type ActionsModule = typeof import('@/features/sharing/hooks/useProgramImport');

const structure: ProgramStructure = {
  name: 'Força',
  description: null,
  workouts: [{ name: 'Treino A', exercises: [{ name: 'Supino', sets: 3, reps: 10, weightKg: 20, restSeconds: 60 }] }],
};
const encoded = encodeShareCode(structure);
if (!encoded.ok) throw new Error(encoded.error);
const CODE = encoded.value;

describe('importação: integração com a interface (área de transferência, prévia e confirmação)', () => {
  let app: TestApp;
  let actions: ActionsModule;
  let clipboard: { getStringAsync: jest.Mock<Promise<string>, []> };

  beforeEach(() => {
    app = startApp();
    actions = require('@/features/sharing/hooks/useProgramImport');
    clipboard = require('expo-clipboard');
    clipboard.getStringAsync.mockReset();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  const count = async () => (await app.programs.programService.listPrograms()).length;

  it('colar lê o texto completo da área de transferência', async () => {
    const message = `Importe:\n${CODE}\nAbraço`;
    clipboard.getStringAsync.mockResolvedValue(message);
    expect(await actions.pasteShareCodeFromClipboard()).toEqual({ ok: true, text: message });
    expect(clipboard.getStringAsync).toHaveBeenCalledTimes(1);
  });

  it('área de transferência vazia ou inacessível → mensagens amigáveis', async () => {
    clipboard.getStringAsync.mockResolvedValue('  ');
    expect(await actions.pasteShareCodeFromClipboard()).toEqual({ ok: false, message: actions.IMPORT_MESSAGES.clipboardEmpty });
    clipboard.getStringAsync.mockRejectedValue(new Error('SecurityException: not allowed'));
    const failed = await actions.pasteShareCodeFromClipboard();
    expect(failed).toEqual({ ok: false, message: actions.IMPORT_MESSAGES.clipboardFailed });
    expect(JSON.stringify(failed)).not.toMatch(/Security|allowed/);
  });

  it.each([
    ['empty', ''],
    ['not-found', 'bom dia'],
    ['unsupported-version', CODE.replace('GN1:', 'GN2:')],
    ['corrupted', CODE.slice(0, -5)],
    ['too-large', `GN1:${'A'.repeat(200 * 1024)}`],
  ] as const)('prévia e importação de código "%s" → mensagem do serviço, sem gravar nada', async (errorCode, raw) => {
    const before = await count();
    expect(await actions.requestImportPreview(raw)).toEqual({ ok: false, message: SHARE_ERROR_MESSAGES[errorCode] });
    expect(await actions.requestProgramImport(raw)).toEqual({ ok: false, message: SHARE_ERROR_MESSAGES[errorCode] });
    expect(await count()).toBe(before);
  });

  it('malformado e conteúdo inválido também usam as mensagens do serviço', () => {
    const { SharingServiceError } = app.sharing;
    for (const code of ['malformed', 'invalid-content'] as const) {
      expect(actions.getImportErrorMessage(new SharingServiceError(code, 'interno'), 'x')).toBe(SHARE_ERROR_MESSAGES[code]);
    }
  });

  it('prévia e importação com código válido (serviço real)', async () => {
    const preview = await actions.requestImportPreview(CODE);
    expect(preview).toMatchObject({ ok: true, preview: { name: 'Força', finalName: 'Força', workoutCount: 1 } });
    const imported = await actions.requestProgramImport(CODE);
    expect(imported).toMatchObject({ ok: true, program: { name: 'Força', workoutCount: 1 } });
    expect(await count()).toBe(2);
  });

  it('falhas inesperadas → mensagens genéricas, sem detalhes técnicos', async () => {
    jest.spyOn(app.sharing.sharingService, 'previewImport').mockRejectedValue(new Error('SQLITE_IOERR at /data'));
    jest.spyOn(app.sharing.sharingService, 'importProgram').mockRejectedValue(new Error('SQLITE_FULL disk'));
    expect(await actions.requestImportPreview(CODE)).toEqual({ ok: false, message: actions.IMPORT_MESSAGES.previewFailed });
    expect(await actions.requestProgramImport(CODE)).toEqual({ ok: false, message: actions.IMPORT_MESSAGES.importFailed });
  });
});
