export function parseBrazilianNumber(input: string | null | undefined): number | null {
  if (!input) return null;
  const sanitized = input
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!sanitized) {
    return null;
  }

  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Number(parsed.toFixed(2));
  return Number.isFinite(rounded) ? rounded : null;
}
