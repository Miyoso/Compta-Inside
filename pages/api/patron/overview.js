import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';
import { computeWeeklyTax } from '../../../lib/tax';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const companyId = token.companyId;

  // ── CA de la semaine en cours ─────────────────────────────────
  const [weekSalesRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM sales
    WHERE company_id = ${companyId}
      AND sale_date >= DATE_TRUNC('week', NOW())
  `;
  const weekSales = weekSalesRow.total;

  // ── Achats de la semaine ──────────────────────────────────────
  const [weekPurchRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM purchases
    WHERE company_id  = ${companyId}
      AND purchase_date >= DATE_TRUNC('week', NOW())
  `;
  const weekPurchases = weekPurchRow.total;

  // ── Salaires en UNE seule requête — base = MARGE (vente − coût matières)
  //    Couvre : semaine en cours, mois en cours, 4 semaines précédentes
  const [salRow] = await sql`
    WITH avg_prices AS (
      SELECT raw_material_id,
             SUM(total_amount) / NULLIF(SUM(quantity), 0) AS avg_unit_price
      FROM purchases
      WHERE company_id = ${companyId} AND raw_material_id IS NOT NULL
      GROUP BY raw_material_id
    ),
    product_costs AS (
      SELECT pr.product_id,
             COALESCE(SUM(pr.quantity_per_unit * COALESCE(ap.avg_unit_price, 0)), 0) AS cost_price
      FROM product_recipes pr
      LEFT JOIN avg_prices ap ON ap.raw_material_id = pr.raw_material_id
      WHERE pr.company_id = ${companyId}
      GROUP BY pr.product_id
    ),
    base AS (
      SELECT
        s.sale_date,
        GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0)) * u.salary_percent / 100 AS sal_contrib
      FROM sales s
      JOIN  users u ON u.id = s.employee_id
      LEFT JOIN product_costs pc ON pc.product_id = s.product_id
      WHERE s.company_id = ${companyId}
        AND s.sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks'
    )
    SELECT
      COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW())),                                                                           0)::float AS week_sal,
      COALESCE(SUM(sal_contrib) FILTER (WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', NOW())),                                                      0)::float AS month_sal,
      COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '1 week'  AND sale_date < DATE_TRUNC('week', NOW())),             0)::float AS prev1_sal,
      COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '2 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '1 week'),  0)::float AS prev2_sal,
      COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '3 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '2 weeks'), 0)::float AS prev3_sal,
      COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '3 weeks'), 0)::float AS prev4_sal
    FROM base
  `;
  const weekSalaries  = salRow.week_sal;
  const monthSalaries = salRow.month_sal;

  // ── IRS semaine en cours ──────────────────────────────────────
  const weekNetRaw  = weekSales - weekPurchases - weekSalaries;
  const weekTaxBase = Math.max(0, weekNetRaw);
  const weekTax     = computeWeeklyTax(weekTaxBase);

  // ── Mois en cours (récap fiscal) ─────────────────────────────
  const [monthSalesRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM sales
    WHERE company_id = ${companyId}
      AND DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', NOW())
  `;
  const monthSales = monthSalesRow.total;

  const [monthPurchRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM purchases
    WHERE company_id  = ${companyId}
      AND DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', NOW())
  `;
  const monthPurchases = monthPurchRow.total;

  const monthTaxBase        = Math.max(0, monthSales - monthPurchases - monthSalaries);
  const monthTaxBaseNoPurch = Math.max(0, monthSales - monthSalaries);
  const monthTaxObj         = computeWeeklyTax(monthTaxBase);
  const monthTaxNoPurchObj  = computeWeeklyTax(monthTaxBaseNoPurch);
  const taxSaving           = Math.max(0, monthTaxNoPurchObj.tax - monthTaxObj.tax);

  // ── 4 semaines précédentes ────────────────────────────────────
  const prevWeeks = [];
  const prevSals  = [salRow.prev1_sal, salRow.prev2_sal, salRow.prev3_sal, salRow.prev4_sal];

  for (let i = 1; i <= 4; i++) {
    const [s] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM sales
      WHERE company_id = ${companyId}
        AND sale_date >= DATE_TRUNC('week', NOW()) - (${i}  * INTERVAL '1 week')
        AND sale_date <  DATE_TRUNC('week', NOW()) - (${i - 1} * INTERVAL '1 week')
    `;
    const [p] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM purchases
      WHERE company_id  = ${companyId}
        AND purchase_date >= DATE_TRUNC('week', NOW()) - (${i}  * INTERVAL '1 week')
        AND purchase_date <  DATE_TRUNC('week', NOW()) - (${i - 1} * INTERVAL '1 week')
    `;
    const sal     = prevSals[i - 1];
    const netRaw  = s.total - p.total - sal;
    const taxBase = Math.max(0, netRaw);
    const tax     = computeWeeklyTax(taxBase);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - i * 7);
    prevWeeks.push({
      weekStart: weekStart.toISOString().split('T')[0],
      sales:     s.total,
      purchases: p.total,
      salaries:  sal,
      net:       netRaw,
      taxBase,
      tax:       tax.tax,
      rate:      tax.rate,
      bracket:   tax.bracket,
    });
  }

  // ── Alertes stock bas ─────────────────────────────────────────
  const [alertRow] = await sql`
    SELECT COUNT(*)::int AS count FROM raw_materials
    WHERE company_id = ${companyId} AND quantity <= min_alert
  `;

  // ── 10 dernières ventes ───────────────────────────────────────
  const recentSales = await sql`
    SELECT s.id, u.name AS employee_name, p.name AS product_name,
           s.quantity, s.total_amount::float, s.sale_date
    FROM sales s
    JOIN users    u ON u.id = s.employee_id
    JOIN products p ON p.id = s.product_id
    WHERE s.company_id = ${companyId}
    ORDER BY s.sale_date DESC
    LIMIT 10
  `;

  return res.status(200).json({
    weekSales,
    weekPurchases,
    weekSalaries,
    weekNet:              weekNetRaw,
    weekTaxBase,
    weekTaxAmount:        weekTax.tax,
    weekTaxRate:          weekTax.rate,
    weekTaxEffectiveRate: weekTax.effectiveRate,
    weekBracket:          weekTax.bracket,
    totalSales:     monthSales,
    totalPurchases: monthPurchases,
    totalSalaries:  monthSalaries,
    taxableBase:    monthTaxBase,
    taxSaving,
    taxes:          monthTaxObj.tax,
    taxRate:        monthTaxObj.rate,
    prevWeeks,
    alertsCount:  alertRow.count,
    recentSales,
  });
}
