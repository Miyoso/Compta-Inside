import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

const TAX_RATE = 0.15;

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  // Toutes les entreprises
  const companies = await sql`SELECT id, name FROM companies ORDER BY name ASC`;

  const result = await Promise.all(companies.map(async (company) => {
    // CA du mois
    const [salesRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM sales
      WHERE company_id = ${company.id}
        AND DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', NOW())
    `;
    const totalSales = salesRow.total;

    // CA cumulé (historique complet)
    const [salesAllRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM sales
      WHERE company_id = ${company.id}
    `;
    const totalSalesAll = salesAllRow.total;

    // Achats matières premières du mois
    const [purchRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM purchases
      WHERE company_id = ${company.id}
        AND DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', NOW())
    `;
    const totalPurchases = purchRow.total;

    // Base imposable et impôts du mois
    const taxableBase = Math.max(0, totalSales - totalPurchases);
    const taxes       = taxableBase * TAX_RATE;

    // Impôts cumulés (historique)
    const [salesAllMonths] = await sql`
      SELECT
        COALESCE(SUM(s.total_amount), 0)::float AS total_sales,
        COALESCE(SUM(p.total_purchases), 0)::float AS total_purchases
      FROM (
        SELECT DATE_TRUNC('month', sale_date) AS month,
               SUM(total_amount) AS total_amount
        FROM sales
        WHERE company_id = ${company.id}
        GROUP BY month
      ) s
      LEFT JOIN (
        SELECT DATE_TRUNC('month', purchase_date) AS month,
               SUM(total_amount) AS total_purchases
        FROM purchases
        WHERE company_id = ${company.id}
        GROUP BY month
      ) p ON p.month = s.month
    `;
    const totalTaxesAll = Math.max(0, salesAllMonths.total_sales - salesAllMonths.total_purchases) * TAX_RATE;

    // Salaires du mois
    const [salRow] = await sql`
      SELECT COALESCE(SUM(s.total_amount * u.salary_percent / 100), 0)::float AS total
      FROM sales s
      JOIN users u ON u.id = s.employee_id
      WHERE s.company_id = ${company.id}
        AND DATE_TRUNC('month', s.sale_date) = DATE_TRUNC('month', NOW())
    `;
    const totalSalaries = salRow.total;

    // Nombre d'employés actifs
    const [empRow] = await sql`
      SELECT COUNT(*)::int AS count FROM users
      WHERE company_id = ${company.id} AND role = 'employee' AND status = 'active'
    `;

    // Nombre de patrons
    const [patronRow] = await sql`
      SELECT COUNT(*)::int AS count FROM users
      WHERE company_id = ${company.id} AND role = 'patron'
    `;

    // Comptes en attente
    const [pendingRow] = await sql`
      SELECT COUNT(*)::int AS count FROM users
      WHERE company_id = ${company.id} AND status = 'pending'
    `;

    // Alertes stock matières premières
    const [alertRow] = await sql`
      SELECT COUNT(*)::int AS count FROM raw_materials
      WHERE company_id = ${company.id} AND quantity <= min_alert
    `;

    // CA par mois (6 derniers mois) pour mini-graphique
    const monthlySales = await sql`
      SELECT DATE_TRUNC('month', sale_date) AS month,
             SUM(total_amount)::float AS total
      FROM sales
      WHERE company_id = ${company.id}
        AND sale_date >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `;

    const netRevenue = totalSales - taxes - totalSalaries - totalPurchases;

    return {
      id:              company.id,
      name:            company.name,
      totalSales,
      totalSalesAll,
      totalPurchases,
      taxableBase,
      taxes,
      totalTaxesAll,
      totalSalaries,
      netRevenue,
      employeeCount:   empRow.count,
      patronCount:     patronRow.count,
      pendingCount:    pendingRow.count,
      stockAlerts:     alertRow.count,
      monthlySales,
    };
  }));

  // Totaux globaux
  const globalTaxes     = result.reduce((a, c) => a + c.taxes, 0);
  const globalTaxesAll  = result.reduce((a, c) => a + c.totalTaxesAll, 0);
  const globalSales     = result.reduce((a, c) => a + c.totalSales, 0);
  const globalSalesAll  = result.reduce((a, c) => a + c.totalSalesAll, 0);

  return res.status(200).json({
    companies: result,
    totals: { globalTaxes, globalTaxesAll, globalSales, globalSalesAll },
  });
}
