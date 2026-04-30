import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

const TAX_RATE = 0.15;

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const companyId = token.companyId;

  // CA total du mois en cours
  const [salesRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM sales
    WHERE company_id = ${companyId}
    AND DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', NOW())
  `;
  const totalSales = salesRow.total;
  const taxes = totalSales * TAX_RATE;

  // Total salaires du mois
  const [salRow] = await sql`
    SELECT COALESCE(SUM(s.total_amount * u.salary_percent / 100), 0)::float AS total
    FROM sales s
    JOIN users u ON u.id = s.employee_id
    WHERE s.company_id = ${companyId}
    AND DATE_TRUNC('month', s.sale_date) = DATE_TRUNC('month', NOW())
  `;
  const totalSalaries = salRow.total;

  // Nombre de produits en alerte stock
  const [alertRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM products
    WHERE company_id = ${companyId}
    AND stock_quantity <= stock_min_alert
  `;

  // 10 dernières ventes
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
    totalSales,
    taxes,
    totalSalaries,
    netRevenue: totalSales - taxes - totalSalaries,
    alertsCount: alertRow.count,
    recentSales,
  });
}
