export interface Money {
  amount: number;
  currency: string;
}

export function isMoney(value: unknown): value is Money {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.amount === "number" &&
    Number.isInteger(record.amount) &&
    record.amount >= 0 &&
    typeof record.currency === "string" &&
    /^[A-Z]{3}$/.test(record.currency)
  );
}
