/**
 * Report rows as chart data. Recharts spreads each data row onto the SVG elements it draws, so a
 * row field named `ref` (report rows carry `ref: "b2c:<uuid>"`) would become a React ref and crash
 * the render. Charts get the row without it.
 */
export function chartRow<T extends { ref?: unknown }>(row: T): Omit<T, "ref"> {
  const { ref: _ref, ...rest } = row;
  return rest;
}
