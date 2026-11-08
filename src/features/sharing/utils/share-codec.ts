import { normalizeExerciseObservation } from '@/features/exercises/services/exercise.service';
import type { ProgramStructure } from '@/features/programs/types/program.types';
import {
  SHARE_CODE_PREFIX,
  SHARE_FORMAT_BASE_VERSION,
  SHARE_FORMAT_LATEST_VERSION,
  SHARE_LIMITS,
  type SharedExerciseTuple,
  type SharedProgramPayload,
  type ShareResult,
} from '@/features/sharing/types/sharing.types';
import { validateSharedPayload } from '@/features/sharing/utils/share-validation';

/*
 * Codec do código de compartilhamento, em TypeScript puro.
 * Não usa btoa/atob/TextEncoder/TextDecoder/Buffer: o mesmo código roda igual no Hermes (app)
 * e no Node (testes), sem depender de APIs globais com suporte diferente entre os ambientes.
 */

// ---------------------------------------------------------------- UTF-8

/** Texto → bytes UTF-8. Surrogates isolados (texto inválido) viram U+FFFD. */
export function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let codePoint = text.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

/** Bytes UTF-8 → texto. Estrito: sequências inválidas, truncadas ou "overlong" retornam `null`. */
export function utf8Decode(bytes: Uint8Array): string | null {
  const units: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i]!;
    let codePoint: number;
    let extra: number;
    let minimum: number;
    if (first < 0x80) {
      codePoint = first;
      extra = 0;
      minimum = 0;
    } else if (first >= 0xc2 && first <= 0xdf) {
      codePoint = first & 0x1f;
      extra = 1;
      minimum = 0x80;
    } else if (first >= 0xe0 && first <= 0xef) {
      codePoint = first & 0x0f;
      extra = 2;
      minimum = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      codePoint = first & 0x07;
      extra = 3;
      minimum = 0x10000;
    } else {
      return null;
    }
    for (let k = 1; k <= extra; k += 1) {
      const next = bytes[i + k];
      if (next === undefined || (next & 0xc0) !== 0x80) return null;
      codePoint = (codePoint << 6) | (next & 0x3f);
    }
    if (codePoint < minimum || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return null;

    if (codePoint >= 0x10000) {
      const offset = codePoint - 0x10000;
      units.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    } else {
      units.push(codePoint);
    }
    i += extra + 1;
  }

  let text = '';
  const CHUNK = 4096;
  for (let start = 0; start < units.length; start += CHUNK) {
    text += String.fromCharCode(...units.slice(start, start + CHUNK));
  }
  return text;
}

// ---------------------------------------------------------------- Base64 (padrão, sem padding)

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP: Readonly<Record<string, number>> = Object.fromEntries(
  [...BASE64_ALPHABET].map((char, index) => [char, index]),
);

export function base64Encode(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    output += BASE64_ALPHABET[b0 >> 2]!;
    output += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)]!;
    if (b1 !== undefined) output += BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)]!;
    if (b2 !== undefined) output += BASE64_ALPHABET[b2 & 0x3f]!;
  }
  return output;
}

/**
 * Base64 (sem padding) → bytes. Estrito: caracteres fora do alfabeto, comprimento impossível
 * ou bits finais não nulos (sinal de truncamento/alteração) retornam `null`.
 */
export function base64Decode(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const values: number[] = [];
  for (const char of text) {
    const value = BASE64_LOOKUP[char];
    if (value === undefined) return null;
    values.push(value);
  }

  const bytes: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const v0 = values[i]!;
    const v1 = values[i + 1]!;
    const v2 = values[i + 2];
    const v3 = values[i + 3];
    bytes.push((v0 << 2) | (v1 >> 4));
    if (v2 === undefined) {
      if ((v1 & 0x0f) !== 0) return null;
      break;
    }
    bytes.push(((v1 & 0x0f) << 4) | (v2 >> 2));
    if (v3 === undefined) {
      if ((v2 & 0x03) !== 0) return null;
      break;
    }
    bytes.push(((v2 & 0x03) << 6) | v3);
  }
  return Uint8Array.from(bytes);
}

