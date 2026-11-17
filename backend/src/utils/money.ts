/** Fixed-cent arithmetic for user-entered money. Values are converted to bigint cents
 * before arithmetic so fee totals do not accumulate binary floating-point errors. */
export function cents(value: number | string | null | undefined): bigint {
  const text = String(value ?? '0').trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Invalid money value');
  const [whole, fraction = ''] = text.split('.');
  const padded = (fraction + '00').slice(0, 3);
  const base = BigInt(whole ?? '0') * 100n + BigInt(padded.slice(0, 2));
  return padded[2] && Number(padded[2]) >= 5 ? base + 1n : base;
}

export function money(centsValue: bigint): number {
  return Number(centsValue) / 100;
}

export function percentageOf(amount: bigint, percentage: number): bigint {
  return cents((Number(amount) / 100 * percentage / 100).toFixed(2));
}
