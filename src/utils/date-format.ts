const weekdayDateFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const shortDateYearFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const monthYearFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const monthShortFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

const capitalize = (text: string) => (text.length > 0 ? text[0]!.toUpperCase() + text.slice(1) : text);

/** "Qui., 05 de nov." */
export function formatWeekdayDate(iso: string): string {
  return capitalize(weekdayDateFormatter.format(new Date(iso)));
}

/** "05 de novembro de 2026" */
export function formatFullDate(iso: string): string {
  return fullDateFormatter.format(new Date(iso));
}

/** "18:32" */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** "05/11" (eixos de gráfico). */
export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

/** "05/11/26" */
export function formatShortDateWithYear(iso: string): string {
  return shortDateYearFormatter.format(new Date(iso));
}

/** "Novembro de 2026" (cabeçalhos de seção). */
export function formatMonthYear(iso: string): string {
  return capitalize(monthYearFormatter.format(new Date(iso)));
}

/** "nov." (rótulos de barras mensais). */
export function formatMonthShort(iso: string): string {
  return monthShortFormatter.format(new Date(iso)).replace('.', '');
}
