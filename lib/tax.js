/**
 * Calcul de la taxe IRS — barème MARGINAL progressif
 *
 * Chaque tranche est taxée uniquement sur la portion qui la dépasse,
 * ce qui évite les effets de seuil brutaux.
 *
 * Tranches :
 *   $0      – $14 999  →   0 %
 *   $15 000 – $30 999  →  10 %  (sur cette tranche uniquement)
 *   $31 000 – $50 999  →  20 %  (sur cette tranche uniquement)
 *   $51 000+           →  30 %  (sur cette tranche uniquement)
 *
 * Exemple : $40 000 net
 *   → $0        sur les $14 999 premiers
 *   → $1 599.90 sur la tranche $15 000–$30 999   (15 999 × 10 %)
 *   → $1 800.20 sur la tranche $31 000–$40 000   ( 9 000 × 20 %)
 *   → Total : $3 400.10  (taux effectif ≈ 8,5 %)
 */
export function computeWeeklyTax(netAfterSalaries) {
  const base = Math.max(0, netAfterSalaries);
  if (base === 0) {
    return { rate: 0, tax: 0, bracket: 'Exonéré (< $15 000)', effectiveRate: 0 };
  }

  let tax = 0;
  if (base > 15000) tax += (Math.min(base, 30999) - 15000) * 0.10;
  if (base > 30999) tax += (Math.min(base, 50999) - 30999) * 0.20;
  if (base > 50999) tax += (base - 50999) * 0.30;

  const effectiveRate = base > 0 ? tax / base : 0;

  // Tranche marginale atteinte (pour l'affichage de la barre et des KPIs)
  let rate, bracket;
  if (base < 15000)       { rate = 0;    bracket = 'Exonéré (< $15 000)'; }
  else if (base <= 30999) { rate = 0.10; bracket = '$15 000 – $30 999  →  10 %'; }
  else if (base <= 50999) { rate = 0.20; bracket = '$31 000 – $50 999  →  20 %'; }
  else                    { rate = 0.30; bracket = '≥ $51 000          →  30 %'; }

  return { rate, tax, bracket, effectiveRate };
}
