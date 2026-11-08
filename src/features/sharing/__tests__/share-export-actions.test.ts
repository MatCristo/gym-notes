/// <reference types="node" />
/* eslint-disable @typescript-eslint/no-require-imports -- os módulos são recarregados junto com o app de teste */
import { Buffer } from 'node:buffer';

import { cleanupDatabases, closeApp, startApp, type TestApp } from '../../../../test/helpers/app';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

type ActionsModule = typeof import('@/features/sharing/hooks/useProgramSharing');
type ClipboardMock = { setStringAsync: jest.Mock<Promise<boolean>, [string]> };
type ShareApi = typeof import('react-native').Share;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const plan = (name: string, sets: number, reps: number, weightKg: number, restSeconds: number) => ({
  name,
  sets,
  reps,
  weightKg,
  restSeconds,
});

describe('exportação: integração com a interface (serviço, área de transferência e Share)', () => {
  let app: TestApp;
  let actions: ActionsModule;
  let clipboard: ClipboardMock;
  let share: ShareApi;

  beforeEach(() => {
    app = startApp();
    // Carregados depois do startApp: mesmo registro de módulos (e mesmo banco) do app de teste.
    actions = require('@/features/sharing/hooks/useProgramSharing');
    clipboard = require('expo-clipboard');
    share = require('react-native').Share;
    clipboard.setStringAsync.mockClear();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await closeApp(app);
  });
  afterAll(cleanupDatabases);

  async function createProgram() {
    const program = await app.programs.programService.createProgram({ name: 'Hipertrofia', description: '4x' });
    const a = await app.workouts.workoutService.createWorkout(program.id, 'Treino A');
    await app.exercises.exerciseService.createExercise(a.id, plan('Supino reto', 4, 12, 40, 90));
    return { program, a };
  }

  async function dumpAll() {
    const db = await app.database.getDatabase();
    const all = (table: string) => db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
    return Promise.all(
      ['training_programs', 'workouts', 'exercises', 'workout_sessions', 'session_exercises', 'set_logs'].map(all),
    );
  }

  it('chama o serviço com o ID do planejamento e devolve o código gerado', async () => {
    const { program } = await createProgram();
    const spy = jest.spyOn(app.sharing.sharingService, 'exportProgram');

    const result = await actions.requestProgramExport(program.id);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(program.id);
    expect(result).toEqual({ ok: true, exported: await spy.mock.results[0]!.value });
    expect(result.ok && result.exported.code).toMatch(/^GN1:[A-Za-z0-9+/]+\.[0-9a-f]{8}$/);
  });

  describe('erros do serviço viram mensagens claras (e o painel não é aberto)', () => {
    it('planejamento inexistente e sem treinos (serviço real)', async () => {
      expect(await actions.requestProgramExport('nao-existe')).toEqual({
        ok: false,
        message: 'Este planejamento não foi encontrado. Ele pode ter sido excluído.',
      });
      const empty = await app.programs.programService.createProgram({ name: 'Vazio' });
      expect(await actions.requestProgramExport(empty.id)).toEqual({
        ok: false,
        message: 'Adicione ao menos um treino ao planejamento para poder compartilhá-lo.',
      });
    });

    it.each([
      ['exceeds-limits', /limite para compartilhamento \(até 50 treinos e 100 exercícios por treino\)/],
      ['too-large', /grande demais para ser compartilhado/],
    ] as const)('%s', async (code, message) => {
      const { SharingServiceError } = app.sharing;
      jest.spyOn(app.sharing.sharingService, 'exportProgram').mockRejectedValue(new SharingServiceError(code, 'interno'));
      const result = await actions.requestProgramExport('x');
      expect(result.ok).toBe(false);
      expect(!result.ok && result.message).toMatch(message);
    });

    it('erro inesperado → mensagem genérica, sem detalhes técnicos', async () => {
      jest
        .spyOn(app.sharing.sharingService, 'exportProgram')
        .mockRejectedValue(new Error('SQLITE_BUSY: database is locked at /data/gym-notes.db'));
      const result = await actions.requestProgramExport('x');
      expect(result).toEqual({ ok: false, message: 'Não foi possível gerar o código agora. Tente novamente.' });
      expect(JSON.stringify(result)).not.toMatch(/SQLITE|locked|\.db/);
    });
  });

  it('copiar envia exatamente o código retornado pelo serviço', async () => {
    const { program } = await createProgram();
    const result = await actions.requestProgramExport(program.id);
    if (!result.ok) throw new Error(result.message);

    expect(await actions.copyShareCode(result.exported.code)).toBe(true);
    expect(clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(result.exported.code);
  });

  it('falha ao copiar resolve false (sem lançar)', async () => {
    clipboard.setStringAsync.mockRejectedValueOnce(new Error('indisponível'));
    expect(await actions.copyShareCode('GN1:abc.00000000')).toBe(false);
  });

  it('o compartilhamento nativo recebe a mensagem explicativa e o código completo, sem alteração', async () => {
    const { program } = await createProgram();
    const result = await actions.requestProgramExport(program.id);
    if (!result.ok) throw new Error(result.message);
    const spy = jest.spyOn(share, 'share').mockResolvedValue({ action: 'sharedAction' });

    expect(await actions.shareProgramCode(result.exported)).toBe(true);

    expect(spy).toHaveBeenCalledTimes(1);
    const [content, options] = spy.mock.calls[0]!;
    const message = (content as { message: string }).message;
    expect(message).toBe(actions.buildShareMessage(result.exported));
    expect(message).toContain('Gym Notes');
    expect(message).toContain('“Hipertrofia”');
    const lines = message.split('\n');
    expect(lines[lines.length - 1]).toBe(result.exported.code);
    expect(message.split(result.exported.code)).toHaveLength(2); // aparece uma única vez, inteiro
    expect(options).toEqual({ dialogTitle: 'Compartilhar planejamento' });
  });

  it('falha ao abrir o compartilhamento resolve false (sem lançar)', async () => {
    jest.spyOn(share, 'share').mockRejectedValue(new Error('sem apps'));
    expect(await actions.shareProgramCode({ programName: 'X', code: 'GN1:abc.00000000' })).toBe(false);
  });

  it('exportar, copiar, compartilhar e fechar não alteram dados; nada de sessões ou desempenho é enviado', async () => {
    const { program, a } = await createProgram();
    const { sessionService } = app.sessions;
    const done = await sessionService.startSession(a.id);
    for (const set of (await sessionService.getSessionDetails(done.sessionId))!.exercises.flatMap((e) => e.sets)) {
      await sessionService.completeSet(set.id, { actualReps: 77, actualWeightKg: 987.5 });
    }
    await sessionService.finishSession(done.sessionId);
    const live = await sessionService.startSession(a.id);
    const [liveSet] = (await sessionService.getSessionDetails(live.sessionId))!.exercises[0]!.sets;
    await sessionService.completeSet(liveSet!.id, { actualReps: 66, actualWeightKg: 876.25 });
    const shareSpy = jest.spyOn(share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const before = await dumpAll();

    const result = await actions.requestProgramExport(program.id);
    if (!result.ok) throw new Error(result.message);
    await actions.copyShareCode(result.exported.code);
    await actions.shareProgramCode(result.exported);
    // "Fechar" não chama nada: apenas descarta o resultado em memória.

    expect(await dumpAll()).toEqual(before);
    // Tudo o que sai do app, com o código substituído pelo JSON decodificado (o Base64 e o CRC
    // são aleatórios e poderiam conter dígitos como "66" por coincidência).
    const { code } = result.exported;
    const decodedJson = Buffer.from(code.slice(4, code.lastIndexOf('.')), 'base64').toString('utf8');
    const reveal = (text: string) => text.split(code).join(decodedJson);
    expect(clipboard.setStringAsync.mock.calls[0]![0]).toBe(code);
    const sent = [
      reveal(JSON.stringify(result.exported)),
      reveal((shareSpy.mock.calls[0]![0] as { message: string }).message),
    ].join('\n');
    expect(sent).toContain('"Supino reto",4,12,40,90');
    expect(sent).not.toMatch(/987|876|77|66/);
    expect(sent).not.toMatch(UUID);
    expect(sent).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    for (const id of [program.id, a.id, done.sessionId, live.sessionId]) expect(sent).not.toContain(id);
  });
});
