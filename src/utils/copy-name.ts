const COPY_SUFFIX = ' (Cópia)';

/** "Treino A" → "Treino A (Cópia)", cortando o original se necessário para respeitar `maxLength`. */
export function buildCopyName(name: string, maxLength: number): string {
  const base = name.slice(0, maxLength - COPY_SUFFIX.length).trimEnd();
  return `${base}${COPY_SUFFIX}`;
}
