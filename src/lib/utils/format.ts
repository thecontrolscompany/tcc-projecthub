const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const USD_COMPACT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export function fmtCurrency(n: number): string {
  return USD.format(n);
}

export function fmtCurrencyCompact(n: number): string {
  return USD_COMPACT.format(n);
}
