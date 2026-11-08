/** Retorna uma nova lista com o item de `from` movido para `to` (usado nas reordenações por arrastar). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

/** `true` se `orderedIds` contém exatamente os mesmos IDs de `currentIds`, sem repetições. */
export function isPermutationOf(orderedIds: readonly string[], currentIds: readonly string[]): boolean {
  const current = new Set(currentIds);
  return (
    orderedIds.length === currentIds.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => current.has(id))
  );
}
