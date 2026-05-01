import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';
import { computeWeeklyTax } from '../../../lib/tax';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const companies = await sql`SELECT id, name FROM companies ORDER BY name ASC`;

  const result = await Promise.all(companies.map(async (company) => {

    // ── Semaine en cours ────────────────────────────────────────
    const [weekSalesRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM sales
      WHERE company_id = ${company.id}
        AND sale_date >= DATE_TRUNC('week', NOW())
    `;
    const weekSales = weekSalesRow.total;

    const [weekSalRow] = await sql`
      SELECT COALESCE(SUM(s.total_amount * u.salary_percent / 100), 0)::float AS total
      FROM sales s
      JOIN users u ON u.id = s.employee_id
      WHERE s.company_id = ${company.id}
        AND s.sale_date >= DATE_TRUNC('week', NOW())
    `;
    const weekSalaries = weekSalRow.total;

    const [weekPurchRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM purchases
      WHERE company_id = ${company.id}
        AND purchase_date >= DATE_TRUNC('week', NOW())
    `;
    const weekPurchases = weekPurchRow.total;

    // Base imposable = CA − achats − salaires
    const weekNet = Math.max(0, weekSales - weekPurchases - weekSalaries);
    const weekTax = computeWeeklyTax(weekNet);

    // ── 4 semaines précédentes ──────────────────────────────────
    const prevWeeks = [];
    for (let i = 1; i <= 4; i++) {
      const [s] = await sql`
        SELECT COALESCE(SUM(total_amount), 0)::float AS total
        FROM sales
        WHERE company_id = ${company.id}
          AND sale_date >= DATE_TRUNC('week', NOW()) - (${i} * INTERVAL '1 week')
          AND sale_date <  DATE_TRUNC('week', NOW()) - ((${i} - 1) * INTERVAL '1 week')
      `;
      const [sal] = await sql`
        SELECT COALESCE(SUM(s2.total_amount * u.salary_percent / 100), 0)::float AS total
        FROM sales s2
        JOIN users u ON u.id = s2.employee_id
        WHERE s2.company_id = ${company.id}
          AND s2.sale_date >= DATE_TRUNC('week', NOW()) - (${i} * INTERVAL '1 week')
          AND s2.sale_date <  DATE_TRUNC('week', NOW()) - ((${i} - 1) * INTERVAL '1 week')
      `;
      const [p] = await sql`
        SELECT COALESCE(SUM(total_amount), 0)::float AS total
        FROM purchases
        WHERE company_id = ${company.id}
          AND purchase_date >= DATE_TRUNC('week', NOW()) - (${i} * INTERVAL '1 week')
          AND purchase_date <  DATE_TRUNC('week', NOW()) - ((${i} - 1) * INTERVAL '1 week')
      `;
      const net = Math.max(0, s.total - p.total - sal.total);
      const tax = computeWeeklyTax(net);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - i * 7);
      prevWeeks.push({
        weekStart: weekStart.toISOString().split('T')[0],
        sales: s.total, purchases: p.total, salaries: sal.total, net,
        tax: tax.tax, rate: tax.rate, bracket: tax.bracket,
      });
    }

    const totalTaxesDue = prevWeeks.reduce((a, w) => a + w.tax, 0) + weekTax.tax;

    // ── CA mensuel graphique ────────────────────────────────────
    const monthlySales = await sql`
      SELECT DATE_TRUNC('month', sale_date) AS month,
             SUM(total_amount)::float AS total
      FROM sales
      WHERE company_id = ${company.id}
        AND sale_date >= NOW() - INTERVAL '6 months'
      GROUP BY month ORDER BY month ASC
    `;

    // ── Effectifs ────────────────────────────────────────────────
    const [empRow]     = await sql`SELECT COUNT(*)::int AS count FROM users WHERE company_id = ${company.id} AND role = 'employee' AND status = 'active'`;
    const [patronRow]  = await sql`SELECT COUNT(*)::int AS count FROM users WHERE company_id = ${company.id} AND role = 'patron'`;
    const [pendingRow] = await sql`SELECT COUNT(*)::int AS count FROM users WHERE company_id = ${company.id} AND status = 'pending'`;
    const [alertRow]   = await sql`SELECT COUNT(*)::int AS count FROM raw_materials WHERE company_id = ${company.id} AND quantity <= min_alert`;

    return {
      id:            company.id,
      name:          company.name,
      weekSales,
      weekPurchases,
      weekSalaries,
      weekNet,
      weekTaxAmount: weekTax.tax,
      weekTaxRate:   weekTax.rate,
      weekBracket:   weekTax.bracket,
      prevWeeks,
      totalTaxesDue,
      monthlySales,
      employeeCount: empRow.count,
      patronCount:   patronRow.count,
      pendingCount:  pendingRow.count,
      stockAlerts:   alertRow.count,
    };
  }));

  const globalWeekTax   = result.reduce((a, c) => a + c.weekTaxAmount, 0);
  const globalWeekSales = result.reduce((a, c) => a + c.weekSales, 0);
  const globalTaxesDue  = result.reduce((a, c) => a + c.totalTaxesDue, 0);

  return res.status(200).json({
    companies: result,
    totals: { globalWeekTax, globalWeekSales, globalTaxesDue },
  });
}
