export type NumberInputError = 'required' | 'invalid-number' | 'not-integer' | 'not-positive' | 'negative' | 'too-large';

export interface NumberInputRule {
  kind: 'integer' | 'decimal';
  /** 0 = aceita zero; 1 = exige positivo. */
  min: 0 | 1;
  max: number;
  /** Se `false`, campo vazio vale 0. */
  required: boolean;
}

export type NumberInputResult = { value: number } | { error: NumberInputError };

const INTEGER_PATTERN = /^\d+$/;
/** Aceita "40", "22.5" ou "22,5" (vírgula decimal pt-BR), até 2 casas. */
const DECIMAL_PATTERN = /^\d+([.,]\d{1,2})?$/;

/** Converte e valida um número digitado pelo usuário. */
export function parseNumberInput(raw: string, rule: NumberInputRule): NumberInputResult {
  const text = raw.trim();
  if (text.length === 0) return rule.required ? { error: 'required' } : { value: 0 };
  if (text.startsWith('-')) return { error: 'negative' };
  if (!DECIMAL_PATTERN.test(text)) return { error: 'invalid-number' };
  if (rule.kind === 'integer' && !INTEGER_PATTERN.test(text)) return { error: 'not-integer' };

  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) return { error: 'invalid-number' };
  if (value < rule.min) return { error: rule.min === 1 ? 'not-positive' : 'negative' };
  if (value > rule.max) return { error: 'too-large' };
  return { value };
}

/** Número → texto para campos de formulário, com vírgula decimal (ex.: 22.5 → "22,5"). */
export function formatNumberForInput(value: number): string {
  return String(value).replace('.', ',');
}
