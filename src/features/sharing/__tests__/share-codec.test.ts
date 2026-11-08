/// <reference types="node" />
import { Buffer } from 'node:buffer';

import type { ProgramStructure } from '@/features/programs/types/program.types';
import { SHARE_LIMITS } from '@/features/sharing/types/sharing.types';
import {
  base64Decode,
  base64Encode,
  crc32,
  crc32Hex,
  decodeEnvelope,
  decodeShareCode,
  encodeShareCode,
  jsonDepth,
  toSharedPayload,
  utf8Decode,
  utf8Encode,
} from '@/features/sharing/utils/share-codec';

const CODE_FORMAT = /^GN1:[A-Za-z0-9+/]+\.[0-9a-f]{8}$/;

const structure: ProgramStructure = {
  name: 'Hipertrofia',
  description: '4x por semana',
  workouts: [
    {
      name: 'Treino A - Peito',
      exercises: [
        { name: 'Supino reto', sets: 4, reps: 12, weightKg: 40, restSeconds: 90 },
        { name: 'Crucifixo', sets: 3, reps: 15, weightKg: 22.5, restSeconds: 0 },
      ],
    },
    { name: 'Treino B - Costas', exercises: [{ name: 'Remada', sets: 4, reps: 10, weightKg: 50, restSeconds: 120 }] },
    { name: 'Treino C', exercises: [] },
  ],
};

/** Monta um envelope válido (Base64 + CRC corretos) a partir de qualquer texto JSON. */
function envelopeOf(json: string, version = 1): string {
  const bytes = utf8Encode(json);
  return `GN${version}:${base64Encode(bytes)}.${crc32Hex(bytes)}`;
}

function encode(value: ProgramStructure): string {
  const result = encodeShareCode(value);
  if (!result.ok) throw new Error(`falha ao codificar: ${result.error}`);
  return result.value;
}

const errorOf = (raw: string) => {
  const result = decodeShareCode(raw);
  return result.ok ? 'ok' : result.error;
};

/** Gerador determinístico (os testes não dependem de sorte). */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('primitivas do codec', () => {
  it('CRC-32 bate com o vetor de referência e tem 8 dígitos fixos', () => {
    expect(crc32(utf8Encode('123456789'))).toBe(0xcbf43926);
    expect(crc32Hex(utf8Encode(''))).toBe('00000000');
    expect(crc32Hex(utf8Encode('a'))).toBe('e8b7be43');
    for (let i = 0; i < 50; i += 1) expect(crc32Hex(utf8Encode(`x${i}`))).toMatch(/^[0-9a-f]{8}$/);
  });

  it('Base64 segue a RFC 4648 (sem padding) e bate com o Node para bytes aleatórios', () => {
    const vectors: [string, string][] = [
      ['', ''],
      ['f', 'Zg'],
      ['fo', 'Zm8'],
      ['foo', 'Zm9v'],
      ['foob', 'Zm9vYg'],
      ['fooba', 'Zm9vYmE'],
      ['foobar', 'Zm9vYmFy'],
    ];
    for (const [plain, encoded] of vectors) {
      expect(base64Encode(utf8Encode(plain))).toBe(encoded);
      expect(utf8Decode(base64Decode(encoded)!)).toBe(plain);
    }

    const random = seededRandom(42);
    for (let length = 0; length < 300; length += 7) {
      const bytes = Uint8Array.from({ length }, () => Math.floor(random() * 256));
      const encoded = base64Encode(bytes);
      expect(encoded).toBe(Buffer.from(bytes).toString('base64').replace(/=+$/, ''));
      expect(base64Decode(encoded)).toEqual(bytes);
    }
  });

  it('Base64 estrito: recusa caracteres fora do alfabeto, comprimento impossível e bits finais alterados', () => {
    expect(base64Decode('Zm9v_')).toBeNull();
    expect(base64Decode('Zm9v=')).toBeNull();
    expect(base64Decode('Zm9vY')).toBeNull(); // comprimento % 4 === 1
    expect(base64Decode('Zh')).toBeNull(); // "Zg" com bits finais alterados
  });

  it('UTF-8 preserva acentos e emojis (inclusive sequências com ZWJ) e bate com o Node', () => {
    const samples = ['Glúteos, ç, ã, é', '💪🏋️‍♀️🔥', 'Treino 🦵 de pernas', '中文', 'Ω≈ç√∫', '\u0000x'];
    for (const text of samples) {
      const bytes = utf8Encode(text);
      expect(Buffer.from(bytes).equals(Buffer.from(text, 'utf8'))).toBe(true);
      expect(utf8Decode(bytes)).toBe(text);
    }
  });

  it('UTF-8 estrito: sequências inválidas, truncadas ou "overlong" retornam null', () => {
    expect(utf8Decode(Uint8Array.from([0xc3]))).toBeNull(); // truncado
    expect(utf8Decode(Uint8Array.from([0xf0, 0x9f, 0x92]))).toBeNull(); // emoji truncado
    expect(utf8Decode(Uint8Array.from([0xc0, 0xaf]))).toBeNull(); // overlong
    expect(utf8Decode(Uint8Array.from([0xed, 0xa0, 0x80]))).toBeNull(); // surrogate codificado
    expect(utf8Decode(Uint8Array.from([0xff]))).toBeNull();
  });

  it('mede a profundidade do JSON ignorando colchetes dentro de strings', () => {
    expect(jsonDepth('{"a":[[1]]}')).toBe(3);
    expect(jsonDepth('{"a":"[[[[[[[[[[\\"]]]"}')).toBe(1);
  });
});

