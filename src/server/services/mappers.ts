type RowWithDates = Record<string, unknown>;

export function serializeDates<T>(row: RowWithDates): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  ) as T;
}
