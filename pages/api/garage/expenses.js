import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).end();
  const companyId = token.companyId;

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT ge.*, u.name AS employee_name
      FROM garage_expenses ge LEFT JOIN users u ON u.id = ge.employee_id
      WHERE ge.company_id = ${companyId}
      ORDER BY ge.expense_date DESC, ge.created_at DESC LIMIT 200
    `;
    return res.json({ expenses: rows });
  }

  if (req.method === 'POST') {
    const { description, amount, category, expense_date, notes } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'description et amount requis' });
    const [row] = await sql`
      INSERT INTO garage_expenses (company_id, employee_id, description, amount, category, expense_date, notes)
      VALUES (${companyId}, ${token.id}, ${description}, ${amount}, ${category || 'Pièces'}, ${expense_date || new Date().toISOString().slice(0,10)}, ${notes || null})
      RETURNING *
    `;
    return res.status(201).json({ expense: row });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await sql`DELETE FROM garage_expenses WHERE id = ${id} AND company_id = ${companyId}`;
    return res.json({ ok: true });
  }

  res.status(405).end();
}
