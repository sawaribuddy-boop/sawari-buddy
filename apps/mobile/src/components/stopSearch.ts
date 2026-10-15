/**
 * Stops whose name contains the query (any case, extra spaces ignored), names that start with it
 * first. An empty query returns every stop in its original order.
 */
export function filterStops<T extends { name: string }>(stops: T[], query: string): T[] {
  const q = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!q) return stops;
  const starts: T[] = [];
  const contains: T[] = [];
  for (const stop of stops) {
    const name = stop.name.toLowerCase();
    if (name.startsWith(q)) starts.push(stop);
    else if (name.includes(q)) contains.push(stop);
  }
  return [...starts, ...contains];
}
