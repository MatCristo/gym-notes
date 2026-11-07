const formatters = new Map<number, Intl.NumberFormat>();

function getFormatter(maxFractionDigits: number): Intl.NumberFormat {
  let formatter = formatters.get(maxFractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: maxFractionDigits });
    formatters.set(maxFractionDigits, formatter);
  }
  return formatter;
}

/** Número em pt-BR, sem zeros desnecessários: 22.5 → "22,5"; 40 → "40". */
export function formatDecimal(value: number, maxFractionDigits = 2): string {
  return getFormatter(maxFractionDigits).format(value);
}

/** Carga em kg: 42.5 → "42,5 kg". */
export function formatKg(value: number): string {
  return `${formatDecimal(value)} kg`;
}
