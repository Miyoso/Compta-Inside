// Salaire de l'employé depuis le dernier paiement de salaires de l'entreprise
import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non connecté.' });
  if (req.method !== 'GET') return res.status(405).end();

  const employeeId = parseInt(token.sub);
  const companyId  = token.companyId;

  const [user] = await sql`SELECT salary_percent::float FROM users WHERE id = ${employeeId}`;
  const salaryPercent = user?.salary_percent ?? 0;

  // Date du dernier paiement de salaires de l'entreprise
  const [lastPayRow] = await sql`
    SELECT COALESCE(MAX(paid_at), '1970-01-01T00:00:00Z'::timestamptz) AS last_paid,
           MAX(paid_at) IS NOT NULL AS ever_paid
    FROM salary_payments WHERE company_id = ${companyId}
  `;
  const lastPaid   = lastPayRow.last_paid;
  const everPaid   = lastPayRow.ever_paid;

  // Gains depuis le dernier paiement (avec marge déduite du coût de revient)
  const [currentRow] = await sql`
    WITH avg_prices AS (
      SELECT raw_material_id,
             SUM(total_amount) / NULLIF(SUM(quantity), 0) AS avg_unit_price
      FROM purchases WHERE company_id = ${companyId} AND raw_material_id IS NOT NULL
      GROUP BY raw_material_id
    ),
    product_costs AS (
      SELECT pr.product_id,
             COALESCE(SUM(pr.quantity_per_unit * COALESCE(ap.avg_unit_price, 0)), 0) AS cost_price
      FROM product_recipes pr
      LEFT JOIN avg_prices ap ON ap.raw_material_id = pr.raw_material_id
      WHERE pr.company_id = ${companyId}
      GROUP BY pr.product_id
    )
    SELECT
      COALESCE(SUM(s.total_amount), 0)::float                                                                   AS gross_sales,
      COALESCE(SUM(GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))), 0)::float     AS margin,
      COUNT(*)::int                                                                                              AS nb_sales
    FROM sales s
    LEFT JOIN product_costs pc ON pc.product_id = s.product_id
    WHERE s.employee_id = ${employeeId}
      AND s.company_id  = ${companyId}
      AND s.sale_date   > ${lastPaid}
  `;

  // Historique des 5 derniers paiements effectués (montant reçu par cet employé)
  const paymentHistory = await sql`
    SELECT sp.id, sp.paid_at, sp.week_start,
           -- Approximation : part de l'employé proportionnelle à son % et à ses ventes ce jour-là
           -- (Pour un suivi exact il faudrait une table de détail par employé)
           sp.total_amount::float AS company_total
    FROM salary_payments sp
    WHERE sp.company_id = ${companyId}
    ORDER BY sp.paid_at DESC LIMIT 8
  `;

  return res.status(200).json({
    salaryPercent,
    lastPaid,
    everPaid,
    currentPeriod: {
      grossSales: currentRow.gross_sales,
      margin:     currentRow.margin,
      salary:     (currentRow.margin * salaryPercent) / 100,
      nbSales:    currentRow.nb_sales,
    },
    paymentHistory,
  });
}
