const AGENT_PRICE_FACTOR_NUMERATOR = 157;
const AGENT_PRICE_FACTOR_DENOMINATOR = 160;

/** Apply the 1.875% Agent discount and round to cents like the backend. */
export function agentSellingPrice(basePrice: number) {
  const baseCents = Math.round(Number(basePrice) * 100);
  return Math.floor((baseCents * AGENT_PRICE_FACTOR_NUMERATOR + AGENT_PRICE_FACTOR_DENOMINATOR / 2) / AGENT_PRICE_FACTOR_DENOMINATOR) / 100;
}