describe('código de compartilhamento GN1', () => {
  it('ida e volta: decodificar o código gerado devolve a mesma estrutura', () => {
    const code = encode(structure);
    expect(code).toMatch(CODE_FORMAT);
    expect(decodeShareCode(code)).toEqual({ ok: true, value: structure });
  });

  it('preserva acentos e emojis em nomes e descrição', () => {
    const unicode: ProgramStructure = {
      name: 'Força 💪 & Glúteos',
      description: 'Ênfase em posterior 🏋️‍♀️ — ação, coração, “aspas”',
      workouts: [
        {
          name: 'Treino 🦵 Pernas',
          exercises: [{ name: 'Agachamento búlgaro 🔥', sets: 4, reps: 8, weightKg: 17.5, restSeconds: 75 }],
        },
      ],
    };
    const code = encode(unicode);
    expect(code).toMatch(CODE_FORMAT);
    expect(decodeShareCode(code)).toEqual({ ok: true, value: unicode });
  });

  it('descrição nula é omitida do payload e volta como null', () => {
    const noDescription = { ...structure, description: null };
    expect(toSharedPayload(noDescription).p).not.toHaveProperty('d');
    expect(decodeShareCode(encode(noDescription))).toEqual({ ok: true, value: noDescription });
  });

  it('o payload segue o formato exato: v, p{n,d,w[{n,e[tupla]}]} — sem IDs, datas ou ordem numérica', () => {
    expect(toSharedPayload(structure)).toEqual({
      v: 1,
      p: {
        n: 'Hipertrofia',
        d: '4x por semana',
        w: [
          {
            n: 'Treino A - Peito',
            e: [
              ['Supino reto', 4, 12, 40, 90],
              ['Crucifixo', 3, 15, 22.5, 0],
            ],
          },
          { n: 'Treino B - Costas', e: [['Remada', 4, 10, 50, 120]] },
          { n: 'Treino C', e: [] },
        ],
      },
    });
  });

  it('o mapeamento é explícito: campos extras no objeto de origem nunca entram no código', () => {
    const polluted = {
      ...structure,
      id: '6f1c3b0e-0000-4000-8000-000000000000',
      createdAt: '2026-11-08T10:00:00.000Z',
      sessions: [{ actualWeightKg: 987.5 }],
      workouts: structure.workouts.map((workout) => ({
        ...workout,
        id: 'uuid-treino',
        sortOrder: 3,
        exercises: workout.exercises.map((exercise) => ({ ...exercise, id: 'uuid-ex', actualWeightKg: 987.5 })),
      })),
    } as unknown as ProgramStructure;

    const code = encode(polluted);
    const decoded = decodeEnvelope(code);
    expect(decoded.ok).toBe(true);
    const json = JSON.stringify(decoded.ok ? decoded.value : null);
    expect(json).not.toMatch(/uuid|6f1c3b0e|2026-11-08|987|sortOrder|sessions|actual|id"/);
    expect(json).toBe(JSON.stringify(toSharedPayload(structure)));
  });

  it('usa só A–Z a–z 0–9 + / no payload (sem _ * ~ crase nem padding =)', () => {
    const random = seededRandom(7);
    const chars = 'aéç💪Z9 _*~`=+/"\\';
    for (let round = 0; round < 40; round += 1) {
      const name = Array.from({ length: 1 + Math.floor(random() * 18) }, () => chars[Math.floor(random() * chars.length)])
        .join('')
        .trim() || 'x';
      const code = encode({ name, description: null, workouts: [{ name, exercises: [] }] });
      expect(code).toMatch(CODE_FORMAT);
      expect(code.slice(4)).not.toMatch(/[_*~`=]/);
    }
  });

  it('aceita texto em volta do código e espaços/quebras de linha no meio', () => {
    const code = encode(structure);
    const wrapped = code.replace(/(.{20})/g, '$1\n  ');
    expect(errorOf(`Oi! Importe no Gym Notes:\n${code}\nAbraço 💪`)).toBe('ok');
    expect(errorOf(`   ${wrapped}   `)).toBe('ok');
    expect(errorOf(`código: ${code}. Valeu!`)).toBe('ok');
    expect(decodeShareCode(`xx ${wrapped} yy`)).toEqual({ ok: true, value: structure });
  });

  it('acha o código mesmo com "GN1:"/"GN2:" soltos no texto antes dele', () => {
    const code = encode(structure);
    expect(decodeShareCode(`segue o GN1:\n${code}`)).toEqual({ ok: true, value: structure });
    expect(decodeShareCode(`GN1: GN2: GN1:abc.zz ${code} GN1:`)).toEqual({ ok: true, value: structure });
    // Sem nenhum código íntegro, o erro é o da última ocorrência.
    expect(errorOf('segue o GN1: depois mando')).toBe('corrupted');
    expect(errorOf(`GN1: e ${code.replace('GN1:', 'GN2:')}`)).toBe('unsupported-version');
  });

  it('muitos cabeçalhos falsos no limite de tamanho não degradam o desempenho', () => {
    const noisy = 'GN1:'.repeat(Math.floor(SHARE_LIMITS.maxCodeLength / 4));
    const started = Date.now();
    expect(errorOf(noisy)).toBe('corrupted');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('chaves "__proto__"/"constructor" no payload não poluem protótipos nem chegam à estrutura', () => {
    const json =
      '{"__proto__":{"polluted":1},"v":1,"p":{"n":"P","constructor":{"prototype":{"x":1}},' +
      '"w":[{"n":"A","e":[],"__proto__":{"y":1}}]}}';
    expect(decodeShareCode(envelopeOf(json))).toEqual({
      ok: true,
      value: { name: 'P', description: null, workouts: [{ name: 'A', exercises: [] }] },
    });
    const probe: Record<string, unknown> = {};
    expect([probe.polluted, probe.x, probe.y]).toEqual([undefined, undefined, undefined]);
  });

  it('CRC incorreto ou payload alterado → corrupted', () => {
    const code = encode(structure);
    const crc = code.slice(-8);
    const wrongCrc = code.slice(0, -8) + (crc[0] === '0' ? '1' : '0') + crc.slice(1);
    expect(errorOf(wrongCrc)).toBe('corrupted');

    const middle = 10;
    const altered = code.slice(0, middle) + (code[middle] === 'A' ? 'B' : 'A') + code.slice(middle + 1);
    expect(errorOf(altered)).toBe('corrupted');
    expect(errorOf(code.toUpperCase().replace('GN1:', 'GN1:'))).toBe('corrupted');
  });

  it('código truncado em qualquer ponto → corrupted (nunca importa dados parciais)', () => {
    const code = encode(structure);
    for (let cut = 5; cut < code.length; cut += 3) {
      expect(errorOf(code.slice(0, cut))).toBe('corrupted');
    }
    // Sem o trecho final do payload, mas com o CRC.
    const [head, crc] = code.split('.');
    expect(errorOf(`${head!.slice(0, -6)}.${crc}`)).toBe('corrupted');
  });

  it('prefixo incorreto → not-found; versão futura → unsupported-version', () => {
    const code = encode(structure);
    expect(errorOf(code.replace('GN1:', 'XX1:'))).toBe('not-found');
    expect(errorOf(code.replace('GN1:', 'gn1:'))).toBe('not-found');
    expect(errorOf(code.replace('GN1:', 'GN:'))).toBe('not-found');
    expect(errorOf('um texto qualquer sem código')).toBe('not-found');
    expect(errorOf(code.replace('GN1:', 'GN2:'))).toBe('unsupported-version');
    expect(errorOf(code.replace('GN1:', 'GN0:'))).toBe('malformed');
    // Envelope v1 íntegro, mas com payload de versão futura.
    expect(errorOf(envelopeOf('{"v":2,"p":{}}'))).toBe('unsupported-version');
  });

  it('vazio → empty; acima de 100 KB → too-large sem decodificar', () => {
    expect(errorOf('')).toBe('empty');
    expect(errorOf('  \n  ')).toBe('empty');
    const code = encode(structure);
    expect(errorOf(code + ' '.repeat(SHARE_LIMITS.maxCodeLength - code.length))).toBe('ok');
    expect(errorOf(code + ' '.repeat(SHARE_LIMITS.maxCodeLength - code.length + 1))).toBe('too-large');
    expect(errorOf('GN1:' + 'A'.repeat(SHARE_LIMITS.maxCodeLength))).toBe('too-large');
  });

  it('JSON inválido, UTF-8 inválido ou aninhamento excessivo com CRC correto → malformed', () => {
    expect(errorOf(envelopeOf('{"v":1,"p":'))).toBe('malformed');
    expect(errorOf(envelopeOf('não é json'))).toBe('malformed');
    const invalidUtf8 = Uint8Array.from([0x7b, 0xc3, 0x7d]);
    expect(errorOf(`GN1:${base64Encode(invalidUtf8)}.${crc32Hex(invalidUtf8)}`)).toBe('malformed');
    expect(errorOf(envelopeOf('['.repeat(5000) + ']'.repeat(5000)))).toBe('malformed');
  });

  it('código íntegro com conteúdo fora dos limites → invalid-content', () => {
    expect(errorOf(envelopeOf('{"v":1,"p":{"n":"Plano","w":[]}}'))).toBe('invalid-content');
    expect(errorOf(envelopeOf('{"v":1,"p":{"n":"Plano","w":[{"n":"A","e":[["Supino",0,10,20,60]]}]}}'))).toBe(
      'invalid-content',
    );
  });

  describe('geração do código', () => {
    it('recusa estruturas que não poderiam ser importadas (mesmas regras da importação)', () => {
      expect(encodeShareCode({ ...structure, workouts: [] })).toEqual({ ok: false, error: 'invalid-content' });
      expect(encodeShareCode({ ...structure, name: '' })).toEqual({ ok: false, error: 'invalid-content' });
    });

    it('recusa códigos acima de 100 KB', () => {
      const name = 'x'.repeat(60);
      const huge: ProgramStructure = {
        name: 'Gigante',
        description: null,
        workouts: Array.from({ length: 50 }, (_, w) => ({
          name: `Treino ${w}`,
          exercises: Array.from({ length: 100 }, () => ({ name, sets: 99, reps: 999, weightKg: 9999, restSeconds: 3600 })),
        })),
      };
      expect(encodeShareCode(huge)).toEqual({ ok: false, error: 'too-large' });
    });

    it('um planejamento realista gera um código curto o bastante para mensagens', () => {
      const realistic: ProgramStructure = {
        name: 'Hipertrofia',
        description: '4x por semana',
        workouts: Array.from({ length: 4 }, (_, w) => ({
          name: `Treino ${'ABCD'[w]}`,
          exercises: Array.from({ length: 8 }, (_, e) => ({
            name: `Exercício número ${e + 1}`,
            sets: 4,
            reps: 12,
            weightKg: 32.5,
            restSeconds: 90,
          })),
        })),
      };
      expect(encode(realistic).length).toBeLessThan(2500);
    });
  });
});
