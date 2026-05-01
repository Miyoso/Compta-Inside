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

  // ── Semaine en cours ──────────────────────────────────────────

  const [weekSalesRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM sales
    WHERE company_id = ${companyId}
      AND sale_date >= DATE_TRUNC('week', NOW())
  `;
  const weekSales = weekSalesRow.total;

  const [weekSalRow] = await sql`
    SELECT COALESCE(SUM(s.total_amount * u.salary_percent / 100), 0)::float AS total
    FROM sales s
    JOIN users u ON u.id = s.employee_id
    WHERE s.company_id = ${companyId}
      AND s.sale_date >= DATE_TRUNC('week', NOW())
  `;
  const weekSalaries = weekSalRow.total;

  const [weekPurchRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM purchases
    WHERE company_id = ${companyId}
      AND purchase_date >= DATE_TRUNC('week', NOW())
  `;
  const weekPurchases = weekPurchRow.total;

  // Base imposable = CA − achats − salaires
  const weekNet = Math.max(0, weekSales - weekPurchases - weekSalaries);
  const weekTax = computeWeeklyTax(weekNet);

  // ── 4 semaines précédentes ────────────────────────────────────
  const prevWeeks = [];
  for (let i = 1; i <= 4; i++) {
    const [s] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM sales
      WHERE company_id = ${companyId}
        AND sale_date >= DATE_TRUNC('week', NOW()) - (${i} * INTERVAL '1 week')
        AND sale_date <  DATE_TRUNC('week', NOW()) - ((${i} - 1) * INTERVAL '1 week')
    `;
    const [sal] = await sql`
      SELECT COALESCE(SUM(s2.total_amount * u.salary_percent / 100), 0)::float AS total
      FROM sales s2
      JOIN users u ON u.id = s2.employee_id
      WHERE s2.company_id = ${companyId}
        AND s2.sale_date >= DATE_TRUNC('week', NOW()) - (${i} * INTERVAL '1 week')
        AND s2.sale_date <  DATE_TRUNC('week', NOW()) - ((${i} - 1) * INTERVAL '1 week')
    `;
    const [p] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM purchases
      WHERE company_id = ${companyId}
        AND purchase_date >= DATE_TRUNC('week', NOW()) - (${i} * INTERVAL '1 week')
        AND purchase_date <  DATE_TRUNC('week', NOW()) - ((${i} - 1) * INTERVAL '1 week')
    `;
    const net = Math.max(0, s.total - p.total - sal.total);
    const tax = computeWeeklyTax(net);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - i * 7);
    prevWeeks.push({
      weekStart: weekStart.toISOString().split('T')[0],
      sales:     s.total,
      purchases: p.total,
      salaries:  sal.total,
      net,
      tax:     tax.tax,
      rate:    tax.rate,
      bracket: tax.bracket,
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
    JOIN users u ON u.id = s.employee_id
    JOIN products p ON p.id = s.product_id
    WHERE s.company_id = ${companyId}
    ORDER BY s.sale_date DESC
    LIMIT 10
  `;

  return res.status(200).json({
    weekSales,
    weekPurchases,
    weekSalaries,
    weekNet,
    weekTaxAmount: weekTax.tax,
    weekTaxRate:   weekTax.rate,
    weekBracket:   weekTax.bracket,
    prevWeeks,
    alertsCount:   alertRow.count,
    recentSales,
  });
}
