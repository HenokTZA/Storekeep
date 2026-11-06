const AGENT_PRICE_FACTOR_NUMERATOR = 157;
const AGENT_PRICE_FACTOR_DENOMINATOR = 160;

/** Apply the 1.875% Agent discount at eight decimal places without cent rounding. */
export function agentSellingPrice(basePrice: number) {
  const baseCents = Math.round(Number(basePrice) * 100);
  // 1,000,000 / 160 = 6,250, so this returns the exact result scaled to 1e-8.
  const scaleToEightPlaces = 1_000_000 / AGENT_PRICE_FACTOR_DENOMINATOR;
  return (baseCents * AGENT_PRICE_FACTOR_NUMERATOR * scaleToEightPlaces) / 100_000_000;
}

export function formatUnitPrice(value: number) {
  const result = Number(value).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  if (!result.includes('.')) return `${result}.00`;
  const [whole, fraction] = result.split('.');
  return `${Number(whole).toLocaleString()}.${fraction.padEnd(2, '0')}`;
}

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
