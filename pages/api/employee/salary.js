// Salaire hebdomadaire de l'employé connecté — semaine en cours + 4 précédentes
// Base de calcul : MARGE (= CA − coût matières) et non CA brut
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

  // Ventes des 5 dernières semaines avec marge déduite du coût de revient
  const rows = await sql`
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
    )
    SELECT
      DATE_TRUNC('week', s.sale_date)                                                                             AS week_start,
      COALESCE(SUM(s.total_amount), 0)::float                                                                     AS gross_sales,
      COALESCE(SUM(GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))), 0)::float       AS margin,
      COUNT(*)::int                                                                                                AS nb_sales
    FROM sales s
    LEFT JOIN product_costs pc ON pc.product_id = s.product_id
    WHERE s.employee_id = ${employeeId}
      AND s.company_id  = ${companyId}
      AND s.sale_date  >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks'
    GROUP BY week_start
    ORDER BY week_start DESC
  `;

  // Construire les 5 semaines (même si certaines sont vides)
  const weeks = [];
  for (let i = 0; i < 5; i++) {
    const weekStart = new Date();
    const day = weekStart.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    weekStart.setDate(weekStart.getDate() + diffToMonday - i * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const matched = rows.find(r => new Date(r.week_start).toDateString() === weekStart.toDateString());

    weeks.push({
      label:       i === 0 ? 'Cette semaine' : `Semaine du ${weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`,
      week_start:  weekStart.toISOString(),
      week_end:    weekEnd.toISOString(),
      gross_sales: matched?.gross_sales ?? 0,
      total_sales: matched?.gross_sales ?? 0,  // compat rétro
      margin:      matched?.margin      ?? 0,
      nb_sales:    matched?.nb_sales    ?? 0,
      salary:      ((matched?.margin ?? 0) * salaryPercent) / 100,
      is_current:  i === 0,
    });
  }

  return res.status(200).json({ salaryPercent, weeks });
}
