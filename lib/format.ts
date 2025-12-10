export function formatCurrency(
  value: number,
  locale: string = "pt-BR",
  currency: string = "BRL",
) {
  return value.toLocaleString(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

export function formatPercentage(value: number, fractionDigits: number = 0) {
  const percentage = Math.max(0, Math.min(value, 1)) * 100;
  return `${percentage.toFixed(fractionDigits)}%`;
}
