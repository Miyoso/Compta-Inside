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
  const base = Math.ma