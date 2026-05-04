import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).end();
  const companyId = token.companyId;

  // Dernière date de paiement
  const [lastPayRow] = await sql`
    SELECT COALESCE(MAX(paid_at), '1970-01-01T00:00:00Z'::timestamptz) AS last_paid
    FROM salary_payments WHERE company_id = ${companyId}
  `;
  const lastPaid = lastPayRow.last_paid;

  const employees = await sql`
    SELECT
      u.id, u.name, u.role, u.salary_percent,
      COALESCE(SUM(gq.grand_total) FILTER (WHERE gq.created_at > ${lastPaid}), 0) AS period_revenue,
      COALESCE(SUM(gq.grand_total) FILTER (WHERE DATE_TRUNC('month', gq.created_at) = DATE_TRUNC('month', NOW())), 0) AS month_revenue,
      COUNT(gq.id)  FILTER (WHERE gq.created_at > ${lastPaid}) AS period_count
    FROM users u
    LEFT JOIN garage_quotes gq ON gq.employee_id = u.id AND gq.company_id = ${companyId}
    WHERE u.company_id = ${companyId} AND u.status = 'active'
    GROUP BY u.id, u.name, u.role, u.salary_percent
    ORDER BY u.role, u.name
  `;

  const result = employees.map(e => ({
    ...e,
    period_salary: Number(e.period_revenue) * Number(e.salary_percent || 0) / 100,
    month_salary:  Number(e.month_revenue)  * Number(e.salary_percent || 0) / 100,
  }));

  res.json({ employees: result, lastPaid });
}
