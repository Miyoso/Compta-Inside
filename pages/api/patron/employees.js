import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — employés avec ventes semaine + mois et salaires calculés
  if (req.method === 'GET') {
    const employees = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.salary_percent::float,

        -- Ventes & salaire de la semaine en cours
        COALESCE(SUM(s_week.total_amount), 0)::float                              AS week_sales,
        COALESCE(SUM(s_week.total_amount) * u.salary_percent / 100, 0)::float    AS week_salary,

        -- Ventes & salaire du mois en cours
        COALESCE(SUM(s_month.total_amount), 0)::float                             AS total_sales,
        COALESCE(SUM(s_month.total_amount) * u.salary_percent / 100, 0)::float   AS salary_due

      FROM users u

      LEFT JOIN sales s_week
        ON s_week.employee_id = u.id
        AND s_week.sale_date >= DATE_TRUNC('week', NOW())

      LEFT JOIN sales s_month
        ON s_month.employee_id = u.id
        AND DATE_TRUNC('month', s_month.sale_date) = DATE_TRUNC('month', NOW())

      WHERE u.company_id = ${companyId}
        AND u.status = 'active'

      GROUP BY u.id, u.name, u.email, u.role, u.salary_percent
      ORDER BY week_salary DESC, u.name ASC
    `;
    return res.status(200).json(employees);
  }

  // PUT — modifier le pourcentage de salaire d'un employé
  if (req.method === 'PUT') {
    const { id, salary_percent } = req.body;
    if (salary_percent == null || salary_percent < 0 || salary_percent > 100) {
      return res.status(400).json({ error: 'Pourcentage invalide (0-100).' });
    }
    await sql`
      UPDATE users
      SET salary_percent = ${salary_percent}
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
