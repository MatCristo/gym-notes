/// <reference types="node" />
/** Substituto do `expo-crypto` em testes: UUID v4 real do Node (mesmo formato RFC 4122). */
import { randomUUID as nodeRandomUUID } from 'node:crypto';

export function randomUUID(): string {
  return nodeRandomUUID();
}
