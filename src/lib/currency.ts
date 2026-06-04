export const DEFAULT_CURRENCY = "USD";

export const CURRENCY_PRESETS = [
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "INR", label: "Indian Rupee" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "SGD", label: "Singapore Dollar" },
  { code: "AED", label: "UAE Dirham" },
  { code: "NZD", label: "New Zealand Dollar" },
  { code: "ZAR", label: "South African Rand" },
] as const;

export function normalizeCurrency(code?: string | null): string {
  if (!code?.trim()) return DEFAULT_CURRENCY;
  return code.trim().toUpperCase().slice(0, 3);
}

/** Short symbol for editable amount fields (not full Intl formatting). */
export function currencyInputPrefix(currency = DEFAULT_CURRENCY): string {
  const code = normalizeCurrency(currency);
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === "currency")?.value;
    return sym ?? code;
  } catch {
    return code;
  }
}

export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
  const code = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString()}`;
  }
}

export function isPresetCurrency(code: string): boolean {
  return CURRENCY_PRESETS.some((c) => c.code === code);
}

export const TARGET_MRR_HELP =
  "Monthly recurring revenue you want to reach at the end of your time horizon — not annual revenue, total contract value, or profit.";

export const CURRENT_MRR_HELP =
  "What you earn per month from recurring subscriptions or contracts today (MRR).";

export const GOAL_HORIZON_HELP =
  "How many months you have to grow from current MRR to your target MRR.";
