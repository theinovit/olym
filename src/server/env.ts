export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
