/**
 * Calcul de la taxe IRS hebdomadaire
 * Base imposable = CA de la semaine − salaires de la semaine
 *
 * Barème progressif :
 *   < 15 000       →  0 %
 *   15 000–30 999  → 10 %
 *   31 000–50 999  → 20 %
 *   ≥ 51 000       → 30 %
 */
export function computeWeeklyTax(netAfterSalaries) {
  const base = Math.max(0, netAfterSalaries);
  if (base < 15000)  return { rate: 0,    tax: 0,              bracket: 'Exonéré (< $15 000)' };
  if (base <= 30999) return { rate: 0.10, tax: base * 0.10,    bracket: '$15 000 – $30 999  →  10 %' };
  if (base <= 50999) return { rate: 0.20, tax: base * 0.20,    bracket: '$31 000 – $50 999  →  20 %' };
  return              { rate: 0.30, tax: base * 0.30,           bracket: '≥ $51 000          →  30 %' };
}
