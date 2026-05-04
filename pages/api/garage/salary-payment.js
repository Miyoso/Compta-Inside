import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).end();
  const companyId = token.companyId;

  if (req.method === 'GET') {
    const [lastPayRow] = await sql`
      SELECT MAX(paid_at) AS last_paid, SUM(total_amount) AS total_paid
      FROM salary_payments WHERE company_id = ${companyId}
    `;
    const lastPaid = lastPayRow?.last_paid || null;

    // Total à payer depuis le dernier paiement
    const [totRow] = await sql`
      SELECT COALESCE(SUM(gq.grand_total * u.salary_percent / 100.0), 0) AS total_to_pay
      FROM garage_quotes gq JOIN users u ON u.id = gq.employee_id
      WHERE gq.company_id = ${companyId}
        AND gq.created_at > COALESCE(${lastPaid}::timestamptz, '1970-01-01'::timestamptz)
        AND u.status = 'active'
    `;

    const history = await sql`
      SELECT sp.*, u.name AS paid_by_name
      FROM salary_payments sp LEFT JOIN users u ON u.id = sp.paid_by
      WHERE sp.company_id = ${companyId}
      ORDER BY sp.paid_at DESC LIMIT 10
    `;

    return res.json({ lastPaid, totalToPay: Number(totRow.total_to_pay), history });
  }

  if (req.method === 'POST') {
    const [lastPayRow] = await sql`
      SELECT MAX(paid_at) AS last_paid FROM salary_payments WHERE company_id = ${companyId}
    `;
    const lastPaid = lastPayRow?.last_paid || null;

    const [totRow] = await sql`
      SELECT COALESCE(SUM(gq.grand_total * u.salary_percent / 100.0), 0) AS total_to_pay
      FROM garage_quotes gq JOIN users u ON u.id = gq.employee_id
      WHERE gq.company_id = ${companyId}
        AND gq.created_at > COALESCE(${lastPaid}::timestamptz, '1970-01-01'::timestamptz)
        AND u.status = 'active'
    `;
    const amount = Number(totRow.total_to_pay);
    if (amount <= 0) return res.status(400).json({ error: 'Aucun salaire à payer' });

    const weekStart = new Date().toISOString().slice(0, 10);
    await sql`
      INSERT INTO salary_payments (company_id, week_start, total_amount, paid_at, paid_by)
      VALUES (${companyId}, ${weekStart}, ${amount}, NOW(), ${token.id})
      ON CONFLICT (company_id, week_start)
      DO UPDATE SET total_amount = salary_payments.total_amount + EXCLUDED.total_amount, paid_at = NOW()
    `;
    return res.json({ ok: true, amount });
  }

  res.status(405).end();
}
