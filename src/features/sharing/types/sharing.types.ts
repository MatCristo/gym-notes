/**
 * Formato do código de compartilhamento de planejamentos (versão 1):
 *
 *   GN1:<PAYLOAD_BASE64>.<CRC32>
 *
 * - `PAYLOAD_BASE64`: JSON compacto em UTF-8, codificado em Base64 padrão (A–Z a–z 0–9 + /), sem padding.
 *   O alfabeto não contém `_ * ~` nem crase, que o WhatsApp interpreta como formatação.
 * - `CRC32`: 8 dígitos hexadecimais (minúsculos) do CRC-32 dos bytes UTF-8 do JSON.
 *
 * O código NÃO é criptografado: qualquer pessoa pode decodificá-lo. Por isso ele contém
 * somente a estrutura e a prescrição do planejamento — nunca IDs, datas ou dados de execução.
 */

export const SHARE_CODE_PREFIX = 'GN';
export const SHARE_FORMAT_VERSION = 1;

export const SHARE_LIMITS = {
  /** Tamanho máximo do texto colado (100 KB), verificado ANTES de qualquer decodificação. */
  maxCodeLength: 100 * 1024,
  minWorkouts: 1,
  maxWorkouts: 50,
  maxExercisesPerWorkout: 100,
  /** Profundidade máxima de aninhamento do JSON (o formato válido usa 5). */
  maxJsonDepth: 8,
} as const;

/** Tupla de exercício no payload: [nome, séries, repetições, cargaPlanejadaKg, descansoSegundos]. */
export type SharedExerciseTuple = [name: string, sets: number, reps: number, weightKg: number, restSeconds: number];

export interface SharedWorkoutV1 {
  /** Nome do treino. */
  n: string;
  /** Exercícios, na ordem. */
  e: SharedExerciseTuple[];
}

/** Payload (JSON) da versão 1. A ordem dos arrays é a ordem dos itens. */
export interface SharedProgramPayloadV1 {
  v: 1;
  p: {
    /** Nome do planejamento. */
    n: string;
    /** Descrição (omitida quando não houver). */
    d?: string;
    /** Treinos, na ordem. */
    w: SharedWorkoutV1[];
  };
}

export type ShareCodeErrorCode =
  /** Nada foi colado. */
  | 'empty'
  /** Texto maior que o limite (não é decodificado). */
  | 'too-large'
  /** Não há um código do Gym Notes no texto. */
  | 'not-found'
  /** Código de uma versão mais nova do formato. */
  | 'unsupported-version'
  /** Código incompleto, truncado ou alterado (Base64 inválido ou CRC divergente). */
  | 'corrupted'
  /** Conteúdo íntegro, mas com estrutura/tipos inválidos. */
  | 'malformed'
  /** Estrutura válida, mas com valores fora dos limites do app. */
  | 'invalid-content';

export type ShareResult<T> = { ok: true; value: T } | { ok: false; error: ShareCodeErrorCode };

/** Mensagens para o usuário: simples e sem detalhes técnicos. */
export const SHARE_ERROR_MESSAGES: Record<ShareCodeErrorCode, string> = {
  empty: 'Cole um código de planejamento para continuar.',
  'too-large': 'O texto colado é grande demais para ser um código de planejamento.',
  'not-found': 'Não encontramos um código do Gym Notes no texto colado.',
  'unsupported-version': 'Este código foi criado em uma versão mais nova do Gym Notes. Atualize o app para importá-lo.',
  corrupted: 'O código está incompleto ou foi alterado. Peça para a pessoa enviar o código novamente.',
  malformed: 'Este código não é válido.',
  'invalid-content': 'Este código contém dados que o Gym Notes não aceita (por exemplo, valores fora dos limites).',
};

// ---------------------------------------------------------------- Exportação

export type ShareExportErrorCode =
  /** O planejamento não existe (ex.: foi excluído). */
  | 'program-not-found'
  /** Planejamento sem treinos: não há o que compartilhar. */
  | 'no-workouts'
  /** Mais treinos/exercícios do que o formato permite, ou dados fora dos limites. */
  | 'exceeds-limits'
  /** O código ficaria maior que o limite de 100 KB. */
  | 'too-large';

/** Mensagens para o usuário: simples e sem detalhes técnicos. */
export const SHARE_EXPORT_ERROR_MESSAGES: Record<ShareExportErrorCode, string> = {
  'program-not-found': 'Este planejamento não foi encontrado. Ele pode ter sido excluído.',
  'no-workouts': 'Adicione ao menos um treino ao planejamento para poder compartilhá-lo.',
  'exceeds-limits': `Este planejamento passa do limite para compartilhamento (até ${SHARE_LIMITS.maxWorkouts} treinos e ${SHARE_LIMITS.maxExercisesPerWorkout} exercícios por treino).`,
  'too-large': 'Este planejamento é grande demais para ser compartilhado por código.',
};

/** Resultado da exportação: o código e um resumo para exibir ao usuário. */
export interface ExportedProgram {
  code: string;
  programName: string;
  workoutCount: number;
  exerciseCount: number;
}

// ---------------------------------------------------------------- Importação

export const IMPORTED_NAME_SUFFIX = ' (Importado)';

/** Prévia de um código: somente o necessário para o usuário decidir se importa. */
export interface ImportPreview {
  /** Nome como está no código. */
  name: string;
  /** Nome com que será criado agora (com " (Importado)" se o nome já existir). Recalculado na importação. */
  finalName: string;
  description: string | null;
  workoutCount: number;
  exerciseCount: number;
  workouts: { name: string; exerciseCount: number }[];
}