// ---------------------------------------------------------------- CRC-32 (IEEE 802.3)

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable === null) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  return crcTable;
}

/** CRC-32 padrão (o mesmo de zip/PNG). */
export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** CRC-32 como 8 dígitos hexadecimais minúsculos (tamanho fixo). */
export function crc32Hex(bytes: Uint8Array): string {
  return crc32(bytes).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------- Envelope GN1:<base64>.<crc>

const HEADER_PATTERN = new RegExp(`${SHARE_CODE_PREFIX}(\\d{1,4}):`, 'g');
/** Ocorrências do cabeçalho testadas no máximo (o texto colado pode conter "GN1:" soltos). */
const MAX_HEADER_ATTEMPTS = 20;
const WHITESPACE = /\s/;
const HEX_DIGIT = /[0-9a-fA-F]/;

/** Profundidade máxima de aninhamento de um JSON (ignora colchetes dentro de strings). */
export function jsonDepth(json: string): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  for (let i = 0; i < json.length; i += 1) {
    const char = json[i];
    if (inString) {
      if (char === '\\') i += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '[' || char === '{') {
      depth += 1;
      if (depth > max) max = depth;
    } else if (char === ']' || char === '}') {
      depth -= 1;
    }
  }
  return max;
}

/**
 * Localiza o código no texto colado e devolve o JSON decodificado (ainda não validado).
 * Tolera texto antes/depois do código e espaços/quebras de linha no meio dele.
 * Se o texto tiver mais de um "GN<n>:" (ex.: "segue o GN1:" antes do código), cada ocorrência é
 * testada em ordem; vale a primeira íntegra. Se nenhuma for, devolve o erro da última.
 * O custo continua linear: a leitura de cada ocorrência para no ":" da seguinte.
 */
export function decodeEnvelope(raw: string): ShareResult<unknown> {
  if (raw.length > SHARE_LIMITS.maxCodeLength) return { ok: false, error: 'too-large' };
  if (raw.trim().length === 0) return { ok: false, error: 'empty' };

  const pattern = new RegExp(HEADER_PATTERN.source, 'g');
  let result: ShareResult<unknown> = { ok: false, error: 'not-found' };
  for (let attempt = 0; attempt < MAX_HEADER_ATTEMPTS; attempt += 1) {
    const header = pattern.exec(raw);
    if (!header) break;
    result = decodeAt(raw, header);
    if (result.ok) return result;
  }
  return result;
}

/** Decodifica o código que começa no cabeçalho encontrado. */
function decodeAt(raw: string, header: RegExpExecArray): ShareResult<unknown> {
  const version = Number(header[1]);
  if (version > SHARE_FORMAT_LATEST_VERSION) return { ok: false, error: 'unsupported-version' };
  if (version < SHARE_FORMAT_BASE_VERSION) return { ok: false, error: 'malformed' };

  // Payload: caracteres do alfabeto Base64 (espaços/quebras de linha são ignorados) até o ponto.
  let index = header.index + header[0].length;
  let payload = '';
  for (; index < raw.length; index += 1) {
    const char = raw[index]!;
    if (BASE64_LOOKUP[char] !== undefined) payload += char;
    else if (!WHITESPACE.test(char)) break;
  }
  if (raw[index] !== '.' || payload.length === 0) return { ok: false, error: 'corrupted' };

  // CRC: exatamente 8 dígitos hexadecimais (espaços/quebras de linha ignorados).
  let checksum = '';
  for (index += 1; index < raw.length && checksum.length < 8; index += 1) {
    const char = raw[index]!;
    if (HEX_DIGIT.test(char)) checksum += char;
    else if (!WHITESPACE.test(char)) break;
  }
  if (checksum.length !== 8) return { ok: false, error: 'corrupted' };

  const bytes = base64Decode(payload);
  if (bytes === null || crc32Hex(bytes) !== checksum.toLowerCase()) return { ok: false, error: 'corrupted' };

  const json = utf8Decode(bytes);
  if (json === null) return { ok: false, error: 'malformed' };
  // Limita o aninhamento ANTES do JSON.parse (evita estouro de pilha com entradas maliciosas).
  if (jsonDepth(json) > SHARE_LIMITS.maxJsonDepth) return { ok: false, error: 'malformed' };

  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    return { ok: false, error: 'malformed' };
  }
  // O cabeçalho (fora do CRC) precisa indicar a mesma versão do conteúdo (dentro do CRC).
  if (typeof value === 'object' && value !== null && 'v' in value && value.v !== version) {
    const payloadVersion = value.v;
    if (typeof payloadVersion === 'number' && payloadVersion > SHARE_FORMAT_LATEST_VERSION) {
      return { ok: false, error: 'unsupported-version' };
    }
    return { ok: false, error: 'malformed' };
  }
  return { ok: true, value };
}

