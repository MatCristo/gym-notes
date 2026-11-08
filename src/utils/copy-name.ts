const COPY_SUFFIX = ' (Cópia)';

/**
 * Acrescenta `suffix` ao nome, cortando o original se necessário para respeitar `maxLength`.
 * Nunca corta um emoji/caractere fora do BMP pela metade (surrogate isolado).
 */
export function withNameSuffix(name: string, suffix: string, maxLength: number): string {
  let base = name.slice(0, Math.max(0, maxLength - suffix.length));
  const last = base.charCodeAt(base.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) base = base.slice(0, -1);
  return `${base.trimEnd()}${suffix}`;
}

/** "Treino A" → "Treino A (Cópia)", cortando o original se necessário para respeitar `maxLength`. */
export function buildCopyName(name: string, maxLength: number): string {
  return withNameSuffix(name, COPY_SUFFIX, maxLength);
}