/** Monta o código a partir de um payload: `GN<v>:<base64>.<crc32>` (o cabeçalho usa a versão do payload). */
export function encodeEnvelope(payload: SharedProgramPayload): string {
  const bytes = utf8Encode(JSON.stringify(payload));
  return `${SHARE_CODE_PREFIX}${payload.v}:${base64Encode(bytes)}.${crc32Hex(bytes)}`;
}

// ---------------------------------------------------------------- Estrutura ↔ código

/**
 * Mapeamento EXPLÍCITO da estrutura para o payload: copia somente os campos permitidos
 * (nomes, descrição, ordem pela posição no array, séries, repetições, carga, descanso e observação).
 * Não usa spread: nenhum campo extra que exista no objeto de origem chega ao código.
 */
export function toSharedPayload(structure: ProgramStructure): SharedProgramPayload {
  // A menor versão que representa o conteúdo: GN2 só se algum exercício tiver observação.
  const hasObservation = structure.workouts.some((workout) =>
    workout.exercises.some((exercise) => normalizeExerciseObservation(exercise.observation) !== null),
  );
  const program: SharedProgramPayload['p'] = {
    n: structure.name,
    w: structure.workouts.map((workout) => ({
      n: workout.name,
      e: workout.exercises.map((exercise): SharedExerciseTuple => {
        const observation = normalizeExerciseObservation(exercise.observation);
        return observation === null
          ? [exercise.name, exercise.sets, exercise.reps, exercise.weightKg, exercise.restSeconds]
          : [exercise.name, exercise.sets, exercise.reps, exercise.weightKg, exercise.restSeconds, observation];
      }),
    })),
  };
  if (structure.description !== null) program.d = structure.description;
  return { v: hasObservation ? SHARE_FORMAT_LATEST_VERSION : SHARE_FORMAT_BASE_VERSION, p: program };
}

/**
 * Gera o código de um planejamento. A estrutura é validada com as MESMAS regras da importação,
 * garantindo que todo código gerado possa ser importado.
 */
export function encodeShareCode(structure: ProgramStructure): ShareResult<string> {
  const payload = toSharedPayload(structure);
  const validation = validateSharedPayload(payload);
  if (!validation.ok) return validation;
  const code = encodeEnvelope(payload);
  if (code.length > SHARE_LIMITS.maxCodeLength) return { ok: false, error: 'too-large' };
  return { ok: true, value: code };
}

/** Lê o código colado (com ou sem texto em volta) e devolve a estrutura validada. Não acessa o banco. */
export function decodeShareCode(raw: string): ShareResult<ProgramStructure> {
  const decoded = decodeEnvelope(raw);
  if (!decoded.ok) return decoded;
  return validateSharedPayload(decoded.value);
}
